import { expect, test, type Page } from '@playwright/test';

const PORTRAIT_SIZES = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];
const LANDSCAPE_SIZES = [
  { width: 844, height: 390 },
  { width: 932, height: 430 },
];

interface Rect { left: number; right: number; top: number; bottom: number; width: number; height: number }

async function documentMetrics(page: Page): Promise<{
  docScrollWidth: number; docScrollHeight: number; bodyScrollWidth: number;
  innerWidth: number; innerHeight: number;
}> {
  return page.evaluate(() => ({
    docScrollWidth: document.documentElement.scrollWidth,
    docScrollHeight: document.documentElement.scrollHeight,
    bodyScrollWidth: document.body.scrollWidth,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }));
}

function expectRectWithinViewport(rect: Rect, viewportWidth: number, viewportHeight: number): void {
  expect(rect.left).toBeGreaterThanOrEqual(0);
  expect(rect.right).toBeLessThanOrEqual(viewportWidth);
  expect(rect.top).toBeGreaterThanOrEqual(0);
  expect(rect.bottom).toBeLessThanOrEqual(viewportHeight);
  expect(rect.height).toBeGreaterThanOrEqual(48);
}

test.describe('boot overlay fits every iPhone viewport without zoom', () => {
  for (const { width, height } of [...PORTRAIT_SIZES, ...LANDSCAPE_SIZES]) {
    test(`tap button is fully visible and clickable at ${width}x${height}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      page.on('pageerror', (error) => consoleErrors.push(error.message));

      await page.setViewportSize({ width, height });
      await page.goto('/');

      const tapButton = page.locator('[data-boot-tap]');
      await expect(tapButton).toBeVisible();
      const rect = await tapButton.evaluate((el) => el.getBoundingClientRect());
      expectRectWithinViewport(rect, width, height);

      const metrics = await documentMetrics(page);
      expect(metrics.docScrollWidth).toBeLessThanOrEqual(width);
      expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(width);

      // Real click, no synthetic coordinate hack and no page zoom applied.
      await tapButton.click();
      expect(consoleErrors).toEqual([]);
    });
  }
});

test.describe('portrait keeps the rotate prompt; landscape reaches the menu', () => {
  for (const { width, height } of PORTRAIT_SIZES) {
    test(`portrait ${width}x${height} shows rotate-required after loading, never the menu`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await page.locator('[data-boot-tap]').click();

      const overlay = page.locator('[data-boot-overlay]');
      await expect(overlay).toHaveAttribute('data-boot-state', 'loading');
      await expect(overlay).toHaveAttribute('data-boot-state', 'rotate-required', { timeout: 25_000 });
      await expect(page.getByText('لف الجوال بالعرض')).toBeVisible();
      // No Start control reachable while the rotate prompt owns the screen.
      await expect(page.locator('[data-menu-action="start"]')).toBeHidden();

      const metrics = await documentMetrics(page);
      expect(metrics.docScrollWidth).toBeLessThanOrEqual(width);
      expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(width);
    });
  }

  for (const { width, height } of LANDSCAPE_SIZES) {
    test(`landscape ${width}x${height} reaches the menu automatically after loading`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await page.locator('[data-boot-tap]').click();

      const overlay = page.locator('[data-boot-overlay]');
      await expect(overlay).toHaveAttribute('data-boot-state', 'hidden', { timeout: 25_000 });
      const startButton = page.locator('[data-menu-action="start"]');
      await expect(startButton).toBeVisible();
      const rect = await startButton.evaluate((el) => el.getBoundingClientRect());
      expectRectWithinViewport(rect, width, height);

      const metrics = await documentMetrics(page);
      expect(metrics.docScrollWidth).toBeLessThanOrEqual(width);
      expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(width);

      await startButton.click();
      await expect(page.getByText('دور على لوحة الكهرباء داخل المستودع')).toBeVisible();
    });
  }
});

test('rotating from portrait to landscape mid-boot continues automatically, no extra tap', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('[data-boot-tap]').click();
  await expect(page.locator('[data-boot-overlay]')).toHaveAttribute('data-boot-state', 'rotate-required', { timeout: 25_000 });

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('[data-boot-overlay]')).toHaveAttribute('data-boot-state', 'hidden', { timeout: 5_000 });
  await expect(page.locator('[data-menu-action="start"]')).toBeVisible();
});

test('loading overlay stays up until character loading settles, then clears without a second tap', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  const overlay = page.locator('[data-boot-overlay]');

  await page.locator('[data-boot-tap]').click();
  await expect(overlay).toHaveAttribute('data-boot-state', 'loading');
  await expect(page.getByText('جاري تحميل محمد')).toBeVisible();
  // Never an empty black screen: the loading stage's own content is visible
  // and the overlay keeps covering the canvas the whole time.
  await expect(overlay).toBeVisible();

  await expect(overlay).toHaveAttribute('data-boot-state', 'hidden', { timeout: 25_000 });
  await expect(page.locator('[data-menu-action="start"]')).toBeVisible();
});

test('fullscreen and orientation-lock rejection does not block startup', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    // Force-reject both optional enhancements, as iOS Safari commonly does,
    // and prove neither one throws unhandled or freezes the boot flow.
    // Patching the prototype (rather than document.documentElement, which
    // is not guaranteed to exist yet when an init script runs) always works.
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('denied by test'));
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await page.locator('[data-boot-tap]').click();
  await expect(page.locator('[data-boot-overlay]')).toHaveAttribute('data-boot-state', 'hidden', { timeout: 25_000 });
  await expect(page.locator('[data-menu-action="start"]')).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
