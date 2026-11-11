import { test as base, expect } from '@playwright/test'
import { apiStub } from './api-stub'

// Every test gets:
//   - /api/* stubbed with the Worker's own answers (e2e/api-stub.ts — held
//     to the route handlers by tests/worker/api-stub.test.ts; the Worker
//     itself is covered by tests/worker/ and smoke.sh);
//   - the intro marked as seen, unless a test sets `introSeen: false`;
//   - a check after the test that the page logged no console error and the
//     browser reported no CSP violation — the hash CSP and the code must
//     keep agreeing on every page.

// Cloudflare's api.js as far as components/contact/Turnstile.tsx uses it.
const FAKE_TURNSTILE = `(() => {
  const widgets = new Map()
  let n = 0
  const issue = (w, id) => setTimeout(() => w.o.callback && w.o.callback('fake-token-' + id + '-' + Date.now()), 0)
  window.turnstile = {
    render(el, o) {
      const id = 'w' + ++n
      el.setAttribute('data-fake-turnstile', o.theme || 'auto')
      widgets.set(id, { el, o })
      issue(widgets.get(id), id)
      return id
    },
    reset(id) {
      const w = widgets.get(id)
      if (w) issue(w, id)
    },
    remove(id) {
      const w = widgets.get(id)
      if (w) w.el.removeAttribute('data-fake-turnstile')
      widgets.delete(id)
    },
  }
  if (window.onloadTurnstileCallback) window.onloadTurnstileCallback()
})()`

type Fixtures = { introSeen: boolean; pageProblems: string[] }

export const test = base.extend<Fixtures>({
  introSeen: [true, { option: true }],
  pageProblems: [
    async ({ page, introSeen, browserName }, use) => {
      const problems: string[] = []
      await page.addInitScript((seen) => {
        if (seen) {
          try {
            localStorage.setItem('intro-seen', '1')
          } catch {}
        }
        document.addEventListener('securitypolicyviolation', (e) =>
          console.error(`CSP violation: ${e.effectiveDirective} ${e.blockedURI}`),
        )
      }, introSeen)
      // Turnstile: a stand-in api.js that renders a fake widget (its theme in
      // data-fake-turnstile) and hands out a token. Only an export built with
      // a site key asks for it — CI's (ci.yml sets Cloudflare's test key).
      await page.route(
        (url) => url.hostname === 'challenges.cloudflare.com',
        (route) => route.fulfill({ contentType: 'text/javascript', body: FAKE_TURNSTILE }),
      )
      // Registered first, so a test's own page.route for one endpoint wins.
      await page.route('**/api/**', (route) => {
        const { status, body } = apiStub(new URL(route.request().url()), route.request().method())
        return route.fulfill({ status, body, contentType: 'application/json' })
      })
      page.on('console', (m) => {
        // The 404 page's own document is a 404 — expected, not a problem.
        if (m.type() === 'error' && !/status of 404/.test(m.text())) problems.push(m.text())
      })
      page.on('pageerror', (e) => {
        // WebKit reports a fetch that a navigation cancelled (Next's
        // prefetches, an /api call still in flight) as an uncaught "… due to
        // access control checks." — not a page error. Every request here is
        // same-origin, and a real CORS refusal still fails the Chromium runs.
        if (browserName === 'webkit' && /due to access control checks\.$/.test(e.message)) return
        problems.push(`pageerror: ${e.message}`)
      })
      await use(problems)
      expect(problems, 'console errors / CSP violations').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
