import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ComponentProps } from 'react';
import { componentClass } from '../../config/runtime.ts';
import { cx } from '../../lib/cx.ts';

/** Accessible tabs (arrow-key navigation). Styled by `components.tabs`. */
export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cx(componentClass('tabs'), className)} {...props} />;
}

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cx(componentClass('tabs', 'list'), className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger className={cx(componentClass('tabs', 'trigger'), className)} {...props} />;
}

export const TabsContent = TabsPrimitive.Content;
