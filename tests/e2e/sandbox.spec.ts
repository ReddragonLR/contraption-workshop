import { test, expect } from '@playwright/test';

test('sandbox mode: free build and run with no goal and no modals', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('/?test=1');
  await page.click('[data-testid=mode-sandbox]');
  await expect(page.locator('[data-testid=level-title]')).toHaveText('Sandbox');

  // Build a little contraption through the test API.
  await page.evaluate(() => {
    const api = window.__GAME__!;
    api.placePart('ramp', 300, 200, 15);
    api.placePart('basketball', 240, 80);
    api.placePart('trampoline', 520, 520);
    api.placePart('bowling-ball', 700, 100);
    api.setSpeed(2);
    api.run();
  });
  await expect(page.locator('[data-testid=run-status]')).toHaveAttribute('data-state', 'running');

  // Sandbox never judges you: no win, no settle modal, even after everything stops.
  await page.waitForTimeout(5000);
  await expect(page.locator('[data-testid=modal-win]')).toHaveCount(0);
  await expect(page.locator('[data-testid=modal-settled]')).toHaveCount(0);

  await page.click('[data-testid=btn-stop]');
  await expect(page.locator('[data-testid=run-status]')).toHaveAttribute('data-state', 'editing');
  expect(errors).toEqual([]);
});

test('sandbox offers the full parts catalog', async ({ page }) => {
  await page.goto('/?test=1');
  await page.click('[data-testid=mode-sandbox]');
  for (const part of ['basketball', 'ramp', 'conveyor', 'fan', 'balloon', 'trampoline', 'seesaw', 'bucket']) {
    await expect(page.locator(`[data-testid=bin-tile-${part}]`)).toBeVisible();
  }
});
