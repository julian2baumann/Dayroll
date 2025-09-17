import { test, expect } from '@playwright/test'

test.describe('App shell smoke test', () => {
  test('renders hero copy and feature cards', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/everything new today/i)

    await expect(page.getByRole('list')).toContainText('ESLint, Prettier, TypeScript')
    await expect(page.getByRole('article').first()).toContainText('New Today overview')
  })
})
