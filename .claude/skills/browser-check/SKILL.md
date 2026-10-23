---
name: browser-check
description: Look at a built page in headless Chromium (Playwright) before it ships — layout, console errors, axe-core a11y, or the real Worker's CSP/headers. Use when a UI or header change needs checking in a real browser.
---

# Browser check

For a regression that should stay caught, add a test to the suite instead
(`e2e/site.e2e.ts`, `npm run test:e2e` after a build — CI runs it); this
recipe is for a one-off look.

The sandbox's Chromium (`/opt/pw-browsers/chromium`) is not the build the
pinned Playwright expects, so point the suite at it:
`PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test
--project=desktop --project=mobile`. The `iphone` project is WebKit, which
sandboxes don't preinstall (CI runs it). To run it here too, put
WebKit in the scratchpad: `PLAYWRIGHT_BROWSERS_PATH=<dir> npx playwright
install webkit`, `npx playwright install-deps webkit`, symlink
`/opt/pw-browsers/chromium*-<rev>` into `<dir>`, and run with that
`PLAYWRIGHT_BROWSERS_PATH` and `NO_PROXY=localhost`.

1. `npm run build`, then serve the export in the background:
   `PORT=8765 node scripts/serve-out.mjs` (the suite's server: the 404
   page with a 404, slash-less 301s) or `python3 -m http.server 8765
   --directory out`. Both serve by path, so a rebuild needs no restart.
   Note the PID.
2. Drive it with Playwright from a `.mjs` script in the scratchpad:
   `chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-proxy-server'] })`.
   Localhost must bypass the agent proxy — it answers plain-HTTP localhost
   with 405. For the LIVE site instead, use
   `proxy: { server: process.env.HTTPS_PROXY }` with Chromium's default TLS:
   the zone accepts TLS 1.3 only, so a `--ssl-version-max=tls1.2` cap fails
   with `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`. To watch CSP reports there,
   strip `report-to` (the browser then POSTs `report-uri`, which `page.route`
   can intercept) or use CDP `Network.enableReportingApi`.
3. Stub `/api/*` with `page.route` — the LAST registered matching route wins,
   so register the catch-all first. Stub `window.turnstile` via
   `addInitScript`; the real widget can't load from the sandbox.
4. To serve the export the way production does (the baked-in `<meta>` CSP
   plus `_headers`, `_redirects`, the 404 page, and the real Worker on
   `/api/*`): `npx wrangler dev`. Pages work over plain http; `/api/*`
   301s to https unless you add `--local-protocol https` and launch with
   `ignoreHTTPSErrors: true`.
5. a11y: inject axe-core from cdnjs into each page and run it in both themes;
   the baseline is zero violations.
6. Print a compact summary from the script (console errors, failed requests,
   axe violation ids) rather than whole DOM dumps. Save screenshots to the
   scratchpad and open only the ones whose look matters — each image costs
   context.
7. Stop servers with `kill <PID>`. `pkill -f <pattern>` in the same shell
   command matches its own command line and kills that shell.
