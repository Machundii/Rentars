/**
 * Visual regression tests — captures and diffs page screenshots.
 * Run with: npx playwright test e2e/visual-regression.spec.ts --update-snapshots
 */

import { test, expect } from '@playwright/test';

test.describe('Visual regression', () => {
  test('home page matches snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('home.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
    });
  });

  test('search page matches snapshot', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('search.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
    });
  });

  test('login page matches snapshot', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('login.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
    });
  });

  test('register page matches snapshot', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('register.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
    });
  });
});
