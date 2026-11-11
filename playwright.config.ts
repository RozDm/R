import { existsSync } from 'node:fs'
import { defineConfig, devices, webkit } from '@playwright/test'

// Browser tests (e2e/*.e2e.ts) against the built export — `npm run build`
// first — served by scripts/serve-out.mjs. /api/* is stubbed per test
// (e2e/fixtures.ts), so they never touch the Worker or production data.
// `npm run test:e2e`; CI runs them after the build (ci.yml).
const PORT = 4173
// WebKit runs against the same export over HTTPS (scripts/serve-out.mjs TLS=1).
const TLS_PORT = 4174

// A Claude Code session (it sets CLAUDECODE) reads every line printed here as
// context: a dot per test instead of a line, and a stop after a few failures
// — a browser that isn't installed fails every test with the same 1.4 KB box,
// 55 KB for one project.
const AGENT = !process.env.CI && !!process.env.CLAUDECODE
// Claude Code's cloud sandbox preinstalls a Chromium of another revision than
// the one this Playwright downloads, and no WebKit: take that Chromium, and
// leave the iPhone project to CI unless WebKit was installed
// (.claude/skills/browser-check).
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium'
const SANDBOX = process.env.CLAUDE_CODE_REMOTE === 'true' && existsSync(SANDBOX_CHROMIUM)
const IPHONE = !SANDBOX || existsSync(webkit.executablePath())
// Said once: every worker process loads this file too.
if (!IPHONE && !process.env.TEST_WORKER_INDEX) {
  console.warn('e2e: no WebKit in this sandbox — the iphone project is left to CI')
}

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: a flaky browser test is a bug to fix, not to re-roll.
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : AGENT ? 'dot' : 'list',
  maxFailures: AGENT ? 5 : undefined,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    launchOptions: {
      // A remote session's agent proxy answers plain-HTTP localhost with a
      // 405; CI has no proxy, so the flag changes nothing there.
      args: ['--no-proxy-server'],
      // A Chromium other than the one Playwright downloaded: the one
      // PW_CHROMIUM_PATH names, else the sandbox's. Unset in CI.
      executablePath: process.env.PW_CHROMIUM_PATH || (SANDBOX ? SANDBOX_CHROMIUM : undefined),
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    // Safari's engine: most phones that visit a Norwegian site are iPhones.
    // Over HTTPS, like production (serve-out.mjs explains why it must be);
    // its own launchOptions — the Chromium flag and path above don't apply.
    ...(IPHONE
      ? [
          {
            name: 'iphone',
            use: {
              ...devices['iPhone 14'],
              baseURL: `https://localhost:${TLS_PORT}`,
              ignoreHTTPSErrors: true,
              launchOptions: {},
            },
          },
        ]
      : []),
  ],
  webServer: [
    {
      command: 'node scripts/serve-out.mjs',
      url: `http://localhost:${PORT}/`,
      env: { PORT: String(PORT) },
      reuseExistingServer: !process.env.CI,
    },
    // Only the iPhone project uses the HTTPS copy.
    ...(IPHONE
      ? [
          {
            command: 'node scripts/serve-out.mjs',
            url: `https://localhost:${TLS_PORT}/`,
            env: { PORT: String(TLS_PORT), TLS: '1' },
            ignoreHTTPSErrors: true,
            reuseExistingServer: !process.env.CI,
          },
        ]
      : []),
  ],
})
