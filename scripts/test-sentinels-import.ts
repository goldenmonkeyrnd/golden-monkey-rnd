import { readArchive } from "./sentinels-archive";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";

type Entry = { name: string; data: Buffer; kind?: string };
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");
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
const cases: {name:string;entries:Entry[];success?:boolean;badHeader?:boolean;reason?:string}[] = [
  {name:"valid pinned archive",entries:valid,success:true},
  {name:"tar header checksum mismatch",entries:valid,badHeader:true,reason:"Invalid tar header checksum"},
  {name:"parent traversal",entries:[...valid,{name:"../escaped.txt",data:Buffer.from("escape")}],reason:"Unsafe or duplicate archive path"},
  {name:"absolute path",entries:[...valid,{name:"/escaped.txt",data:Buffer.from("escape")}],reason:"Unsafe or duplicate archive path"},
  {name:"symbolic link",entries:[...valid,{name:"linked",data:Buffer.alloc(0),kind:"2"}],reason:"link or unsupported entry"},
  {name:"duplicate path",entries:[...valid,valid[0]],reason:"Unsafe or duplicate archive path"},
  {name:"oversized asset",entries:[...valid,{name:"large.bin",data:Buffer.alloc(25*1024*1024+1)}],reason:"Invalid asset size"},
  {name:"inventory mismatch",entries:[...valid,{name:"unlisted.js",data:Buffer.from("extra")}],reason:"inventory differs from archive files"},
];
for (const test of cases) {
  let archive = tar(test.entries);
  if (test.badHeader) { const bytes=gunzipSync(archive);bytes[0]^=1;archive=gzipSync(bytes); }
  try {
    const entries = readArchive(archive, "v0.1.0");
    if (!test.success) throw new Error(`${test.name}: rejected archive was accepted`);
    if (!entries.get("index.html")?.equals(bytes)) throw new Error("Valid archive was not read exactly");
  } catch (error) {
    if (test.success || !String(error).includes(test.reason!)) throw error;
  }
}
console.log(`Verified Sentinels archive acceptance and ${cases.length-1} rejection controls.`);
