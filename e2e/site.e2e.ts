import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures'

// User-level flows on the built export, desktop and mobile (playwright.config.ts).

// Reload once the network is quiet: WebKit fails a reload that cancels
// in-flight requests (Next's viewport prefetches) with "WebKit encountered an
// internal error" — the reload itself, not the page under test.
async function reloadWhenIdle(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle')
  await page.reload()
}

test('front page renders every section and the live widgets', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Rozsoshnykh')
  for (const h of ['Teknologistack', 'Driftsstatus', 'Hvor leserne kommer fra', 'Trafikk over tid']) {
    await expect(page.getByRole('heading', { name: h })).toBeVisible()
  }
  // The code-split widgets load and draw the stubbed /api data.
  await page.locator('#status').scrollIntoViewIfNeeded()
  await expect(page.getByText('Alle systemer operative').first()).toBeVisible()
  await page.locator('#besok').scrollIntoViewIfNeeded()
  await expect(page.locator('#besok').getByText('Norge').filter({ visible: true }).first()).toBeVisible()
  // Nothing wider than the screen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
})

// Each /api/* call is a Worker request against the free plan's daily quota:
// the widgets below the fold (lib/use-near-viewport.ts) ask nothing until a
// reader nears them, and the footer dot shares the dashboard's answer.
test('below-the-fold widgets wait for the reader; the status is fetched once', async ({ page }) => {
  const asked: string[] = []
  page.on('request', (r) => {
    const { pathname } = new URL(r.url())
    if (pathname.startsWith('/api/') || pathname === '/world.svg') asked.push(pathname)
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  expect(asked, 'nothing below the fold on load').toEqual([])
  await page.locator('#status').scrollIntoViewIfNeeded()
  await expect(page.getByText('Alle systemer operative').first()).toBeVisible()
  await page.locator('footer').scrollIntoViewIfNeeded()
  await expect(page.locator('footer').getByText('(alle systemer operative)')).toBeAttached()
  expect(asked.filter((p) => p === '/api/status')).toHaveLength(1)
})

test('the dashboard loads and polls only while it is on screen', async ({ page }) => {
  await page.clock.install()
  let calls = 0
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/status') calls++
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  expect(calls, 'below the fold: not even loaded').toBe(0)
  await page.locator('#status').scrollIntoViewIfNeeded()
  await expect(page.locator('#status').getByText('Alle systemer operative').first()).toBeVisible()
  expect(calls).toBe(1)
  // Scrolled away, past the 90 s refresh: nothing is fetched…
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForTimeout(300) // the observer reports the section gone
  await page.clock.runFor(100_000)
  await page.waitForTimeout(300)
  expect(calls).toBe(1)
  // …until it comes back into view, when the overdue refresh runs at once.
  await page.locator('#status').scrollIntoViewIfNeeded()
  await expect.poll(() => calls).toBe(2)
})

test.describe('first visit', () => {
  test.use({ introSeen: false })

  test('plays the intro once; any key skips it', async ({ page }) => {
    await page.goto('/')
    const greeting = page.getByText('HEI %USERNAME%')
    // Fading in (phase 1 began), not merely in the DOM: Playwright calls an
    // opacity-0 node visible, and a key pressed before the intro's keydown
    // listener is attached is lost (seen under load in WebKit). Phase 1's
    // timer is set in the same effect flush that attaches the listener.
    const card = greeting.locator('..')
    await expect.poll(() => card.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0)
    await page.keyboard.press('Space')
    await expect(greeting).toHaveCount(0, { timeout: 5_000 })
    expect(await page.evaluate(() => localStorage.getItem('intro-seen'))).toBe('1')
    await reloadWhenIdle(page)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText('HEI %USERNAME%')).toHaveCount(0)
  })
})

test('theme toggle switches and remembers the theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  const html = page.locator('html')
  await expect(html).not.toHaveClass(/\bdark\b/)
  await page.getByRole('button', { name: 'Bytt til mørkt tema' }).click()
  await expect(html).toHaveClass(/\bdark\b/)
  await reloadWhenIdle(page)
  await expect(html).toHaveClass(/\bdark\b/)
})

test('flipping back to the OS theme follows the OS again, live', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  const html = page.locator('html')
  await page.getByRole('button', { name: 'Bytt til mørkt tema' }).click()
  await expect(html).toHaveClass(/\bdark\b/)
  // Picked by hand: an OS switch doesn't override it.
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(html).toHaveClass(/\bdark\b/)
  // Back to the OS's own theme: nothing stored, and the OS leads again.
  await page.getByRole('button', { name: 'Bytt til lyst tema' }).click()
  await expect(html).not.toHaveClass(/\bdark\b/)
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull()
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(html).toHaveClass(/\bdark\b/)
})

test('NO/EN switch moves between the language twins', async ({ page }) => {
  await page.goto('/blogg/velkommen/')
  await page.getByRole('link', { name: /^EN/ }).click()
  await expect(page).toHaveURL(/\/en\/blog\/welcome\/$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByRole('link', { name: /^NO/ }).click()
  await expect(page).toHaveURL(/\/blogg\/velkommen\/$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'nb')
})

test('header nav scrolls within the front page (desktop)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the mobile menu has its own test')
  await page.goto('/')
  await page.getByRole('navigation').getByRole('link', { name: 'Kompetanse', exact: true }).click()
  await expect(page).toHaveURL(/\/#skills$/) // one hash, not /#main#skills
  await expect(page.locator('#skills')).toBeInViewport()
})

test('logo lines up with the content (desktop)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'one column on phones')
  await page.goto('/')
  const logo = await page.locator('header a').first().boundingBox()
  const h1 = await page.getByRole('heading', { level: 1 }).boundingBox()
  expect(Math.round(logo!.x)).toBe(Math.round(h1!.x))
})

test('mobile menu opens, closes on Escape and navigates', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'desktop shows the nav inline')
  await page.goto('/')
  const toggle = page.getByRole('button', { name: 'Åpne meny' })
  await toggle.click()
  const menu = page.getByRole('navigation', { name: 'Mobilnavigasjon' })
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(toggle).toBeFocused()
  await toggle.click()
  await page.getByRole('navigation', { name: 'Mobilnavigasjon' }).getByRole('link', { name: 'Blogg' }).click()
  await expect(page).toHaveURL(/\/blogg\/$/)
})

// WebKit's Tab skips links (Safari's default), so these run on Chromium.
test('mobile menu closes when Tab leaves it', async ({ page, isMobile, browserName }) => {
  test.skip(!isMobile || browserName === 'webkit', 'Chromium phone only')
  await page.goto('/blogg/')
  await page.getByRole('button', { name: 'Åpne meny' }).click()
  const menu = page.getByRole('navigation', { name: 'Mobilnavigasjon' })
  await menu.getByRole('link').last().focus()
  await page.keyboard.press('Tab')
  await expect(menu).toHaveCount(0)
})

test('every page starts with a skip link to its main content', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', "WebKit's Tab skips links")
  for (const path of ['/', '/kontakt/', '/blogg/velkommen/', '/en/privacy/']) {
    await page.goto(path)
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: /Hopp til hovedinnhold|Skip to main content/ })
    await expect(skip).toBeFocused()
    await expect(skip).toHaveAttribute('href', '#main')
    await expect(page.locator('main#main')).toHaveCount(1)
  }
})

test('blog: index → post → tag page and back', async ({ page }) => {
  await page.goto('/blogg/')
  await page.getByRole('link', { name: /Velkommen til bloggen/ }).click()
  await expect(page).toHaveURL(/\/blogg\/velkommen\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Velkommen til bloggen')
  await page.getByRole('main').getByRole('link', { name: 'Velkommen', exact: true }).first().click()
  await expect(page).toHaveURL(/\/blogg\/tag\/velkommen\/$/)
  await page.goto('/blogg/velkommen/')
  await page.getByRole('link', { name: /Tilbake til bloggen/ }).click()
  await expect(page).toHaveURL(/\/blogg\/$/)
})

test.describe('contact form', () => {
  async function fill(page: import('@playwright/test').Page) {
    await page.goto('/kontakt/')
    await page.getByLabel('Navn').fill('Test Person')
    await page.getByLabel('E-post').fill('test@example.com')
    await page.getByLabel('Melding').fill('Hei! Dette er en testmelding.')
    await page.getByRole('button', { name: 'Send melding' }).click()
  }

  test('sends and thanks the visitor', async ({ page }) => {
    await fill(page)
    await expect(page.getByText('Takk! Meldingen er sendt.')).toBeVisible()
  })

  test('says so on a rate limit and keeps the typed text', async ({ page, pageProblems }) => {
    await page.route('**/api/contact', (r) => r.fulfill({ status: 429, body: '{"error":"rate limited"}' }))
    await fill(page)
    await expect(page.getByText(/For mange meldinger på kort tid/)).toBeVisible()
    await expect(page.getByLabel('Melding')).toHaveValue('Hei! Dette er en testmelding.')
    // The browser logs the 429 this test asked for; anything else still fails.
    const i = pageProblems.findIndex((p) => p.includes('status of 429'))
    if (i >= 0) pageProblems.splice(i, 1)
  })

  test('a filter refusal points to e-mail, not to a challenge', async ({ page, pageProblems }) => {
    await page.route('**/api/contact', (r) => r.fulfill({ status: 403, body: '{"error":"forbidden"}' }))
    await fill(page)
    // Filtered by text: Next's route announcer is an alert too.
    const alert = page.getByRole('alert').filter({ hasText: 'stanset av sikkerhetsfiltrene' })
    await expect(alert).toBeVisible()
    await expect(alert.getByRole('link', { name: 'contact@rozsoshnykh.no' })).toBeVisible()
    const i = pageProblems.findIndex((p) => p.includes('status of 403'))
    if (i >= 0) pageProblems.splice(i, 1)
  })

  // The widget tests need an export built with a site key (ci.yml sets
  // Cloudflare's test key; e2e/fixtures.ts stands in for its api.js). A local
  // build without one renders no widget: they skip there, never in CI.
  const widgetOrSkip = (asked: number) => {
    test.skip(asked === 0 && !process.env.CI, 'export built without NEXT_PUBLIC_TURNSTILE_SITE_KEY')
    expect(asked, 'the CI export renders the Turnstile widget (ci.yml site key)').toBeGreaterThan(0)
  }

  test('a blocked security check points to e-mail, also after coming back', async ({ page, pageProblems }) => {
    let asked = 0
    await page.route(
      (url) => url.hostname === 'challenges.cloudflare.com',
      (r) => (asked++, r.abort()),
    )
    await page.goto('/kontakt/')
    await page.waitForLoadState('networkidle')
    widgetOrSkip(asked)
    const notice = page.getByRole('alert').filter({ hasText: 'Sikkerhetssjekken lastet ikke' })
    await expect(notice).toBeVisible()
    await expect(notice.getByRole('link', { name: 'contact@rozsoshnykh.no' })).toBeVisible()
    // Back to the form by client-side navigation: the loader tries again and
    // says so again (it used to wait forever on the dead <script>).
    await page.getByRole('link', { name: /Tilbake til forsiden/ }).click()
    await expect(page).toHaveURL(/\/\/[^/]+\/$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/kontakt\/$/)
    await expect(notice).toBeVisible()
    await page.getByLabel('Navn').fill('Test Person')
    await page.getByLabel('E-post').fill('test@example.com')
    await page.getByLabel('Melding').fill('Hei! Dette er en testmelding.')
    await page.getByRole('button', { name: 'Send melding' }).click()
    // Still the e-mail notice, never a challenge with no widget to solve.
    await expect(notice).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'Bekreft at du ikke er en bot' })).toHaveCount(0)
    // The browser logs each refused script load; anything else still fails.
    for (let i = pageProblems.length - 1; i >= 0; i--) {
      if (/Failed to load resource/.test(pageProblems[i])) pageProblems.splice(i, 1)
    }
  })

  test('the security check follows the site’s theme toggle', async ({ page }) => {
    let asked = 0
    page.on('request', (r) => {
      if (new URL(r.url()).hostname === 'challenges.cloudflare.com') asked++
    })
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/kontakt/')
    await page.waitForLoadState('networkidle')
    widgetOrSkip(asked)
    const widget = page.locator('[data-fake-turnstile]')
    await expect(widget).toHaveAttribute('data-fake-turnstile', 'light')
    await page.getByRole('button', { name: 'Bytt til mørkt tema' }).click()
    await expect(widget).toHaveAttribute('data-fake-turnstile', 'dark')
  })
})

test.describe('visit beacon (lib/visit.ts)', () => {
  const visits = (page: import('@playwright/test').Page) => {
    const sent: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/visit') sent.push(r.url())
    })
    return sent
  }

  test('waits for a human input, then counts once a day', async ({ page }) => {
    // Playwright's browser reports navigator.webdriver; pose as a person.
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }))
    const sent = visits(page)
    await page.goto('/')
    await page.waitForTimeout(1_000)
    expect(sent, 'nothing on load alone').toHaveLength(0)
    await page.keyboard.press('ArrowDown')
    await expect.poll(() => sent.length).toBe(1)
    // Another page, a reload, more input: the same browser, the same day.
    await page.goto('/blogg/')
    await page.keyboard.press('ArrowDown')
    await reloadWhenIdle(page)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(500)
    expect(sent).toHaveLength(1)
  })

  test('never counts a browser under automation', async ({ page }) => {
    const sent = visits(page)
    await page.goto('/')
    await page.keyboard.press('ArrowDown')
    await page.mouse.move(200, 200)
    await page.waitForTimeout(1_000)
    expect(sent).toHaveLength(0)
  })
})

// The post ViewCounter counts like the beacon: on human input, once per
// session per post, never under automation (lib/visit.ts onFirstHumanInput).
test.describe('post view counter', () => {
  const calls = (page: import('@playwright/test').Page) => {
    const methods: string[] = []
    page.on('request', (r) => {
      if (new URL(r.url()).pathname === '/api/views/velkommen') methods.push(r.method())
    })
    return methods
  }

  test('counts on the first human input, then only reads', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }))
    const methods = calls(page)
    await page.goto('/blogg/velkommen/')
    await page.waitForTimeout(1_000)
    expect(methods, 'nothing on load alone').toEqual([])
    await page.keyboard.press('ArrowDown')
    await expect.poll(() => methods).toEqual(['POST'])
    await reloadWhenIdle(page)
    await expect.poll(() => methods).toEqual(['POST', 'GET'])
  })

  test('only reads under automation', async ({ page }) => {
    const methods = calls(page)
    await page.goto('/blogg/velkommen/')
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(1_000)
    expect(methods).toEqual(['GET'])
  })
})

// Pre-launch (CLAUDE.md, SEO): no page may be indexed until the owner says
// "launch" — this test flips together with robots.index in app/layout.tsx.
test('pre-launch: every page tells search engines noindex', async ({ page, request, isMobile }) => {
  test.skip(isMobile, 'markup, not layout')
  const xml = await (await request.get('/sitemap.xml')).text()
  const paths = [...xml.matchAll(/<loc>https:\/\/rozsoshnykh\.no([^<]*)<\/loc>/g)].map((m) => m[1])
  expect(paths.length).toBeGreaterThan(0)
  for (const path of [...paths, '/kontakt/', '/personvern/', '/blogg/tag/velkommen/']) {
    await page.goto(path)
    const robots = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((e) => e.getAttribute('content')))
    expect(robots.length, path).toBeGreaterThan(0)
    for (const r of robots) expect(r, path).toMatch(/noindex/)
  }
})

test('404 page: HAL, a 404 status and the body font', async ({ page }) => {
  const res = await page.goto('/finnes-ikke/')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Beklager %username%')
  // finalize-export.mjs adds the font preload Next leaves off the 404 —
  // without it, display: 'optional' renders the page in the system monospace.
  await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(1)
  await page.evaluate(() => document.fonts.ready)
  expect(await page.evaluate(() => [...document.fonts].some((f) => f.family.includes('Intel') && f.status === 'loaded'))).toBe(true)
  await expect(page).toHaveTitle(/^404 – /)
  await page.getByRole('link', { name: 'Tilbake til forsiden' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('404 under /en/ speaks English', async ({ page }) => {
  const res = await page.goto('/en/finnes-ikke/')
  expect(res?.status()).toBe(404)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^I’m sorry %username%/)
  await page.getByRole('link', { name: 'Back to the home page' }).click()
  await expect(page).toHaveURL(/\/en\/$/)
})

test('the contact page’s footer doesn’t invite to the contact page', async ({ page }) => {
  await page.goto('/kontakt/')
  const footer = page.locator('footer')
  await expect(footer.getByText('GitHub')).toBeVisible()
  await expect(footer.getByRole('heading')).toHaveCount(0)
  await expect(footer.getByRole('link', { name: 'Kontaktskjema' })).toHaveCount(0)
})

for (const scheme of ['light', 'dark'] as const) {
  test(`no axe violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    for (const path of ['/', '/en/', '/blogg/velkommen/', '/kontakt/', '/personvern/', '/finnes-ikke/']) {
      await page.goto(path)
      // Let the lazy widgets and fade-ins settle before scanning contrast.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo({ top: y, behavior: 'instant' })
          await new Promise((r) => setTimeout(r, 100))
        }
      })
      await page.waitForTimeout(1_000)
      const { violations } = await new AxeBuilder({ page }).analyze()
      expect(
        violations.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
      ).toEqual([])
    }
  })
}

// Code blocks: rehype-highlight's token colours (app/globals.css) on the
// block PostPage gives `pre`. No published post has code yet, so blocks
// marked up as PostPage renders them are planted in a copy of the post's
// prose wrapper (same classes) and axe checks their contrast — the light
// theme once drew dark text on a dark block.
for (const scheme of ['light', 'dark'] as const) {
  test(`code blocks are readable (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/blogg/velkommen/')
    await page.waitForLoadState('networkidle')
    await page.locator('.prose').evaluate((prose) => {
      const copy = prose.cloneNode(false) as HTMLElement
      copy.id = 'planted-code'
      copy.innerHTML =
        '<pre tabindex="0"><code class="hljs language-bash"><span class="hljs-comment"># restart</span>\n' +
        '<span class="hljs-keyword">for</span> h <span class="hljs-keyword">in</span> web01; <span class="hljs-keyword">do</span> ' +
        'ssh <span class="hljs-string">"$h"</span> <span class="hljs-built_in">echo</span> <span class="hljs-variable">$?</span> ' +
        '<span class="hljs-number">42</span> <span class="hljs-title">main</span> <span class="hljs-attr">key</span>; ' +
        '<span class="hljs-keyword">done</span></code></pre><pre tabindex="0"><code>plain block, no language</code></pre>'
      prose.after(copy)
    })
    const { violations } = await new AxeBuilder({ page }).include('#planted-code').withRules(['color-contrast']).analyze()
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  })
}

// What visitors see while the site is young: below MIN_PUBLIC_VISITS
// (lib/geo.ts) the map and the chart keep their shape but show no number,
// and the chart says why.
test('below the public threshold no visit number shows', async ({ page }) => {
  await page.route('**/api/geo', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"countries":{"NO":11,"US":2,"UA":1,"AM":1}}' }),
  )
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    await page.locator('#besok').scrollIntoViewIfNeeded()
    await expect(page.locator('#besok').getByText('Norge').filter({ visible: true }).first()).toBeVisible()
    await expect(page.locator('#besok')).not.toContainText(/\d+ besøk/)
    await page.locator('#trender').scrollIntoViewIfNeeded()
    await expect(page.getByText('Samler data — tallene vises fra 100 besøk.')).toBeVisible()
    await page.waitForTimeout(1_000) // fade-ins and hover transitions settle
    const { violations } = await new AxeBuilder({ page }).include('#besok').include('#trender').analyze()
    expect(violations.map((v) => `${scheme} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  }
})
