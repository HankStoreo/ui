// Every demo page: loads without errors, follows the theme, and has no axe violations in light or dark.
const { test, expect } = require('@playwright/test')
const { demo, axe } = require('./helpers')

for (const name of ['button', 'kpi-tile']) {
  for (const theme of ['light', 'dark']) {
    test(`${name} demo, ${theme}: renders and passes axe`, async ({ page }) => {
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.goto(demo(name))
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
      expect(bg).toBe(theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(8, 9, 11)')
      expect(await axe(page)).toEqual([])
      expect(errors).toEqual([])
    })
  }

  test(`${name} demo: data-theme overrides the system setting`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto(demo(name))
    await page.selectOption('#theme', 'dark')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(8, 9, 11)')
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.selectOption('#theme', 'light')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  })
}
