import { describe, expect, it } from 'vitest';
import { validateRankedBuildConfig } from '../scripts/ranked-build-config.mjs';

const configured = {
  VITE_RUN_API_BASE_URL: 'https://runs.example/prod/v1',
  VITE_LEADERBOARD_API_BASE_URL: 'https://board.example/v1/',
};

describe('ranked release build config', () => {
  it('accepts separate public HTTPS v1 service URLs', () => {
    expect(() => validateRankedBuildConfig(configured)).not.toThrow();
  });

  it.each([
    { ...configured, VITE_RUN_API_BASE_URL: undefined },
    { ...configured, VITE_RUN_API_BASE_URL: 'http://runs.example/v1' },
    { ...configured, VITE_RUN_API_BASE_URL: 'https://localhost/v1' },
    { ...configured, VITE_RUN_API_BASE_URL: 'https://user:pass@runs.example/v1' },
    { ...configured, VITE_RUN_API_BASE_URL: 'https://runs.example/v1?key=secret' },
    { ...configured, VITE_LEADERBOARD_API_BASE_URL: 'https://board.example/v1/scores' },
  ])('rejects a missing or unsafe ranked endpoint', env => {
    expect(() => validateRankedBuildConfig(env)).toThrow(/must be an HTTPS \/v1 release URL/);
  });
});
