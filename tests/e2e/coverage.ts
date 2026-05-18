import fs from 'node:fs/promises';
import { test, type Page } from '@playwright/test';

async function readPageCoverage(page: Page) {
  if (page.isClosed()) {
    return null;
  }

  try {
    return await page.evaluate(() => {
      const coverageScope = globalThis as typeof globalThis & { __coverage__?: unknown };
      return coverageScope.__coverage__ ?? null;
    });
  } catch {
    return null;
  }
}

test.afterEach(async ({ page }, testInfo) => {
  if (process.env.DATAARM_COVERAGE !== '1') {
    return;
  }

  const coverage = await readPageCoverage(page);
  if (coverage == null) {
    return;
  }

  await fs.writeFile(
    testInfo.outputPath('frontend-coverage.json'),
    `${JSON.stringify(coverage, null, 2)}\n`,
    'utf8',
  );
});
