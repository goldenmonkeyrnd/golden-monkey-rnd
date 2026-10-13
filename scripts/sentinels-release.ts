import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sha256 } from "./sentinels-archive";

export const repository = "goldenmonkeyrnd/sentinels";
export const stableTag = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export type Asset = { sha256: string; bytes: number };
export type Qualification = {
  version: 1; repository: typeof repository; tag: string; package_version: string; source_sha: string;
  qualification: { run_id: number; run_url: string; workflow_path: string; jobs: { id: number; name: string; conclusion: "success" }[] };
  native: { asset: string; python_versions: string[]; wheel_sha256: string };
  browser: { asset: string; wheel_sha256: string };
  assets: Record<string, Asset>;
};
export type Release = {
  tag: string; release_id: number; source_sha: string;
  archive: Asset & { url: string };
  qualification?: { file: string; sha256: string };
  legacy?: true;
};
export type Catalog = { schema_version: 1; releases: Release[] };
export type Pin = { schema_version: 1; archive_sha256: string };
export type Policy = { schema_version: 1; blocked: { release_id: number; tag: string; source_sha: string; reason: string; blocked_at: string }[] };
const digest = /^[a-f0-9]{64}$/;
const commit = /^[a-f0-9]{40}$/;
const integer = (x: unknown): x is number => Number.isSafeInteger(x) && Number(x) > 0;
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
function keys(value: unknown, expected: string[], label: string): asserts value is Record<string, unknown> {
  if (!object(value) || Object.keys(value).sort().join() !== [...expected].sort().join()) throw new Error(`Invalid ${label} fields`);
}
export function releaseURL(tag: string, file: string): string {
  return `https://github.com/${repository}/releases/download/${tag}/${file}`;
}
export function validateQualification(value: unknown, release: Release): Qualification {
  keys(value, ["version", "repository", "tag", "package_version", "source_sha", "qualification", "native", "browser", "assets"], "release qualification");
  if (value.version !== 1 || value.repository !== repository || value.tag !== release.tag || value.package_version !== release.tag.slice(1) || value.source_sha !== release.source_sha) throw new Error("Release qualification identity mismatch");
  keys(value.qualification, ["run_id", "run_url", "workflow_path", "jobs"], "qualification run");
  const run = value.qualification;
  if (!integer(run.run_id) || run.run_url !== `https://github.com/${repository}/actions/runs/${run.run_id}` || run.workflow_path !== ".github/workflows/release.yml" || !Array.isArray(run.jobs)) throw new Error("Invalid qualification run identity");
  const names = ["Qualify Python 3.12", "Qualify Python 3.13", "Qualify Python 3.14", "Qualify browser"];
  if (run.jobs.length !== names.length) throw new Error("Incomplete qualification jobs");
  const ids = new Set<number>();
  for (const job of run.jobs) {
    keys(job, ["id", "name", "conclusion"], "qualification job");
    if (!integer(job.id) || ids.has(job.id) || typeof job.name !== "string" || !names.includes(job.name) || job.conclusion !== "success") throw new Error("Invalid qualification job");
    ids.add(job.id); names.splice(names.indexOf(job.name), 1);
  }
  keys(value.native, ["asset", "python_versions", "wheel_sha256"], "native qualification");
  keys(value.browser, ["asset", "wheel_sha256"], "browser qualification");
  if (value.native.asset !== "native-qualification.json" || JSON.stringify(value.native.python_versions) !== JSON.stringify(["3.12", "3.13", "3.14"]) || value.browser.asset !== "browser-qualification.json") throw new Error("Incomplete native/browser qualification");
  if (!object(value.assets)) throw new Error("Invalid qualification asset table");
  const version = release.tag.slice(1);
  const filenames = [`goldenmonkey_sentinels-${version}-py3-none-any.whl`, `goldenmonkey_sentinels-${version}.tar.gz`, `sentinels-lab-${release.tag}.tar.gz`, `sentinels-source-${release.tag}.tar.gz`, "assets-manifest.json", "native-qualification.json", "browser-qualification.json", "LICENSE", "NOTICE", "THIRD_PARTY_NOTICES.txt"];
  if (Object.keys(value.assets).sort().join() !== filenames.sort().join()) throw new Error("Incomplete qualified release assets");
  for (const asset of Object.values(value.assets)) {
    keys(asset, ["sha256", "bytes"], "qualified asset");
    if (typeof asset.sha256 !== "string" || !digest.test(asset.sha256) || !integer(asset.bytes)) throw new Error("Invalid qualified asset digest/size");
  }
  const assets = value.assets as Record<string, Asset>;
  const wheel = assets[`goldenmonkey_sentinels-${version}-py3-none-any.whl`];
  const archive = assets[`sentinels-lab-${release.tag}.tar.gz`];
  if (value.native.wheel_sha256 !== wheel.sha256 || value.browser.wheel_sha256 !== wheel.sha256 || archive.sha256 !== release.archive.sha256 || archive.bytes !== release.archive.bytes) throw new Error("Qualified wheel or archive identity mismatch");
  return value as unknown as Qualification;
}
export function readState(root = "."): { pin: Pin; catalog: Catalog; policy: Policy } {
  const parse = (file: string): unknown => JSON.parse(readFileSync(resolve(root, "data", file), "utf8"));
  const pin = parse("sentinels-release.json"); keys(pin, ["schema_version", "archive_sha256"], "Sentinels pin");
  if (pin.schema_version !== 1 || typeof pin.archive_sha256 !== "string" || !digest.test(pin.archive_sha256)) throw new Error("Invalid Sentinels pin");
  const catalog = parse("sentinels-catalog.json"); keys(catalog, ["schema_version", "releases"], "Sentinels catalog");
  if (catalog.schema_version !== 1 || !Array.isArray(catalog.releases) || !catalog.releases.length) throw new Error("Empty Sentinels release catalog");
  const tags = new Set<string>(), hashes = new Set<string>(), releaseIDs = new Set<number>();
  for (const value of catalog.releases) {
    keys(value, value?.legacy === true ? ["tag", "release_id", "source_sha", "archive", "legacy"] : ["tag", "release_id", "source_sha", "archive", "qualification"], "catalog release");
    keys(value.archive, ["url", "sha256", "bytes"], "release archive");
    if (typeof value.tag !== "string" || !stableTag.test(value.tag) || !integer(value.release_id) || typeof value.source_sha !== "string" || !commit.test(value.source_sha) || typeof value.archive.sha256 !== "string" || !digest.test(value.archive.sha256) || !integer(value.archive.bytes) || value.archive.url !== releaseURL(value.tag, `sentinels-lab-${value.tag}.tar.gz`)) throw new Error("Invalid catalog release identity");
    if (tags.has(value.tag) || hashes.has(value.archive.sha256) || releaseIDs.has(value.release_id)) throw new Error("Duplicate catalog release identity");
    tags.add(value.tag); hashes.add(value.archive.sha256); releaseIDs.add(value.release_id);
    if (value.legacy === true) {
      if (value.tag !== "v0.1.0" || value.release_id !== 411052089 || value.source_sha !== "f1a48dac3e4a3acb9356db8caa71a069a2999db9" || value.archive.sha256 !== "8ca85db312e04f95c23bdad066746e9337294170bfefb06d78b19750b06aed88" || value.archive.bytes !== 8267400) throw new Error("Unrecognized grandfathered release");
    } else {
      keys(value.qualification, ["file", "sha256"], "qualification pin");
      if (value.qualification.file !== `data/sentinels-provenance/${value.tag}.json` || typeof value.qualification.sha256 !== "string" || !digest.test(value.qualification.sha256)) throw new Error("Invalid qualification record pin");
      const bytes = readFileSync(resolve(root, value.qualification.file));
      if (sha256(bytes) !== value.qualification.sha256) throw new Error("Qualification record checksum mismatch");
      validateQualification(JSON.parse(bytes.toString("utf8")), value as unknown as Release);
    }
  }
  if (!hashes.has(pin.archive_sha256)) throw new Error("Current release is absent from retained catalog");
  const policy = parse("sentinels-policy.json"); keys(policy, ["schema_version", "blocked"], "promotion policy");
  if (policy.schema_version !== 1 || !Array.isArray(policy.blocked)) throw new Error("Invalid promotion policy");
  const blockedIDs = new Set<number>();
  for (const item of policy.blocked) {
    keys(item, ["release_id", "tag", "source_sha", "reason", "blocked_at"], "blocked release");
    if (!integer(item.release_id) || blockedIDs.has(item.release_id) || typeof item.tag !== "string" || !stableTag.test(item.tag) || typeof item.source_sha !== "string" || !commit.test(item.source_sha) || typeof item.reason !== "string" || !item.reason.trim() || typeof item.blocked_at !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(item.blocked_at) || !Number.isFinite(Date.parse(item.blocked_at))) throw new Error("Invalid blocked release identity/reason");
    blockedIDs.add(item.release_id);
  }
  const current = catalog.releases.find((r: Release) => r.archive.sha256 === pin.archive_sha256);
  if (policy.blocked.some((r: { release_id: number; tag: string; source_sha: string }) => r.release_id === current.release_id || r.tag === current.tag || r.source_sha === current.source_sha)) throw new Error("Current release is blocked by promotion policy");
  return { pin: pin as Pin, catalog: catalog as Catalog, policy: policy as Policy };
}
