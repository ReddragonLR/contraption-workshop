import { test, expect } from '@playwright/test';

test('solving a level persists and shows a checkmark after reload', async ({ page }) => {
  await page.goto('/?test=1');
  await expect(page.locator('#game-canvas')).toBeVisible();

  // Solve level 1 with the documented solution.
  await page.evaluate(() => {
    const api = window.__GAME__!;
    (api.extras.loadLevel as (id: string) => boolean)('level-01');
    api.placePart('ramp', 230, 280, 15);
    api.placePart('ramp', 450, 430, 15);
    api.setSpeed(2);
    api.run();
  });
  await expect(page.locator('[data-testid=modal-win]')).toBeVisible({ timeout: 20_000 });

  // Reload: progress survives via localStorage (PRD §3).
  await page.reload();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.click('[data-testid=btn-levels]');
  await expect(page.locator('[data-testid=level-card-level-01] .check')).toHaveText('✓ Solved');

  // The app boots into the first unsolved level now.
  await page.click('[data-testid=btn-levels-close]');
  await expect(page.locator('[data-testid=level-title]')).not.toHaveText('Roll With It');
});
