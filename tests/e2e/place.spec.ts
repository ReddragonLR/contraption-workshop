import { test, expect, type Page } from '@playwright/test';

const WORLD_W = 960;

async function canvasPoint(page: Page, wx: number, wy: number): Promise<{ x: number; y: number }> {
  const box = (await page.locator('#game-canvas').boundingBox())!;
  const scale = box.width / WORLD_W;
  return { x: box.x + wx * scale, y: box.y + wy * scale };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?test=1');
  await expect(page.locator('#game-canvas')).toBeVisible();
});

test('drag a part from the bin onto the canvas; bin count decrements', async ({ page }) => {
  const tile = page.locator('[data-testid=bin-tile-ramp]');
  await expect(tile).toBeVisible();
  const before = Number(await page.locator('[data-testid=bin-count-ramp]').textContent());

  const tileBox = (await tile.boundingBox())!;
  const drop = await canvasPoint(page, 480, 280);
  await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(drop.x, drop.y, { steps: 12 });
  await page.mouse.up();

  await expect(page.locator('[data-testid=bin-count-ramp]')).toHaveText(String(before - 1));
  const placements = await page.evaluate(() => window.__GAME__!.getPlacements());
  expect(placements).toHaveLength(1);
  expect(placements[0].partId).toBe('ramp');
  expect(placements[0].fromBin).toBe(true);
});

test('dropping a part outside the canvas cancels the placement', async ({ page }) => {
  const tile = page.locator('[data-testid=bin-tile-wall]');
  const before = Number(await page.locator('[data-testid=bin-count-wall]').textContent());
  const tileBox = (await tile.boundingBox())!;
  await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(tileBox.x + 30, tileBox.y + 200, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('[data-testid=bin-count-wall]')).toHaveText(String(before));
  expect(await page.evaluate(() => window.__GAME__!.getPlacements())).toHaveLength(0);
});

test('overlapping placement is rejected with feedback', async ({ page }) => {
  await page.evaluate(() => window.__GAME__!.placePart('wall', 480, 300));
  const tile = page.locator('[data-testid=bin-tile-wall]');
  const countAfterFirst = Number(await page.locator('[data-testid=bin-count-wall]').textContent());

  const tileBox = (await tile.boundingBox())!;
  const drop = await canvasPoint(page, 485, 302); // overlaps the placed wall
  await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(drop.x, drop.y, { steps: 12 });
  await page.mouse.up();

  await expect(page.locator('.toast')).toBeVisible();
  await expect(page.locator('[data-testid=bin-count-wall]')).toHaveText(String(countAfterFirst));
  expect(await page.evaluate(() => window.__GAME__!.getPlacements())).toHaveLength(1);
});

test('select, rotate, and delete a placed part returns it to the bin', async ({ page }) => {
  const id = await page.evaluate(() => window.__GAME__!.placePart('ramp', 400, 300));
  expect(id).toBeTruthy();
  const point = await canvasPoint(page, 400, 300);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('.sel-toolbar')).toBeVisible();

  await page.keyboard.press(']');
  let placements = await page.evaluate(() => window.__GAME__!.getPlacements());
  expect(placements[0].rotation).toBe(15);

  await page.keyboard.press('Delete');
  placements = await page.evaluate(() => window.__GAME__!.getPlacements());
  expect(placements).toHaveLength(0);
  await expect(page.locator('[data-testid=bin-count-ramp]')).toHaveText('10');
});

test('run, stop, and reset keep placements intact', async ({ page }) => {
  await page.evaluate(() => {
    window.__GAME__!.placePart('basketball', 300, 100);
    window.__GAME__!.placePart('ramp', 300, 400, 15);
  });
  await page.click('[data-testid=btn-run]');
  await expect(page.locator('[data-testid=run-status]')).toHaveAttribute('data-state', 'running');
  await page.waitForTimeout(800);
  await page.click('[data-testid=btn-reset]');
  await expect(page.locator('[data-testid=run-status]')).toHaveAttribute('data-state', 'editing');
  const placements = await page.evaluate(() => window.__GAME__!.getPlacements());
  expect(placements.find((p) => p.partId === 'basketball')).toMatchObject({ x: 300, y: 100 });
});
