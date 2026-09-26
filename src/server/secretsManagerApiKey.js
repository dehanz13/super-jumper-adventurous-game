import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const CACHE_MS = 5 * 60 * 1000;

export function createSecretsManagerApiKeyLoader({ client, secretId, now = Date.now }) {
  if (typeof client?.send !== 'function' || typeof secretId !== 'string' || !secretId.trim() || typeof now !== 'function') {
    throw new TypeError('valid Secrets Manager configuration is required');
  }
  let cached;
  let expiresAtMs = 0;
  let inFlight;
  return async function loadApiKey() {
    const nowMs = now();
    if (cached && nowMs < expiresAtMs) return cached;
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
      if (typeof response.SecretString !== 'string' || !response.SecretString.trim()) {
        throw new TypeError('leaderboard secret must contain a nonempty string');
      }
      cached = response.SecretString;
      expiresAtMs = now() + CACHE_MS;
      return cached;
    })();
    try { return await inFlight; } finally { inFlight = undefined; }
  };
}
