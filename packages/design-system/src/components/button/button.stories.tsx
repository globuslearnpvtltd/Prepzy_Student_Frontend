import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantArgTypes, variantOptions } from '../../stories/variant-options.ts';
import { Button } from './button.tsx';

const meta = {
  title: 'Components/Button',
  component: Button,
  argTypes: { ...variantArgTypes('button'), loading: { control: 'boolean' }, disabled: { control: 'boolean' } },
  args: { children: 'Start test' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every intent × size defined in design.config.ts. New variants appear here automatically. */
export const AllVariants: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      {variantOptions('button', 'size').map((size) => (
        <div key={size} className="flex flex-wrap items-center gap-3">
          {variantOptions('button', 'intent').map((intent) => (
            <Button key={intent} {...args} intent={intent as never} size={size as never}>
              {intent} · {size}
            </Button>
          ))}
        </div>
      ))}
    </div>
  ),
};

export const States: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-3">
      <Button {...args}>Default</Button>
      <Button {...args} disabled>
        Disabled
      </Button>
      <Button {...args} loading>
        Saving
      </Button>
      <Button {...args} asChild intent="outline">
        <a href="#plans">Link as button</a>
      </Button>
    </div>
  ),
};

export const FullWidth: Story = {
  args: { width: 'full', children: 'Continue' },
  parameters: { viewport: { defaultViewport: 'mobile' } },
};
