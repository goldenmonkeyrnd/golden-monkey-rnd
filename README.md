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

## Sentinels lab

The analyzer, browser code, examples and runtime bundle belong to [goldenmonkeyrnd/sentinels](https://github.com/goldenmonkeyrnd/sentinels), licensed AGPL-3.0-only. The stable public address is [goldenmonkey.dev/labs/sentinels/](https://goldenmonkey.dev/labs/sentinels/), with shared Hugo navigation, breadcrumbs and footer. It embeds the exact released workspace named by the committed pin; its source link uses the qualified commit. The original v0.1.0 release is explicitly grandfathered by its previously verified archive and wheel digests. Do not edit imported files or silently replace retained identities.

The agentic-engineering article creates the raw workspace iframe only after **Try the lab**; it never embeds a second site shell. Direct-open renders the workspace immediately, with no analytics loader on that page. Both defer Python until the workspace's own activation. Functional loading is independent of GPC/DNT. WebAssembly, workers and same-origin framing are permitted only for digest bundle routes and retained v0.1.0 assets. The stable shell revalidates; digest assets cache immutably. Only the three exact legacy landing URLs redirect to the stable page. The lab has no content telemetry or automatic persistence. Original recordings, captions and transcript remain historical evidence, with their capture provenance linked from the article.

## Deploy

```sh
bun run deploy
```

Wrangler requires a current login or a scoped `CLOUDFLARE_API_TOKEN`. The main-branch workflow qualifies a build, uploads its file-hash proof and deploys that exact artifact without rebuilding. It refuses a stale deployment when main has advanced. Configure the production environment secret `CLOUDFLARE_API_TOKEN` with Workers Scripts Edit, Workers Routes Edit, Account Settings Read, Account Analytics Read and Zone Read, scoped to the configured account and goldenmonkey.dev zone. `CLOUDFLARE_ACCOUNT_ID` may be set as a repository variable; account and custom domain are already declared in wrangler.jsonc. No paid upgrade is required.

Stable releases trigger `promote-sentinels.yml` through a GitHub App installed only on this website repository, with Actions write and Metadata read. The App ID/private key belong to the source publisher; this repository needs no additional secret. Dispatch inputs name the stable tag, release ID, source commit and qualification-record digest. The verifier requires a public immutable release and checks exact tag/workflow/job evidence, Python 3.12–3.14 and real browser records, every qualified asset, archive inventory and native/browser wheel identity. Mutable releases, prereleases, blocked releases and delayed older events fail before changing a pin. The candidate is committed locally, built and browser-qualified, then fast-forwarded only while main still equals its original base. The same checked public files deploy in that run. Existing production Cloudflare credentials are reused; main must permit the authorized workflow's contents write.

For a Sentinels rollback, manually dispatch `promote-sentinels.yml` with `operation=rollback`, the retained `rollback_archive_sha256`, and a concrete `rollback_reason`. It restores the chosen pin and records the replaced release in `data/sentinels-policy.json`, so duplicate publication events cannot immediately promote it again. Both releases' assets remain available. A block is removed only by an explicit reviewed policy change. For an emergency whole-site rollback, list deployments with `bunx wrangler deployments list`, then use `bunx wrangler rollback <version-id>`; also record the release block/pin correction before a later deployment can replace it.

## Assets and privacy

Portfolio code is MIT licensed; the imported Sentinels lab is AGPL-3.0-only with its own source and notices. Written content and the original AI-generated golden-monkey laboratory illustration are copyright Pauline Yeary. Fonts retain their SIL Open Font Licenses under static/fonts; see /asset-credits/. Hugo derives responsive WebP images from the original laboratory illustration. Its native OpenGraph and Twitter Card partials use global social images, with a CivicAtlas page override. Hugo publishes those PNG resources and reads their actual dimensions; the favicon family and browser manifest need no runtime framework or service worker.

Page analytics and bounded aggregate events honor GPC/DNT. The site stores no contact submissions, persistent visitor identifiers or fingerprints. See /privacy/ and the CivicAtlas telemetry implementation. AI assistance is disclosed; the public claims and engineering decisions are human-directed.
