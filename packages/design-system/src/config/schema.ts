/** A token name ('brand', 'brand.700', 'md') or a raw CSS value ('#fff', '12px', 'transparent'). */
export type TokenValue = string;

export interface DesignTokens {
  colors: Record<string, Record<string | number, string>>;
  fonts: Record<string, string>;
  /** [font-size, line-height] */
  fontSizes: Record<string, readonly [string, string]>;
  fontWeights: Record<string, number>;
  radius: Record<string, string>;
  /** Base step of Tailwind's numeric spacing scale (p-1 = 1 unit, p-4 = 4 units). */
  spacingUnit: string;
  /** Named spacing used by component styles (paddingX: 'md'). Emitted as --space-<name>. */
  spacing: Record<string, string>;
  shadows: Record<string, string>;
  breakpoints: Record<string, string>;
}

/** Visual properties a component may set. Structural layout (display, alignment) lives in the component code. */
export interface StyleRules {
  background?: TokenValue;
  color?: TokenValue;
  borderColor?: TokenValue;
  borderWidth?: string;
  borderStyle?: string;
  radius?: TokenValue;
  shadow?: TokenValue;
  fontFamily?: TokenValue;
  fontSize?: TokenValue;
  fontWeight?: TokenValue | number;
  lineHeight?: string;
  letterSpacing?: string;
  textTransform?: string;
  height?: TokenValue;
  minHeight?: TokenValue;
  width?: TokenValue;
  maxWidth?: TokenValue;
  padding?: TokenValue;
  paddingX?: TokenValue;
  paddingY?: TokenValue;
  gap?: TokenValue;
  opacity?: number;
  cursor?: string;
  outline?: string;
  outlineOffset?: string;
  transition?: string;
  /** Escape hatch for any other CSS property: { 'text-decoration': 'underline' }. */
  css?: Record<string, string>;
}

export const STATES = [
  'hover',
  'active',
  'focus',
  'disabled',
  'invalid',
  'checked',
  'selected',
  'focusWithin',
  'placeholder',
] as const;
export type StyleState = (typeof STATES)[number];

export type StyleBlock = StyleRules & Partial<Record<StyleState, StyleRules>>;

export interface ComponentConfig {
  base: StyleBlock;
  /** variant group → option → styles. Each group becomes a typed prop on the component. */
  variants?: Record<string, Record<string, StyleBlock>>;
  /** Option used when the prop is not passed. */
  defaults?: Record<string, string>;
  /** Named sub-parts (card.title, card.footer …), styled the same way. */
  slots?: Record<string, ComponentConfig>;
}

export interface DesignConfig {
  tokens: DesignTokens;
  semantic: Record<string, TokenValue>;
  themes?: Record<string, Record<string, TokenValue>>;
  components: Record<string, ComponentConfig>;
}

/** Identity helper that keeps literal types, so component props are inferred from the config. */
export function defineDesignConfig<const C extends DesignConfig>(config: C): C {
  return config;
}
