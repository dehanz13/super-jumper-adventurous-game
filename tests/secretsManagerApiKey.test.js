import { describe, expect, it, vi } from 'vitest';
import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { createSecretsManagerApiKeyLoader } from '../src/server/secretsManagerApiKey.js';

describe('Secrets Manager API key loader', () => {
  it('rejects invalid configuration', () => {
    expect(() => createSecretsManagerApiKeyLoader({ client: {}, secretId: 'key' })).toThrow(TypeError);
    expect(() => createSecretsManagerApiKeyLoader({ client: { send() {} }, secretId: ' ' })).toThrow(TypeError);
  });

  it('coalesces reads and refreshes after five minutes', async () => {
    let nowMs = 1000;
    let resolveRead;
    const client = { send: vi.fn(() => new Promise(resolve => { resolveRead = resolve; })) };
    const load = createSecretsManagerApiKeyLoader({ client, secretId: 'leaderboard-key', now: () => nowMs });
    const first = load();
    const concurrent = load();
    expect(client.send).toHaveBeenCalledTimes(1);
    expect(client.send.mock.calls[0][0]).toBeInstanceOf(GetSecretValueCommand);
    expect(client.send.mock.calls[0][0].input.SecretId).toBe('leaderboard-key');
    resolveRead({ SecretString: 'first-key' });
    expect(await Promise.all([first, concurrent])).toEqual(['first-key', 'first-key']);
    expect(await load()).toBe('first-key');
    nowMs += 5 * 60 * 1000;
    const next = load();
    resolveRead({ SecretString: 'rotated-key' });
    expect(await next).toBe('rotated-key');
    expect(client.send).toHaveBeenCalledTimes(2);
  });

  it('retries after a failed or empty secret read', async () => {
    const client = { send: vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ SecretString: ' ' }).mockResolvedValueOnce({ SecretString: 'usable' }) };
    const load = createSecretsManagerApiKeyLoader({ client, secretId: 'key' });
    await expect(load()).rejects.toThrow('unavailable');
    await expect(load()).rejects.toThrow('nonempty');
    await expect(load()).resolves.toBe('usable');
  });
});
