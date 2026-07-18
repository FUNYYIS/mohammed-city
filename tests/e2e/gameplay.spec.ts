import { expect, test } from '@playwright/test';

test('starts, moves, jumps, crouches, pauses, and restores landscape play', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: /ابدأ/ }).click();
  await expect(page.getByText('تحرّك داخل الساحة واختبر الحواجز')).toBeVisible();

  const initial = await page.evaluate(() => window.__MC_TEST__?.getState());
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(650);
  await page.keyboard.up('KeyW');
  const moved = await page.evaluate(() => window.__MC_TEST__?.getState());
  expect(moved!.player.z).toBeLessThan(initial!.player.z - 0.3);

  // Orbit roughly 90 degrees left, then verify forward still follows the
  // camera view instead of reversing as the old sine signs did.
  const canvas = page.locator('#game-canvas');
  const canvasBounds = await canvas.boundingBox();
  expect(canvasBounds).not.toBeNull();
  const dragStartX = canvasBounds!.x + canvasBounds!.width * 0.72;
  const dragY = canvasBounds!.y + canvasBounds!.height * 0.5;
  await page.mouse.move(dragStartX, dragY);
  await page.mouse.down();
  await page.mouse.move(dragStartX - 374, dragY, { steps: 12 });
  await page.mouse.up();
  const beforeOrbitMove = await page.evaluate(() => window.__MC_TEST__?.getState());
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(650);
  await page.keyboard.up('KeyW');
  const afterOrbitMove = await page.evaluate(() => window.__MC_TEST__?.getState());
  expect(afterOrbitMove!.player.x).toBeLessThan(beforeOrbitMove!.player.x - 0.3);

  await page.keyboard.press('Space');
  await page.waitForTimeout(80);
  const jumping = (await page.evaluate(() => window.__MC_TEST__?.getState()))!;
  expect(jumping.grounded).toBe(false);
  expect(jumping.player.y).toBeGreaterThan(0);
  expect(jumping.playerRootY).toBeCloseTo(jumping.player.y, 4);
  expect(jumping.visualLocalY).toBeLessThan(0.05);

  await page.keyboard.down('KeyC');
  await page.waitForTimeout(50);
  expect((await page.evaluate(() => window.__MC_TEST__?.getState()))!.crouching).toBe(true);
  await page.keyboard.up('KeyC');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'اللعبة متوقفة' })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText('لف الجهاز عشان تلعب')).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });

  expect(consoleErrors).toEqual([]);
});
