// Next.js adds `<distDir>/types/**/*.ts` to tsconfig.json for every build folder it runs with
// (.next, .next-e2e, .next-agents …). A build then type-checks the generated types of *other* folders,
// which can describe routes that have since moved. Keep only the default `.next` entry.
import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../tsconfig.json', import.meta.url);
const config = JSON.parse(readFileSync(path, 'utf8'));
const before = config.include.length;
config.include = config.include.filter((entry) => !/^\.next-[^/]+\/types\//.test(entry));
if (config.include.length !== before) writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
