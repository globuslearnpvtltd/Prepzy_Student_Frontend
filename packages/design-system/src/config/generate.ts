import { CLASS_PREFIX } from './constants.ts';
import {
  STATES,
  type ComponentConfig,
  type DesignConfig,
  type StyleBlock,
  type StyleRules,
  type StyleState,
} from './schema.ts';

type Category = 'color' | 'radius' | 'shadow' | 'font' | 'text' | 'fontWeight' | 'spacing' | 'raw';

const PROPERTIES: Record<Exclude<keyof StyleRules, 'css'>, [cssProperty: string, category: Category]> = {
  background: ['background-color', 'color'],
  color: ['color', 'color'],
  borderColor: ['border-color', 'color'],
  borderWidth: ['border-width', 'raw'],
  borderStyle: ['border-style', 'raw'],
  radius: ['border-radius', 'radius'],
  shadow: ['box-shadow', 'shadow'],
  fontFamily: ['font-family', 'font'],
  fontSize: ['font-size', 'text'],
  fontWeight: ['font-weight', 'fontWeight'],
  lineHeight: ['line-height', 'raw'],
  letterSpacing: ['letter-spacing', 'raw'],
  textTransform: ['text-transform', 'raw'],
  height: ['height', 'spacing'],
  minHeight: ['min-height', 'spacing'],
  width: ['width', 'spacing'],
  maxWidth: ['max-width', 'spacing'],
  padding: ['padding', 'spacing'],
  paddingX: ['padding-inline', 'spacing'],
  paddingY: ['padding-block', 'spacing'],
  gap: ['gap', 'spacing'],
  opacity: ['opacity', 'raw'],
  cursor: ['cursor', 'raw'],
  outline: ['outline', 'raw'],
  outlineOffset: ['outline-offset', 'raw'],
  transition: ['transition', 'raw'],
};

const STATE_SELECTORS: Record<StyleState, string> = {
  hover: ':hover:not(:disabled, [aria-disabled="true"])',
  active: ':active:not(:disabled, [aria-disabled="true"])',
  focus: ':focus-visible',
  disabled: ':is(:disabled, [aria-disabled="true"])',
  invalid: '[aria-invalid="true"]',
  checked: ':is(:checked, [data-state="checked"], [aria-pressed="true"])',
  selected: ':is([aria-selected="true"], [aria-checked="true"], [data-state="active"])',
  focusWithin: ':focus-within',
  placeholder: '::placeholder',
};

const KEYWORDS = new Set(['transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'none', 'auto', '0']);
const NAME = /^[a-z0-9][a-z0-9-]*$/;

/** True when a value is written like a token name rather than a raw CSS value. */
function looksLikeToken(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)?$/i.test(value) && !KEYWORDS.has(value.toLowerCase()) && !/^\d/.test(value);
}

class Resolver {
  readonly errors: string[] = [];
  private readonly config: DesignConfig;

  constructor(config: DesignConfig) {
    this.config = config;
  }

  resolve(category: Category, value: string | number, where: string): string {
    if (typeof value === 'number') return category === 'spacing' ? `${value}px` : String(value);
    if (category === 'raw' || !looksLikeToken(value)) return value;
    const { tokens, semantic } = this.config;
    const ok = (exists: unknown, cssVar: string) => (exists !== undefined ? `var(${cssVar})` : undefined);
    let resolved: string | undefined;
    switch (category) {
      case 'color': {
        if (semantic[value] !== undefined) resolved = `var(--color-${value})`;
        else {
          const [scale, step] = value.split('.');
          if (scale && step) resolved = ok(tokens.colors[scale]?.[step], `--color-${scale}-${step}`);
        }
        break;
      }
      case 'radius':
        resolved = ok(tokens.radius[value], `--radius-${value}`);
        break;
      case 'shadow':
        resolved = ok(tokens.shadows[value], `--shadow-${value}`);
        break;
      case 'font':
        resolved = ok(tokens.fonts[value], `--font-${value}`);
        break;
      case 'text':
        resolved = ok(tokens.fontSizes[value], `--text-${value}`);
        break;
      case 'fontWeight':
        resolved = ok(tokens.fontWeights[value], `--font-weight-${value}`);
        break;
      case 'spacing':
        resolved = ok(tokens.spacing[value], `--space-${value}`);
        break;
    }
    if (resolved === undefined) {
      this.errors.push(`${where}: unknown ${category} token "${value}"`);
      return value;
    }
    return resolved;
  }
}

function declarations(rules: StyleRules, resolver: Resolver, where: string): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(rules)) {
    if (value === undefined || (STATES as readonly string[]).includes(key)) continue;
    if (key === 'css') {
      for (const [prop, raw] of Object.entries(value as Record<string, string>)) out.push(`${prop}: ${raw};`);
      continue;
    }
    const mapping = PROPERTIES[key as keyof typeof PROPERTIES];
    if (!mapping) {
      resolver.errors.push(`${where}: unknown style property "${key}"`);
      continue;
    }
    const [cssProperty, category] = mapping;
    out.push(`${cssProperty}: ${resolver.resolve(category, value as string | number, `${where}.${key}`)};`);
    if (key === 'fontSize' && looksLikeToken(String(value))) {
      out.push(`line-height: var(--text-${String(value)}--line-height);`);
    }
  }
  return out;
}

function rule(selector: string, decls: string[]): string {
  return decls.length ? `  ${selector} {\n${decls.map((d) => `    ${d}`).join('\n')}\n  }` : '';
}

function blockRules(selector: string, block: StyleBlock, resolver: Resolver, where: string): string[] {
  const rules = [rule(selector, declarations(block, resolver, where))];
  for (const state of STATES) {
    const stateRules = block[state];
    if (stateRules) {
      rules.push(rule(`${selector}${STATE_SELECTORS[state]}`, declarations(stateRules, resolver, `${where}.${state}`)));
    }
  }
  return rules;
}

function componentRules(className: string, component: ComponentConfig, resolver: Resolver, where: string): string[] {
  const selector = `.${className}`;
  const rules = blockRules(selector, component.base, resolver, `${where}.base`);
  for (const [group, options] of Object.entries(component.variants ?? {})) {
    if (!NAME.test(group))
      resolver.errors.push(`${where}.variants: group name "${group}" must be lowercase kebab-case`);
    for (const [option, block] of Object.entries(options)) {
      rules.push(
        ...blockRules(
          `${selector}[data-${group}="${option}"]`,
          block,
          resolver,
          `${where}.variants.${group}.${option}`,
        ),
      );
    }
  }
  for (const [group, option] of Object.entries(component.defaults ?? {})) {
    if (!component.variants?.[group]?.[option]) {
      resolver.errors.push(`${where}.defaults: "${group}: ${option}" is not a defined variant`);
    }
  }
  for (const [slot, slotConfig] of Object.entries(component.slots ?? {})) {
    rules.push(...componentRules(`${className}__${slot}`, slotConfig, resolver, `${where}.slots.${slot}`));
  }
  return rules;
}

function themeVariables(config: DesignConfig, resolver: Resolver): string[] {
  const lines: string[] = [
    '  --color-*: initial;',
    '  --text-*: initial;',
    '  --radius-*: initial;',
    '  --shadow-*: initial;',
  ];
  for (const [scale, steps] of Object.entries(config.tokens.colors)) {
    for (const [step, value] of Object.entries(steps)) lines.push(`  --color-${scale}-${step}: ${value};`);
  }
  for (const [name, value] of Object.entries(config.semantic)) {
    lines.push(`  --color-${name}: ${resolver.resolve('color', value, `semantic.${name}`)};`);
  }
  for (const [name, value] of Object.entries(config.tokens.fonts)) lines.push(`  --font-${name}: ${value};`);
  for (const [name, [size, lineHeight]] of Object.entries(config.tokens.fontSizes)) {
    lines.push(`  --text-${name}: ${size};`, `  --text-${name}--line-height: ${lineHeight};`);
  }
  for (const [name, value] of Object.entries(config.tokens.fontWeights))
    lines.push(`  --font-weight-${name}: ${value};`);
  for (const [name, value] of Object.entries(config.tokens.radius)) lines.push(`  --radius-${name}: ${value};`);
  lines.push(`  --spacing: ${config.tokens.spacingUnit};`);
  for (const [name, value] of Object.entries(config.tokens.shadows)) lines.push(`  --shadow-${name}: ${value};`);
  for (const [name, value] of Object.entries(config.tokens.breakpoints))
    lines.push(`  --breakpoint-${name}: ${value};`);
  return lines;
}

/** Named spacing lives outside Tailwind's --spacing-* namespace so it can't clash with w-/max-w- sizes. */
function spaceVariables(config: DesignConfig): string[] {
  return Object.entries(config.tokens.spacing).map(([name, value]) => `    --space-${name}: ${value};`);
}

function themeOverrides(config: DesignConfig, resolver: Resolver): string[] {
  const rules: string[] = [];
  for (const [theme, overrides] of Object.entries(config.themes ?? {})) {
    const decls = Object.entries(overrides).map(([name, value]) => {
      if (config.semantic[name] === undefined) {
        resolver.errors.push(`themes.${theme}: "${name}" is not a semantic colour`);
      }
      return `--color-${name}: ${resolver.resolve('color', value, `themes.${theme}.${name}`)};`;
    });
    rules.push(rule(`[data-theme="${theme}"]`, decls));
  }
  return rules;
}

export interface GenerateResult {
  css: string;
  errors: string[];
}

/** Turns the design config into Tailwind v4 theme variables, theme overrides and component styles. */
export function generateCss(config: DesignConfig): GenerateResult {
  const resolver = new Resolver(config);
  const theme = themeVariables(config, resolver);
  const themes = themeOverrides(config, resolver).filter(Boolean);
  const components = Object.entries(config.components).flatMap(([name, component]) => {
    if (!NAME.test(name)) resolver.errors.push(`components: name "${name}" must be lowercase kebab-case`);
    return componentRules(`${CLASS_PREFIX}-${name}`, component, resolver, `components.${name}`);
  });

  const css = [
    '/* GENERATED from design.config.ts by `npm run tokens`. Do not edit by hand. */',
    "@import './structure.css';",
    '',
    // `static`: always emit every token, even ones no utility uses yet (themes and inline styles rely on them).
    '@theme static {',
    ...theme,
    '}',
    '',
    '@layer base {',
    '  :root {',
    ...spaceVariables(config),
    '  }',
    ...themes,
    '}',
    '',
    '@layer components {',
    components.filter(Boolean).join('\n\n'),
    '}',
    '',
  ].join('\n');

  return { css, errors: resolver.errors };
}
