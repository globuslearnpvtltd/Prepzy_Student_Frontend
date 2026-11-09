import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../button/button.tsx';
import { Field, FieldError, FieldHint, FieldLabel } from '../field/field.tsx';
import { Input } from '../input/input.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../tabs/tabs.tsx';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './dialog.tsx';

describe('Dialog', () => {
  it('opens, is labelled by its title, and closes', async () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Submit test</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Submit now?</DialogTitle>
          <DialogDescription>You have 3 unanswered questions.</DialogDescription>
          <DialogClose asChild>
            <Button intent="ghost">Keep going</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit test' }));
    const dialog = screen.getByRole('dialog', { name: 'Submit now?' });
    expect(dialog).toHaveClass('pz-dialog__content');
    await userEvent.click(screen.getByRole('button', { name: 'Keep going' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Tabs', () => {
  it('switches panels', async () => {
    render(
      <Tabs defaultValue="mock">
        <TabsList aria-label="Test types">
          <TabsTrigger value="mock">Mock</TabsTrigger>
          <TabsTrigger value="pyq">PYQ</TabsTrigger>
        </TabsList>
        <TabsContent value="mock">Mock list</TabsContent>
        <TabsContent value="pyq">PYQ list</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole('tab', { name: 'Mock' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'PYQ' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('PYQ list');
  });
});

describe('Field', () => {
  it('links label to input and announces errors', () => {
    render(
      <Field>
        <FieldLabel htmlFor="phone">Phone</FieldLabel>
        <Input id="phone" invalid />
        <FieldHint>10 digits</FieldHint>
        <FieldError>Enter a valid number</FieldError>
      </Field>,
    );
    expect(screen.getByLabelText('Phone')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid number');
  });

  it('renders no error element when empty', () => {
    render(<FieldError>{''}</FieldError>);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
