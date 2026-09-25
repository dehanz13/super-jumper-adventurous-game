import { expect, test } from '@playwright/test';

test('a player can start, pause, and resume a world', async ({ page }) => {
  await page.goto('/');
  await page.getByText(/skip/i).click();
  await page.getByRole('button', { name: /press start/i }).click();

  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('SECTOR')).toBeVisible();
  await page.getByRole('button', { name: 'Pause game' }).click();
  await expect(page.getByText('PAUSED')).toBeVisible();
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByText('PAUSED')).toBeHidden();
});

test('the player sprite reaches the ground line', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.getByText(/skip/i).click();
  await page.getByRole('button', { name: /press start/i }).click();

  await expect.poll(async () => page.locator('canvas').evaluate(canvas => {
    return Array.from(canvas.getContext('2d').getImageData(114, 499, 1, 1).data).slice(0, 3);
  }), { timeout: 5_000 }).toEqual([46, 64, 90]);
  await page.locator('canvas').screenshot({
    path: `test-results/grounding-${isMobile ? 'mobile' : 'desktop'}.png`,
  });
});

test('mobile controls are available for touch', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile viewport only');
  await page.goto('/');
  await page.getByText(/skip/i).click();
  await page.getByRole('button', { name: /press start/i }).click();

  await expect(page.getByRole('button', { name: 'Move Right' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jump A' })).toBeVisible();
  await page.getByRole('button', { name: 'Jump A' }).tap();
  await expect(page.locator('canvas')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/mobile-page.png', fullPage: true });
});

test('dragging across the direction pad reverses movement', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile viewport only');
  await page.goto('/');
  await page.getByText(/skip/i).click();
  await page.getByRole('button', { name: /press start/i }).click();

  const playerFootX = () => page.locator('canvas').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 499, 350, 1).data;
    const positions = [];
    for (let x = 0; x < 350; x++) {
      const offset = x * 4;
      if (pixels[offset] === 46 && pixels[offset + 1] === 64 && pixels[offset + 2] === 90) positions.push(x);
    }
    return positions.length ? (positions[0] + positions[positions.length - 1]) / 2 : null;
  });

  await expect.poll(playerFootX).not.toBeNull();
  const initialX = await playerFootX();
  const right = await page.getByRole('button', { name: 'Move Right' }).boundingBox();
  const left = await page.getByRole('button', { name: 'Move Left' }).boundingBox();
  const touchPoint = (box) => ({ id: 1, x: box.x + box.width / 2, y: box.y + box.height / 2 });
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint(right)] });
  await expect.poll(playerFootX).toBeGreaterThan(initialX + 10);
  const rightX = await playerFootX();
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touchPoint(left)] });
  await expect.poll(playerFootX).toBeLessThan(rightX - 10);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
});
