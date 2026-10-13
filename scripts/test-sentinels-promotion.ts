import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { preparePromotion, prepareRollback, type Promotion, type Remote } from "./promote-sentinels";
import { readState, releaseURL } from "./sentinels-release";
import { sha256 } from "./sentinels-archive";
import { importReleases } from "./import-sentinels";

const originalRoot = process.cwd();
const legacy = JSON.parse(readFileSync("data/sentinels-catalog.json", "utf8")).releases.find((r: { legacy?: boolean }) => r.legacy);
const cachedLegacy = resolve("artifacts/sentinels", `${legacy.archive.sha256}.tar.gz`);
function tar(files: Map<string, Buffer>): Buffer {
  const blocks: Buffer[] = [];
  for (const [name, bytes] of files) {
    const header = Buffer.alloc(512); header.write(name, 0, 100);
    header.write("0000644\0",100,8); header.write("0000000\0",108,8); header.write("0000000\0",116,8);
    header.write(bytes.length.toString(8).padStart(11,"0")+"\0",124,12); header.write("00000000000\0",136,12);
    header.fill(32,148,156); header.write("0",156,1); header.write("ustar\0",257,6); header.write("00",263,2);
    header.write(header.reduce((sum,byte)=>sum+byte,0).toString(8).padStart(6,"0")+"\0 ",148,8);
    blocks.push(header,bytes,Buffer.alloc((512-bytes.length%512)%512));
  }
  blocks.push(Buffer.alloc(1024)); return gzipSync(Buffer.concat(blocks));
}
function fixture(options: { nativeFailure?: boolean; browserMismatch?: boolean; unknownField?: boolean } = {}) {
  const tag = "v0.1.1", version = "0.1.1", source = "1".repeat(40), wheelName = `goldenmonkey_sentinels-${version}-py3-none-any.whl`;
  const wheel = Buffer.from("exact test wheel bytes"), wheelHash = sha256(wheel);
  const manifest = { version, wheel: { file: wheelName, sha256: wheelHash }, source_commit:source,source_dirty:false,release:{tag,url:`https://github.com/goldenmonkeyrnd/sentinels/releases/tag/${tag}`,source_url:`https://github.com/goldenmonkeyrnd/sentinels/tree/${source}`,source_archive_url:releaseURL(tag,`sentinels-source-${tag}.tar.gz`)} };
  const files = new Map<string, Buffer>([["index.html",Buffer.from("<!doctype html><title>Test workspace</title>")],["manifest.json",Buffer.from(JSON.stringify(manifest))],[wheelName,wheel]]);
  const inventory = Buffer.from(JSON.stringify({ version, files: Object.fromEntries([...files].map(([name,bytes])=>[name,{sha256:sha256(bytes),bytes:bytes.length}])) }));
  files.set("assets-manifest.json",inventory);
  const assets = new Map<string, Buffer>([
    [wheelName,wheel], [`goldenmonkey_sentinels-${version}.tar.gz`,Buffer.from("sdist")],
    [`sentinels-lab-${tag}.tar.gz`,tar(files)], [`sentinels-source-${tag}.tar.gz`,Buffer.from("source")],
    ["assets-manifest.json",inventory], ["LICENSE",Buffer.from("AGPL")], ["NOTICE",Buffer.from("Attribution")], ["THIRD_PARTY_NOTICES.txt",Buffer.from("Notices")],
    ["native-qualification.json",Buffer.from(JSON.stringify({ version:1,wheel:manifest.wheel,interpreters:["3.12.12","3.13.9","3.14.6"].map(python=>({python,tests:67,failures:options.nativeFailure?1:0,errors:0,skipped:0})) }))],
    ["browser-qualification.json",Buffer.from(JSON.stringify({ checker_version:version,tests:["real browser evidence"],fixture_cases:108,wheel_manifest:{...manifest,wheel:options.browserMismatch?{file:wheelName,sha256:"0".repeat(64)}:manifest.wheel} }))],
  ]);
  const jobs = ["Qualify Python 3.12","Qualify Python 3.13","Qualify Python 3.14","Qualify browser"].map((name,i)=>({id:i+10,name,conclusion:"success"}));
  const record: Record<string,unknown> = {version:1,repository:"goldenmonkeyrnd/sentinels",tag,package_version:version,source_sha:source,qualification:{run_id:123,run_url:"https://github.com/goldenmonkeyrnd/sentinels/actions/runs/123",workflow_path:".github/workflows/release.yml",jobs},native:{asset:"native-qualification.json",python_versions:["3.12","3.13","3.14"],wheel_sha256:wheelHash},browser:{asset:"browser-qualification.json",wheel_sha256:wheelHash},assets:Object.fromEntries([...assets].map(([name,bytes])=>[name,{sha256:sha256(bytes),bytes:bytes.length}]))};
  if(options.unknownField)record.extra="untrusted";
  assets.set("release-qualification.json",Buffer.from(JSON.stringify(record)));
  const published = { id: 411052090, tag_name:tag, draft:false, prerelease:false, immutable:true, assets:[...assets].map(([name,bytes])=>({name,size:bytes.length,digest:`sha256:${sha256(bytes)}`,browser_download_url:releaseURL(tag,name)})) };
  const run = {id:123,head_sha:source,path:".github/workflows/release.yml",event:"push",head_branch:tag};
  const input: Promotion = {tag,release_id:published.id,source_sha:source,qualification_sha256:sha256(assets.get("release-qualification.json")!)};
  const remote: Remote = { async json<T>(path: string): Promise<T> {
    let value: unknown;
    if(path===`releases/${published.id}`)value=published;
    else if(path.startsWith("releases?"))value=[published];
    else if(path===`git/ref/tags/${tag}`)value={ref:`refs/tags/${tag}`,object:{type:"commit",sha:source}};
    else if(path===`actions/runs/${run.id}`)value=run;
    else if(path===`actions/runs/${run.id}/jobs?per_page=100`)value={total_count:jobs.length,jobs:jobs.map(j=>({...j,status:"completed"}))};
    else throw new Error(`Unexpected provenance request ${path}`);
    return value as T;
  }, async asset(url: string) { const name=url.split("/").at(-1)!; assert.ok(assets.has(name)); return assets.get(name)!; } };
  return { input,remote,published,run,jobs,assets,record };
}
function freshRoot(): string {
  const root=mkdtempSync(join(tmpdir(),"sentinels-promotion-")); mkdirSync(join(root,"data"));
  writeFileSync(join(root,"data/sentinels-release.json"),JSON.stringify({schema_version:1,archive_sha256:legacy.archive.sha256}));
  writeFileSync(join(root,"data/sentinels-catalog.json"),JSON.stringify({schema_version:1,releases:[legacy]}));
  writeFileSync(join(root,"data/sentinels-policy.json"),JSON.stringify({schema_version:1,blocked:[]}));
  return root;
}
const tests: {name:string;reason:RegExp;options?:Parameters<typeof fixture>[0];alter?:(f:ReturnType<typeof fixture>)=>void}[] = [
  {name:"dispatch checksum mismatch",reason:/qualification checksum mismatch/,alter:f=>{f.input.qualification_sha256="0".repeat(64)}},
  {name:"prerelease",reason:/published stable release/,alter:f=>{f.published.prerelease=true}},
  {name:"mutable release",reason:/published immutable release/,alter:f=>{f.published.immutable=false}},
  {name:"wrong source tag",reason:/source tag differs/,alter:f=>{const original=f.remote.json;f.remote.json=async<T>(p:string)=>p.startsWith("git/ref/")?{ref:`refs/tags/${f.input.tag}`,object:{type:"commit",sha:"2".repeat(40)}}as T:original<T>(p)}},
  {name:"wrong qualification workflow",reason:/exact source tag\/workflow/,alter:f=>{f.run.path=".github/workflows/untrusted.yml"}},
  {name:"failed browser job",reason:/Qualification job has not passed/,alter:f=>{f.jobs[3].conclusion="failure"}},
  {name:"changed released bytes",reason:/asset checksum mismatch/,alter:f=>{f.assets.set("NOTICE",Buffer.from("different"))}},
  {name:"duplicate release asset",reason:/Duplicate or foreign/,alter:f=>{f.published.assets.push(f.published.assets[0])}},
  {name:"unknown record fields",reason:/Invalid release qualification fields/,options:{unknownField:true}},
  {name:"failed native evidence",reason:/Native qualification incomplete/,options:{nativeFailure:true}},
  {name:"different browser wheel",reason:/Invalid browser qualification evidence/,options:{browserMismatch:true}},
  {name:"newer stable takes priority",reason:/newer qualified stable/,alter:f=>{const original=f.remote.json;f.remote.json=async<T>(p:string)=>p.startsWith("releases?")?[{...f.published,id:f.published.id+1,tag_name:"v0.2.0"}]as T:original<T>(p)}},
];
for(const test of tests){
  const root=freshRoot(),f=fixture(test.options);test.alter?.(f);
  const before=readFileSync(join(root,"data/sentinels-release.json"));
  try { await assert.rejects(preparePromotion(f.input,f.remote,root),test.reason,test.name); assert.ok(readFileSync(join(root,"data/sentinels-release.json")).equals(before)); assert.equal(existsSync(join(root,"data/sentinels-provenance")),false); }
  finally { rmSync(root,{recursive:true,force:true}); }
}
const root=freshRoot(),f=fixture();
try {
  assert.equal(await preparePromotion(f.input,f.remote,root),true);
  assert.equal(readState(root).catalog.releases.length,2);
  assert.equal(await preparePromotion(f.input,f.remote,root),false,"verified duplicate dispatch is idempotent");
  const catalogFile=join(root,"data/sentinels-catalog.json"),retainedBytes=readFileSync(catalogFile),withoutLegacy=JSON.parse(retainedBytes.toString());
  withoutLegacy.releases=withoutLegacy.releases.filter((r:{legacy?:boolean})=>!r.legacy);writeFileSync(catalogFile,JSON.stringify(withoutLegacy));
  assert.throws(()=>readState(root),/preserve the original v0.1.0 assets/);writeFileSync(catalogFile,retainedBytes);
  if(existsSync(cachedLegacy)){
    mkdirSync(join(root,"artifacts/sentinels"),{recursive:true});writeFileSync(join(root,"artifacts/sentinels",`${legacy.archive.sha256}.tar.gz`),readFileSync(cachedLegacy));
    process.chdir(root);await importReleases();process.chdir(originalRoot);
    assert.ok(existsSync(join(root,"static/labs/sentinels/_bundles",legacy.archive.sha256,"worker.js")));
    assert.ok(readFileSync(join(root,"static/labs/sentinels/v0.1.0/worker.js")).equals(readFileSync(join(root,"static/labs/sentinels/_bundles",legacy.archive.sha256,"worker.js"))));
  }
  prepareRollback(legacy.archive.sha256,"Browser regression discovered after release",root);
  const state=readState(root);assert.equal(state.pin.archive_sha256,legacy.archive.sha256);assert.equal(state.catalog.releases.length,2);assert.equal(state.policy.blocked[0].release_id,f.input.release_id);
  await assert.rejects(preparePromotion(f.input,f.remote,root),/persistently blocked/);
  const catalogPath=join(root,"data/sentinels-catalog.json"),catalog=JSON.parse(readFileSync(catalogPath,"utf8"));catalog.releases[1].archive.sha256="f".repeat(64);writeFileSync(catalogPath,JSON.stringify(catalog));assert.throws(()=>readState(root),/archive identity mismatch/);
} finally { process.chdir(originalRoot);rmSync(root,{recursive:true,force:true}); }
console.log(`Verified promotion acceptance, ${tests.length} rejection controls, idempotence, immutable catalog, retained assets and blocked rollback.`);
