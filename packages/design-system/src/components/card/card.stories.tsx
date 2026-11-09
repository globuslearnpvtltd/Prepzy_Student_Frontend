import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantArgTypes, variantOptions } from '../../stories/variant-options.ts';
import { Button } from '../button/button.tsx';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card.tsx';

const meta = {
  title: 'Components/Card',
  component: Card,
  argTypes: variantArgTypes('card'),
  render: (args) => (
    <Card {...args} className="max-w-sm">
      <CardHeader>
        <CardTitle>Physics · Mock test 3</CardTitle>
        <CardDescription>45 questions · 60 minutes</CardDescription>
      </CardHeader>
      <CardContent>Covers kinematics, laws of motion and work, energy and power.</CardContent>
      <CardFooter>
        <Button size="sm">Start</Button>
        <Button size="sm" intent="ghost">
          Details
        </Button>
      </CardFooter>
    </Card>
  ),
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every appearance defined in design.config.ts. */
export const Appearances: Story = {
  render: () => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {variantOptions('card', 'appearance').map((appearance) => (
        <Card key={appearance} appearance={appearance as never}>
          <CardHeader>
            <CardTitle>{appearance}</CardTitle>
            <CardDescription className="break-all">components.card.variants.appearance.{appearance}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  ),
};
