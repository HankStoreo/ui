// Button: names, busy width, the .btn-only press guard, reduced motion. Runs in Chromium, Firefox and WebKit.
const { test, expect } = require('@playwright/test')
const { demo } = require('../../../test/e2e/helpers')

test.beforeEach(async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(demo('button'))
  page.errors = errors
})
test.afterEach(async ({ page }) => { expect(page.errors).toEqual([]) })

test('a busy button keeps its label as its accessible name', async ({ page }) => {
  const busy = page.locator('#busy .btn')
  await expect(busy.nth(0)).toHaveAccessibleName('Publish draft')
  await expect(busy.nth(1)).toHaveAccessibleName('Save')
  await expect(busy.nth(0).locator('.spinner')).toBeVisible()
})

test('going busy does not change the button width', async ({ page }) => {
  const b = page.locator('#busy .btn').nth(0)
  const busyW = (await b.boundingBox()).width
  await b.evaluate((el) => el.removeAttribute('aria-busy'))
  const idleW = (await b.boundingBox()).width
  expect(Math.abs(busyW - idleW)).toBeLessThan(0.5)
})

test('a disabled button is described by its reason', async ({ page }) => {
  await expect(page.locator('button[aria-describedby="why-1"]')).toHaveAccessibleDescription('Two checks are still open.')
})

test('the guard drops presses on a busy or aria-disabled .btn', async ({ page }) => {
  // The demo clears busy after 2s. Freeze the clock so a slow runner can't let it expire mid-test.
  // install() alone keeps time flowing, and only governs pages loaded after it: reload, then pause.
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  await page.reload()
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'))
  const out = page.locator('#presses')
  await page.locator('#try-locked').click({ force: true })
  await expect(out).toHaveText('Presses handled: 0')
  await page.locator('#try-save').click()
  await expect(out).toHaveText('Presses handled: 1')
  await expect(page.locator('#try-save')).toHaveAttribute('aria-busy', 'true')
  await page.locator('#try-save').click()
  await page.locator('#try-save').press('Enter')
  await expect(out).toHaveText('Presses handled: 1')
})

test('the guard stops a busy .btn from submitting its form', async ({ page }) => {
  const submitted = await page.evaluate(() => {
    let n = 0
    const f = document.createElement('form')
    f.innerHTML = '<input name="q"><button class="btn" aria-busy="true">Go</button>'
    f.addEventListener('submit', (e) => { e.preventDefault(); n++ })
    document.body.append(f)
    f.querySelector('button').click()
    return n
  })
  expect(submitted).toBe(0)
})

test('the guard leaves controls without .btn alone', async ({ page }) => {
  const handled = await page.evaluate(() => {
    const hits = []
    const make = (html) => { const w = document.createElement('div'); w.innerHTML = html; document.body.append(w); return w.firstElementChild }
    const els = [
      make('<button type="button" aria-disabled="true">Plain</button>'),
      make('<div role="button" tabindex="0" aria-busy="true">Role</div>'),
      make('<a href="#x" aria-disabled="true">Link</a>'),
      make('<input type="button" value="Input" aria-busy="true">'),
    ]
    els.forEach((el, i) => { el.addEventListener('click', (e) => { e.preventDefault(); hits.push(i) }); el.click() })
    return hits
  })
  expect(handled).toEqual([0, 1, 2, 3])
})

test('the guard reads the flag on the button, not on a busy ancestor', async ({ page }) => {
  const n = await page.evaluate(() => {
    let n = 0
    const w = document.createElement('div'); w.setAttribute('aria-busy', 'true')
    w.innerHTML = '<button type="button" class="btn">Inside</button>'
    document.body.append(w)
    w.querySelector('button').addEventListener('click', () => n++)
    w.querySelector('button').click()
    return n
  })
  expect(n).toBe(1)
})

test('reduced motion stops the spinner', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const d = await page.locator('#busy .spinner').first().evaluate((el) => getComputedStyle(el).animationDuration)
  expect(d).toBe('0s')
})
