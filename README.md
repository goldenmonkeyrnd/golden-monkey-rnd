# GoldenMonkey.dev

Pauline Yeary's hiring portfolio and the website of Golden Monkey Research and Development LLC (Maryland). Hugo produces the site; Cloudflare Workers Static Assets hosts it. The conference QR points to https://goldenmonkey.dev/summit/2026/; the working data application is https://atlas.goldenmonkey.dev.

## Launch status — October 12, 2026

The portfolio, conference landing page, résumé and editable Sentinels lab are live. The lab runs the released analyzer on visitor-edited source; the original CivicAtlas recording remains historical evidence with its provenance. Production links and the digital résumé QR destination have been verified. GitHub Actions validation and automatic deployment have both passed against production. Privacy-conscious application events are stored in Analytics Engine; conference-page, comparison and source-inspector actions have been verified with a sampling-aware query. Verification traffic is not recruiter engagement.

## Run and verify

Use Hugo 0.160.1 extended and Bun 1.3.4.

```sh
bun install --frozen-lockfile
bun run dev
bun run build
bun run check
```

`dev` and `build` import the current archive digest from `data/sentinels-release.json` and every retained release in `data/sentinels-catalog.json`. Qualified successors include checksum-pinned provenance records under `data/sentinels-provenance/`. The importer validates source, wheel, inventory and archive identities, rejects links, traversal, duplicate entries and assets exceeding Cloudflare's 25 MiB limit, then stages immutable `/labs/sentinels/_bundles/<archive SHA>/` paths. Clean builds also recreate the original v0.1.0 asset paths. Verified archives are cached under ignored `artifacts/sentinels/`; a first build needs GitHub access. `SENTINELS_ARCHIVE_PATH` can supply the current archive locally without overriding its digest.

`check` runs strict TypeScript validation, archive safety and promotion/rollback regression checks, and validates public links, retained inventories, the stable shell and scoped runtime policy. `bunx playwright install chromium` followed by `bun run check:browser` runs real Pyodide analysis through a task-owned Wrangler preview, including failure/repair, offline analysis, GPC/DNT, mobile layout and legacy assets. The downloadable two-page PDF is public; its editable source is retained privately. The case studies distinguish delivered experience, recorded demonstrations and bounded verification.

## Write a blog post

Posts are Markdown files in `content/blog/`. From this repository, create a draft with a short, lowercase, hyphenated name:

```sh
mise run post -- a-thought-worth-keeping
```

This creates `content/blog/a-thought-worth-keeping/index.md`. Open that file in your editor, change the title, optionally add a one-sentence `description`, and write below the closing `+++`. The name in the command becomes the URL; the title can change without changing the URL. If you do not use mise, the equivalent command is `hugo new content --kind blog blog/a-thought-worth-keeping/index.md`.

Preview while you write:

```sh
mise run dev
```

Open <http://localhost:1313/blog/>. Saving a file refreshes the preview, including future-dated posts. Drafts have a visible **Draft preview** label locally and are omitted from production builds, the public blog, RSS, and the sitemap. Stop the preview with Ctrl+C. If port 1313 is already occupied, use the existing preview or stop the process you started before trying again.

There is no required topic, length, or outline. Markdown supports paragraphs, `## Headings`, lists, links, blockquotes, and fenced code blocks. Put images beside `index.md` and insert them with `![Describe the image](photo.jpg)`; bundle images stay out of production while the post is a draft. Images hosted on other sites are blocked by this site's content policy.

To publish:

1. Set `draft = false`. Check the `date`: future-dated posts are excluded until a build runs after that time. There is no scheduled publisher; for immediate publication, use today's date or an earlier date. Dates use Eastern time when no explicit timezone is supplied.
2. Run `mise run build` and `mise run check`.
3. Commit just the post and its images, then push to `main`:

   ```sh
   git add content/blog/a-thought-worth-keeping/
   git commit -m "Publish a thought worth keeping"
   git push origin main
   ```

The existing GitHub Actions workflow validates and deploys the site. After it succeeds, the post appears at `https://goldenmonkey.dev/blog/a-thought-worth-keeping/`, newest first in the blog, and in the [blog feed](https://goldenmonkey.dev/blog/index.xml). To revise a published post, edit the same file and repeat the build, check, commit, and push steps.

**Draft status controls website publication, not repository privacy.** This website's GitHub repository is public. Keep unfinished or private writing uncommitted; pushing a draft makes its source public even though the website hides it. Avoid broad `git add .` commands while drafts are present. A post that is missing after deployment is usually still marked as a draft, dated in the future, or part of a failed deployment; check those before changing the URL.

### Automatic SEO and images

Hugo generates search/social metadata and structured data from the post. You can write only a title, date, and body; a plain-text summary supplies the description automatically. These optional front matter fields give you control:

```toml
description = "A short description for search results and shared links."
summary = "An optional summary instead of Hugo's automatic excerpt."
lastmod = "2026-10-14T09:00:00-04:00"
images = ["cover.jpg"]
social_image_alt = "A description of the cover image."
```

An explicit `description` takes precedence over the summary. Without `lastmod`, the post's last Git commit supplies its revision date; an uncommitted new post falls back to its publication date. Builds do not refresh dates merely because the site was rebuilt. Both publishing workflows fetch the history Hugo needs. A fresh manual clone must also contain history (`git fetch --unshallow` if you cloned with limited depth).

Keep `cover.jpg` beside the post's `index.md`; `images` selects a social preview, with the site artwork as the default when omitted. Add `social_image_alt` to describe your own cover. A missing named image stops the build with its path so that a broken image cannot be published silently.

Ordinary Markdown images in the bundle receive responsive WebP versions up to 1,200 pixels wide, without enlarging small originals. Hugo includes their dimensions, loads the first body image eagerly, and defers later images. SVG files and animated GIFs retain their original bytes. Generated WebP URLs contain a content hash and cache immutably; replacing an image produces a new URL automatically.

`mise run check` also builds a temporary blog fixture to verify canonical URLs, dates, metadata, structured data, image output, and draft exclusion. The fixture is never part of the published site. Development previews and the error page tell crawlers not to index them; the public robots file advertises the generated sitemap.

## Sentinels lab

The analyzer, browser code, examples and runtime bundle belong to [goldenmonkeyrnd/sentinels](https://github.com/goldenmonkeyrnd/sentinels), licensed AGPL-3.0-only. The stable public address is [goldenmonkey.dev/labs/sentinels/](https://goldenmonkey.dev/labs/sentinels/), with shared Hugo navigation, breadcrumbs and footer. It embeds the exact released workspace named by the committed pin; its source link uses the qualified commit. The original v0.1.0 release is explicitly grandfathered by its previously verified archive and wheel digests. Do not edit imported files or silently replace retained identities.

The agentic-engineering article creates the raw workspace iframe only after **Try the lab**; it never embeds a second site shell. Direct-open renders the workspace immediately, with no analytics loader on that page. Both defer Python until the workspace's own activation. Functional loading is independent of GPC/DNT. WebAssembly, workers and same-origin framing are permitted only for digest bundle routes and retained v0.1.0 assets. The stable shell revalidates; digest assets cache immutably. Only the three exact legacy landing URLs redirect to the stable page. The lab has no content telemetry or automatic persistence. Original recordings, captions and transcript remain historical evidence, with their capture provenance linked from the article.

## Deploy

```sh
bun run deploy
```

Wrangler requires a current login or a scoped `CLOUDFLARE_API_TOKEN`. The main-branch workflow qualifies a build, uploads its file-hash proof and deploys that exact artifact without rebuilding. It refuses a stale deployment when main has advanced. Configure the production environment secret `CLOUDFLARE_API_TOKEN` with Workers Scripts Edit, Workers Routes Edit, Account Settings Read, Account Analytics Read and Zone Read, scoped to the configured account and goldenmonkey.dev zone. `CLOUDFLARE_ACCOUNT_ID` may be set as a repository variable; account and custom domain are already declared in wrangler.jsonc. No paid upgrade is required.

The Cloudflare zone has a redirect-only, proxied `www` CNAME pointing to `goldenmonkey.dev` (record `9e300353c4a0ecb6fac6997583c9f215`). Single Redirect ruleset `4aef335201ef42a1aeb3e8060898a4c8`, rule `b4ca572aa8ad48a798fee44bf653c899` (`portfolio_https_apex`), sends HTTP or `www` requests for these two hosts to `https://goldenmonkey.dev`, preserving path and query string with a 301 response. Other subdomains are outside its expression. These are zone resources, separate from Wrangler's Worker deployment.

Before this change, the `www` record and dynamic-redirect entrypoint were absent. To undo this redirect, remove that exact rule and DNS record; remove the ruleset only if it still contains solely this rule. Preserve any later additions. Worker deployment rollback alone does not undo zone configuration. The zone ID is `99b95e7cc36d67d7cce96fdae2a4c23b`; the recorded IDs allow an exact rollback through Cloudflare's dashboard or API.

Workers preview URLs and the `workers.dev` subdomain stay explicitly disabled in `wrangler.jsonc`. HTML, RSS, and sitemap responses revalidate with ETags; fingerprinted CSS, JavaScript, and generated blog images cache immutably. Ordinary pages permit compression. Released Sentinels bundles and their legacy routes retain `no-transform` and their scoped security policies. Existing Web Analytics remains preference-aware; inspect aggregate traffic and Core Web Vitals in Cloudflare without adding another tracker.

Stable releases trigger `promote-sentinels.yml` through a GitHub App installed only on this website repository, with Actions write and Metadata read. The App ID/private key belong to the source publisher; this repository needs no additional secret. Dispatch inputs name the stable tag, release ID, source commit and qualification-record digest. The verifier requires a public immutable release and checks exact tag/workflow/job evidence, Python 3.12–3.14 and real browser records, every qualified asset, archive inventory and native/browser wheel identity. Mutable releases, prereleases, blocked releases and delayed older events fail before changing a pin. The candidate is committed locally, built and browser-qualified, then fast-forwarded only while main still equals its original base. The same checked public files deploy in that run. Existing production Cloudflare credentials are reused; main must permit the authorized workflow's contents write.

For a Sentinels rollback, manually dispatch `promote-sentinels.yml` with `operation=rollback`, the retained `rollback_archive_sha256`, and a concrete `rollback_reason`. It restores the chosen pin and records the replaced release in `data/sentinels-policy.json`, so duplicate publication events cannot immediately promote it again. Both releases' assets remain available. A block is removed only by an explicit reviewed policy change. For an emergency whole-site rollback, list deployments with `bunx wrangler deployments list`, then use `bunx wrangler rollback <version-id>`; also record the release block/pin correction before a later deployment can replace it.

## Assets and privacy

Portfolio code is MIT licensed; the imported Sentinels lab is AGPL-3.0-only with its own source and notices. Written content and the original AI-generated golden-monkey laboratory illustration are copyright Pauline Yeary. Fonts retain their SIL Open Font Licenses under static/fonts; see /asset-credits/. Hugo derives responsive WebP images from the original laboratory illustration. Its native OpenGraph and Twitter Card partials use global social images, with a CivicAtlas page override. Hugo publishes those PNG resources and reads their actual dimensions; the favicon family and browser manifest need no runtime framework or service worker.

Page analytics and bounded aggregate events honor GPC/DNT. The site stores no contact submissions, persistent visitor identifiers or fingerprints. See /privacy/ and the CivicAtlas telemetry implementation. AI assistance is disclosed; the public claims and engineering decisions are human-directed.
