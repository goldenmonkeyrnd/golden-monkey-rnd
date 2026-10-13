import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { download } from "./import-sentinels";
import { readArchive, sha256 } from "./sentinels-archive";
import { readState, releaseURL, repository, stableTag, validateQualification, type Release } from "./sentinels-release";

type GitHubAsset = { name: string; browser_download_url: string; size: number; digest: string | null };
type GitHubRelease = { id: number; tag_name: string; draft: boolean; prerelease: boolean; assets: GitHubAsset[] };
type Run = { id: number; head_sha: string; path: string; event: string; head_branch: string };
type Job = { id: number; name: string; status: string; conclusion: string | null };
export type Promotion = { tag: string; release_id: number; source_sha: string; qualification_sha256: string };
export type Remote = { json: <T>(path: string) => Promise<T>; asset: (url: string) => Promise<Buffer> };
export const github: Remote = {
  async json<T>(path: string): Promise<T> {
    const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`GitHub provenance request failed: ${path} HTTP ${response.status}`);
    return response.json() as Promise<T>;
  },
  asset: download,
};
const jsonBytes = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const newer = (left: string, right: string): boolean => {
  const a = left.slice(1).split(".").map(BigInt), b = right.slice(1).split(".").map(BigInt);
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return false;
};
export async function preparePromotion(input: Promotion, remote: Remote = github, root = "."): Promise<boolean> {
  if (!stableTag.test(input.tag) || !Number.isSafeInteger(input.release_id) || input.release_id < 1 || !/^[a-f0-9]{40}$/.test(input.source_sha) || !/^[a-f0-9]{64}$/.test(input.qualification_sha256)) throw new Error("Invalid release dispatch identity");
  const { pin, catalog, policy } = readState(root);
  if (policy.blocked.some(r => r.release_id === input.release_id || r.tag === input.tag || r.source_sha === input.source_sha)) throw new Error("Release is persistently blocked by site policy");
  const published = await remote.json<GitHubRelease>(`releases/${input.release_id}`);
  if (published.id !== input.release_id || published.tag_name !== input.tag || published.draft || published.prerelease) throw new Error("Dispatch does not identify a published stable release");
  const current = catalog.releases.find(r => r.archive.sha256 === pin.archive_sha256)!;
  if (newer(current.tag, input.tag)) throw new Error("Delayed dispatch cannot downgrade the current release");
  // A newer stable release carrying a qualification record takes priority. Never
  // replace the current pin with a delayed older publication event.
  let exhausted = false;
  for (let page = 1; page <= 10; page++) {
    const releases = await remote.json<GitHubRelease[]>(`releases?per_page=100&page=${page}`);
    if (releases.some(r => !r.draft && !r.prerelease && stableTag.test(r.tag_name) && !policy.blocked.some(b => b.release_id === r.id || b.tag === r.tag_name) && r.assets.some(a => a.name === "release-qualification.json") && newer(r.tag_name, input.tag))) throw new Error("A newer qualified stable release takes priority");
    if (releases.length < 100) { exhausted = true; break; }
  }
  if (!exhausted) throw new Error("Release listing exceeded the bounded provenance scope");
  const assetByName = new Map<string, GitHubAsset>();
  for (const asset of published.assets) {
    if (assetByName.has(asset.name) || asset.browser_download_url !== releaseURL(input.tag, asset.name)) throw new Error("Duplicate or foreign release asset");
    assetByName.set(asset.name, asset);
  }
  const recordAsset = assetByName.get("release-qualification.json");
  if (!recordAsset || recordAsset.size > 256 * 1024) throw new Error("Missing or oversized release qualification record");
  const recordBytes = await remote.asset(recordAsset.browser_download_url);
  if (recordBytes.length !== recordAsset.size || sha256(recordBytes) !== input.qualification_sha256 || (recordAsset.digest && recordAsset.digest !== `sha256:${input.qualification_sha256}`)) throw new Error("Release qualification checksum mismatch");
  const raw = JSON.parse(recordBytes.toString("utf8"));
  const archiveName = `sentinels-lab-${input.tag}.tar.gz`;
  const release: Release = { tag: input.tag, release_id: input.release_id, source_sha: input.source_sha, archive: { url: releaseURL(input.tag, archiveName), sha256: raw.assets?.[archiveName]?.sha256, bytes: raw.assets?.[archiveName]?.bytes }, qualification: { file: `data/sentinels-provenance/${input.tag}.json`, sha256: input.qualification_sha256 } };
  const record = validateQualification(raw, release);
  const tag = await remote.json<{ ref: string; object: { type: string; sha: string } }>(`git/ref/tags/${input.tag}`);
  if (tag.ref !== `refs/tags/${input.tag}`) throw new Error("Published source tag differs from qualified commit");
  let target = tag.object;
  for (let depth = 0; target.type === "tag" && depth < 5; depth++) {
    const annotated = await remote.json<{ object: { type: string; sha: string } }>(`git/tags/${target.sha}`);
    target = annotated.object;
  }
  if (target.type !== "commit" || target.sha !== input.source_sha) throw new Error("Published source tag differs from qualified commit");
  const run = await remote.json<Run>(`actions/runs/${record.qualification.run_id}`);
  if (run.id !== record.qualification.run_id || run.head_sha !== input.source_sha || run.path !== record.qualification.workflow_path || run.event !== "push" || run.head_branch !== input.tag) throw new Error("Qualification run differs from the exact source tag/workflow");
  const jobList = await remote.json<{ jobs: Job[]; total_count: number }>(`actions/runs/${run.id}/jobs?per_page=100`);
  if (jobList.total_count > 100) throw new Error("Qualification job inventory exceeded analysis scope");
  for (const expected of record.qualification.jobs) {
    const actual = jobList.jobs.find(j => j.id === expected.id);
    if (!actual || actual.name !== expected.name || actual.status !== "completed" || actual.conclusion !== "success") throw new Error(`Qualification job has not passed: ${expected.name}`);
  }
  const downloaded = new Map<string, Buffer>([["release-qualification.json", recordBytes]]);
  for (const [name, qualified] of Object.entries(record.assets)) {
    const asset = assetByName.get(name);
    if (!asset || asset.size !== qualified.bytes || (asset.digest && asset.digest !== `sha256:${qualified.sha256}`)) throw new Error(`Release asset metadata differs from qualification: ${name}`);
    const bytes = await remote.asset(asset.browser_download_url);
    if (bytes.length !== qualified.bytes || sha256(bytes) !== qualified.sha256) throw new Error(`Release asset checksum mismatch: ${name}`);
    downloaded.set(name, bytes);
  }
  const entries = readArchive(downloaded.get(archiveName)!, input.tag);
  if (!entries.get("assets-manifest.json")?.equals(downloaded.get("assets-manifest.json")!)) throw new Error("Released inventory differs from archive inventory");
  const manifest = JSON.parse(entries.get("manifest.json")?.toString("utf8") ?? "null");
  const wheelName = `goldenmonkey_sentinels-${input.tag.slice(1)}-py3-none-any.whl`;
  if (!entries.get(wheelName)?.equals(downloaded.get(wheelName)!) || manifest?.version !== input.tag.slice(1) || manifest.wheel?.file !== wheelName || manifest.wheel?.sha256 !== record.assets[wheelName].sha256) throw new Error("Browser does not contain the exact qualified native wheel");
  if (manifest.source_commit !== input.source_sha || manifest.source_dirty !== false || manifest.release?.tag !== input.tag || manifest.release.url !== `https://github.com/${repository}/releases/tag/${input.tag}` || manifest.release.source_url !== `https://github.com/${repository}/tree/${input.source_sha}` || manifest.release.source_archive_url !== releaseURL(input.tag, `sentinels-source-${input.tag}.tar.gz`)) throw new Error("Browser provenance differs from qualified source/release");
  const native = JSON.parse(downloaded.get("native-qualification.json")!.toString("utf8"));
  if (native.version !== 1 || native.wheel?.file !== wheelName || native.wheel?.sha256 !== record.native.wheel_sha256 || !Array.isArray(native.interpreters) || native.interpreters.length !== 3) throw new Error("Invalid native qualification evidence");
  for (const version of ["3.12", "3.13", "3.14"]) {
    const item = native.interpreters.find((p: { python: string }) => p.python?.startsWith(`${version}.`));
    if (!item || !Number.isSafeInteger(item.tests) || item.tests < 1 || item.failures !== 0 || item.errors !== 0 || item.skipped !== 0) throw new Error(`Native qualification incomplete: ${version}`);
  }
  const browser = JSON.parse(downloaded.get("browser-qualification.json")!.toString("utf8"));
  if (browser.checker_version !== input.tag.slice(1) || browser.wheel_manifest?.wheel?.file !== wheelName || browser.wheel_manifest?.wheel?.sha256 !== record.browser.wheel_sha256 || !Array.isArray(browser.tests) || !browser.tests.length || !Number.isSafeInteger(browser.fixture_cases) || browser.fixture_cases < 1) throw new Error("Invalid browser qualification evidence");
  const retained = catalog.releases.find(r => r.tag === input.tag || r.release_id === input.release_id);
  if (retained && JSON.stringify(retained) !== JSON.stringify(release)) throw new Error("Existing retained release identity is immutable");
  if (current.archive.sha256 === release.archive.sha256) return false;
  // All remote evidence is verified before changing any tracked adoption state.
  mkdirSync(resolve(root, "data/sentinels-provenance"), { recursive: true });
  writeFileSync(resolve(root, release.qualification!.file), recordBytes);
  mkdirSync(resolve(root, "artifacts/sentinels"), { recursive: true });
  writeFileSync(resolve(root, "artifacts/sentinels", `${release.archive.sha256}.tar.gz`), downloaded.get(archiveName)!);
  if (!retained) catalog.releases.push(release);
  writeFileSync(resolve(root, "data/sentinels-catalog.json"), jsonBytes(catalog));
  writeFileSync(resolve(root, "data/sentinels-release.json"), jsonBytes({ schema_version: 1, archive_sha256: release.archive.sha256 }));
  readState(root);
  return true;
}
export function prepareRollback(archive: string, reason: string, root = "."): void {
  if (!/^[a-f0-9]{64}$/.test(archive) || !reason.trim()) throw new Error("Rollback requires a retained archive digest and explicit reason");
  const { pin, catalog, policy } = readState(root);
  const replacement = catalog.releases.find(r => r.archive.sha256 === archive);
  const current = catalog.releases.find(r => r.archive.sha256 === pin.archive_sha256)!;
  if (!replacement || archive === pin.archive_sha256 || policy.blocked.some(r => r.release_id === replacement.release_id || r.tag === replacement.tag || r.source_sha === replacement.source_sha)) throw new Error("Rollback target is absent, current, or blocked");
  if (!policy.blocked.some(r => r.release_id === current.release_id)) policy.blocked.push({ release_id: current.release_id, tag: current.tag, source_sha: current.source_sha, reason: reason.trim(), blocked_at: new Date().toISOString() });
  writeFileSync(resolve(root, "data/sentinels-policy.json"), jsonBytes(policy));
  writeFileSync(resolve(root, "data/sentinels-release.json"), jsonBytes({ schema_version: 1, archive_sha256: archive }));
  readState(root);
}
if (import.meta.main) {
  const operation = process.env.SENTINELS_OPERATION;
  if (operation === "promote") await preparePromotion({ tag: process.env.SENTINELS_TAG ?? "", release_id: Number(process.env.SENTINELS_RELEASE_ID), source_sha: process.env.SENTINELS_SOURCE_SHA ?? "", qualification_sha256: process.env.SENTINELS_QUALIFICATION_SHA256 ?? "" });
  else if (operation === "rollback") prepareRollback(process.env.SENTINELS_ROLLBACK_ARCHIVE ?? "", process.env.SENTINELS_ROLLBACK_REASON ?? "");
  else throw new Error("Expected explicit promote or rollback operation");
}
