import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import designConfig from '@prepzy/design-system/config';

/**
 * Tailwind silently ignores classes whose token doesn't exist (e.g. `bg-white` after the default palette
 * is switched off, or `rounded-2xl` when the config has no `2xl` radius). This test fails instead, so
 * every colour / radius / font size used in the app comes from design.config.ts.
 */
const { tokens, semantic } = designConfig;

const colours = new Set<string>([
  ...Object.keys(semantic),
  ...Object.entries(tokens.colors).flatMap(([scale, steps]) => Object.keys(steps).map((step) => `${scale}-${step}`)),
  'transparent',
  'current',
  'inherit',
]);
const radii = new Set(['none', ...Object.keys(tokens.radius)]);
const textSizes = new Set(Object.keys(tokens.fontSizes));
const fonts = new Set([...Object.keys(tokens.fonts), ...Object.keys(tokens.fontWeights), 'normal', 'extrabold', 'black']);
const shadows = new Set(['none', ...Object.keys(tokens.shadows)]);

// text-* utilities that aren't colours or sizes.
const TEXT_KEYWORDS = new Set(['left', 'center', 'right', 'justify', 'start', 'end', 'wrap', 'nowrap', 'balance', 'pretty', 'ellipsis', 'clip']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

function classTokens(source: string): string[] {
  const strings = source.match(/(["'`])(?:(?!\1)[^\\\n]|\\.)*\1/g) ?? [];
  return strings.flatMap((s) => s.slice(1, -1).split(/\s+/)).map((c) => c.replace(/^([a-z0-9-]+:)+/, '').replace(/\/\d+$/, ''));
}

function problem(cls: string): string | null {
  if (cls.includes('[')) return null; // arbitrary values are explicit by design
  let m = /^(bg|border|ring|outline|fill|stroke|from|via|to|accent|caret|divide|placeholder)-([a-z][a-z0-9-]*)$/.exec(cls);
  if (m) {
    const [, util, value] = m as unknown as [string, string, string];
    if (/^(x|y|t|b|l|r|s|e|\d|solid|dashed|dotted|none|linear|radial|conic|clip|origin|fixed|local|scroll|cover|contain|center|no-repeat|repeat|auto|separate|collapse|offset|inset)/.test(value)) return null;
    if (util === 'border' && /^\d/.test(value)) return null;
    return colours.has(value) ? null : `${cls}: colour "${value}" is not in design.config.ts`;
  }
  m = /^text-([a-z0-9][a-z0-9-]*)$/.exec(cls);
  if (m) {
    const value = m[1]!;
    if (TEXT_KEYWORDS.has(value) || textSizes.has(value) || colours.has(value)) return null;
    return `${cls}: "${value}" is not a font size or colour in design.config.ts`;
  }
  m = /^rounded(?:-(?:t|b|l|r|tl|tr|bl|br|s|e))?-([a-z0-9]+)$/.exec(cls);
  if (m) return radii.has(m[1]!) ? null : `${cls}: radius "${m[1]}" is not in design.config.ts`;
  m = /^font-([a-z0-9-]+)$/.exec(cls);
  if (m) return fonts.has(m[1]!) ? null : `${cls}: font "${m[1]}" is not in design.config.ts`;
  m = /^shadow-([a-z0-9-]+)$/.exec(cls);
  if (m) return shadows.has(m[1]!) ? null : `${cls}: shadow "${m[1]}" is not in design.config.ts`;
  return null;
}

describe('design tokens', () => {
  it('flags classes whose token does not exist and accepts ones that do', () => {
    expect(problem('bg-white')).not.toBeNull();
    expect(problem('rounded-3xl')).not.toBeNull();
    expect(problem('text-red-500')).not.toBeNull();
    expect(problem('bg-brand-soft')).toBeNull();
    expect(problem('text-sm')).toBeNull();
    expect(problem('text-center')).toBeNull();
    expect(problem('border-2')).toBeNull();
    expect(problem('rounded-lg')).toBeNull();
    expect(problem('bg-[url(/x.png)]')).toBeNull();
  });

  it('every Tailwind colour, radius, font and shadow class used in the app exists in design.config.ts', () => {
    const root = join(process.cwd(), 'src');
    const problems = sourceFiles(root).flatMap((file) =>
      classTokens(readFileSync(file, 'utf8'))
        .map(problem)
        .filter((p): p is string => p !== null)
        .map((p) => `${file.slice(root.length + 1)} → ${p}`),
    );
    expect([...new Set(problems)]).toEqual([]);
  });

  it('no raw hex colour in app code: colours come from design.config.ts (classes or var(--color-…))', () => {
    // Multi-colour illustrations ported as-is from the previous app.
    const ALLOWED = new Set(['features/schools/components/icons.tsx']);
    const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi;
    const root = join(process.cwd(), 'src');
    const found = sourceFiles(root)
      .map((file) => file.slice(root.length + 1).split('\\').join('/'))
      .filter((file) => !ALLOWED.has(file))
      .flatMap((file) => (readFileSync(join(root, file), 'utf8').match(HEX) ?? []).map((hex) => `${file}: ${hex}`));
    expect([...new Set(found)]).toEqual([]);
  });
});
