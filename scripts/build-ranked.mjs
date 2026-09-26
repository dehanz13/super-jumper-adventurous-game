import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateRankedBuildConfig } from './ranked-build-config.mjs';

try {
  validateRankedBuildConfig(process.env);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}

const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const result = spawnSync(process.execPath, [vite, 'build'], { stdio: 'inherit', env: process.env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
