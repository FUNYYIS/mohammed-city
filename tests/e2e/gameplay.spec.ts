import { expect, test } from '@playwright/test';

test('starts, moves, jumps, crouches, pauses, and restores landscape play', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: /ابدأ/ }).click();
  await expect(page.getByText('دور على لوحة الكهرباء داخل المستودع')).toBeVisible();

  const initial = await page.evaluate(() => window.__MC_TEST__?.getState());
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(650);
  await page.keyboard.up('KeyW');
  const moved = await page.evaluate(() => window.__MC_TEST__?.getState());
  expect(moved!.player.z).toBeGreaterThan(initial!.player.z + 0.3);

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
  expect(afterOrbitMove!.player.x).toBeGreaterThan(beforeOrbitMove!.player.x + 0.3);

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

test('completes mission one in order, drives to the garage, and resets cleanly', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: /ابدأ مهمة جديدة/ }).click();
  await page.waitForTimeout(650);
  await page.screenshot({ path: 'artifacts/screenshots/phase2-warehouse.png' });

  const teleport = async (x: number, z: number, yaw: number): Promise<void> => {
    await page.evaluate(([nextX, nextZ, nextYaw]) => {
      window.__MC_TEST__?.teleportPlayer(nextX, 0, nextZ, nextYaw);
    }, [x, z, yaw] as [number, number, number]);
    await page.waitForTimeout(100);
  };
  const interact = async (): Promise<void> => {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(100);
  };

  await teleport(-5.8, -5.1, Math.PI / 2);
  await interact();
  expect((await page.evaluate(() => window.__MC_TEST__?.getState()))!.missionObjective).toBe('power-sequence');

  await teleport(-5.8, -5.8, Math.PI / 2);
  await interact();
  await teleport(-5.8, -5.1, Math.PI / 2);
  await interact();
  await teleport(-5.8, -4.4, Math.PI / 2);
  await interact();
  expect((await page.evaluate(() => window.__MC_TEST__?.getState()))!.missionObjective).toBe('start-generator');

  await teleport(3.2, -9.2, -Math.PI / 2);
  await interact();
  await expect.poll(
    async () => (await page.evaluate(() => window.__MC_TEST__?.getState()))!.generatorOn,
    { timeout: 4_000 },
  ).toBe(true);
  expect((await page.evaluate(() => window.__MC_TEST__?.getState()))!.missionObjective).toBe('open-main-door');

  await teleport(2.75, 2.55, Math.PI);
  await interact();
  await expect.poll(
    async () => (await page.evaluate(() => window.__MC_TEST__?.getState()))!.doorOpen,
    { timeout: 5_000 },
  ).toBe(true);
  expect((await page.evaluate(() => window.__MC_TEST__?.getState()))!.missionObjective).toBe('exit-warehouse');

  await teleport(0, 6.1, Math.PI);
  await page.waitForTimeout(150);
  expect((await page.evaluate(() => window.__MC_TEST__?.getState()))!.missionObjective).toBe('enter-car');

  await teleport(0, 7.7, Math.PI);
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(150);
  expect((await page.evaluate(() => window.__MC_TEST__?.getState()))!.vehicleOccupied).toBe(true);
  expect((await page.evaluate(() => window.__MC_TEST__?.getState()))!.missionObjective).toBe('reach-garage');

  await page.keyboard.down('KeyW');
  await expect(page.getByRole('heading', { name: 'كفو يا محمد!' })).toBeVisible({ timeout: 8_000 });
  await page.keyboard.up('KeyW');
  expect((await page.evaluate(() => window.__MC_TEST__?.getState()))!.missionCompleted).toBe(true);
  await page.screenshot({ path: 'artifacts/screenshots/phase2-mission-complete.png' });

  await page.getByRole('button', { name: 'إعادة المهمة', exact: true }).click();
  await page.waitForTimeout(150);
  const reset = (await page.evaluate(() => window.__MC_TEST__?.getState()))!;
  expect(reset.missionObjective).toBe('discover-panel');
  expect(reset.missionCompleted).toBe(false);
  expect(reset.generatorOn).toBe(false);
  expect(reset.doorOpen).toBe(false);
  expect(reset.vehicleOccupied).toBe(false);
  expect(consoleErrors).toEqual([]);
});
