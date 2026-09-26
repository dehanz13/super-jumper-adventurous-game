import { expect, test } from '@playwright/test';

test('public solo board separates current weekly and account all-time scores', async ({ page }) => {
  let reads = 0;
  await page.route('**/v1/leaderboards?*', async route => {
    reads++;
    const request = route.request();
    const url = new URL(request.url());
    expect(url.searchParams.get('game-id')).toBe('nova-orbit-jump');
    expect(url.searchParams.get('variant')).toBe('alltopics');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(request.headers()['x-api-version']).toBe('1');
    expect(request.headers()['x-tracking-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    expect(request.headers()['x-api-key']).toBeUndefined();
    const period = url.searchParams.get('period');
    expect(period).toMatch(/^(weekly-\d{4}-W\d{2}|alltime)$/);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      gameId: 'nova-orbit-jump', variant: 'alltopics', period, playerCount: 1,
      entries: [{ rank: 1, playerId: 'not-shown', displayName: period === 'alltime' ? 'Account Ace' : 'Guest Nova', country: 'US', score: 420, lastPlayedAt: '2026-09-25T12:00:00Z' }],
    }) });
  });
  await page.goto('/');
  await page.getByText(/skip/i).click();
  await page.getByRole('button', { name: 'View solo ranks' }).click();
  await expect(page.getByRole('region', { name: 'Nova solo leaderboard' })).toBeVisible();
  await expect(page.getByText('Guest Nova')).toBeVisible();
  await expect(page.getByText('not-shown')).toHaveCount(0);
  await page.getByRole('button', { name: 'All time' }).click();
  await expect(page.getByText('Account Ace')).toBeVisible();
  await expect(page.getByText('Hearso accounts only')).toBeVisible();
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect.poll(() => reads).toBe(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'This week' })).toBeVisible();
  await expect(page.getByText('Account Ace')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('button', { name: /press start/i })).toBeVisible();
});
