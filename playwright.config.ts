import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  use: { channel: process.env.PLAYWRIGHT_CHANNEL, baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', testMatch: ['app.spec.ts', 'sound.spec.ts', 'guided.spec.ts'], use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', testMatch: ['app.spec.ts', 'shell.spec.ts', 'guided.spec.ts'], use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    ...[
      { name: 'oppo-pad3-landscape', width: 1120, height: 800, scale: 2.5 },
      { name: 'oppo-pad3-large', width: 1400, height: 1000, scale: 2 },
      { name: 'oppo-pad3-browser-bars', width: 1120, height: 720, scale: 2.5 },
      { name: 'oppo-pad3-portrait', width: 800, height: 1120, scale: 2.5 },
    ].map(device => ({ name: device.name, testMatch: device.name === 'oppo-pad3-landscape' ? ['tablet.spec.ts', 'sound.spec.ts', 'shell.spec.ts', 'workspace.spec.ts', 'guided.spec.ts'] : device.name.includes('portrait') ? ['tablet.spec.ts', 'shell.spec.ts'] : ['tablet.spec.ts', 'shell.spec.ts', 'workspace.spec.ts'], use: { browserName: 'chromium' as const, viewport: { width: device.width, height: device.height }, deviceScaleFactor: device.scale, isMobile: true, hasTouch: true } })),
  ],
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
});
