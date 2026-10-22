import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures'

// User-level flows on the built export, desktop and mobile (playwright.config.ts).

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

test.describe('first visit', () => {
  test.use({ introSeen: false })

  test('plays the intro once; any key skips it', async ({ page }) => {
    await page.goto('/')
    const greeting = page.getByText('HEI %USERNAME%')
    await expect(greeting).toBeVisible()
    await page.keyboard.press('Space')
    await expect(greeting).toHaveCount(0, { timeout: 5_000 })
    expect(await page.evaluate(() => localStorage.getItem('intro-seen'))).toBe('1')
    await page.reload()
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
  await page.reload()
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
  await page.getByRole('navigation').getByRole('link', { name: 'Ferdigheter' }).click()
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
  await page.getByRole('link', { name: 'Tilbake til forsiden' }).click()
  await expect(page).toHaveURL(/\/$/)
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
