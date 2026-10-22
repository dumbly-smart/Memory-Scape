import { defineConfig, devices } from '@playwright/test';

const chromiumLaunch = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } }
  : {};
const requestedProjects = process.env.PLAYWRIGHT_PROJECTS?.split(',');
const projects = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'], ...chromiumLaunch } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
].filter((project) => !requestedProjects || requestedProjects.includes(project.name));

export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
  },
  projects,
  ...(process.env.PLAYWRIGHT_BASE_URL ? {} : { webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  } }),
});
