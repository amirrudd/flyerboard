import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',

    expect: {
        toMatchSnapshot: { maxDiffPixels: 100 }, // Allow minor anti-aliasing differences
    },

    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
    },

    projects: [
        { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
        { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    ],

    webServer: {
        command: 'npm run dev:frontend',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
    },
});
