import { expect, test } from '@playwright/test';

test('intro and start screen honor reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const starfield = page.locator('.animate-scroll-slow');
  await expect(starfield).toBeVisible();
  expect(await starfield.evaluate(node => getComputedStyle(node).animationName)).toBe('none');
  expect(await starfield.evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');

  await page.getByText(/skip/i).click();
  const startButton = page.getByRole('button', { name: /press start/i });
  await expect(startButton).toBeVisible();
  expect(await startButton.evaluate(node => getComputedStyle(node).animationName)).toBe('none');
});

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

test('the first sector can be completed with keyboard controls', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the full keyboard route is covered on desktop; mobile touch is tested separately');
  test.setTimeout(45_000);
  await page.goto('/');
  await page.getByText(/skip/i).click();
  await page.getByRole('button', { name: /press start/i }).click();

  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('Space');
  await expect(page.getByText('COURSE CLEAR!')).toBeVisible({ timeout: 35_000 });
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowRight');
  await expect(page.getByText('GET READY FOR SECTOR 2-1')).toBeVisible();
});

test('the second sector advances to sector three', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the full keyboard route is covered on desktop; mobile touch is tested separately');
  test.setTimeout(70_000);
  await page.goto('/');
  await page.getByText(/skip/i).click();
  await page.getByRole('button', { name: /press start/i }).click();

  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('Space');
  await expect(page.getByText('GET READY FOR SECTOR 2-1')).toBeVisible({ timeout: 35_000 });
  await page.getByRole('button', { name: /next sector/i }).click();
  await expect(page.getByText('GET READY FOR SECTOR 3-1')).toBeVisible({ timeout: 35_000 });
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowRight');
});

test('the third sector can finish the current campaign', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the full keyboard route is covered on desktop; mobile touch is tested separately');
  test.setTimeout(100_000);
  await page.goto('/');
  await page.getByText(/skip/i).click();
  await page.getByRole('button', { name: /press start/i }).click();

  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('Space');
  await expect(page.getByText('GET READY FOR SECTOR 2-1')).toBeVisible({ timeout: 35_000 });
  await page.getByRole('button', { name: /next sector/i }).click();
  await expect(page.getByText('GET READY FOR SECTOR 3-1')).toBeVisible({ timeout: 35_000 });
  await page.getByRole('button', { name: /next sector/i }).click();
  await expect(page.getByText('ALL SECTORS CLEARED!')).toBeVisible({ timeout: 40_000 });
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowRight');
});

test('touch controls advance through the first two sectors', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile touch viewport only');
  test.setTimeout(100_000);
  await page.goto('/');
  await page.getByText(/skip/i).click();
  await page.getByRole('button', { name: /press start/i }).click();

  const right = await page.getByRole('button', { name: 'Move Right' }).boundingBox();
  const jump = await page.getByRole('button', { name: 'Jump A' }).boundingBox();
  const point = (box, id) => ({ id, x: box.x + box.width / 2, y: box.y + box.height / 2 });
  const session = await page.context().newCDPSession(page);
  const pressControls = () => session.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [point(right, 1), point(jump, 2)],
  });
  const releaseControls = () => session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pressControls();
  await expect(page.getByText('GET READY FOR SECTOR 2-1')).toBeVisible({ timeout: 35_000 });
  await releaseControls();
  await page.getByRole('button', { name: /next sector/i }).click();
  await pressControls();
  await expect(page.getByText('GET READY FOR SECTOR 3-1')).toBeVisible({ timeout: 35_000 });
  await releaseControls();
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
  expect(await page.locator('canvas').evaluate(canvas => canvas.getBoundingClientRect().width)).toBeGreaterThanOrEqual(680);
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
