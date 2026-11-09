// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import designConfig from '../../design.config.ts';
import { generateCss } from './generate.ts';
import { defineDesignConfig } from './schema.ts';

const fixture = defineDesignConfig({
  tokens: {
    colors: { brand: { 500: '#123456', 600: '#0F2A44' }, neutral: { 0: '#FFFFFF' } },
    fonts: { sans: 'Inter, sans-serif' },
    fontSizes: { sm: ['14px', '20px'] },
    fontWeights: { bold: 700 },
    radius: { md: '10px' },
    spacingUnit: '4px',
    spacing: { sm: '12px' },
    shadows: { card: '0 1px 2px black' },
    breakpoints: { md: '768px' },
  },
  semantic: { brand: 'brand.500', surface: 'neutral.0' },
  themes: { dark: { surface: '#000000' }, empty: {} },
  components: {
    chip: {
      base: { radius: 'md', fontSize: 'sm', paddingX: 'sm', hover: { background: 'brand.600' } },
      variants: { tone: { solid: { background: 'brand', color: 'surface' }, plain: { background: 'transparent' } } },
      defaults: { tone: 'solid' },
      slots: { icon: { base: { width: '16px' } } },
    },
  },
});

describe('generateCss', () => {
  const { css, errors } = generateCss(fixture);

  it('has no errors for a valid config', () => {
    expect(errors).toEqual([]);
  });

  it('emits palette, semantic and scale tokens as Tailwind theme variables', () => {
    expect(css).toContain('--color-brand-500: #123456;');
    expect(css).toContain('--color-brand: var(--color-brand-500);');
    expect(css).toContain('--text-sm: 14px;');
    expect(css).toContain('--text-sm--line-height: 20px;');
    expect(css).toContain('--radius-md: 10px;');
    expect(css).toContain('--font-weight-bold: 700;');
    expect(css).toContain('--spacing: 4px;');
  });

  it('keeps named spacing out of the Tailwind --spacing-* namespace', () => {
    expect(css).toContain('--space-sm: 12px;');
    expect(css).not.toContain('--spacing-sm');
  });

  it('emits theme overrides only for themes that change something', () => {
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('--color-surface: #000000;');
    expect(css).not.toContain('[data-theme="empty"]');
  });

  it('resolves component tokens to CSS variables, including line-height for font sizes', () => {
    expect(css).toMatch(/\.pz-chip \{[^}]*border-radius: var\(--radius-md\);/);
    expect(css).toMatch(/\.pz-chip \{[^}]*line-height: var\(--text-sm--line-height\);/);
    expect(css).toMatch(/\.pz-chip \{[^}]*padding-inline: var\(--space-sm\);/);
  });

  it('emits variant, state and slot selectors', () => {
    expect(css).toContain('.pz-chip[data-tone="solid"] {');
    expect(css).toContain('.pz-chip:hover:not(:disabled, [aria-disabled="true"]) {');
    expect(css).toContain('.pz-chip__icon {');
    expect(css).toMatch(/\.pz-chip\[data-tone="plain"\] \{\s*background-color: transparent;/);
  });

  it('reports unknown tokens, properties, themes and defaults', () => {
    const broken = defineDesignConfig({
      ...fixture,
      themes: { dark: { nope: 'brand' } },
      components: {
        chip: {
          base: { radius: 'huge', background: 'brand.999', colour: 'red' } as never,
          variants: { tone: { solid: {} } },
          defaults: { tone: 'outline' },
        },
      },
    });
    const result = generateCss(broken);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('unknown radius token "huge"'),
        expect.stringContaining('unknown color token "brand.999"'),
        expect.stringContaining('unknown style property "colour"'),
        expect.stringContaining('"nope" is not a semantic colour'),
        expect.stringContaining('"tone: outline" is not a defined variant'),
      ]),
    );
  });

  it('passes raw CSS values through unchanged', () => {
    const raw = generateCss(
      defineDesignConfig({
        ...fixture,
        components: { box: { base: { width: '100%', background: '#ff0000', radius: '3px', padding: '0' } } },
      }),
    );
    expect(raw.errors).toEqual([]);
    expect(raw.css).toContain('width: 100%;');
    expect(raw.css).toContain('background-color: #ff0000;');
  });
});

describe('design.config.ts', () => {
  it('is valid', () => {
    expect(generateCss(designConfig).errors).toEqual([]);
  });

  it('matches the committed design-system.css (run `npm run tokens` if this fails)', () => {
    const file = fileURLToPath(new URL('../styles/design-system.css', import.meta.url));
    expect(readFileSync(file, 'utf8')).toBe(generateCss(designConfig).css);
  });
});
