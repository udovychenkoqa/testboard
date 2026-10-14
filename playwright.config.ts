import { defineConfig, devices } from '@playwright/test';

// End-to-end suite. Runs its own Next dev server on :3100 with throwaway data
// (tests/e2e/.data) and its own build dir (.next-e2e), so it never touches
// data/, .next/ or a dev server already running on :3000.
// Note: report generation on the server uses its own temporary merge config,
// so this file doesn't interfere with it.

export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_API_TOKEN = 'e2e-test-token';
export const E2E_DATA_DIR = 'tests/e2e/.data';
export const E2E_AUTH_STATE = 'tests/e2e/.auth/user.json';

// Values set here win over .env: Next.js never overrides variables already
// present in the process environment.
const serverEnv: Record<string, string> = {
  PORT: String(E2E_PORT),
  DATA_DIR: E2E_DATA_DIR,
  NEXT_DIST_DIR: '.next-e2e',
  DATA_STORAGE: 'fs',
  API_TOKEN: E2E_API_TOKEN,
  AUTH_SECRET: 'e2e-test-secret',
  AUTH_URL: E2E_BASE_URL,
  NEXTAUTH_URL: E2E_BASE_URL,
  AUTH_TRUST_HOST: 'true',
  BASE_URL: E2E_BASE_URL,
  // API-key sign-in only.
  AUTH_GOOGLE_ID: '',
  AUTH_GOOGLE_SECRET: '',
  AUTH_ALLOWED_DOMAINS: '',
  AUTH_ADMIN_EMAILS: '',
  // `.invalid` never resolves → the "external service unreachable" path is deterministic.
  DRONE_SERVER: 'http://drone.invalid',
  DRONE_TOKEN: 'e2e-drone-token',
  DRONE_AUTOTESTS_REPO: 'e2e/autotests',
  ANTHROPIC_API_KEY: '',
};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // First compile of a page in `next dev` is slow.
    navigationTimeout: 60_000,
  },
  projects: [
    // Seeds a report through the real upload/generate API, then signs in.
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: E2E_AUTH_STATE, locale: 'en-US' },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    // Fresh data dir on every run, then a dev server isolated from the real one.
    command: `node -e "require('fs').rmSync('${E2E_DATA_DIR}',{recursive:true,force:true})" && npx next dev -p ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/api/ping`,
    env: serverEnv,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
