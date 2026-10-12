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

`dev` and `build` first import the checksum-pinned Sentinels release in `data/sentinels-release.json`. The importer caches verified bytes under ignored `artifacts/sentinels/`, rejects links, archive traversal, duplicate entries and assets exceeding Cloudflare's 25 MiB per-file limit, then stages the lab under ignored `static/labs/sentinels/v0.1.0/`. A clean first build needs network access to GitHub; cached builds need no release download. For qualification, set `SENTINELS_ARCHIVE_PATH` to a local copy of the identical pinned archive; its digest is still mandatory.

`check` validates launch artifacts, every local HTML link, the approved public identity, the lab inventory and the route-specific runtime policy. The downloadable two-page PDF is public; its editable source is retained privately. The case studies distinguish delivered experience, recorded demonstrations and bounded verification.

## Sentinels lab

The analyzer, browser code, examples and runtime bundle belong to [goldenmonkeyrnd/sentinels](https://github.com/goldenmonkeyrnd/sentinels), licensed AGPL-3.0-only. This site consumes the pinned [v0.1.0 release](https://github.com/goldenmonkeyrnd/sentinels/releases/tag/v0.1.0), with corresponding source and dependency notices included. Do not edit the imported files here; qualify a new upstream release and update the URL and SHA-256 manifest together.

The agentic-engineering page creates its same-origin iframe only after **Try the lab**. The lab's Python runtime loads only after activation. Its functional loader is independent of page analytics and GPC/DNT. The WebAssembly and worker policy applies only to `/labs/sentinels/v0.1.0/*`; the parent permits same-origin frames. The lab has no content telemetry or automatic persistence. Original recordings, captions and transcript remain historical evidence, with their capture provenance linked from the article.

## Deploy

```sh
bun run deploy
```

Wrangler requires a current login or a scoped `CLOUDFLARE_API_TOKEN`. The main-branch GitHub Actions workflow checks before deploying. Configure the production environment secret `CLOUDFLARE_API_TOKEN` with Workers Scripts Edit, Workers Routes Edit, Account Settings Read, Account Analytics Read and Zone Read, scoped to the configured account and goldenmonkey.dev zone. `CLOUDFLARE_ACCOUNT_ID` may be set as a repository variable; account and custom domain are already declared in wrangler.jsonc. No paid upgrade is required.

For rollback, list deployments with `bunx wrangler deployments list`, then use `bunx wrangler rollback <version-id>`. Record the verified version before replacing it.

## Assets and privacy

Portfolio code is MIT licensed; the imported Sentinels lab is AGPL-3.0-only with its own source and notices. Written content and the original AI-generated golden-monkey laboratory illustration are copyright Pauline Yeary. Fonts retain their SIL Open Font Licenses under static/fonts; see /asset-credits/. Hugo derives responsive WebP images from the original laboratory illustration. Its native OpenGraph and Twitter Card partials use global social images, with a CivicAtlas page override. Hugo publishes those PNG resources and reads their actual dimensions; the favicon family and browser manifest need no runtime framework or service worker.

Page analytics and bounded aggregate events honor GPC/DNT. The site stores no contact submissions, persistent visitor identifiers or fingerprints. See /privacy/ and the CivicAtlas telemetry implementation. AI assistance is disclosed; the public claims and engineering decisions are human-directed.
