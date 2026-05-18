#!/usr/bin/env node

import { buildHygieneReport, renderHygieneReport } from './lib/hygiene.mjs';

const format = process.argv.includes('--format=json') ? 'json' : 'text';
const report = buildHygieneReport();

if (format === 'json') {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(renderHygieneReport(report));
}
