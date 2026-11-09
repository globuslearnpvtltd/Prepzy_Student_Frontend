import designConfig from '../../design.config.ts';
import type { ComponentName } from '../config/runtime.ts';

type VariantMap = Record<string, Record<string, unknown>>;

function variantsOf(name: ComponentName): VariantMap {
  return ((designConfig.components[name] as { variants?: VariantMap }).variants ?? {}) as VariantMap;
}

/** Storybook argTypes for every variant group of a component, read from design.config.ts. */
export function variantArgTypes(name: ComponentName) {
  return Object.fromEntries(
    Object.entries(variantsOf(name)).map(([group, options]) => [
      group,
      { control: 'select' as const, options: Object.keys(options), table: { category: 'Variants (design.config.ts)' } },
    ]),
  );
}

/** Option names of one variant group, e.g. variantOptions('button', 'intent') → ['primary', …]. */
export function variantOptions(name: ComponentName, group: string): string[] {
  return Object.keys(variantsOf(name)[group] ?? {});
}
