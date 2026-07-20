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

test('completes mission one, enters the streamed city, walks through both new interiors, and resets', async ({ page }) => {
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
  await page.evaluate(() => window.__MC_TEST__?.setCameraYaw(Math.PI / 2));
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'artifacts/screenshots/phase2-power-panel.png' });
  await interact();
  await page.evaluate(() => window.__MC_TEST__?.setCameraYaw(Math.PI));
  expect((await page.evaluate(() => window.__MC_TEST__?.getState()))!.missionObjective).toBe('power-sequence');

  await teleport(-5.8, -6.15, Math.PI / 2);
  await interact();
  await teleport(-5.8, -5.1, Math.PI / 2);
  await interact();
  await teleport(-5.8, -4.05, Math.PI / 2);
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

  await page.getByRole('button', { name: 'ادخل المدينة', exact: true }).click();
  await expect.poll(
    async () => (await page.evaluate(() => window.__MC_TEST__?.getState()))!.freeRoam,
  ).toBe(true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/screenshots/phase3-city-intersection.png' });

  await teleport(-34, 23.5, 0);
  await page.evaluate(() => window.__MC_TEST__?.setCameraYaw(0));
  await expect(page.getByText('افتح الباب', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/screenshots/phase3-mohammed-home.png' });
  await interact();
  await page.waitForTimeout(600);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyW');
  expect((await page.evaluate(() => window.__MC_TEST__?.getState()))!.insideInterior).toBe(true);

  await teleport(30, 34.8, Math.PI);
  await page.evaluate(() => window.__MC_TEST__?.setCameraYaw(Math.PI));
  await expect(page.getByText('افتح الباب', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/screenshots/phase3-supermarket.png' });
  await interact();
  await page.waitForTimeout(600);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyW');
  const supermarketInterior = (await page.evaluate(() => window.__MC_TEST__?.getState()))!;
  expect(supermarketInterior.insideInterior).toBe(true);
  expect(supermarketInterior.activeNPCs).toBeGreaterThanOrEqual(1);
  expect(supermarketInterior.drawCalls).toBeLessThan(150);
  // Ceiling raised from 100k for the approved 55.7k-triangle GLB character
  // (within the 25k-60k character budget); measured 124,618 at integration.
  expect(supermarketInterior.triangles).toBeLessThan(150_000);
  await page.screenshot({ path: 'artifacts/screenshots/phase3-supermarket-interior.png' });

  await page.reload();
  await page.getByRole('button', { name: /متابعة/ }).click();
  await expect.poll(
    async () => (await page.evaluate(() => window.__MC_TEST__?.getState()))!.freeRoam,
  ).toBe(true);

  await page.evaluate(() => window.__MC_TEST__?.resetMission());
  await page.waitForTimeout(150);
  const reset = (await page.evaluate(() => window.__MC_TEST__?.getState()))!;
  expect(reset.missionObjective).toBe('discover-panel');
  expect(reset.missionCompleted).toBe(false);
  expect(reset.generatorOn).toBe(false);
  expect(reset.doorOpen).toBe(false);
  expect(reset.vehicleOccupied).toBe(false);
  expect(consoleErrors).toEqual([]);
});

test('completes the phase four story, races, puzzle, repairs, map, and vehicle rewards', async ({ page }) => {
  test.setTimeout(120_000);
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    localStorage.setItem('mohammed-city.mission-01-warehouse-escape.v1', JSON.stringify({
      missionId: 'mission-01-warehouse-escape',
      version: 1,
      started: true,
      completed: true,
      objectiveIndex: 7,
      sequenceIndex: 0,
    }));
    localStorage.removeItem('mohammed-city.phase-four-story.v1');
  });
  await page.goto('/?debug');
  await page.getByRole('button', { name: /متابعة/ }).click();

  const state = async () => page.evaluate(() => window.__MC_TEST__?.getState());
  const expectObjective = async (id: string): Promise<void> => {
    await expect.poll(async () => (await state())!.storyObjective).toBe(id);
  };
  const teleport = async (x: number, z: number, yaw: number): Promise<void> => {
    await page.evaluate(([nextX, nextZ, nextYaw]) => {
      window.__MC_TEST__?.teleportPlayer(nextX, 0, nextZ, nextYaw);
    }, [x, z, yaw] as [number, number, number]);
    await page.waitForTimeout(120);
  };
  const teleportVehicle = async (x: number, z: number, yaw = 0): Promise<void> => {
    await page.evaluate(([nextX, nextZ, nextYaw]) => {
      window.__MC_TEST__?.teleportActiveVehicle(nextX, nextZ, nextYaw);
    }, [x, z, yaw] as [number, number, number]);
    await page.waitForTimeout(120);
  };
  const interact = async (): Promise<void> => {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(120);
  };
  const finishDialogue = async (): Promise<void> => {
    const panel = page.locator('[data-screen="dialogue"].is-visible');
    const next = panel.locator('[data-dialogue-next]');
    await expect(next).toHaveText('متابعة');
    await next.click();
    await expect(next).toHaveText('تم');
    await next.click();
    await expect(panel).not.toBeVisible();
  };
  const crossZones = async (points: ReadonlyArray<readonly [number, number]>): Promise<void> => {
    for (const [index, [x, z]] of points.entries()) {
      await teleport(x, z, 0);
      if (index < points.length - 1) {
        await expect.poll(async () => (await state())!.storySequence).toBe(index + 1);
      }
    }
  };
  const driveZones = async (points: ReadonlyArray<readonly [number, number]>): Promise<void> => {
    for (const [index, [x, z]] of points.entries()) {
      await teleportVehicle(x, z);
      if (index < points.length - 1) {
        await expect.poll(async () => (await state())!.storySequence).toBe(index + 1);
      }
    }
  };

  await expect.poll(async () => (await state())!.freeRoam).toBe(true);
  await expectObjective('friend-report');
  await page.keyboard.press('KeyM');
  await expect(page.getByRole('heading', { name: 'خريطة المدينة' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/screenshots/phase4-map.png' });
  await page.keyboard.press('KeyM');

  await teleport(-24, 21.6, 0);
  await interact();
  await expect(page.getByText('يا محمد، دراجتي اختفت من عند البيت!')).toBeVisible();
  await page.screenshot({ path: 'artifacts/screenshots/phase4-dialogue.png' });
  await finishDialogue();
  await expectObjective('follow-tracks');
  await crossZones([[-16, 29], [2, 29], [16, 29]]);
  await expectObjective('ask-first-witness');

  await teleport(18, 23.5, 0);
  await interact();
  await finishDialogue();
  await expectObjective('ask-second-witness');
  await teleport(42, 23.5, 0);
  await interact();
  await finishDialogue();
  await expectObjective('check-store-camera');
  await teleport(45, 22.2, 0);
  await interact();
  await expectObjective('alley-chase');
  await crossZones([[44, 29], [36, 23], [27, 35], [16, 36]]);
  await expectObjective('recover-bicycle');
  await teleport(15, 34.6, Math.PI);
  await interact();
  await expectObjective('enter-bicycle');
  await page.keyboard.press('KeyF');
  await expect.poll(async () => (await state())!.activeVehicleId).toBe('bicycle');
  await expectObjective('return-bicycle');
  await teleportVehicle(-24, 20, -Math.PI / 2);
  await expect.poll(async () => (await state())!.storyMission).toBe('street-races');

  await teleport(8.7, 41.5, Math.PI);
  await interact();
  await finishDialogue();
  await expectObjective('enter-sport-car');
  await teleport(8, 27, Math.PI);
  await page.keyboard.press('KeyF');
  await expect.poll(async () => (await state())!.activeVehicleId).toBe('sport-car');
  await driveZones([[0, 29], [24, 29], [46, 29]]);
  await expectObjective('race-one');
  await driveZones([[36, 29], [0, 29], [-38, 29], [0, 29]]);
  await expectObjective('race-two');
  await driveZones([[40, 29], [0, 29], [0, 8], [0, 29], [-40, 29]]);
  await expectObjective('race-three');
  await driveZones([[-42, 29], [0, 29], [42, 29], [0, 29], [0, 8], [0, 29]]);
  await expect.poll(async () => (await state())!.storyMission).toBe('abandoned-house');
  await page.screenshot({ path: 'artifacts/screenshots/phase4-sport-car.png' });

  await teleport(-26, 21.6, 0);
  await interact();
  await finishDialogue();
  await crossZones([[-39, 16]]);
  await expectObjective('open-side-door');
  await teleport(-38.2, 16, Math.PI / 2);
  await interact();
  await expectObjective('symbol-puzzle');
  await teleport(-47.5, 20, 0);
  await interact();
  expect((await state())!.storySequence).toBe(0);
  for (const [index, x] of [-51.5, -49.5, -47.5].entries()) {
    await teleport(x, 20, 0);
    await interact();
    if (index < 2) await expect.poll(async () => (await state())!.storySequence).toBe(index + 1);
  }
  await expectObjective('open-hidden-room');
  await teleport(-47, 14.8, 0);
  await interact();
  await page.waitForTimeout(500);
  await expectObjective('take-map-fragment');
  await teleport(-47, 12.4, 0);
  await interact();
  await expect.poll(async () => (await state())!.storyMission).toBe('secret-garage');
  await page.screenshot({ path: 'artifacts/screenshots/phase4-old-house.png' });

  await teleport(8.7, 41.5, Math.PI);
  await interact();
  await finishDialogue();
  await expectObjective('collect-parts');
  for (const [index, [x, z]] of ([[-14, -8.6], [47, 25.4], [-26, 15.4]] as const).entries()) {
    await teleport(x, z, 0);
    await interact();
    if (index < 2) await expect.poll(async () => (await state())!.storySequence).toBe(index + 1);
  }
  await expectObjective('repair-classic');
  for (const [index, x] of [-3.2, 0, 3.2].entries()) {
    await teleport(x, 42.4, Math.PI);
    await interact();
    if (index < 2) await expect.poll(async () => (await state())!.storySequence).toBe(index + 1);
  }
  await expectObjective('start-classic');
  await teleport(-11, 27.6, Math.PI);
  await interact();
  await expectObjective('enter-classic');
  await page.keyboard.press('KeyF');
  await expect.poll(async () => (await state())!.activeVehicleId).toBe('classic-car');
  await driveZones([[-34, 29], [0, 29], [32, 29]]);
  await expectObjective('drawer-clue');
  await teleport(-3.3, 43, Math.PI);
  await interact();
  await expect.poll(async () => (await state())!.storyCompleted).toBe(true);
  expect((await state())!.storyObjective).toBeNull();
  expect((await state())!.drawCalls).toBeLessThan(180);
  expect((await state())!.triangles).toBeLessThan(120_000);
  await page.screenshot({ path: 'artifacts/screenshots/phase4-story-complete.png' });
  expect(consoleErrors).toEqual([]);
});
