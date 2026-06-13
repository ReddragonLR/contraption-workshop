import { test, expect } from '@playwright/test';

test('editor round-trip: build a tiny level, save it, reload, and play it', async ({ page }) => {
  await page.goto('/?test=1');
  await expect(page.locator('#game-canvas')).toBeVisible();

  // Enter the editor and build: a fixed bucket, a tagged ball above it,
  // a goal zone inside the bucket, and a 1-ramp bin.
  await page.click('[data-testid=mode-editor]');
  await expect(page.locator('.editor-panel')).toBeVisible();

  await page.evaluate(() => {
    const api = window.__GAME__!;
    const ballId = api.placePart('basketball', 200, 100)!;
    api.placePart('bucket', 650, 548);
    (api.extras.editorSetDraft as (p: Record<string, unknown>) => void)({
      title: 'Tiny Test Level',
      goalType: 'object-in-zone',
      goalDescription: 'Drop the ball in the bucket.',
      zone: { x: 616, y: 506, w: 68, h: 70 },
      sustainMs: 300,
      bin: [{ partId: 'ramp', count: 2 }],
    });
    // Tag the ball via the selection panel.
    window.__GAME__!.getPlacements();
    void ballId;
  });

  // Tag the ball through the real selection UI.
  const canvas = page.locator('#game-canvas');
  const box = (await canvas.boundingBox())!;
  const scale = box.width / 960;
  await page.mouse.click(box.x + 200 * scale, box.y + 100 * scale);
  await page.fill('[data-ed=selTag]', 'ball-1');
  await page.evaluate(() =>
    (window.__GAME__!.extras.editorSetDraft as (p: Record<string, unknown>) => void)({
      objectTag: 'ball-1',
    }),
  );

  // Save to localStorage.
  await page.click('[data-testid=editor-save]');
  const saved = await page.evaluate(
    () => (window.__GAME__!.extras.listCustomLevels as () => { id: string; title: string }[])(),
  );
  expect(saved).toContainEqual({ id: 'custom-tiny-test-level', title: 'Tiny Test Level' });

  // Reload the app — the custom level must survive and be playable.
  await page.reload();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.click('[data-testid=btn-levels]');
  await page.click('[data-testid=level-card-custom-tiny-test-level]');
  await expect(page.locator('[data-testid=level-title]')).toHaveText('Tiny Test Level');
  await expect(page.locator('[data-testid=goal-text]')).toContainText('Drop the ball');

  // It plays: ball is locked? No — placedParts are movable; just solve it.
  await page.evaluate(() => {
    const api = window.__GAME__!;
    api.move(api.getPlacements().find((p) => p.partId === 'basketball')!.instanceId, 650, 100);
    api.setSpeed(2);
    api.run();
  });
  await expect(page.locator('[data-testid=modal-win]')).toBeVisible({ timeout: 20_000 });
});

test('editor play-test loop: test a draft, then return to the editor', async ({ page }) => {
  await page.goto('/?test=1');
  await page.click('[data-testid=mode-editor]');
  await page.evaluate(() => {
    const api = window.__GAME__!;
    api.placePart('basketball', 480, 100);
    const id = api.getPlacements()[0].instanceId;
    void id;
    (api.extras.editorSetDraft as (p: Record<string, unknown>) => void)({
      title: 'Probe',
      goalType: 'object-in-zone',
      zone: { x: 430, y: 500, w: 120, h: 100 },
      objectTag: '',
      bin: [{ partId: 'ramp', count: 1 }],
    });
  });
  // Tag via selection UI.
  const box = (await page.locator('#game-canvas').boundingBox())!;
  await page.mouse.click(box.x + (480 / 960) * box.width, box.y + (100 / 600) * box.height);
  await page.fill('[data-ed=selTag]', 'ball-1');
  await page.evaluate(() =>
    (window.__GAME__!.extras.editorSetDraft as (p: Record<string, unknown>) => void)({
      objectTag: 'ball-1',
    }),
  );
  await page.click('[data-testid=editor-play]');
  await expect(page.locator('[data-testid=back-to-editor]')).toBeVisible();
  await expect(page.locator('[data-testid=level-title]')).toHaveText('Probe');
  await page.click('[data-testid=back-to-editor]');
  await expect(page.locator('.editor-panel')).toBeVisible();
  // The draft survived the round trip.
  await expect(page.locator('[data-ed=title]')).toHaveValue('Probe');
});
