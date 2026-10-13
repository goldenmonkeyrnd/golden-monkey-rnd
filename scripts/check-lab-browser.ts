import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { readState } from "./sentinels-release";
import { sha256 } from "./sentinels-archive";
const base = process.env.SENTINELS_SITE_URL ?? "http://127.0.0.1:8875";
const { pin, catalog } = readState();
const release = catalog.releases.find(r => r.archive.sha256 === pin.archive_sha256)!;
const bundle = `/labs/sentinels/_bundles/${pin.archive_sha256}/`;
let server: ReturnType<typeof Bun.spawn> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const results: string[] = [];
try {
  if (!process.env.SENTINELS_SITE_URL) {
    server = Bun.spawn(["node", "node_modules/wrangler/bin/wrangler.js", "dev", "--port", "8875", "--local"], { detached: true, stdout: "ignore", stderr: "inherit", env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
    let ready = false;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) throw new Error("Task-owned preview exited before qualification");
      try { if ((await fetch(`${base}/labs/sentinels/`, { signal: AbortSignal.timeout(500) })).ok) { ready = true; break; } } catch { /* Preview is starting. */ }
      await Bun.sleep(200);
    }
    if (!ready) throw new Error("Task-owned preview initialization exceeded 20 seconds");
  }
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const context = await browser.newContext({ extraHTTPHeaders: { DNT: "1", "Sec-GPC": "1" } });
  await context.addInitScript(() => { Object.defineProperty(navigator, "globalPrivacyControl", { value: true }); Object.defineProperty(navigator, "doNotTrack", { value: "1" }); });
  const page = await context.newPage(), requests: string[] = [], errors: string[] = [];
  page.on("request", request => requests.push(request.url())); page.on("pageerror", error => errors.push(String(error)));
  const article = await page.goto(`${base}/work/agentic-engineering/`); await page.waitForLoadState("networkidle");
  assert.equal(requests.filter(url => url.includes("/labs/sentinels/")).length, 0);
  assert.ok(!article!.headers()["content-security-policy"].includes("wasm-unsafe-eval"));
  await page.locator("[data-sentinels-activate]").click();
  assert.equal(await page.locator("[data-sentinels-workspace] iframe").getAttribute("src"), bundle);
  await page.frameLocator("[data-sentinels-workspace] iframe").locator("#activate:not([disabled])").waitFor();
  assert.equal(requests.filter(url => /\/runtime\/|\.whl|\.wasm/.test(url)).length, 0);
  results.push("article activation defers the immutable workspace and runtime under GPC/DNT");
  requests.length = 0;
  const shell = await page.goto(`${base}/labs/sentinels/`); await page.waitForLoadState("networkidle");
  assert.equal(page.url(), `${base}/labs/sentinels/`);
  assert.ok(!shell!.headers()["content-security-policy"].includes("wasm-unsafe-eval"));
  assert.equal(await page.locator("[data-sentinels-workspace] iframe").getAttribute("src"), bundle);
  assert.equal(await page.locator("script[data-analytics-token]").count(), 0);
  assert.equal(requests.filter(url => /\/runtime\/|\.whl|\.wasm|cloudflareinsights|\/api\/events/.test(url)).length, 0);
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Home", exact: true }).focus();
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("href")), "/");
  assert.equal(await page.locator(".site-header").getByRole("link", { name: "Labs", exact: true }).getAttribute("href"), "/labs/");
  assert.equal(await page.locator(".site-footer").getByRole("link", { name: "Golden Monkey R&D", exact: true }).getAttribute("href"), "/");
  results.push("stable shell has navigation, breadcrumbs, footer, keyboard access and no analytics script");
  const runtime = await context.request.get(`${base}${bundle}worker.js`);
  assert.ok(runtime.headers()["content-security-policy"].includes("wasm-unsafe-eval"));
  assert.ok(runtime.headers()["content-security-policy"].includes("frame-ancestors 'self'"));
  assert.ok(runtime.headers()["cache-control"].includes("immutable"));
  const manifest = await (await context.request.get(`${base}${bundle}manifest.json`)).json();
  assert.equal(manifest.version, release.tag.slice(1));
  assert.deepEqual(manifest, JSON.parse(readFileSync(`public${bundle}manifest.json`, "utf8")));
  const frame = page.frameLocator("[data-sentinels-workspace] iframe");
  await frame.getByRole("button", { name: "Try the lab", exact: true }).click();
  await frame.locator("#run:not([disabled])").waitFor({ timeout: 32_000 });
  async function run(expected: string): Promise<void> {
    await frame.getByRole("button", { name: "Run fresh analysis", exact: true }).click();
    await frame.locator("#run:not([disabled])").waitFor({ timeout: 7_000 });
    assert.equal(JSON.parse((await frame.locator("#report-json").textContent())!).status, expected);
  }
  await frame.getByRole("button", { name: "Load repair", exact: true }).click(); await run("PASS");
  await frame.getByRole("button", { name: "Reset defect", exact: true }).click(); await run("FAIL");
  await frame.getByRole("button", { name: "Load repair", exact: true }).click(); await run("PASS");
  await context.setOffline(true); await run("PASS"); await context.setOffline(false);
  results.push("released Pyodide generates PASS, injected FAIL, repaired PASS and fresh offline PASS");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); assert.deepEqual(errors, []);
  results.push("mobile shell fits the viewport without browser errors");
  for (const landing of ["/labs/sentinels/v0.1.0", "/labs/sentinels/v0.1.0/", "/labs/sentinels/v0.1.0/index.html"]) {
    const response = await context.request.get(`${base}${landing}`, { maxRedirects: 0 });
    assert.equal(response.status(), 302); assert.equal(new URL(response.headers().location, base).pathname, "/labs/sentinels/");
  }
  const legacy = await context.request.get(`${base}/labs/sentinels/v0.1.0/worker.js`, { maxRedirects: 0 });
  assert.equal(legacy.status(), 200); assert.equal(sha256(await legacy.body()), sha256(readFileSync("public/labs/sentinels/v0.1.0/worker.js")));
  assert.ok(legacy.headers()["content-security-policy"].includes("wasm-unsafe-eval"));
  results.push("exact legacy landing redirects preserve old worker bytes and runtime policy");
  assert.equal(requests.filter(url => /cloudflareinsights|\/api\/events/.test(url)).length, 0);
  mkdirSync("artifacts", { recursive: true });
  writeFileSync("artifacts/sentinels-site-qualification.json", `${JSON.stringify({ version: 1, archive_sha256: pin.archive_sha256, wheel_sha256: manifest.wheel.sha256, browser: browser.version(), passed: true, tests: results }, null, 2)}\n`);
  console.log(`Verified ${results.length} real browser site integration checks.`);
} finally {
  await browser?.close();
  if (server) {
    // The detached group contains only this check's Wrangler and workerd children.
    // Stop that group even when the launcher exited before one of its children.
    try { process.kill(-server.pid, "SIGTERM"); } catch { /* Already stopped. */ }
    const stopped = await Promise.race([server.exited.then(() => true), Bun.sleep(3000).then(() => false)]);
    if (!stopped) { try { process.kill(-server.pid, "SIGKILL"); } catch { /* Already stopped. */ } }
  }
}
