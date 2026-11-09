import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantArgTypes, variantOptions } from '../../stories/variant-options.ts';
import { Input } from './input.tsx';

const meta = {
  title: 'Components/Input',
  component: Input,
  argTypes: { ...variantArgTypes('input'), invalid: { control: 'boolean' }, disabled: { control: 'boolean' } },
  args: { placeholder: 'Enter your phone number', 'aria-label': 'Phone number' },
  render: (args) => <Input {...args} className="max-w-sm" />,
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const SizesAndStates: Story = {
  render: (args) => (
    <div className="flex max-w-sm flex-col gap-3">
      {variantOptions('input', 'size').map((size) => (
        <Input key={size} {...args} size={size as never} placeholder={`size: ${size}`} aria-label={`size ${size}`} />
      ))}
      <Input {...args} invalid placeholder="Invalid" aria-label="Invalid" />
      <Input {...args} disabled placeholder="Disabled" aria-label="Disabled" />
    </div>
  ),
};
