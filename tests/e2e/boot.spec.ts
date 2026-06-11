import { test, expect } from '@playwright/test';

test('app boots with no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('/');
  await expect(page).toHaveTitle(/Contraption Workshop/);
  await expect(page.locator('canvas#game-canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
