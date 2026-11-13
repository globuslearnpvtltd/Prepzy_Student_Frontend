// Prints a Markdown summary of playwright-report/results.json (GitHub Actions job summary).
/* eslint-disable no-console -- a CLI script: printing to stdout is its job */
import { existsSync, readFileSync } from 'node:fs';

const file = 'playwright-report/results.json';
if (!existsSync(file)) {
  console.log('### Browser tests\n\nNo results file: the test run did not start (see the job log).');
  process.exit(0);
}
const report = JSON.parse(readFileSync(file, 'utf8'));
const rows = [];
const walk = (suite, path) => {
  const here = suite.title ? [...path, suite.title] : path;
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const last = test.results?.at(-1);
      rows.push({ name: [...here, spec.title].filter(Boolean).join(' › '), project: test.projectName, status: test.status, error: last?.error?.message });
    }
  }
  for (const child of suite.suites ?? []) walk(child, here);
};
for (const suite of report.suites ?? []) walk(suite, []);

const count = (status) => rows.filter((r) => r.status === status).length;
const failed = rows.filter((r) => r.status === 'unexpected');
console.log('### Browser tests');
console.log('');
console.log(`| Passed | Failed | Flaky (passed on retry) | Skipped |\n|---|---|---|---|\n| ${count('expected')} | ${failed.length} | ${count('flaky')} | ${count('skipped')} |`);
console.log('');
if (failed.length) {
  console.log('**Failed tests**');
  console.log('');
  for (const r of failed) {
    const reason = (r.error ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0].slice(0, 200);
    console.log(`- \`${r.project}\` ${r.name}${reason ? ` — ${reason}` : ''}`);
  }
  console.log('');
}
console.log('Screenshots of every test: download **playwright-report** under Artifacts below, unzip, and open `playwright-report/index.html`.');
