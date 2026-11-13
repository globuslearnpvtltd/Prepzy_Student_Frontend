import designConfig from '../../design.config.ts';
import { CLASS_PREFIX } from './constants.ts';

type Components = (typeof designConfig)['components'];

export type ComponentName = keyof Components & string;

/** Variant props of a component, inferred from design.config.ts (e.g. Button → intent, size, width). */
export type VariantProps<N extends ComponentName> = Components[N] extends { variants: infer V }
  ? { [Group in keyof V]?: keyof V[Group] & string }
  : Record<never, never>;

export type SlotName<N extends ComponentName> = Components[N] extends { slots: infer S } ? keyof S & string : never;

/** CSS class of a component or one of its slots: `pz-card`, `pz-card__title`. */
export function componentClass<N extends ComponentName>(name: N, slot?: SlotName<N>): string {
  return slot ? `${CLASS_PREFIX}-${name}__${slot}` : `${CLASS_PREFIX}-${name}`;
}

/**
 * Splits a component's props into `data-*` variant attributes (defaults applied) and the remaining props.
 * Variant groups are read from the config at runtime, so a variant group added to design.config.ts
 * works without changing component code.
 */
export function splitVariantProps<N extends ComponentName, P extends object>(
  name: N,
  props: P & VariantProps<N>,
): [attributes: Record<`data-${string}`, string>, rest: Omit<P, keyof VariantProps<N>>] {
  const component = designConfig.components[name] as {
    variants?: Record<string, Record<string, unknown>>;
    defaults?: Record<string, string>;
  };
  const groups = Object.keys(component.variants ?? {});
  const attributes: Record<`data-${string}`, string> = {};
  const rest: Record<string, unknown> = { ...props };
  for (const group of groups) {
    const value = (rest[group] as string | undefined) ?? component.defaults?.[group];
    delete rest[group];
    if (value !== undefined) attributes[`data-${group}`] = value;
  }
  return [attributes, rest as Omit<P, keyof VariantProps<N>>];
}

type Colors = (typeof designConfig)['tokens']['colors'];
type PaletteColor = { [Scale in keyof Colors & string]: `${Scale}.${keyof Colors[Scale] & (string | number)}` }[keyof Colors &
  string];
export type ColorName = (keyof (typeof designConfig)['semantic'] & string) | PaletteColor;

/**
 * Raw value of a colour token, for the few places that need a colour string in JavaScript instead of a class or
 * `var(--color-…)` (the browser `theme-color` meta tag, third-party widgets such as Razorpay's checkout).
 * `colorValue('brand')` → '#3D348B', `colorValue('warning.700')` → '#B54708'.
 */
export function colorValue(name: ColorName): string {
  const seen = new Set<string>();
  let value: string = name;
  const semantic = designConfig.semantic as Record<string, string>;
  const colors = designConfig.tokens.colors as Record<string, Record<string, string>>;
  for (;;) {
    if (seen.has(value)) throw new Error(`colorValue: circular colour "${name}"`);
    seen.add(value);
    const alias = semantic[value];
    if (alias !== undefined) {
      value = alias;
      continue;
    }
    const [scale, step] = value.split('.');
    const raw = scale && step ? colors[scale]?.[step] : undefined;
    if (raw !== undefined) return raw;
    if (/^(#|rgb|hsl|transparent$)/.test(value)) return value;
    throw new Error(`colorValue: unknown colour "${name}"`);
  }
}
