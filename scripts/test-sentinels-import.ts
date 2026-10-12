import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

type Entry = { name: string; data: Buffer; kind?: string };
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const script = resolve("scripts/import-sentinels.ts");
const bytes = Buffer.from("<!doctype html><title>Qualified test archive</title>");
const metadata = Buffer.from(JSON.stringify({version:"0.1.0",files:{"index.html":{sha256:hash(bytes),bytes:bytes.length}}}));
const valid: Entry[] = [{name:"index.html",data:bytes},{name:"assets-manifest.json",data:metadata}];
function tar(entries: Entry[]): Buffer {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    const header = Buffer.alloc(512);
    header.write(entry.name,0,100,"utf8");
    header.write("0000644\0",100,8,"ascii");
    header.write("0000000\0",108,8,"ascii");
    header.write("0000000\0",116,8,"ascii");
    header.write(entry.data.length.toString(8).padStart(11,"0")+"\0",124,12,"ascii");
    header.write("00000000000\0",136,12,"ascii");
    header.fill(32,148,156);
    header.write(entry.kind ?? "0",156,1,"ascii");
    header.write("ustar\0",257,6,"ascii");
    header.write("00",263,2,"ascii");
    const checksum = header.reduce((sum,value)=>sum+value,0);
    header.write(checksum.toString(8).padStart(6,"0")+"\0 ",148,8,"ascii");
    blocks.push(header,entry.data,Buffer.alloc((512-entry.data.length%512)%512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}
const cases: {name:string;entries:Entry[];success?:boolean;wrongHash?:boolean;reason?:string}[] = [
  {name:"valid pinned archive",entries:valid,success:true},
  {name:"checksum mismatch",entries:valid,wrongHash:true,reason:"checksum or size mismatch"},
  {name:"parent traversal",entries:[...valid,{name:"../escaped.txt",data:Buffer.from("escape")}],reason:"Unsafe or duplicate archive path"},
  {name:"absolute path",entries:[...valid,{name:"/escaped.txt",data:Buffer.from("escape")}],reason:"Unsafe or duplicate archive path"},
  {name:"symbolic link",entries:[...valid,{name:"linked",data:Buffer.alloc(0),kind:"2"}],reason:"link or unsupported entry"},
  {name:"duplicate path",entries:[...valid,valid[0]],reason:"Unsafe or duplicate archive path"},
  {name:"oversized asset",entries:[...valid,{name:"large.bin",data:Buffer.alloc(25*1024*1024+1)}],reason:"Invalid asset size"},
  {name:"inventory mismatch",entries:[...valid,{name:"unlisted.js",data:Buffer.from("extra")}],reason:"inventory differs from archive files"},
];
for (const test of cases) {
  const root = mkdtempSync(join(tmpdir(),"sentinels-import-"));
  try {
    const archive = tar(test.entries);
    mkdirSync(join(root,"data"));
    writeFileSync(join(root,"bundle.tar.gz"),archive);
    writeFileSync(join(root,"data/sentinels-release.json"),JSON.stringify({version:"v0.1.0",url:"https://github.com/goldenmonkeyrnd/sentinels/releases/download/v0.1.0/sentinels-lab-v0.1.0.tar.gz",sha256:test.wrongHash?"0".repeat(64):hash(archive)}));
    const run = Bun.spawnSync([process.execPath,script],{cwd:root,env:{...process.env,SENTINELS_ARCHIVE_PATH:join(root,"bundle.tar.gz")}});
    if ((run.exitCode===0)!==Boolean(test.success)) throw new Error(`${test.name}: unexpected exit ${run.exitCode}\n${run.stderr.toString()}`);
    if (test.reason && !run.stderr.toString().includes(test.reason)) throw new Error(`${test.name}: rejected for the wrong reason\n${run.stderr.toString()}`);
    const staged=join(root,"static/labs/sentinels/v0.1.0/index.html");
    if (test.success && (!existsSync(staged) || !readFileSync(staged).equals(bytes))) throw new Error("Valid archive was not staged exactly");
    if (!test.success && existsSync(staged)) throw new Error(`${test.name}: rejected archive changed staged output`);
    if (existsSync(join(root,"escaped.txt"))) throw new Error("Archive escaped the stage");
  } finally { rmSync(root,{recursive:true,force:true}); }
}
console.log(`Verified Sentinels importer acceptance and ${cases.length-1} rejection controls.`);
