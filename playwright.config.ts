import { defineConfig, devices } from '@playwright/test'

// Browser tests (e2e/*.e2e.ts) against the built export — `npm run build`
// first — served by scripts/serve-out.mjs. /api/* is stubbed per test
// (e2e/fixtures.ts), so they never touch the Worker or production data.
// `npm run test:e2e`; CI runs them after the build (ci.yml).
const PORT = 4173
// WebKit runs against the same export over HTTPS (scripts/serve-out.mjs TLS=1).
const TLS_PORT = 4174

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: a flaky browser test is a bug to fix, not to re-roll.
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    launchOptions: {
      // A remote session's agent proxy answers plain-HTTP localhost with a
      // 405; CI has no proxy, so the flag changes nothing there.
      args: ['--no-proxy-server'],
      // Sandboxes with a preinstalled Chromium of another revision point
      // this at it (.claude/skills/browser-check); unset in CI.
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    // Safari's engine: most phones that visit a Norwegian site are iPhones.
    // Over HTTPS, like production (serve-out.mjs explains why it must be);
    // its own launchOptions — the Chromium flag and path above don't apply.
    {
      name: 'iphone',
      use: {
        ...devices['iPhone 14'],
        baseURL: `https://localhost:${TLS_PORT}`,
        ignoreHTTPSErrors: true,
        launchOptions: {},
      },
    },
  ],
  webServer: [
    {
      command: 'node scripts/serve-out.mjs',
      url: `http://localhost:${PORT}/`,
      env: { PORT: String(PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node scripts/serve-out.mjs',
      url: `https://localhost:${TLS_PORT}/`,
      env: { PORT: String(TLS_PORT), TLS: '1' },
      ignoreHTTPSErrors: true,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
