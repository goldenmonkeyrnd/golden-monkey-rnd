import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { maximumArchive, readArchive, sha256 } from "./sentinels-archive";
import { readState, validateQualification } from "./sentinels-release";

export async function download(url: string, maximum = maximumArchive): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !response.body) throw new Error(`Release download failed: HTTP ${response.status}`);
  const statedLength = response.headers.get("content-length");
  if (statedLength && Number(statedLength) > maximum) throw new Error("Release asset exceeds download limit");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value: chunk } = await reader.read();
    if (done) break;
    bytes += chunk.byteLength;
    if (bytes > maximum) throw new Error("Release asset exceeds download limit");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export async function importReleases(): Promise<void> {
  const { pin, catalog } = readState();
  // Validate every retained release before replacing any staged output. A clean
  // CI build recreates old immutable URLs; it never depends on ignored files.
  const releases: { paths: string[]; entries: Map<string, Buffer> }[] = [];
  for (const release of catalog.releases) {
    const cache = resolve("artifacts/sentinels", `${release.archive.sha256}.tar.gz`);
    let archive: Buffer;
    if (process.env.SENTINELS_ARCHIVE_PATH && release.archive.sha256 === pin.archive_sha256) archive = readFileSync(process.env.SENTINELS_ARCHIVE_PATH);
    else if (existsSync(cache)) archive = readFileSync(cache);
    else archive = await download(release.archive.url);
    if (archive.length !== release.archive.bytes || sha256(archive) !== release.archive.sha256) throw new Error("Sentinels archive checksum or size mismatch");
    const entries = readArchive(archive, release.tag);
    if (release.qualification) {
      const record = validateQualification(JSON.parse(readFileSync(release.qualification.file, "utf8")), release);
      const inventory = entries.get("assets-manifest.json")!;
      if (sha256(inventory) !== record.assets["assets-manifest.json"].sha256 || inventory.length !== record.assets["assets-manifest.json"].bytes) throw new Error("Qualified inventory checksum mismatch");
      const manifest = JSON.parse(entries.get("manifest.json")?.toString("utf8") ?? "null");
      const wheelFile = `goldenmonkey_sentinels-${release.tag.slice(1)}-py3-none-any.whl`;
      const wheel = entries.get(wheelFile);
      if (!wheel || manifest?.version !== release.tag.slice(1) || manifest.wheel?.file !== wheelFile || manifest.wheel?.sha256 !== record.assets[wheelFile].sha256 || sha256(wheel) !== record.assets[wheelFile].sha256 || wheel.length !== record.assets[wheelFile].bytes) throw new Error("Browser bundle differs from qualified wheel");
      if (manifest.source_commit !== release.source_sha || manifest.source_dirty !== false) throw new Error("Browser bundle differs from qualified source commit");
    } else {
      const wheel = entries.get("goldenmonkey_sentinels-0.1.0-py3-none-any.whl");
      if (!wheel || sha256(wheel) !== "b1e1ea848f400500d3db3f404f8f7f1e5220693ac042a44c59ecca7b29bac774") throw new Error("Grandfathered browser wheel checksum mismatch");
    }
    releases.push({ paths: [`_bundles/${release.archive.sha256}`, ...(release.legacy ? [release.tag] : [])], entries });
    mkdirSync(dirname(cache), { recursive: true });
    writeFileSync(cache, archive);
  }
  const destination = resolve("static/labs/sentinels");
  const stage = `${destination}.stage-${process.pid}`;
  mkdirSync(stage, { recursive: true });
  try {
    for (const release of releases) for (const path of release.paths) for (const [name, body] of release.entries) {
      const target = join(stage, path, name);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, body);
    }
    rmSync(destination, { recursive: true, force: true });
    renameSync(stage, destination);
  } finally { rmSync(stage, { recursive: true, force: true }); }
  console.log(`Imported ${releases.length} retained Sentinels releases; current archive ${pin.archive_sha256}.`);
}
if (import.meta.main) await importReleases();
