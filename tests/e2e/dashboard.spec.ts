import fs from 'node:fs/promises';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';
import './coverage';

async function waitForDetailTitle(page: Page, heading: string) {
  await expect(page.locator('.detail-panel-title')).toHaveText(heading);
}

async function waitForSettingsEditor(page: Page, heading: string) {
  await waitForDetailTitle(page, heading);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toHaveClass(
    /detail-tab-btn-active/u,
  );
  await expect(page.getByLabel('Short name')).toBeEnabled();
}

async function revealAdvancedLibraryTools(page: Page) {
  await page.getByRole('button', { name: 'Show advanced library tools' }).click();
  await expect(page.getByLabel('Change library folder')).toBeVisible();
}

async function fillWatchDraft(
  page: Page,
  draft: {
    watchId: string;
    watchName: string;
    sourceLocator: string;
    selectionSelector?: string;
  },
) {
  await page.getByLabel('Short name').fill(draft.watchId);
  await page.getByLabel('Watch name').fill(draft.watchName);

  const pageUrlField = page.getByLabel('Page URL');
  if ((await pageUrlField.count()) > 0) {
    await pageUrlField.fill(draft.sourceLocator);
  } else {
    await page.getByLabel('File path').fill(draft.sourceLocator);
  }

  if (draft.selectionSelector) {
    await page.getByLabel('CSS selector').fill(draft.selectionSelector);
  }
}

async function choosePreviewSection(page: Page, selector: string) {
  const frame = page.frameLocator('iframe[title="Page preview"]');
  const target = frame.locator(selector);
  await target.waitFor();

  const targetBox = await target.boundingBox();
  const overlay = page.getByLabel('Preview picker overlay');
  const overlayBox = await overlay.boundingBox();
  if (!targetBox || !overlayBox) {
    throw new Error('Could not resolve preview geometry for the visual picker.');
  }

  await overlay.click({
    position: {
      x: targetBox.x + targetBox.width / 2 - overlayBox.x,
      y: targetBox.y + targetBox.height / 2 - overlayBox.y,
    },
  });
}

async function clickPreviewOverlay(page: Page, position: { x: number; y: number }) {
  await page.getByLabel('Preview picker overlay').click({ position });
}

async function writeFileFixture(filePath: string, body: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, body, 'utf8');
}

function releaseNotesHtml(title: string, summary: string) {
  return `<!doctype html>
<html>
  <body>
    <main>
      <article class="release">
        <h1>${title}</h1>
        <p>${summary}</p>
      </article>
    </main>
  </body>
</html>
`;
}

function acceptDiscardWatchDraft(page: Page) {
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe('Discard the unsaved watch draft?');
    await dialog.accept();
  });
}

test.describe('Dataarm Dashboard', () => {
  test('opens into a real first-watch draft and keeps library plumbing hidden by default', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toHaveText('Website watcher');
    await waitForSettingsEditor(page, 'Add watch');
    await expect(
      page.getByText('Add your first page to start tracking a website section over time.'),
    ).toBeVisible();
    await expect(page.getByLabel('Short name')).toHaveValue('website_watch');
    await expect(page.getByLabel('Watch name')).toHaveValue('Website watch');
    await expect(page.getByLabel('Page URL')).toHaveValue('https://example.com/');
    await expect(page.getByRole('button', { name: 'Save watch' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Check all watches' })).toBeDisabled();
    await expect(page.getByLabel('Change library folder')).toHaveCount(0);
    await expect(page.locator('.top-feedback')).toHaveCount(0);
  });

  test('surfaces malformed watch drafts without leaking browser-workbench internals', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForSettingsEditor(page, 'Add watch');

    await page.getByLabel('Short name').fill('');
    await page.getByRole('button', { name: 'Check section' }).click();

    await expect(page.getByRole('button', { name: 'Watch setup', exact: true })).toHaveClass(
      /detail-tab-btn-active/u,
    );
    await expect(page.getByText('Watch setup check failed')).toBeVisible();
    await expect(page.locator('.detail-panel')).toContainText(
      'contract error: target_id must not be empty',
    );
    await expect(page.getByText(/browser workbench runtime/i)).toHaveCount(0);
  });

  test('turns unreachable page checks into repair guidance instead of a fake ready state', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForSettingsEditor(page, 'Add watch');

    await fillWatchDraft(page, {
      watchId: 'broken_page',
      watchName: 'Broken page',
      sourceLocator: 'http://127.0.0.1:9/unreachable',
      selectionSelector: 'main',
    });

    await page.getByRole('button', { name: 'Check section' }).click();

    const setupOutcome = page.locator('.outcome-card').first();
    await expect(setupOutcome.getByText('Could not reach the page', { exact: true })).toBeVisible();
    await expect(
      setupOutcome.getByText('Check the page URL or server and try again.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fix watch setup' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save watch' })).toHaveCount(0);
  });

  test('asks before abandoning an unsaved watch draft when changing creation mode', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForSettingsEditor(page, 'Add watch');

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe('Discard the unsaved watch draft?');
      await dialog.dismiss();
    });

    await page.getByRole('button', { name: 'Advanced: local file' }).click();
    await waitForSettingsEditor(page, 'Add watch');
  });

  test('lets the visual picker choose the clicked section from a loaded page preview', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForSettingsEditor(page, 'Add watch');

    await fillWatchDraft(page, {
      watchId: 'office_price',
      watchName: 'Office price',
      sourceLocator: 'https://example.com/',
      selectionSelector: 'main',
    });

    await page.getByRole('button', { name: 'Load page preview' }).click();
    await clickPreviewOverlay(page, { x: 12, y: 12 });
    await expect(page.getByLabel('CSS selector')).toHaveValue('main');
    await choosePreviewSection(page, 'h1');
    await expect(page.getByLabel('CSS selector')).toHaveValue(/h1/u);
  });

  test('creates a separate library from advanced settings and switches back through recents', async ({
    page,
  }, testInfo) => {
    const workspacePath = testInfo.outputPath('browser-library');

    await page.goto('/');
    await waitForSettingsEditor(page, 'Add watch');
    await revealAdvancedLibraryTools(page);
    await page.getByLabel('Change library folder').fill(workspacePath);

    acceptDiscardWatchDraft(page);
    await page.getByRole('button', { name: 'Create library' }).click();

    await waitForSettingsEditor(page, 'Add watch');
    await expect(page.locator('.top-bar-workspace-name')).toHaveText('browser-library');
    await expect(page.getByRole('button', { name: 'watch-library' })).toBeVisible();

    acceptDiscardWatchDraft(page);
    await page.getByRole('button', { name: 'watch-library' }).click();

    await waitForSettingsEditor(page, 'Add watch');
    await expect(page.locator('.top-bar-workspace-name')).toHaveText('watch-library');
  });

  test('creates a local file watch, captures a baseline, records a change, and shows notification history', async ({
    page,
  }, testInfo) => {
    const sourcePath = testInfo.outputPath('browser-release-notes.html');
    await writeFileFixture(
      sourcePath,
      releaseNotesHtml('Browser fixture release 1', 'Initial browser fixture baseline'),
    );

    await page.goto('/');
    await waitForSettingsEditor(page, 'Add watch');

    acceptDiscardWatchDraft(page);
    await page.getByRole('button', { name: 'Advanced: local file' }).click();
    await waitForSettingsEditor(page, 'Add local file watch');

    await fillWatchDraft(page, {
      watchId: 'browser_release_notes',
      watchName: 'Browser release notes',
      sourceLocator: sourcePath,
      selectionSelector: '.release',
    });

    await page.getByLabel('Deliver through').selectOption('both');
    await expect(page.getByLabel('Deliver through')).toHaveValue('both');
    await expect(page.locator('.notification-status')).toHaveText(
      'System delivery is unavailable on this runtime.',
    );

    await page.getByRole('button', { name: 'Check section' }).click();
    await expect(page.getByText('Section ready')).toBeVisible();
    await page.getByRole('button', { name: 'Save watch' }).click();

    await waitForDetailTitle(page, 'Browser release notes');
    await expect(
      page.getByText('Watch saved. History was reset so the next check starts clean.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Check watch' }).click();
    await expect(page.locator('.top-feedback')).toHaveText(
      'First check saved for Browser release notes.',
    );

    await writeFileFixture(
      sourcePath,
      releaseNotesHtml('Browser fixture release 2', 'Changed browser fixture content'),
    );
    await page.getByRole('button', { name: 'Check watch' }).click();

    await expect(page.locator('.top-feedback')).toHaveText(
      'Change detected in Browser release notes.',
    );
    await expect(page.getByText('History timeline')).toBeVisible();
    await page
      .locator('.snapshot-workbench')
      .getByRole('button', { name: 'Compare', exact: true })
      .click();
    await expect(page.getByText('Current saved text', { exact: true })).toBeVisible();

    const notificationEntry = page.locator('.notification-entry').first();
    await expect(notificationEntry).toContainText('Change detected in Browser release notes.');
    await expect(notificationEntry).toContainText('In app');
    await expect(notificationEntry).toContainText(
      'System delivery is unavailable on this runtime.',
    );
  });

  test('deletes a saved watch after confirmation', async ({ page }, testInfo) => {
    const sourcePath = testInfo.outputPath('delete-me.html');
    await writeFileFixture(
      sourcePath,
      '<!doctype html><html><body><main><article class="release">Delete me fixture</article></main></body></html>\n',
    );

    await page.goto('/');
    await waitForSettingsEditor(page, 'Add watch');

    acceptDiscardWatchDraft(page);
    await page.getByRole('button', { name: 'Advanced: local file' }).click();
    await waitForSettingsEditor(page, 'Add local file watch');

    await fillWatchDraft(page, {
      watchId: 'delete_me',
      watchName: 'Delete me',
      sourceLocator: sourcePath,
      selectionSelector: '.release',
    });

    await page.getByRole('button', { name: 'Check section' }).click();
    await expect(page.getByText('Section ready')).toBeVisible();
    await page.getByRole('button', { name: 'Save watch' }).click();

    await waitForSettingsEditor(page, 'Delete me');

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe('Delete Delete me?');
      await dialog.accept();
    });

    await page.getByRole('button', { name: 'Delete watch' }).click();
    await waitForSettingsEditor(page, 'Add watch');
    await expect(
      page.getByText('Add your first page to start tracking a website section over time.'),
    ).toBeVisible();
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
