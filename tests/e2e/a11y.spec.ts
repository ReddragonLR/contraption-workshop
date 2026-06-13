import { test, expect } from '@playwright/test';

test('Win modal can be dismissed with the Escape key', async ({ page }) => {
  await page.goto('/?test=1');
  await page.evaluate(() => {
    const api = window.__GAME__!;
    (api.extras.loadLevel as (id: string) => boolean)('level-01');
    api.placePart('ramp', 230, 280, 15);
    api.placePart('ramp', 450, 430, 15);
    api.setSpeed(2);
    api.run();
  });
  await expect(page.locator('[data-testid=modal-win]')).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid=modal-win]')).toHaveCount(0);
});

test('the level-select dialog traps Tab focus and restores focus on close', async ({ page }) => {
  await page.goto('/?test=1');
  await page.focus('[data-testid=btn-levels]');
  await page.click('[data-testid=btn-levels]');
  await expect(page.locator('[data-testid=modal-levels]')).toBeVisible();

  // Tabbing repeatedly never escapes the dialog.
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  const inDialog = await page.evaluate(() =>
    !!document.activeElement?.closest('[data-testid=modal-levels]'),
  );
  expect(inDialog).toBe(true);

  // Escape closes and focus returns to the Levels button that opened it.
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid=modal-levels]')).toHaveCount(0);
  const restored = await page.evaluate(
    () => document.activeElement?.getAttribute('data-testid'),
  );
  expect(restored).toBe('btn-levels');
});

test('a part can be placed and moved entirely by keyboard', async ({ page }) => {
  await page.goto('/?test=1');
  await page.click('[data-testid=mode-sandbox]');
  const tile = page.locator('[data-testid=bin-tile-ramp]');
  await tile.focus();
  await page.keyboard.press('Enter'); // place at grid cursor + select
  let placements = await page.evaluate(() => window.__GAME__!.getPlacements());
  expect(placements).toHaveLength(1);
  const before = placements[0];

  // Arrow keys nudge the selected part on the grid.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  placements = await page.evaluate(() => window.__GAME__!.getPlacements());
  expect(placements[0].x).toBe(before.x + 20);
  expect(placements[0].y).toBe(before.y + 10);

  // Bracket rotates it.
  await page.keyboard.press(']');
  placements = await page.evaluate(() => window.__GAME__!.getPlacements());
  expect(placements[0].rotation).toBe(15);
});
