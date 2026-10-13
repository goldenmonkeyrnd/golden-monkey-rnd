import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { sha256 } from "./sentinels-archive";

function inventory(): Record<string, string> {
  const files: Record<string, string> = {};
  function walk(directory: string): void {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (path !== "public/build-proof.json") files[relative("public", path)] = sha256(readFileSync(path));
    }
  }
  walk("public"); return files;
}
const operation = process.argv[2], commit = process.argv[3];
if (!/^[a-f0-9]{40}$/.test(commit ?? "")) throw new Error("Build proof requires the exact website commit");
if (operation === "write") writeFileSync("public/build-proof.json", `${JSON.stringify({ version: 1, source_sha: commit, files: inventory() }, null, 2)}\n`);
else if (operation === "verify") {
  const proof = JSON.parse(readFileSync("public/build-proof.json", "utf8"));
  if (proof.version !== 1 || proof.source_sha !== commit || JSON.stringify(proof.files) !== JSON.stringify(inventory())) throw new Error("Checked website artifact changed or belongs to a different commit");
} else throw new Error("Expected build proof write or verify operation");
