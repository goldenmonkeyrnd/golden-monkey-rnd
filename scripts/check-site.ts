import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
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
console.log(`Checked ${files.filter(p=>p.endsWith('.html')).length} pages, all local links and launch artifacts.`);
