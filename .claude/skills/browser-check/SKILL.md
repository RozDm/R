---
name: browser-check
description: Look at a built page in headless Chromium (Playwright) before it ships — layout, console errors, axe-core a11y, or the real Worker's CSP/headers. Use when a UI or header change needs checking in a real browser.
---

# Browser check

1. `npm run build`, then serve the export in the background:
   `python3 -m http.server 8765 --directory out` (serves by path, so a
   rebuild needs no restart). Note the PID.
2. Drive it with Playwright from a `.mjs` script in the scratchpad:
   `chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-proxy-server'] })`.
   Localhost must bypass the agent proxy — it answers plain-HTTP localhost
   with 405. For the LIVE site instead, use
   `proxy: { server: process.env.HTTPS_PROXY }` and
   `args: ['--ssl-version-max=tls1.2']` (the proxy's TLS terminator resets
   Chromium's TLS 1.3 hello).
3. Stub `/api/*` with `page.route` — the LAST registered matching route wins,
   so register the catch-all first. Stub `window.turnstile` via
   `addInitScript`; the real widget can't load from the sandbox.
4. To exercise the real Worker (CSP hashing, headers, redirects, routes):
   `npx wrangler dev --local-protocol https` (plain http just 301s to https)
   and launch with `ignoreHTTPSErrors: true`.
5. a11y: inject axe-core from cdnjs into each page and run it in both themes;
   the baseline is zero violations.
6. Print a compact summary from the script (console errors, failed requests,
   axe violation ids) rather than whole DOM dumps. Save screenshots to the
   scratchpad and open only the ones whose look matters — each image costs
   context.
7. Stop servers with `kill <PID>`. `pkill -f <pattern>` in the same shell
   command matches its own command line and kills that shell.
