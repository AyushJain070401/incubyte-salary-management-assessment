// Drives the local web app through the demo flow and records a
// video to ~/Downloads/.
//
//   npx tsx scripts/record-demo.ts
//
// Requires both apps running locally (`pnpm dev`) and the HR Manager
// user (hr@acme.test / AcmeHR-2026!) to exist in Supabase.

import { chromium, type Page } from 'playwright';
import { homedir } from 'node:os';
import { mkdir, rename, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:5173';
const EMAIL = process.env.HR_EMAIL ?? 'hr@acme.test';
const PASSWORD = process.env.HR_PASSWORD ?? 'AcmeHR-2026!';
const DOWNLOADS = join(homedir(), 'Downloads');
const VIDEO_DIR = join(DOWNLOADS, 'acme-demo-video-tmp');

const SIZE = { width: 1440, height: 900 };

// Small helpers for narration timing — readable demo, not a robot.
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function step(page: Page, label: string, fn: () => Promise<void>) {
  console.log(`▶ ${label}`);
  await fn();
}

async function main() {
  await mkdir(VIDEO_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: VIDEO_DIR, size: SIZE },
  });
  const page = await context.newPage();

  await step(page, 'Open the app', async () => {
    await page.goto(WEB_URL);
    await page.waitForLoadState('networkidle');
    await pause(1000);
  });

  await step(page, 'Sign in', async () => {
    // If we're already signed in we'd be redirected to /employees; check.
    if (page.url().includes('/login')) {
      await page.fill('#email', EMAIL);
      await pause(400);
      await page.fill('#password', PASSWORD);
      await pause(400);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/employees', { timeout: 10_000 });
    }
    await page.waitForLoadState('networkidle');
    await pause(1200);
  });

  await step(page, 'Search for "aaron"', async () => {
    await page.fill('input[type="search"]', 'aaron');
    await page.waitForLoadState('networkidle');
    await pause(1500);
  });

  await step(page, 'Clear search, filter by country IN', async () => {
    await page.fill('input[type="search"]', '');
    await pause(400);
    await page.selectOption('select[aria-label="Country"]', 'IN');
    await page.waitForLoadState('networkidle');
    await pause(1500);
  });

  await step(page, 'Sort by salary descending', async () => {
    // Click salary header twice — first click defaults to asc, second to desc.
    const salaryHeader = page.getByRole('button', { name: /^Salary/ });
    await salaryHeader.click();
    await page.waitForLoadState('networkidle');
    await pause(700);
    await salaryHeader.click();
    await page.waitForLoadState('networkidle');
    await pause(1500);
  });

  await step(page, 'Switch display currency to EUR', async () => {
    await page.selectOption('select[aria-label="Display currency"]', 'EUR');
    await page.waitForLoadState('networkidle');
    await pause(1500);
  });

  await step(page, 'Reset to all employees, switch back to USD', async () => {
    await page.getByRole('button', { name: 'Clear' }).click();
    await pause(400);
    await page.selectOption('select[aria-label="Display currency"]', 'USD');
    await page.waitForLoadState('networkidle');
    await pause(1500);
  });

  await step(page, 'Open the first employee detail', async () => {
    // Click the first employee name link in the table.
    const firstName = page.locator('table tbody tr').first().locator('a').first();
    await firstName.click();
    await page.waitForLoadState('networkidle');
    await pause(2000);
  });

  await step(page, 'Open the give-raise dialog', async () => {
    await page.getByRole('button', { name: /^Give raise/ }).click();
    await pause(1200);
  });

  await step(page, 'Fill in raise amount + reason', async () => {
    await page.fill('#amount', '125000');
    await pause(400);
    // Set effectiveFrom to a future date.
    await page.fill('#effectiveFrom', '2027-01-01');
    await pause(400);
    await page.fill('#reason', 'Demo: annual review raise');
    await pause(1000);
  });

  await step(page, 'Submit raise', async () => {
    await page.getByRole('button', { name: 'Record raise' }).click();
    await page.waitForLoadState('networkidle');
    await pause(2500); // let the timeline re-render
  });

  await step(page, 'Back to employees list', async () => {
    await page.getByRole('link', { name: '← Employees' }).click();
    await page.waitForLoadState('networkidle');
    await pause(1200);
  });

  await step(page, 'Open Import', async () => {
    await page.getByRole('link', { name: 'Import' }).click();
    await page.waitForLoadState('networkidle');
    await pause(1200);
  });

  await step(page, 'Load example CSV → dry-run', async () => {
    await page.getByRole('button', { name: 'Load example' }).click();
    await page.waitForLoadState('networkidle');
    await pause(2000);
  });

  await step(page, 'Open Analytics dashboard', async () => {
    await page.getByRole('link', { name: 'Analytics' }).click();
    await page.waitForLoadState('networkidle');
    await pause(3000); // let all 6 queries + charts render
  });

  await step(page, 'Switch analytics currency to EUR', async () => {
    await page.selectOption('select[aria-label="Display currency"]', 'EUR');
    await page.waitForLoadState('networkidle');
    await pause(2500);
  });

  await step(page, 'Filter analytics to country=US', async () => {
    await page.selectOption('select[aria-label="Country"]', 'US');
    await page.waitForLoadState('networkidle');
    await pause(2500);
  });

  await pause(1500); // final hold so the video doesn't cut to black instantly

  // Closing the context flushes the video to disk.
  await context.close();
  await browser.close();

  // Playwright writes a random-named .webm; rename to a friendly name.
  const files = await readdir(VIDEO_DIR);
  const webm = files.find((f) => f.endsWith('.webm'));
  if (!webm) {
    throw new Error(`No .webm produced in ${VIDEO_DIR}`);
  }
  const finalPath = join(DOWNLOADS, 'acme-salary-demo.webm');
  await rename(join(VIDEO_DIR, webm), finalPath);

  console.log(`\n✓ Video saved to: ${finalPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
