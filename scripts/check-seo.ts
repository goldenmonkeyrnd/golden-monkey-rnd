import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { deflateSync } from "node:zlib";

type Attributes = Record<string, string>;
type Document = { title: string; metas: Attributes[]; links: Attributes[]; images: Attributes[]; schemas: string[]; scripts: string[] };
type Schema = Record<string, unknown>;
const source = resolve(process.cwd());
const temporary = mkdtempSync(join(tmpdir(), "golden-monkey-seo-"));
const output = join(temporary, "public");
const origin = "https://goldenmonkey.dev";
const escapedTitle = 'A "quoted" title & </script><script>unsafe</script>';
const explicitDescription = 'A "quoted" overview & <plain> details.';
const summaryDescription = "A summary with emphasis and a link & punctuation.";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SEO fixture: ${message}`);
}

function run(command: string, args: string[], environment: Record<string, string> = {}, input?: string): string {
  const result = spawnSync(command, args, { cwd: temporary, encoding: "utf8", env: { ...process.env, ...environment }, input, maxBuffer: 4 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message ?? (result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`)}`);
  return result.stdout;
}

function write(relative: string, value: string | Buffer): void {
  const destination = join(temporary, relative);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, value);
}

// A real raster at a known size makes accidental upscaling observable without an image dependency.
function png(width: number, height: number): Buffer {
  function chunk(kind: string, data: Buffer): Buffer {
    const body = Buffer.concat([Buffer.from(kind), data]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
    length.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, body, checksum]);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc((width * 3 + 1) * height, 100);
  for (let row = 0; row < height; row++) pixels[row * (width * 3 + 1)] = 0;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
}

function webpSize(bytes: Buffer): [number, number] {
  assert(bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP", "generated image is not WebP");
  const kind = bytes.toString("ascii", 12, 16);
  if (kind === "VP8X") return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1];
  if (kind === "VP8 ") return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  assert(kind === "VP8L", `unsupported WebP chunk ${kind}`);
  const bits = bytes.readUInt32LE(21);
  return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
}

function allFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? allFiles(join(directory, entry.name)) : [join(directory, entry.name)]);
}

// Python's standard parser decodes HTML entities and catches malformed JSON-LD boundaries.
function documents(directory: string): Record<string, Document> {
  const files = Object.fromEntries(allFiles(directory).filter(file => file.endsWith(".html")).map(file => [file.slice(directory.length + 1), readFileSync(file, "utf8")]));
  return JSON.parse(run("python3", ["-c", String.raw`
import html.parser, json, sys
class Document(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.result = dict(title='', metas=[], links=[], images=[], schemas=[], scripts=[])
        self.title = False
        self.script = None
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'title': self.title = True
        if tag in ('meta', 'link', 'img'): self.result[dict(meta='metas', link='links', img='images')[tag]].append(attrs)
        if tag == 'script':
            self.script = len(self.result['scripts'])
            self.result['scripts'].append('')
            if attrs.get('type') == 'application/ld+json': self.result['schemas'].append(self.script)
    def handle_endtag(self, tag):
        if tag == 'title': self.title = False
        if tag == 'script': self.script = None
    def handle_data(self, data):
        if self.title: self.result['title'] += data
        if self.script is not None: self.result['scripts'][self.script] += data
result = {}
for name, content in json.load(sys.stdin).items():
    document = Document()
    document.feed(content)
    document.result['schemas'] = [document.result['scripts'][i] for i in document.result['schemas']]
    result[name] = document.result
print(json.dumps(result))
`], {}, JSON.stringify(files)));
}

function meta(document: Document, name: string): string {
  const values = document.metas.filter(item => item.name === name || item.property === name);
  assert(values.length === 1, `expected one ${name} tag, found ${values.length}`);
  return values[0].content;
}

function canonical(document: Document): string {
  const values = document.links.filter(item => item.rel === "canonical");
  assert(values.length === 1, `expected one canonical link, found ${values.length}`);
  return values[0].href;
}

function schemas(document: Document): Schema[] {
  function flatten(value: unknown): Schema[] {
    if (Array.isArray(value)) return value.flatMap(flatten);
    if (!value || typeof value !== "object") return [];
    return [value as Schema, ...Object.values(value).flatMap(flatten)];
  }
  return document.schemas.flatMap(raw => {
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new Error("SEO fixture: invalid or prematurely terminated JSON-LD"); }
    return flatten(value);
  });
}

function hasType(schema: Schema, type: string): boolean {
  return Array.isArray(schema["@type"]) ? schema["@type"].includes(type) : schema["@type"] === type;
}

function resource(url: string): string {
  const parsed = new URL(url, origin);
  assert(parsed.origin === origin, `unexpected image origin ${url}`);
  const file = join(output, decodeURIComponent(parsed.pathname));
  assert(existsSync(file), `image reference does not exist: ${url}`);
  return file;
}

try {
  for (const name of ["hugo.toml", "layouts", "assets", "data", "config"]) {
    if (existsSync(join(source, name))) cpSync(join(source, name), join(temporary, name), { recursive: true });
  }
  if (existsSync(join(source, "static/fonts"))) cpSync(join(source, "static/fonts"), join(temporary, "static/fonts"), { recursive: true });
  const config = Bun.TOML.parse(readFileSync(join(source, "hugo.toml"), "utf8")) as { params: { description: string } };
  write("content/_index.md", '+++\ntitle = "Fixture home"\n+++\n');
  write("content/blog/_index.md", '+++\ntitle = "Fixture blog"\n+++\n');
  write("content/work/fixture.md", '+++\ntitle = "Project fixture"\n+++\n');
  for (let number = 1; number <= 12; number++) {
    const fields = [`title = ${JSON.stringify(number === 1 ? escapedTitle : `Fixture post ${number}`)}`, `date = 2026-01-${String(number).padStart(2, "0")}T12:00:00Z`];
    if (number === 1) fields.push(`description = ${JSON.stringify(explicitDescription)}`, 'lastmod = 2026-03-01T12:00:00Z', 'images = ["wide.png"]', 'social_image_alt = "Fixture social image"');
    if (number === 2) fields.push('summary = "A summary with **emphasis** and [a link](https://example.org/) & punctuation."');
    const body = number === 1 ? "![Wide first image](wide.png)\n\n![Small second image](small.png)\n\n![Animated image](animated.gif)\n\n![Vector image](diagram.svg)" : number === 4 ? "" : `Published fixture content ${number}.`;
    write(`content/blog/post-${number}/index.md`, `+++\n${fields.join("\n")}\n+++\n${body}\n`);
  }
  const wide = png(960, 480), small = png(96, 48);
  // Two graphic-control/image frames preserve an actual animation, not just a GIF extension.
  const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAAh+QQBAAAAACwAAAAAAQABAAACAUQAOw==", "base64");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><rect width="120" height="60" fill="red"/></svg>';
  write("content/blog/post-1/wide.png", wide);
  write("content/blog/post-1/small.png", small);
  write("content/blog/post-1/animated.gif", gif);
  write("content/blog/post-1/diagram.svg", svg);
  // The global resource shares a name so a mistaken assets-first lookup is visible.
  write("assets/wide.png", png(72, 36));
  for (const [slug, extra] of [["private-draft", "draft = true"], ["future-post", "date = 2099-01-01T12:00:00Z"]]) {
    write(`content/blog/${slug}/index.md`, `+++\ntitle = "${slug}"\n${extra}\n+++\n![Unpublished fixture](unpublished-${slug}.png)\n`);
    write(`content/blog/${slug}/unpublished-${slug}.png`, wide);
  }
  run("git", ["init", "--quiet"]);
  run("git", ["add", "content/blog/post-1/index.md", "content/blog/post-2/index.md"]);
  run("git", ["-c", "user.name=SEO fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Fixture content revision"], { GIT_AUTHOR_DATE: "2026-02-02T12:00:00Z", GIT_COMMITTER_DATE: "2026-02-02T12:00:00Z" });
  const build = (environment: string, destination: string, preview = false): void => {
    run("hugo", ["--environment", environment, "--destination", destination, "--cacheDir", join(temporary, "cache"), "--clock", "2026-06-01T12:00:00Z", "--minify", ...(preview ? ["--buildDrafts", "--buildFuture"] : [])]);
  };
  build("production", output);
  const pages = documents(output);
  const firstArchive = pages["blog/index.html"], secondArchive = pages["blog/page/2/index.html"];
  assert(firstArchive && secondArchive, "12 published posts must generate a second archive page");
  assert(canonical(secondArchive) === `${origin}/blog/page/2/`, "second archive canonical must be its own /blog/page/2/ URL");
  assert(canonical(firstArchive) === `${origin}/blog/`, "first archive canonical must stay /blog/");
  assert(meta(secondArchive, "og:url") === canonical(secondArchive), "second archive Open Graph URL must match its canonical");
  assert(/Page 2/.test(secondArchive.title), "second archive title must identify Page 2");

  for (let number = 1; number <= 12; number++) {
    const page = pages[`blog/post-${number}/index.html`];
    assert(page, `missing published fixture post ${number}`);
    const expectedDescription = number === 1 ? explicitDescription : number === 2 ? summaryDescription : number === 4 ? config.params.description : `Published fixture content ${number}.`;
    for (const name of ["description", "og:description", "twitter:description"]) assert(meta(page, name) === expectedDescription, `post ${number} ${name} must use the common plain-text description`);
    const nodes = schemas(page), articles = nodes.filter(node => hasType(node, "BlogPosting"));
    assert(articles.length === 1, `post ${number} must have one BlogPosting JSON-LD node`);
    const article = articles[0], url = `${origin}/blog/post-${number}/`;
    assert(article.url === url || article.mainEntityOfPage === url || (article.mainEntityOfPage as Schema)?.["@id"] === url, `post ${number} schema must identify its canonical URL`);
    assert(article.description === expectedDescription, `post ${number} schema description differs from metadata`);
    assert(article.headline === (number === 1 ? escapedTitle : `Fixture post ${number}`), `post ${number} schema headline must round-trip safely`);
    assert(typeof article.datePublished === "string" && article.datePublished.startsWith(`2026-01-${String(number).padStart(2, "0")}`), `post ${number} publication date is incorrect`);
    const expectedDate = number === 1 ? "2026-03-01" : number === 2 ? "2026-02-02" : `2026-01-${String(number).padStart(2, "0")}`;
    assert(typeof article.dateModified === "string" && article.dateModified.startsWith(expectedDate) && Number.isFinite(Date.parse(article.dateModified)), `post ${number} must resolve explicit, Git, then publication modification dates`);
    const author = article.author as Schema;
    const identity = typeof author === "object" && (author.name === "Pauline Yeary" || nodes.some(node => node["@id"] === author["@id"] && node.name === "Pauline Yeary"));
    assert(identity, `post ${number} schema must identify Pauline Yeary as its author`);
  }
  for (const name of ["index.html", "work/fixture/index.html", "blog/index.html", "blog/page/2/index.html"]) {
    assert(!schemas(pages[name]).some(node => hasType(node, "BlogPosting") || hasType(node, "Article")), `${name} must not claim to be a blog article`);
  }
  const homeNodes = schemas(pages["index.html"]);
  assert(homeNodes.some(node => hasType(node, "WebSite")) && homeNodes.some(node => hasType(node, "Person") && node.name === "Pauline Yeary"), "homepage must expose website and author identity");
  assert(meta(pages["work/fixture/index.html"], "description") === config.params.description, "non-blog page without a description must use the site default");
  const post = pages["blog/post-1/index.html"];
  assert(!post.scripts.some(script => script.trim() === "unsafe"), "a post title must not create an executable script");
  const imageByAlt = (alt: string): Attributes => {
    const image = post.images.find(item => item.alt === alt);
    assert(image, `missing rendered image: ${alt}`);
    return image;
  };
  for (const [alt, maximumWidth, maximumHeight] of [["Wide first image", 960, 480], ["Small second image", 96, 48]] as const) {
    const image = imageByAlt(alt), width = Number(image.width), height = Number(image.height);
    assert(width > 0 && height > 0 && width <= maximumWidth && height <= maximumHeight && width === height * 2, `${alt} must include correct intrinsic dimensions without upscaling`);
    assert(image.src.startsWith("/images/blog/") && /[a-f0-9]{32,}.*\.webp(?:$|\?)/i.test(image.src), `${alt} must use a fingerprinted /images/blog/ WebP URL`);
    const candidates = (image.srcset ?? "").split(",").filter(Boolean).map(item => item.trim().split(/\s+/));
    if (maximumWidth === 960) assert(candidates.length >= 2, "wide raster must offer responsive WebP candidates");
    for (const [url, descriptor] of [[image.src, `${width}w`], ...candidates]) {
      assert(/^\d+w$/.test(descriptor), `${alt} has an invalid srcset width`);
      const actual = webpSize(readFileSync(resource(url)));
      assert(actual[0] <= maximumWidth && actual[1] <= maximumHeight && actual[0] === Number.parseInt(descriptor), `${alt} generated candidate has incorrect or upscaled dimensions`);
    }
    assert(image.loading === (maximumWidth === 960 ? "eager" : "lazy"), `${alt} must use first-image eager/subsequent-image lazy loading`);
  }
  assert(readFileSync(resource(imageByAlt("Animated image").src)).equals(gif), "animated GIF must be preserved byte-for-byte");
  assert(readFileSync(resource(imageByAlt("Vector image").src), "utf8") === svg, "SVG must be preserved byte-for-byte");
  const social = meta(post, "og:image");
  assert(meta(post, "twitter:image") === social && meta(post, "og:image:secure_url") === social, "social image URLs must agree");
  assert(meta(post, "og:image:width") === "960" && meta(post, "og:image:height") === "480", "page-bundle social image must take precedence over the 72x36 global resource");
  assert(meta(post, "og:image:alt") === "Fixture social image" && meta(post, "twitter:image:alt") === "Fixture social image", "social image alt text must agree");
  resource(social);
  const articleImage = schemas(post).find(node => hasType(node, "BlogPosting"))?.image;
  assert(JSON.stringify(articleImage).includes(social), "BlogPosting image must match the social image");

  const feeds = JSON.parse(run("python3", ["-c", String.raw`
import json, sys, xml.etree.ElementTree as E
sitemap, rss = [E.parse(p).getroot() for p in sys.argv[1:]]
print(json.dumps(dict(sitemap={item.findtext('{*}loc'): item.findtext('{*}lastmod') for item in sitemap.findall('{*}url')}, rss=[item.findtext('link') for item in rss.findall('channel/item')])))
`, join(output, "sitemap.xml"), join(output, "blog/index.xml")])) as { sitemap: Record<string, string | null>; rss: string[] };
  for (let number = 1; number <= 12; number++) {
    const url = `${origin}/blog/post-${number}/`;
    assert(url in feeds.sitemap && feeds.rss.includes(url), `published post ${number} must appear in sitemap and RSS`);
  }
  assert(feeds.sitemap[`${origin}/blog/post-1/`]?.startsWith("2026-03-01") && feeds.sitemap[`${origin}/blog/post-2/`]?.startsWith("2026-02-02") && feeds.sitemap[`${origin}/blog/post-3/`]?.startsWith("2026-01-03"), "sitemap modification dates must use the same explicit, Git, and publication precedence");
  const crawlContent = [readFileSync(join(output, "sitemap.xml"), "utf8"), readFileSync(join(output, "blog/index.xml"), "utf8"), ...Object.values(pages).map(page => JSON.stringify(page))].join("\n");
  for (const slug of ["private-draft", "future-post"]) {
    assert(!crawlContent.includes(slug), `${slug} must be absent from production HTML, RSS, and sitemap`);
    assert(!allFiles(output).some(file => file.includes(slug)), `${slug} page and bundle assets must be absent from production output`);
  }
  assert(readFileSync(join(output, "robots.txt"), "utf8").includes(`Sitemap: ${origin}/sitemap.xml`), "robots.txt must advertise the absolute sitemap URL");
  const missing = pages["404.html"];
  assert(meta(missing, "robots").includes("noindex"), "404 must be noindex");
  assert(!missing.links.some(item => item.rel === "canonical") && !schemas(missing).some(node => hasType(node, "BlogPosting") || hasType(node, "Article")), "404 must omit canonical and article schema");
  for (const [name, page] of Object.entries(pages)) {
    if (name !== "404.html") assert(!page.metas.some(item => item.name === "robots" && item.content?.includes("noindex")), `production content must remain indexable: ${name}`);
  }

  const preview = join(temporary, "preview");
  build("development", preview, true);
  const previewPages = documents(preview);
  for (const name of ["index.html", "blog/index.html", "blog/post-1/index.html", "blog/private-draft/index.html", "blog/future-post/index.html"]) {
    assert(previewPages[name] && meta(previewPages[name], "robots").includes("noindex"), `development preview must be noindex: ${name}`);
  }
  console.log("Checked SEO with 12 posts: pagination, descriptions, safe schema, revision dates, images, crawl output, unpublished assets, and preview indexing.");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
