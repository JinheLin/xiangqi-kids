import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
function git(...args: string[]) {
  try { return execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return ''; }
}
export default defineConfig(({ command }) => {
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  const revision = (process.env.GITHUB_SHA || git('rev-parse', 'HEAD')).slice(0, 7) || 'local';
  // Commit time is reproducible across local and CI builds of the same release.
  const release = { version: pkg.version as string, revision, updatedAt: git('show', '-s', '--format=%cI', 'HEAD'), development: command === 'serve' };
  return {
    base: process.env.BASE_PATH || '/',
    define: { __APP_RELEASE__: JSON.stringify(release) },
    plugins: [react(), {
      name: 'release-info',
      generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(release) }); },
    }],
    test: { include: ['src/**/*.test.ts'] },
  };
});
