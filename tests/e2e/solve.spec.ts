import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/?test=1');
  await expect(page.locator('#game-canvas')).toBeVisible();
});

test('auto-solving level 1 shows the Win modal', async ({ page }) => {
  await page.evaluate(() => {
    const api = window.__GAME__!;
    (api.extras.loadLevel as (id: string) => boolean)('level-01');
    // Documented solution (tests/unit/solutions.ts + LEVELS.md).
    api.placePart('ramp', 230, 280, 15);
    api.placePart('ramp', 450, 430, 15);
    api.setSpeed(2);
    api.run();
  });
  await expect(page.locator('[data-testid=modal-win]')).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(() => window.__GAME__!.isWon())).toBe(true);
  // Solving marks progress (PRD §13.2 #8).
  const solved = await page.evaluate(() =>
    (window.__GAME__!.extras.getSolved as () => string[])(),
  );
  expect(solved).toContain('level-01');
});

test('a run that fizzles out shows the Settled modal with a retry nudge', async ({ page }) => {
  await page.evaluate(() => {
    const api = window.__GAME__!;
    (api.extras.loadLevel as (id: string) => boolean)('level-01');
    api.setSpeed(2);
    api.run(); // no parts placed — the ball rolls to a stop
  });
  await expect(page.locator('[data-testid=modal-settled]')).toBeVisible({ timeout: 30_000 });
  await page.click('[data-testid=btn-settle-reset]');
  await expect(page.locator('[data-testid=run-status]')).toHaveAttribute('data-state', 'editing');
});

test('the HUD shows the level goal text', async ({ page }) => {
  await page.evaluate(() => (window.__GAME__!.extras.loadLevel as (id: string) => boolean)('level-01'));
  await expect(page.locator('[data-testid=level-title]')).toHaveText('Roll With It');
  await expect(page.locator('[data-testid=goal-text]')).toContainText('basketball into the bucket');
});

test('Win modal "Next Level" advances to level 2', async ({ page }) => {
  await page.evaluate(() => {
    const api = window.__GAME__!;
    (api.extras.loadLevel as (id: string) => boolean)('level-01');
    api.placePart('ramp', 230, 280, 15);
    api.placePart('ramp', 450, 430, 15);
    api.setSpeed(2);
    api.run();
  });
  await expect(page.locator('[data-testid=modal-win]')).toBeVisible({ timeout: 20_000 });
  await page.click('[data-testid=btn-next-level]');
  await expect(page.locator('[data-testid=level-title]')).toHaveText('Special Delivery');
  await expect(page.locator('[data-testid=run-status]')).toHaveAttribute('data-state', 'editing');
});
