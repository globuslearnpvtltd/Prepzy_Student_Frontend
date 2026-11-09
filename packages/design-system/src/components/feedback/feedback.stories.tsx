import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantOptions } from '../../stories/variant-options.ts';
import { Button } from '../button/button.tsx';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '../dialog/dialog.tsx';
import { Field, FieldError, FieldHint, FieldLabel } from '../field/field.tsx';
import { Input } from '../input/input.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../tabs/tabs.tsx';
import { Alert, AlertTitle, Badge, Progress, Skeleton, Spinner } from './feedback.tsx';

const meta = { title: 'Components/Feedback & overlays' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Badges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {variantOptions('badge', 'tone').map((tone) => (
        <Badge key={tone} tone={tone as never}>
          {tone}
        </Badge>
      ))}
    </div>
  ),
};

export const Alerts: Story = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-3">
      {variantOptions('alert', 'tone').map((tone) => (
        <Alert key={tone} tone={tone as never}>
          <AlertTitle>{tone}</AlertTitle>
          Your plan renews in 3 days.
        </Alert>
      ))}
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-4">
      <div className="flex items-center gap-4">
        {variantOptions('spinner', 'size').map((size) => (
          <Spinner key={size} size={size as never} />
        ))}
      </div>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-24 w-full" />
      {variantOptions('progress', 'tone').map((tone, i) => (
        <Progress key={tone} tone={tone as never} value={25 * (i + 1)} aria-label={tone} />
      ))}
    </div>
  ),
};

export const FormField: Story = {
  render: () => (
    <Field className="max-w-sm">
      <FieldLabel htmlFor="phone">Phone number</FieldLabel>
      <Input id="phone" invalid defaultValue="98765" />
      <FieldHint>We will send a one-time code on WhatsApp.</FieldHint>
      <FieldError>Enter a 10-digit number</FieldError>
    </Field>
  ),
};

export const TabsExample: Story = {
  render: () => (
    <Tabs defaultValue="mock">
      <TabsList aria-label="Test types">
        <TabsTrigger value="mock">Mock tests</TabsTrigger>
        <TabsTrigger value="pyq">Previous years</TabsTrigger>
        <TabsTrigger value="custom">Custom</TabsTrigger>
      </TabsList>
      <TabsContent value="mock">Mock test list</TabsContent>
      <TabsContent value="pyq">PYQ list</TabsContent>
      <TabsContent value="custom">Custom tests</TabsContent>
    </Tabs>
  ),
};

export const DialogExample: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button>Submit test</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Submit your test?</DialogTitle>
        <DialogDescription>You have 3 unanswered and 2 marked-for-review questions.</DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <Button intent="ghost">Keep going</Button>
          </DialogClose>
          <Button>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
