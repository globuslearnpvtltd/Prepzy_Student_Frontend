import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { PORTED_SECTIONS, SECTIONS, placeholderSections } from '@/shared/config/navigation';

// Section folders in every route group under [exam] ((app), (account), (solver) …), dynamic segments aside.
const examDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dirsIn = (dir: string) => readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
const realSections = dirsIn(examDir)
  .filter((group) => /^\(.+\)$/.test(group.name))
  .flatMap((group) => dirsIn(join(examDir, group.name)).map((entry) => entry.name))
  .filter((name) => !/^[[(]/.test(name));

describe('section placeholder', () => {
  it('lists every navigation section that has a real page as ported', () => {
    const navSections = new Set(Object.values(SECTIONS).flatMap((sections) => Object.keys(sections)));
    const missing = realSections.filter((name) => navSections.has(name) && !PORTED_SECTIONS.has(name));
    expect(missing).toEqual([]);
  });

  it('only lists real page folders as ported', () => {
    expect([...PORTED_SECTIONS].filter((name) => !realSections.includes(name))).toEqual([]);
  });

  it('pre-builds placeholders only for unported sections', () => {
    expect(placeholderSections('competitive')).toEqual([]);
    expect(placeholderSections('board')).toEqual(['syllabus', 'pyq-trends']);
    expect(placeholderSections('reference')).toEqual([]);
  });
});
