// KPI tile: sparkline drawing, gaps, sizing, names, descriptions and states. Runs in Chromium, Firefox and WebKit.
const { test, expect } = require('@playwright/test')
const { demo } = require('../../../test/e2e/helpers')

test.beforeEach(async ({ page }) => {
  page.errors = []
  page.on('pageerror', (e) => page.errors.push(e.message))
  await page.goto(demo('kpi-tile'))
})
test.afterEach(async ({ page }) => { expect(page.errors).toEqual([]) })

// Add a tile to the page and wait for the observer to handle it.
async function addTile(page, html) {
  await page.evaluate((h) => { const w = document.createElement('div'); w.className = 'kpis'; w.id = 'test-band'; w.innerHTML = h; document.body.append(w) }, html)
  await page.waitForTimeout(50)
  return page.locator('#test-band > .kpi').first()
}

test('every data-spark tile draws a decorative sparkline', async ({ page }) => {
  const tiles = page.locator('#spark > .kpi')
  await expect(tiles).toHaveCount(4)
  for (let i = 0; i < 4; i++) {
    const svg = tiles.nth(i).locator(':scope > svg.kpi-spark')
    await expect(svg).toHaveAttribute('aria-hidden', 'true')
    await expect(tiles.nth(i)).toHaveClass(/kpi--spark/)
  }
})

test('the curve is a monotone cubic that stays inside the drawing box', async ({ page }) => {
  const d = await page.locator('#spark > .kpi').first().locator('path.line').getAttribute('d')
  expect(d).toMatch(/^M[\d.]+,[\d.]+C/)
  const ys = [...d.matchAll(/[\d.]+,([\d.]+)/g)].map((m) => Number(m[1]))
  expect(Math.min(...ys)).toBeGreaterThanOrEqual(3 - 0.01)
  expect(Math.max(...ys)).toBeLessThanOrEqual(37 + 0.01)
})

test('a blank value is a gap: the line breaks there', async ({ page }) => {
  const d = await page.locator('#spark > .kpi').nth(1).locator('path.line').getAttribute('d')
  expect(d.match(/M/g)).toHaveLength(2)
})

test('a value alone between gaps is a dot; fewer than two numbers draws nothing', async ({ page }) => {
  const dot = await addTile(page, '<a class="kpi" href="#" data-spark="1,2,,5,,7,8"><span class="kpi-v">8</span><span class="kpi-l">Dots</span></a>')
  await expect(dot.locator('path.dot')).toHaveAttribute('d', /h0/)
  await page.evaluate(() => document.getElementById('test-band').remove())
  const none = await addTile(page, '<a class="kpi" href="#" data-spark="5,NA,n/a"><span class="kpi-v">5</span><span class="kpi-l">None</span></a>')
  await expect(none.locator('svg.kpi-spark')).toHaveCount(0)
  await expect(none).not.toHaveClass(/kpi--spark/)
})

test('changing data-spark redraws; removing it removes the line', async ({ page }) => {
  const t = page.locator('#spark > .kpi').first()
  const before = await t.locator('path.line').getAttribute('d')
  await t.evaluate((el) => { el.dataset.spark = '1,5,2,8' })
  await expect.poll(() => t.locator('path.line').getAttribute('d')).not.toBe(before)
  await t.evaluate((el) => { delete el.dataset.spark })
  await expect(t.locator('svg.kpi-spark')).toHaveCount(0)
})

test('each figure is sized by its length, leaving out any .sr-only word', async ({ page }) => {
  await expect(page.locator('#spark .kpi-v').nth(2)).toHaveCSS('--kpi-len', '7')
  await expect(page.locator('#states .kpi-v').first()).toHaveCSS('--kpi-len', '0')
})

test('every tile with data-tip is described by it', async ({ page }) => {
  const tiles = page.locator('.kpi[data-tip]')
  const n = await tiles.count()
  expect(n).toBe(23)
  for (let i = 0; i < n; i++) {
    const tip = await tiles.nth(i).getAttribute('data-tip')
    await expect(tiles.nth(i)).toHaveAccessibleDescription(tip)
  }
})

test('the description follows data-tip changes', async ({ page }) => {
  const t = page.locator('#static > .kpi').first()
  await t.evaluate((el) => { el.dataset.tip = 'Changed definition' })
  await expect(t).toHaveAccessibleDescription('Changed definition')
})

test('a static tile is a group named by its figure and label', async ({ page }) => {
  const t = page.locator('#static > .kpi').first()
  await expect(t).toHaveAttribute('role', 'group')
  await expect(t).toHaveAccessibleName('8 h Sunshine today')
})

test('state tiles say their state in words', async ({ page }) => {
  const s = page.locator('#states > .kpi')
  await expect(s.nth(0)).toHaveAccessibleName(/^Loading Temperature/)
  await expect(s.nth(1)).toHaveAccessibleName(/^No figure Humidity/)
  await expect(s.nth(2)).toHaveAccessibleName('No value Rainfall')
  await expect(s.nth(3)).toHaveAccessibleName('1,234,567 Readings stored')
  await expect(s.nth(0).locator('.sr-only')).toHaveCSS('position', 'absolute')
})

test('the definition tooltip shows on keyboard focus', async ({ page }) => {
  const t = page.locator('#static > .kpi').first()
  await t.focus()
  await expect.poll(() => t.evaluate((el) => getComputedStyle(el, '::after').opacity)).toBe('1')
})
