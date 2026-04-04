import { test, expect } from '@playwright/test';

test.describe('FFHN Desktop Dashboard', () => {
  // Overriding sidecar inputs during headless tests is fully supported
  // by configuring process.env.FFHN_DESKTOP_FFHN_BIN locally in the orchestrator pipeline.

  test('loads the main dashboard structural wrappers', async ({ page }) => {
    // Navigate to the Vite development server mapped locally
    await page.goto('/');

    // Validate absolute baseline execution mode banner is visible
    await expect(page.locator('.banner.banner-strong')).toBeVisible();
    await expect(page.locator('.banner.banner-strong')).toContainText('Execution mode:');

    // Validate Hero structure guarantees
    await expect(page.locator('h1')).toHaveText('Run FFHN without leaving the desktop');

    // Verify the operator-first shell is visible
    await expect(page.getByRole('heading', { name: 'Operator flow' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Current workspace' })).toBeVisible();
    await expect(
      page.getByLabel('Sidebar Navigation').getByRole('button', { name: 'Add target' }),
    ).toBeVisible();
  });

  test('validates sidebar rail state execution and interaction', async ({ page }) => {
    await page.goto('/');

    // Test Target creation rail triggers
    const addTargetBtn = page
      .getByLabel('Sidebar Navigation')
      .getByRole('button', { name: 'Add target' });
    await expect(addTargetBtn).toBeVisible();
    await addTargetBtn.click();

    // Opening target triggers the editor replacement UI view internally
    await expect(page.getByText('Target Editor')).toBeVisible();

    // Form inputs exist structurally
    await expect(page.getByPlaceholder('e.g. Homepage pricing')).toBeVisible();

    // Cancel closes it properly
    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    await cancelBtn.click();

    // Original view returned
    await expect(page.getByText('Target Editor')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Operator flow' })).toBeVisible();
  });
});
