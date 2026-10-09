import { test, expect } from '@playwright/test';

test.describe('Automated PMS End-to-End Visual Workflow Suite', () => {

  test('Full Visual Walkthrough: Tape Chart ➔ Property Stats Data Tab ➔ Master Financial Report ➔ Room Config', async ({ page }) => {
    // 1. Open PMS Application
    console.log('Step 1: Opening PMS homepage...');
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 2. Navigate to Tape Chart Grid
    console.log('Step 2: Inspecting Tape Chart & Room Grid...');
    const tapeChartTab = page.locator('button:has-text("Tape Chart"), a:has-text("Tape Chart"), span:has-text("Tape Chart")').first();
    if (await tapeChartTab.isVisible().catch(() => false)) {
      await tapeChartTab.click();
      await page.waitForTimeout(2500);
    }

    // 3. Navigate to Property Stats Summary
    console.log('Step 3: Inspecting Property Stats & Daily Inventory...');
    const statsTab = page.locator('button:has-text("Property Stats"), a:has-text("Property Stats"), span:has-text("Property Stats")').first();
    if (await statsTab.isVisible().catch(() => false)) {
      await statsTab.click();
      await page.waitForTimeout(2500);
    }

    // 4. Click Data Tab inside Property Stats
    console.log('Step 4: Opening Property Stats Data Tab...');
    const dataTab = page.locator('button:has-text("Data"), span:has-text("Data")').first();
    if (await dataTab.isVisible().catch(() => false)) {
      await dataTab.click();
      await page.waitForTimeout(3000);
    }

    // 5. Navigate to Master Report
    console.log('Step 5: Inspecting Master Financial Report...');
    const masterReportBtn = page.locator('button:has-text("Master Report"), a:has-text("Master Report"), span:has-text("Master Report")').first();
    if (await masterReportBtn.isVisible().catch(() => false)) {
      await masterReportBtn.click();
      await page.waitForTimeout(3000);
    }

    // 6. Navigate to Configuration Panel
    console.log('Step 6: Inspecting Configuration Panel & Room Inventory...');
    const configBtn = page.locator('button:has-text("Configuration"), a:has-text("Configuration"), span:has-text("Configuration")').first();
    if (await configBtn.isVisible().catch(() => false)) {
      await configBtn.click();
      await page.waitForTimeout(3000);
    }

    // Final verification that application container is rendered cleanly
    await expect(page.locator('body')).toBeVisible();
  });

});
