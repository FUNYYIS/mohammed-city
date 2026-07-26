import { expect, test, type Page } from '@playwright/test';

const MISSION_STORAGE_KEY = 'mohammed-city.mission-01-warehouse-escape.v1';

async function tapBootStart(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'اضغط لبدء اللعبة' }).click();
  await page.locator('[data-boot-overlay]').waitFor({ state: 'hidden', timeout: 25_000 });
}

test('hands control back to Mohammed after 10 consecutive exits across multiple locations', async ({ page }) => {
  test.setTimeout(300_000);
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    MISSION_STORAGE_KEY,
    JSON.stringify({
      missionId: 'mission-01-warehouse-escape',
      version: 1,
      started: true,
      completed: true,
      objectiveIndex: 7,
      sequenceIndex: 0,
    }),
  ]);
  await page.goto('/');
  await tapBootStart(page);
  await page.locator('[data-menu-action="continue"]').click();
  await expect.poll(async () => (await page.evaluate(() => window.__MC_TEST__?.getState()))?.freeRoam, {
    timeout: 25_000,
  }).toBe(true);

  const scenarios: ReadonlyArray<readonly [number, number, number]> = [
    [0, 10.2, 0],
    [0, 10.2, Math.PI / 4],
    [0, 10.2, Math.PI / 2],
    [0, 10.2, Math.PI * 0.75],
    [0, 18, Math.PI],
    [0, 18, -Math.PI / 4],
    [0, 18, -Math.PI / 2],
    [0, 18, -Math.PI * 0.75],
    [0, 18, Math.PI / 6],
    [-21.55, 20, Math.PI],
  ];

  for (const [index, [x, z, yaw]] of scenarios.entries()) {
    const vehicle = (await page.evaluate(() => window.__MC_TEST__?.getState()))!.vehicle;
    await page.evaluate(([playerX, playerZ]) => {
      window.__MC_TEST__?.teleportPlayer(playerX, 0, playerZ);
    }, [vehicle.x, vehicle.z] as [number, number]);
    await page.keyboard.press('KeyF');
    await expect.poll(async () => (await page.evaluate(() => window.__MC_TEST__?.getState()))?.vehicleOccupied)
      .toBe(true);
    await page.evaluate(([nextX, nextZ, nextYaw]) => {
      window.__MC_TEST__?.teleportActiveVehicle(nextX, nextZ, nextYaw);
    }, [x, z, yaw] as [number, number, number]);
    await page.keyboard.press('KeyF');

    const exited = (await page.evaluate(() => window.__MC_TEST__?.getState()))!;
    expect(exited.vehicleOccupied, `exit ${index + 1}`).toBe(false);
    expect(exited.vehicleSpeed, `exit ${index + 1}`).toBe(0);
    expect(exited.playerControlEnabled, `exit ${index + 1}`).toBe(true);
    expect(exited.playerVisible, `exit ${index + 1}`).toBe(true);
    expect(exited.grounded, `exit ${index + 1}`).toBe(true);
    expect(exited.playerOverlappingCollider, `exit ${index + 1}`).toBe(false);

    if (index === scenarios.length - 1) {
      await page.keyboard.press('KeyE');
      await expect.poll(async () => (await page.evaluate(() => window.__MC_TEST__?.getState()))?.storyObjective)
        .toBe('follow-tracks');
      continue;
    }

    const walkingStart = exited.player;
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyW');
    const walked = (await page.evaluate(() => window.__MC_TEST__?.getState()))!.player;
    const walkingDistance = Math.hypot(walked.x - walkingStart.x, walked.z - walkingStart.z);
    expect(walkingDistance, `walk after exit ${index + 1}`).toBeGreaterThan(0.35);

    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ShiftLeft');
    const ran = (await page.evaluate(() => window.__MC_TEST__?.getState()))!.player;
    const runningDistance = Math.hypot(ran.x - walked.x, ran.z - walked.z);
    expect(runningDistance, `run after exit ${index + 1}`).toBeGreaterThan(walkingDistance);
  }
});
