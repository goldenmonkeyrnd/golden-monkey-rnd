import { readState } from "./sentinels-release";
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const root='public';
const required=['index.html','summit/2026/index.html','work/civicatlas/index.html','work/censa/index.html','work/agentic-engineering/index.html','about/index.html','resume/index.html','privacy/index.html','404.html','labs/index.html','labs/sentinels/index.html','downloads/Pauline_Yeary_Resume.pdf','media/sentinel-walkthrough.webm','media/sentinel-walkthrough.vtt','media/sentinel-transcript.txt'];
for(const name of required) if(!existsSync(join(root,name))) throw new Error(`Missing launch artifact: ${name}`);
const files: string[]=[];
function walk(path:string){for(const name of readdirSync(path)){const p=join(path,name);if(statSync(p).isDirectory())walk(p);else files.push(p);}}walk(root);
for(const path of files.filter(p=>p.endsWith('.html'))){const html=readFileSync(path,'utf8');
 if(/tel:|coming soon|placeholder/i.test(html))throw new Error(`Unapproved public content: ${path}`);
 for(const match of html.matchAll(/(?:href|src)=(?:["']([^"']+)["']|([^\s>]+))/g)){const href=match[1] || match[2];if(!href.startsWith('/')||href.startsWith('//'))continue;const target=href.split(/[?#]/)[0];if(!target)continue;if(!existsSync(join(root,target))&&!existsSync(join(root,target,'index.html')))throw new Error(`Broken local link ${href} in ${path}`);}
}
const home=readFileSync(join(root,'index.html'),'utf8');
if(!home.includes('Pauline Yeary')||!home.includes('atlas.goldenmonkey.dev')||!home.includes('goldenmonkeyrnd@gmail.com'))throw new Error('Missing professional introduction or CTA');
const { pin, catalog } = readState();
for (const release of catalog.releases) {
 const paths=[join(root,'labs/sentinels/_bundles',release.archive.sha256),...(release.legacy?[join(root,'labs/sentinels',release.tag)]:[])];
 for(const lab of paths){
  const inventory=JSON.parse(readFileSync(join(lab,'assets-manifest.json'),'utf8'));
  if(inventory.version!==release.tag.slice(1))throw new Error('Sentinels lab version differs from retained release');
  for(const [name,entry] of Object.entries(inventory.files) as [string,{sha256:string;bytes:number}][]){
   const path=join(lab,name);
   if(!existsSync(path))throw new Error(`Missing Sentinels asset: ${name}`);
   const bytes=readFileSync(path);
   if(bytes.length>25*1024*1024||bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw new Error(`Changed Sentinels release asset: ${name}`);
  }
 }
}
const stable=readFileSync(join(root,'labs/sentinels/index.html'),'utf8');
const workspace=`/labs/sentinels/_bundles/${pin.archive_sha256}/`;
if(!stable.includes('data-sentinels-workspace')||!stable.includes(workspace)||!/aria-label=(?:"Breadcrumb"|Breadcrumb)(?:\s|>)/.test(stable)||!stable.includes('site-header')||!stable.includes('site-footer')||stable.includes('data-analytics-token')||stable.includes('cloudflareinsights'))throw new Error('Direct lab must use the shared site shell and exact workspace without analytics');
const article=readFileSync(join(root,'work/agentic-engineering/index.html'),'utf8');
if(/<iframe\b/i.test(article)||!article.includes('data-sentinels-activate')||!article.includes(workspace)||!article.includes('/labs/sentinels/'))throw new Error('Article must defer the raw workspace and link to the stable page');
const headers=readFileSync(join(root,'_headers'),'utf8');
const sections=headers.split(/\n(?=\/)/);
for(const section of sections){
 if(section.includes('wasm-unsafe-eval')&&!section.startsWith('/labs/sentinels/_bundles/*')&&!section.startsWith('/labs/sentinels/v0.1.0/*'))throw new Error('WebAssembly policy escaped the released workspace routes');
}
for(const path of ['/labs/sentinels/_bundles/*','/labs/sentinels/v0.1.0/*']){
 const scope=sections.find(section=>section.startsWith(path));
 if(!scope?.includes("worker-src 'self'")||!scope.includes("frame-ancestors 'self'"))throw new Error('Missing workspace worker/framing policy');
}
if(!sections.find(section=>section.startsWith('/labs/sentinels/_bundles/*'))?.includes('immutable'))throw new Error('Digest asset URLs require immutable caching');
const redirects=readFileSync(join(root,'_redirects'),'utf8').trim().split('\n');
if(redirects.join('\n')!==['/labs/sentinels/v0.1.0 /labs/sentinels/ 302','/labs/sentinels/v0.1.0/ /labs/sentinels/ 302','/labs/sentinels/v0.1.0/index.html /labs/sentinels/ 302'].join('\n'))throw new Error('Legacy redirects must affect landing pages only');
console.log(`Checked ${files.filter(p=>p.endsWith('.html')).length} pages, stable shell, deferred embedding and ${catalog.releases.length} retained releases.`);
