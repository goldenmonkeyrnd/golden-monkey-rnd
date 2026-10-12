import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const root='public';
const required=['index.html','summit/2026/index.html','work/civicatlas/index.html','work/censa/index.html','work/agentic-engineering/index.html','about/index.html','resume/index.html','privacy/index.html','404.html','downloads/Pauline_Yeary_Resume.pdf','media/sentinel-walkthrough.webm','media/sentinel-walkthrough.vtt','media/sentinel-transcript.txt'];
for(const name of required) if(!existsSync(join(root,name))) throw new Error(`Missing launch artifact: ${name}`);
const files: string[]=[];
function walk(path:string){for(const name of readdirSync(path)){const p=join(path,name);if(statSync(p).isDirectory())walk(p);else files.push(p);}}walk(root);
for(const path of files.filter(p=>p.endsWith('.html'))){const html=readFileSync(path,'utf8');
 if(/tel:|coming soon|placeholder/i.test(html))throw new Error(`Unapproved public content: ${path}`);
 for(const match of html.matchAll(/(?:href|src)=(?:["']([^"']+)["']|([^\s>]+))/g)){const href=match[1] || match[2];if(!href.startsWith('/')||href.startsWith('//'))continue;const target=href.split(/[?#]/)[0];if(!target)continue;if(!existsSync(join(root,target))&&!existsSync(join(root,target,'index.html')))throw new Error(`Broken local link ${href} in ${path}`);}
}
const home=readFileSync(join(root,'index.html'),'utf8');
if(!home.includes('Pauline Yeary')||!home.includes('atlas.goldenmonkey.dev')||!home.includes('goldenmonkeyrnd@gmail.com'))throw new Error('Missing professional introduction or CTA');
const release=JSON.parse(readFileSync('data/sentinels-release.json','utf8'));
const lab=join(root,'labs/sentinels',release.version);
const inventory=JSON.parse(readFileSync(join(lab,'assets-manifest.json'),'utf8'));
if(inventory.version!==release.version.slice(1))throw new Error('Sentinels lab version differs from pinned release');
for(const [name,entry] of Object.entries(inventory.files) as [string,{sha256:string;bytes:number}][]){
 const path=join(lab,name);
 if(!existsSync(path))throw new Error(`Missing Sentinels asset: ${name}`);
 const bytes=readFileSync(path);
 if(bytes.length>25*1024*1024||bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw new Error(`Changed Sentinels release asset: ${name}`);
}
const article=readFileSync(join(root,'work/agentic-engineering/index.html'),'utf8');
if(/<iframe\b/i.test(article)||!article.includes('data-sentinels-activate')||!article.includes(`/labs/sentinels/${release.version}/`))throw new Error('Sentinels must load only after activation and offer a direct link');
const headers=readFileSync(join(root,'_headers'),'utf8');
const scoped=headers.split(`/labs/sentinels/${release.version}/*`);
if(scoped.length!==2||scoped[0].includes('wasm-unsafe-eval')||!scoped[1].includes("worker-src 'self'")||!scoped[1].includes("frame-ancestors 'self'"))throw new Error('Sentinels runtime policy must be scoped to the pinned lab route');
console.log(`Checked ${files.filter(p=>p.endsWith('.html')).length} pages, local links, launch artifacts and pinned Sentinels assets.`);
