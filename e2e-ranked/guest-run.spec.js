import { expect, test } from '@playwright/test';

const runId = '123e4567-e89b-42d3-a456-426614174000';
const runToken = 'A'.repeat(43);

test('a guest starts a server run and sees a rank only after publishing', async ({ page }) => {
  test.setTimeout(100_000);
  let finished = false;
  let verifiedScore = 0;
  let starts = 0;
  await page.route('**/v1/runs', async route => {
    const request = route.request();
    expect(request.method()).toBe('POST');
    expect(request.postDataJSON()).toEqual(starts++ === 0
      ? { guestProfile: { displayName: 'Nova', country: 'US' } }
      : { guestCredential: 'g'.repeat(43) });
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
      runId, runToken, expiresAt: '2030-01-01T00:00:00.000Z',
      ...(starts === 1 && { guestCredential: 'g'.repeat(43), guestCredentialExpiresAt: '2030-01-01T00:00:00.000Z' }),
      versions: {
        levelSetVersion: 'sha256:2e77fac2230965b7a25f8e4234f154f9e2974be8ba1583303dcf649ba233bb5b',
        rulesVersion: 1, scoringVersion: 1,
      },
    }) });
  });
  await page.route(`**/v1/runs/${runId}/finish`, async route => {
    const request = route.request();
    expect(request.headers().authorization).toBe(`Bearer ${runToken}`);
    expect(request.url()).not.toContain(runToken);
    expect(request.postDataJSON().transcript.endedAs).toBe('win');
    finished = true;
    verifiedScore = request.postDataJSON().claimedScore;
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ runId, status: 'pending_write', score: verifiedScore }) });
  });
  await page.route(`**/v1/runs/${runId}`, async route => {
    expect(finished).toBe(true);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ runId, status: 'ranked', score: verifiedScore, ranks: [{ board: 'weekly', rank: 5 }] }) });
  });

  await page.goto('/');
  await page.getByText(/skip/i).click();
  await expect(page.getByRole('button', { name: /press start/i })).toBeDisabled();
  await page.getByLabel('Public name').fill('Nova');
  await page.getByLabel('Country').selectOption('US');
  await page.getByRole('button', { name: /press start/i }).click();
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('Space');
  await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
  await expect(page.getByText('GET READY FOR SECTOR 2-1')).toBeVisible({ timeout: 35_000 });
  await page.getByRole('button', { name: /next sector/i }).click();
  await expect(page.getByText('GET READY FOR SECTOR 3-1')).toBeVisible({ timeout: 35_000 });
  await page.getByRole('button', { name: /next sector/i }).click();
  await expect(page.getByText('YOU WIN!')).toBeVisible({ timeout: 35_000 });
  await expect(page.getByRole('status')).toContainText('Weekly rank #5', { timeout: 10_000 });
  expect(finished).toBe(true);
  await page.getByRole('button', { name: /play again/i }).click();
  await expect(page.getByText('Continue your weekly guest rank')).toBeVisible();
  await page.getByRole('button', { name: /press start/i }).click();
  await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
  expect(starts).toBe(2);
});
