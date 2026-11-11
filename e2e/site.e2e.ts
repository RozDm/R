import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures'
import { endsWith, post, tagPage, twin } from './posts'

// User-level flows on the built export, desktop and mobile (playwright.config.ts).
// Blog tests take their post from the build (e2e/posts.ts), never by name.

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
  // Its live region announces the state only, not the «Oppdatert» time.
  await expect(page.locator('#status').getByRole('status')).toHaveText('Alle systemer operative')
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

// The caption under an uptime bar is quiet — «Siste N sjekker» — whatever old
// single failures the bar shows: counted out loud, they read as an alarm on a
// service that is up. The count stays for screen readers (the bar is colour
// and mouse-only titles, hidden from them), and while a service is down the
// caption says since when.
test('the uptime caption is quiet, and says since when a service is down', async ({ page }) => {
  const now = Date.now()
  const at = (i: number) => new Date(now - i * 300_000).toISOString()
  // Grafana: one old failed check, up now. NetBox: down for the last two.
  const up = (i: number) => ({ Grafana: i !== 3, NetBox: i > 1 })
  await page.route('**/api/status', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        updatedAt: new Date(now - 60_000).toISOString(),
        results: [
          { name: 'NetBox', ok: false, status: 503, ms: 120 },
          { name: 'Grafana', ok: true, status: 200, ms: 120 },
        ],
        history: [4, 3, 2, 1, 0].map((i) => ({ at: at(i), up: up(i) })),
      }),
    }),
  )
  await page.goto('/')
  const status = page.locator('#status')
  await status.scrollIntoViewIfNeeded()
  const caption = (name: string) =>
    status.locator('div.rounded-xl').filter({ hasText: name }).locator('span').filter({ hasText: 'Siste 5 sjekker' }).first()
  await expect(caption('Grafana')).toBeVisible()
  await expect(caption('Grafana')).not.toContainText('nede siden')
  await expect(caption('Grafana').locator('.sr-only')).toHaveText('· 1 feilet')
  await expect(caption('NetBox')).toContainText('nede siden')
  await expect(caption('NetBox').locator('.sr-only')).toHaveText('· 2 feilet')
  await expect(status.getByText('1:4:9')).toHaveCount(0)
  await expect(status.getByText('ingen feil')).toHaveCount(0)
  await expect(status.locator('[title*="nede"]').first().locator('..')).toHaveAttribute('aria-hidden', 'true')
})

// A visitor's clock can be days off. The stale banner and the Trends grid
// both hang on "now", so they take it from the answer's Date header
// (lib/server-clock.ts): on the local clock a fresh snapshot read as dead and
// the chart's dots fell off its grid.
test('a wrong clock on the visitor\'s machine greys out nothing', async ({ page }) => {
  const now = Date.now()
  const date = new Date(now).toUTCString()
  const hour = (h: number) => new Date(Math.floor((now - h * 3_600_000) / 3_600_000) * 3_600_000)
  const key = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ')
  await page.clock.install({ time: now + 2 * 86_400_000 })
  await page.route('**/api/status', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { date },
      body: JSON.stringify({
        updatedAt: new Date(now - 60_000).toISOString(),
        results: [{ name: 'Grafana', ok: true, status: 200, ms: 120 }],
        history: [{ at: new Date(now - 60_000).toISOString(), up: { Grafana: true } }],
      }),
    }),
  )
  await page.route('**/api/timeseries**', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { date },
      body: JSON.stringify({ metric: 'geo', range: '7d', points: [5, 2].map((h, i) => ({ ts: key(hour(h)), value: i + 1 })) }),
    }),
  )
  await page.goto('/')
  const status = page.locator('#status')
  await status.scrollIntoViewIfNeeded()
  await expect(status.getByText('Alle systemer operative').first()).toBeVisible()
  await expect(status.getByText('Statusdata er utdatert')).toHaveCount(0)
  const trends = page.locator('#trender')
  await trends.scrollIntoViewIfNeeded()
  await expect(trends.locator('svg[role="img"] circle')).toHaveCount(2)
})

// The footer is a phone's last stop. Its links read 16–20 px tall, but the
// finger gets 40 px or more (padding that moves nothing).
test('footer links are finger-sized', async ({ page }) => {
  await page.goto('/')
  const heights = await page
    .locator('footer a')
    .evaluateAll((links) => links.map((a) => Math.round(a.getBoundingClientRect().height)))
  expect(heights.length).toBeGreaterThanOrEqual(6)
  expect(heights.filter((h) => h < 40)).toEqual([])
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
  test.skip(!twin, 'no published post has an English twin')
  await page.goto(twin!.nb)
  await page.getByRole('link', { name: /^EN/ }).click()
  await expect(page).toHaveURL(endsWith(twin!.en))
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByRole('link', { name: /^NO/ }).click()
  await expect(page).toHaveURL(endsWith(twin!.nb))
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
  for (const path of ['/', '/kontakt/', post.path, '/en/privacy/']) {
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
  await page.getByRole('link', { name: post.title, exact: true }).first().click()
  await expect(page).toHaveURL(endsWith(post.path))
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(post.title)
  await page.locator(`main a[href="${tagPage}"]`).first().click()
  await expect(page).toHaveURL(endsWith(tagPage))
  await page.goto(post.path)
  await page.getByRole('link', { name: /Tilbake til bloggen/ }).click()
  await expect(page).toHaveURL(/\/blogg\/$/)
})

test('a post fits the screen, and inline code breaks between words only', async ({ page }) => {
  await page.goto(post.path)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
  // No table wider than the text column (a clipped table hides its overflow).
  const wideTables = await page.locator('.post-body table').evaluateAll((tables) => {
    const column = document.querySelector('.post-body')!.getBoundingClientRect().width
    return tables.map((t) => Math.round(t.getBoundingClientRect().width)).filter((w) => w > column + 1)
  })
  expect(wideTables).toEqual([])
  // lib/inline-code.ts: each word is one .code-word span, so none spans two lines.
  const split = await page
    .locator('.post-body .code-word')
    .evaluateAll((els) => els.filter((el) => el.getClientRects().length > 1).map((el) => el.textContent))
  expect(split).toEqual([])
})

// Post tables (app/globals.css): a cell hyphenates before it breaks a word
// just anywhere, and on a phone a table of up to three columns keeps every
// column readable — auto layout once left the label column 7 characters and
// «Internett» broke as «Interne/tt». A table is planted in the post's own
// .post-body, so the check needs no post with one.
test('post tables hyphenate, and a phone keeps every column readable', async ({ page }) => {
  await page.goto(post.path)
  const table = await page.locator('.post-body').evaluate((body) => {
    const planted = document.createElement('table')
    planted.id = 'planted-table'
    planted.innerHTML =
      '<thead><tr><th>Lag</th><th>Spørsmålet</th><th>Typiske feil</th></tr></thead><tbody>' +
      '<tr><td>5 Applikasjon</td><td>Svarer tjenesten riktig?</td><td>DNS, TLS, HTTP og <code>curl -v</code></td></tr>' +
      '<tr><td>3 Internett (IP)</td><td>Finnes det en vei dit?</td><td>Adresse, nettmaske, gateway, ruting</td></tr></tbody>'
    body.append(planted)
    return {
      wider: planted.getBoundingClientRect().width - body.getBoundingClientRect().width,
      code: getComputedStyle(planted.querySelector('code')!).hyphens,
      cells: [...planted.querySelectorAll('th, td')].map((cell) => {
        const style = getComputedStyle(cell)
        return { hyphens: style.hyphens, floor: parseFloat(style.minWidth) || 0, width: cell.getBoundingClientRect().width }
      }),
    }
  })
  expect(new Set(table.cells.map((c) => c.hyphens))).toEqual(new Set(['auto']))
  // Code keeps its characters: no hyphen that isn't in the command.
  expect(table.code).toBe('manual')
  expect(table.wider).toBeLessThanOrEqual(1)
  const phone = page.viewportSize()!.width < 640
  for (const cell of table.cells) {
    // The floor is the phone's; a desktop column is as wide as its text needs.
    if (phone) expect(cell.floor).toBeGreaterThan(60)
    else expect(cell.floor).toBe(0)
    expect(cell.width).toBeGreaterThanOrEqual(cell.floor - 0.5)
  }
})

test.describe('contact form', () => {
  async function fill(page: import('@playwright/test').Page) {
    await page.goto('/kontakt/')
    await page.getByLabel('Navn').fill('Test Person')
    await page.getByLabel('E-post').fill('test@example.com')
    await page.getByLabel('Melding').fill('Hei! Dette er en testmelding.')
    await page.getByRole('button', { name: 'Send melding' }).click()
  }

  // The form and its confirmation replace each other, so whatever had focus
  // is unmounted: focus moves to the confirmation's heading (read out with
  // the line under it), and back to the first field for the next message —
  // it used to fall to <body>, the top of the page.
  test('sends and thanks the visitor, and focus follows what replaced the form', async ({ page }) => {
    await fill(page)
    const thanks = page.getByRole('heading', { name: 'Takk! Meldingen er sendt.' })
    await expect(thanks).toBeFocused()
    await expect(thanks).toHaveAccessibleDescription('Jeg svarer som regel innen en dag eller to.')
    await page.getByRole('button', { name: /Send en til/ }).click()
    await expect(page.getByLabel('Navn')).toBeFocused()
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

// The form is a fetch() behind a Turnstile check: without JavaScript it can't
// send, and a native submit would be a GET with the message in the address
// bar. The page says so and gives the address, hides the fields that would
// lead nowhere, and the form's method keeps a message out of any URL.
test.describe('contact form without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('points to e-mail instead of offering a dead form', async ({ page }) => {
    await page.goto('/kontakt/')
    const form = page.locator('main form')
    // By its element, not getByText: Playwright's text matching never looks
    // inside a <noscript>.
    const note = form.locator('noscript p')
    await expect(note).toBeVisible()
    await expect(note).toContainText('Skjemaet trenger JavaScript')
    await expect(form.getByRole('link', { name: 'contact@rozsoshnykh.no' })).toHaveAttribute(
      'href',
      'mailto:contact@rozsoshnykh.no',
    )
    await expect(form).toHaveAttribute('method', 'post')
    await expect(form.getByLabel('Navn')).toBeHidden()
    await expect(form.getByRole('button', { name: 'Send melding' })).toBeHidden()
  })
})

// The post ViewCounter counts like the beacon: on human input, once per
// session per post, never under automation (lib/visit.ts onFirstHumanInput).
test.describe('post view counter', () => {
  const calls = (page: import('@playwright/test').Page) => {
    const methods: string[] = []
    page.on('request', (r) => {
      if (new URL(r.url()).pathname === `/api/views/${post.slug}`) methods.push(r.method())
    })
    return methods
  }

  test('counts on the first human input, then only reads', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }))
    const methods = calls(page)
    await page.goto(post.path)
    await page.waitForTimeout(1_000)
    expect(methods, 'nothing on load alone').toEqual([])
    await page.keyboard.press('ArrowDown')
    await expect.poll(() => methods).toEqual(['POST'])
    await reloadWhenIdle(page)
    await expect.poll(() => methods).toEqual(['POST', 'GET'])
  })

  test('only reads under automation', async ({ page }) => {
    const methods = calls(page)
    await page.goto(post.path)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(1_000)
    expect(methods).toEqual(['GET'])
  })
})

// Pre-launch (CLAUDE.md, SEO): no page may be indexed until the owner says
// "launch" — this test flips together with robots.index in app/layout.tsx
// and the home check in scripts/smoke.sh (all three, or CI or the deploy fails).
test('pre-launch: every page tells search engines noindex', async ({ page, request, isMobile }) => {
  test.skip(isMobile, 'markup, not layout')
  const xml = await (await request.get('/sitemap.xml')).text()
  const paths = [...xml.matchAll(/<loc>https:\/\/rozsoshnykh\.no([^<]*)<\/loc>/g)].map((m) => m[1])
  expect(paths.length).toBeGreaterThan(0)
  for (const path of [...paths, '/kontakt/', '/personvern/', tagPage]) {
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
  // Its family is named after lib/fonts.ts's const (intelOneMono), hashed or not.
  expect(await page.evaluate(() => [...document.fonts].some((f) => /intel/i.test(f.family) && f.status === 'loaded'))).toBe(true)
  await expect(page).toHaveTitle(/^404 – /)
  await page.getByRole('link', { name: 'Tilbake til forsiden' }).click()
  // The home URL itself: /\/$/ also matched the 404's own /finnes-ikke/.
  await expect(page).toHaveURL(/\/\/[^/]+\/$/)
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
    for (const path of ['/', '/en/', post.path, '/kontakt/', '/personvern/', '/finnes-ikke/']) {
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
// block PostPage gives `pre`. Blocks marked up as PostPage renders them are
// planted in a copy of the post's prose wrapper (same classes), so the check
// needs no post with code, and axe checks their contrast — the light theme
// once drew dark text on a dark block.
for (const scheme of ['light', 'dark'] as const) {
  test(`code blocks are readable (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto(post.path)
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

// The feed was a <link rel="alternate"> only: nothing a reader could see.
test('the blog index links its RSS feed, in both languages', async ({ page, request }) => {
  for (const [index, feed] of [
    ['/blogg/', '/feed.xml'],
    ['/en/blog/', '/en/feed.xml'],
  ]) {
    await page.goto(index)
    const link = page.locator('main a[type="application/rss+xml"]')
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', feed)
    expect(await (await request.get(feed)).text()).toContain('<rss')
  }
})
