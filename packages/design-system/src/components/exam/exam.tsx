import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import type { ComponentProps, ReactNode } from 'react';
import { componentClass, splitVariantProps, type VariantProps } from '../../config/runtime.ts';
import { cx } from '../../lib/cx.ts';

/** Group of answer options: one choice, arrow-key navigation, announced as a radio group. */
export function OptionGroup({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={cx(componentClass('option-group'), className)} {...props} />;
}

export type OptionTileProps = ComponentProps<typeof RadioGroupPrimitive.Item> &
  VariantProps<'option'> & {
    /** Short label shown in the circle: A, B, C, D. */
    marker?: ReactNode;
  };

/** One MCQ option. Styled by `components.option` (prop: result = none | correct | incorrect). */
export function OptionTile({ className, marker, children, ...props }: OptionTileProps) {
  const [variantAttributes, rest] = splitVariantProps('option', props);
  return (
    <RadioGroupPrimitive.Item className={cx(componentClass('option'), className)} {...variantAttributes} {...rest}>
      {marker !== undefined && (
        <span className={componentClass('option', 'marker')} aria-hidden="true">
          {marker}
        </span>
      )}
      <span className={componentClass('option', 'label')}>{children}</span>
    </RadioGroupPrimitive.Item>
  );
}

export type PaletteItemProps = Omit<ComponentProps<'button'>, 'children'> &
  VariantProps<'palette-item'> & {
    number: number;
    /** Text shown instead of the number (e.g. zero-padded "07"); the accessible name keeps the number. */
    display?: string;
    /** Human-readable status for screen readers, e.g. "answered". */
    statusLabel?: string;
  };

/** Question number in the exam palette. Styled by `components.palette-item` (props: status, current). */
export function PaletteItem({ className, number, display, statusLabel, ...props }: PaletteItemProps) {
  const [variantAttributes, rest] = splitVariantProps('palette-item', props);
  const isCurrent = variantAttributes['data-current'] === 'yes';
  return (
    <button
      type="button"
      className={cx(componentClass('palette-item'), className)}
      aria-label={`Question ${number}${statusLabel ? `, ${statusLabel}` : ''}`}
      aria-current={isCurrent ? 'step' : undefined}
      {...variantAttributes}
      {...rest}
    >
      {display ?? number}
    </button>
  );
}
