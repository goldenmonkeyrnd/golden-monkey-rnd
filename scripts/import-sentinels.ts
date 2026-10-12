import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

type Release = { version: string; url: string; sha256: string };
const manifestPath = resolve("data/sentinels-release.json");
const release: Release = JSON.parse(readFileSync(manifestPath, "utf8"));
if (Object.keys(release).sort().join(",") !== "sha256,url,version" ||
    !/^v\d+\.\d+\.\d+$/.test(release.version) || !/^[a-f0-9]{64}$/.test(release.sha256) ||
    release.url !== `https://github.com/goldenmonkeyrnd/sentinels/releases/download/${release.version}/sentinels-lab-${release.version}.tar.gz`) {
  throw new Error("Invalid pinned Sentinels release manifest");
}
const maximumAsset = 25 * 1024 * 1024;
const maximumArchive = 100 * 1024 * 1024;
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const cache = resolve("artifacts/sentinels", `${release.sha256}.tar.gz`);
let archive: Buffer;
if (process.env.SENTINELS_ARCHIVE_PATH) {
  // Local qualification uses the identical pinned bytes; it never overrides the digest.
  archive = readFileSync(process.env.SENTINELS_ARCHIVE_PATH);
} else if (existsSync(cache)) {
  archive = readFileSync(cache);
} else {
  const response = await fetch(release.url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Sentinels release download failed: HTTP ${response.status}`);
  const statedLength = response.headers.get("content-length");
  if (statedLength && Number(statedLength) > maximumArchive) throw new Error("Sentinels archive exceeds download limit");
  if (!response.body) throw new Error("Sentinels release download has no body");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > maximumArchive) throw new Error("Sentinels archive exceeds download limit");
    chunks.push(chunk);
  }
  archive = Buffer.concat(chunks);
}
if (archive.length > maximumArchive || sha256(archive) !== release.sha256) {
  throw new Error("Sentinels archive checksum or size mismatch");
}

// Read USTAR ourselves so tar extraction cannot follow links or escape the stage.
// Release bundles contain regular files/directories only, with no extension records.
const tar = gunzipSync(archive, { maxOutputLength: maximumArchive });
const decoder = new TextDecoder("utf-8", { fatal: true });
const text = (block: Buffer, start: number, length: number) => {
  const slice = block.subarray(start, start + length);
  const firstNull = slice.indexOf(0);
  return decoder.decode(firstNull === -1 ? slice : slice.subarray(0, firstNull));
};
const octal = (value: string, label: string) => {
  const clean = value.trim();
  if (!/^[0-7]+$/.test(clean)) throw new Error(`Invalid tar ${label}`);
  const number = parseInt(clean, 8);
  if (!Number.isSafeInteger(number)) throw new Error(`Oversized tar ${label}`);
  return number;
};
const entries = new Map<string, Buffer>();
const directories = new Set<string>();
let ended = false;
let offset = 0;
while (offset + 512 <= tar.length) {
  const header = tar.subarray(offset, offset + 512);
  if (header.every(byte => byte === 0)) { ended = true; break; }
  const expectedChecksum = octal(text(header, 148, 8), "checksum");
  const actualChecksum = header.reduce((sum, byte, i) => sum + (i >= 148 && i < 156 ? 32 : byte), 0);
  if (expectedChecksum !== actualChecksum) throw new Error("Invalid tar header checksum");
  if (text(header, 257, 6) !== "ustar") throw new Error("Sentinels release requires USTAR format");
  const prefix = text(header, 345, 155);
  let name = `${prefix ? `${prefix}/` : ""}${text(header, 0, 100)}`;
  name = name.replace(/^(\.\/)+/, "").replace(/\/$/, "");
  const kind = text(header, 156, 1) || "0";
  const size = octal(text(header, 124, 12), "size");
  if (!["0", "5"].includes(kind)) throw new Error("Sentinels archive contains a link or unsupported entry");
  if (size > maximumAsset || (kind === "5" && size !== 0)) throw new Error(`Invalid asset size: ${name}`);
  if (kind === "5" && name === ".") { offset += 512; continue; }
  if (!name || name.startsWith("/") || name.includes("\\") || name.includes(":") ||
      name.split("/").some(part => !part || part === "." || part === "..") ||
      entries.has(name) || directories.has(name)) throw new Error(`Unsafe or duplicate archive path: ${name}`);
  const bodyStart = offset + 512;
  const next = bodyStart + Math.ceil(size / 512) * 512;
  if (next > tar.length) throw new Error("Truncated Sentinels archive");
  if (kind === "0") entries.set(name, tar.subarray(bodyStart, bodyStart + size));
  else directories.add(name);
  if (entries.size + directories.size > 500) throw new Error("Sentinels archive has too many entries");
  offset = next;
}
if (!ended || !tar.subarray(offset).every(byte => byte === 0)) throw new Error("Missing tar terminator or trailing archive content");
if (!entries.has("index.html") || !entries.has("assets-manifest.json")) throw new Error("Incomplete Sentinels browser release");
for (const name of entries.keys()) {
  let parent = dirname(name);
  while (parent !== ".") {
    if (entries.has(parent)) throw new Error(`Archive file shadows a parent directory: ${parent}`);
    parent = dirname(parent);
  }
}
const metadata = JSON.parse(entries.get("assets-manifest.json")!.toString("utf8"));
if (metadata.version !== release.version.slice(1)) throw new Error("Browser bundle version differs from pinned release");
if (!metadata.files || typeof metadata.files !== "object" || Array.isArray(metadata.files)) throw new Error("Browser bundle has no asset inventory");
if (Object.keys(metadata.files).sort().join("\n") !== [...entries.keys()].filter(name => name !== "assets-manifest.json").sort().join("\n")) {
  throw new Error("Browser bundle inventory differs from archive files");
}
for (const [name, body] of entries) {
  if (name === "assets-manifest.json") continue;
  if (metadata.files[name]?.sha256 !== sha256(body) || metadata.files[name]?.bytes !== body.length) {
    throw new Error(`Browser bundle inventory mismatch: ${name}`);
  }
}

const destination = resolve("static/labs/sentinels", release.version);
const stage = `${destination}.stage-${process.pid}`;
mkdirSync(stage, { recursive: true });
try {
  for (const [name, body] of entries) {
    const target = join(stage, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body);
  }
  rmSync(destination, { recursive: true, force: true });
  renameSync(stage, destination);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
mkdirSync(dirname(cache), { recursive: true });
writeFileSync(cache, archive);
console.log(`Imported Sentinels ${release.version}: ${entries.size} pinned assets (${release.sha256}).`);
