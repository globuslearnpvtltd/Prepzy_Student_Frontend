/**
 * Generates src/styles/design-system.css from design.config.ts.
 * Usage: npm run tokens            (writes the file)
 *        npm run tokens -- --check (fails if the file is out of date; used in CI)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import designConfig from '../design.config.ts';
import { generateCss } from '../src/config/generate.ts';

const outFile = fileURLToPath(new URL('../src/styles/design-system.css', import.meta.url));
const { css, errors } = generateCss(designConfig);

if (errors.length) {
  console.error(`design.config.ts has ${errors.length} problem(s):\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(outFile, 'utf8');
  } catch {
    // missing file counts as out of date
  }
  if (current !== css) {
    console.error('design-system.css is out of date. Run `npm run tokens` and commit the result.');
    process.exit(1);
  }
  console.log('design-system.css is up to date.');
} else {
  writeFileSync(outFile, css);
  console.log(`Generated ${outFile}`);
}
