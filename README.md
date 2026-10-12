# GoldenMonkey.dev

Pauline Yeary's hiring portfolio and the website of Golden Monkey Research and Development LLC (Maryland). Hugo produces the site; Cloudflare Workers Static Assets hosts it. The conference QR points to https://goldenmonkey.dev/summit/2026/; the working data application is https://atlas.goldenmonkey.dev.

## Launch status — October 11, 2026

The portfolio, conference landing page, résumé PDF and recorded Sentinel walkthrough are live. Production links and the digital résumé QR destination have been verified. GitHub Actions validation and automatic deployment have both passed against production. Privacy-conscious application events are stored in Analytics Engine; conference-page, comparison and source-inspector actions have been verified with a sampling-aware query. Verification traffic is not recruiter engagement.

## Run and verify

Use Hugo 0.160.1 extended and Bun 1.3.4.

```sh
bun install --frozen-lockfile
bun run dev
bun run build
bun run check
```

`check` validates launch artifacts, every local HTML link, and the approved public identity. The downloadable two-page PDF is public; its editable source is retained privately. The case studies distinguish delivered experience, recorded demonstrations and bounded verification.

## Deploy

```sh
bun run deploy
```

Wrangler requires a current login or a scoped `CLOUDFLARE_API_TOKEN`. The main-branch GitHub Actions workflow checks before deploying. Configure the production environment secret `CLOUDFLARE_API_TOKEN` with Workers Scripts Edit, Workers Routes Edit, Account Settings Read, Account Analytics Read and Zone Read, scoped to the configured account and goldenmonkey.dev zone. `CLOUDFLARE_ACCOUNT_ID` may be set as a repository variable; account and custom domain are already declared in wrangler.jsonc. No paid upgrade is required.

For rollback, list deployments with `bunx wrangler deployments list`, then use `bunx wrangler rollback <version-id>`. Record the verified version before replacing it.

## Assets and privacy

New code is MIT licensed. Written content and the original AI-generated golden-monkey laboratory illustration are copyright Pauline Yeary. Fonts retain their SIL Open Font Licenses under static/fonts; see /asset-credits/. Hugo derives responsive WebP images from the original laboratory illustration. Its native OpenGraph and Twitter Card partials use global social images, with a CivicAtlas page override. Hugo publishes those PNG resources and reads their actual dimensions; the favicon family and browser manifest need no runtime framework or service worker.

Page analytics and bounded aggregate events honor GPC/DNT. The site stores no contact submissions, persistent visitor identifiers or fingerprints. See /privacy/ and the CivicAtlas telemetry implementation. AI assistance is disclosed; the public claims and engineering decisions are human-directed.
