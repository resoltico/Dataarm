import './coverage';
import { expect, test, type Page } from '@playwright/test';

async function waitForDetailTitle(page: Page, heading: string) {
  await expect(page.locator('.detail-panel-title')).toHaveText(heading);
}

async function waitForLoadedEditor(page: Page, heading: string) {
  await waitForDetailTitle(page, heading);
  await page.getByRole('button', { name: 'Config' }).click();
  await expect(page.getByLabel('Target TOML editor')).toBeEnabled();
}

async function openArtifactSubTab(page: Page, label: 'Preview' | 'Last run' | 'State' | 'Batch') {
  await page.getByRole('button', { name: 'Artifacts' }).click();
  await page.getByRole('button', { name: label }).click();
}

test.describe('Dataarm Dashboard', () => {
  test('loads the embedded watch-root workbench', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toHaveText('Target workbench');
    await expect(page.getByRole('heading', { name: 'Targets' })).toBeVisible();
    await expect(page.getByLabel('Workspace controls')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run workspace' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New HTTP' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open watch root' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Alert center' })).toBeVisible();
    await waitForDetailTitle(page, 'Demo status board');
    await expect(page.getByText('Baseline timeline', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run target' })).toBeVisible();
  });

  test('loads the http target template and previews it', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'New HTTP' }).click();
    await waitForLoadedEditor(page, 'New HTTP target');

    const editor = page.getByLabel('Target TOML editor');
    await expect(editor).toContainText('target_id = "website_watch"');

    await page.getByRole('button', { name: 'Preview target' }).click();

    await expect(page.locator('.detail-tab-btn-active')).toHaveText('Preview');
    await expect(page.getByText('Preview ready', { exact: true })).toBeVisible();
    await expect(page.getByText('Preview status report', { exact: true })).toBeVisible();
    await expect(page.getByText('ffhn.status_report')).toBeVisible();
    await expect(page.getByText('ffhn.run_report')).toBeVisible();
  });

  test('surfaces malformed draft errors in the preview workbench without leaking mock internals', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'New HTTP' }).click();
    await waitForLoadedEditor(page, 'New HTTP target');

    await page.getByLabel('Target TOML editor').fill('this is not valid toml');
    await page.getByRole('button', { name: 'Preview target' }).click();

    await expect(page.locator('.detail-tab-btn-active')).toHaveText('Preview');
    await expect(page.getByText('Preview failed', { exact: true })).toBeVisible();
    await expect(page.locator('.detail-panel')).toContainText('target_id is required.');
    await expect(page.getByText(/mock desktop runtime/i)).toHaveCount(0);
  });

  test('enters a truthful draft context for new http targets', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'New HTTP' }).click();

    await waitForDetailTitle(page, 'New HTTP target');
    await expect(page.locator('.detail-tab-btn-active')).toHaveText('Config');
    await expect(page.getByText('Loaded the http target template.')).toBeVisible();
    await expect(page.getByText('Saved to watch root', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/authoring a new http target/i)).toBeVisible();
    await expect(page.locator('.target-row-selected')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Run workspace' })).toBeDisabled();
  });

  test('blocks durable runs while the editor contains unsaved changes', async ({ page }) => {
    await page.goto('/');
    await waitForLoadedEditor(page, 'Demo status board');

    const editor = page.getByLabel('Target TOML editor');
    await editor.fill(`${await editor.inputValue()}\n# unsaved change`);

    await expect(page.getByText('Unsaved draft', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run target' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Run workspace' })).toBeDisabled();
  });

  test('asks before abandoning an untouched new-target template', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'New HTTP' }).click();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe('Discard the unsaved target draft?');
      await dialog.dismiss();
    });

    await page.getByRole('button', { name: /Demo release notes/ }).click();

    await waitForDetailTitle(page, 'New HTTP target');
  });

  test('runs the whole workspace against the browser mock backend', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Run workspace' }).click();
    await openArtifactSubTab(page, 'Batch');

    await expect(page.locator('.top-feedback')).toHaveText('Workspace run found 2 new baselines.');
    await expect(page.getByText('ffhn.batch_run_report')).toBeVisible();
    await expect(page.locator('td.col-when', { hasText: 'Not recorded' })).toHaveCount(0);
  });

  test('updates notification settings and records delivery history for meaningful runs', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByLabel('Deliver via').selectOption('both');
    await expect(page.locator('.notification-status')).toHaveText(
      'System delivery is ready for this runtime.',
    );
    await page.getByRole('button', { name: /Demo release notes/ }).click();
    await waitForDetailTitle(page, 'Demo release notes');

    await page.getByRole('button', { name: 'Run target' }).click();

    await expect(page.locator('.top-feedback')).toHaveText(
      'Change detected in Demo release notes.',
    );
    const notificationEntry = page.locator('.notification-entry').first();
    await expect(notificationEntry).toContainText('Change detected in Demo release notes.');
    await expect(notificationEntry).toContainText('In app + system');
  });

  test('can clear recorded notification history', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Run target' }).click();
    await page.getByRole('button', { name: 'Clear' }).click();

    await expect(page.getByText('Notification history cleared.')).toBeVisible();
    await expect(page.locator('.notification-empty-note')).toContainText(
      'No important alerts yet.',
    );
  });

  test('creates a watch root, saves a new file target, runs it, and switches back through recents', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByLabel('Switch watch root').fill('/tmp/dataarm/browser-fixture-workspace');
    await page.getByRole('button', { name: 'Create watch root' }).click();

    await expect(page.getByText('Workspace created.')).toBeVisible();
    await expect(
      page.getByText('No targets yet. Use New HTTP or New file in the sidebar to create one.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'New file' }).click();
    await waitForLoadedEditor(page, 'New file target');

    const editor = page.getByLabel('Target TOML editor');
    const draft = await editor.inputValue();
    await editor.fill(
      draft
        .replace('target_id = "file_watch"', 'target_id = "browser_release_notes"')
        .replace('display_name = "File watch"', 'display_name = "Browser release notes"')
        .replace(
          'file_path = "/absolute/path/to/page.html"',
          'file_path = "/tmp/dataarm/browser-release-notes.html"',
        )
        .replace('selector = "main"', 'selector = ".release"'),
    );

    await page.getByRole('button', { name: 'Save target' }).click();

    await expect(
      page.getByText('Target saved. Baseline artifacts were reset for a clean next run.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Browser release notes/ })).toBeVisible();
    await waitForDetailTitle(page, 'Browser release notes');

    await page.getByRole('button', { name: 'Run target' }).click();
    await openArtifactSubTab(page, 'Last run');

    await expect(page.locator('.top-feedback')).toHaveText(
      'Change detected in Browser release notes.',
    );
    await expect(page.getByText('ffhn.run_report')).toBeVisible();

    await page.locator('.nav-item-recent', { hasText: 'demo-watch-root' }).click();

    await expect(page.getByText('Workspace loaded.')).toBeVisible();
    await waitForDetailTitle(page, 'Demo status board');
    await expect(page.getByRole('button', { name: /Demo release notes/ })).toBeVisible();
  });

  test('blocks target actions during a fast selection handoff and runs the newly selected target', async ({
    page,
  }) => {
    await page.goto('/');

    const runTarget = page.getByRole('button', { name: 'Run target' });
    await page.getByRole('button', { name: /Demo release notes/ }).click();
    await runTarget.click();

    await waitForDetailTitle(page, 'Demo release notes');
    await expect(page.locator('.top-feedback')).toHaveText(
      'Change detected in Demo release notes.',
    );
  });

  test('deletes a saved target from a user workspace after confirmation', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('Switch watch root').fill('/tmp/dataarm/browser-delete-workspace');
    await page.getByRole('button', { name: 'Create watch root' }).click();
    await expect(page.getByText('Workspace created.')).toBeVisible();
    await expect(
      page.getByText('No targets yet. Use New HTTP or New file in the sidebar to create one.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'New file' }).click();
    await waitForLoadedEditor(page, 'New file target');

    const editor = page.getByLabel('Target TOML editor');
    const draft = await editor.inputValue();
    await editor.fill(
      draft
        .replace('target_id = "file_watch"', 'target_id = "delete_me"')
        .replace('display_name = "File watch"', 'display_name = "Delete me"')
        .replace(
          'file_path = "/absolute/path/to/page.html"',
          'file_path = "/tmp/dataarm/delete-me.html"',
        ),
    );
    await page.getByRole('button', { name: 'Save target' }).click();
    await waitForLoadedEditor(page, 'Delete me');

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe('Delete Delete me?');
      await dialog.accept();
    });

    await page.getByRole('button', { name: 'Delete target' }).click();

    await expect(page.getByText('Target deleted.')).toBeVisible();
    await expect(
      page.getByText('No targets yet. Use New HTTP or New file in the sidebar to create one.'),
    ).toBeVisible();
  });

  test('surfaces retained snapshot history and canonical compare artifacts', async ({ page }) => {
    await page.goto('/');

    await waitForDetailTitle(page, 'Demo status board');
    await expect(page.getByText('Baseline timeline', { exact: true })).toBeVisible();
    await expect(page.getByText('Previous compare.txt', { exact: true })).toBeVisible();
    await expect(page.getByText('Current compare.txt', { exact: true })).toBeVisible();
    await expect(page.getByText('All systems operational')).toBeVisible();

    await openArtifactSubTab(page, 'State');
    await expect(page.getByText('Current compare.txt', { exact: true })).toBeVisible();
    await expect(page.getByText('Current extraction.json', { exact: true })).toBeVisible();
    await expect(page.getByText('ffhn.extraction_record')).toBeVisible();
  });

  test('keeps the initial desktop workbench within the viewport without page scrolling', async ({
    page,
  }) => {
    await page.goto('/');

    const viewport = page.viewportSize();
    if (!viewport) {
      throw new Error('Viewport size is unavailable.');
    }

    const appShell = page.locator('.app-shell');
    const tableSection = page.locator('.target-table-section');
    const detailSection = page.locator('.detail-section');
    await expect(appShell).toBeVisible();
    await expect(tableSection).toBeVisible();
    await expect(detailSection).toBeVisible();

    const [htmlBox, tableBox, detailBox] = await Promise.all([
      page.locator('html').boundingBox(),
      tableSection.boundingBox(),
      detailSection.boundingBox(),
    ]);

    if (!htmlBox || !tableBox || !detailBox) {
      throw new Error('Expected dashboard layout boxes to be available.');
    }

    expect(htmlBox.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(tableBox.height).toBeGreaterThan(180);
    expect(detailBox.height).toBeGreaterThan(260);
  });

  test('keeps the live browser width in the desktop three-panel workbench mode', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1156, height: 1329 });
    await page.goto('/');

    const nav = page.locator('.nav-sidebar');
    const tableSection = page.locator('.target-table-section');
    const detailSection = page.locator('.detail-section');

    const [navBox, tableBox, detailBox] = await Promise.all([
      nav.boundingBox(),
      tableSection.boundingBox(),
      detailSection.boundingBox(),
    ]);

    if (!navBox || !tableBox || !detailBox) {
      throw new Error('Expected dashboard layout boxes to be available.');
    }

    expect(Math.abs(tableBox.y - detailBox.y)).toBeLessThanOrEqual(8);
    expect(tableBox.x).toBeGreaterThan(navBox.x + navBox.width * 0.8);
    expect(detailBox.x).toBeGreaterThan(tableBox.x + tableBox.width * 0.45);
  });
});
