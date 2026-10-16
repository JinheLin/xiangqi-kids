import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Respect the project's rule: compilation never inherits proxy settings.
const root = fileURLToPath(new URL('../', import.meta.url));
const env = { ...process.env, NO_PROXY: '*', no_proxy: '*' };
for (const name of Object.keys(env)) {
  if (/^(https?_proxy|all_proxy|npm_config_(https?_proxy|proxy))$/i.test(name)) delete env[name];
}
for (const args of [
  [resolve(root, 'node_modules/typescript/bin/tsc'), '-b'],
  [resolve(root, 'node_modules/vite/bin/vite.js'), 'build'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
