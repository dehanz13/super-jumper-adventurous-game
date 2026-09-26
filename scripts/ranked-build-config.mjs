const REQUIRED_URLS = ['VITE_RUN_API_BASE_URL', 'VITE_LEADERBOARD_API_BASE_URL'];

export function validateRankedBuildConfig(env) {
  for (const name of REQUIRED_URLS) {
    const raw = env[name];
    let url;
    try { url = new URL(raw); } catch { throw new Error(`${name} must be an HTTPS /v1 release URL`); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || !/^\/(?:[A-Za-z0-9._~-]+\/)*v1\/?$/.test(url.pathname)
      || ['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
      throw new Error(`${name} must be an HTTPS /v1 release URL`);
    }
  }
}
