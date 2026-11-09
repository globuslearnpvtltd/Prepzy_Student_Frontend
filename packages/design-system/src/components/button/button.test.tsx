import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button.tsx';

describe('Button', () => {
  it('applies the config defaults when no variant props are given', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveClass('pz-button');
    expect(button).toHaveAttribute('data-intent', 'primary');
    expect(button).toHaveAttribute('data-size', 'md');
    expect(button).toHaveAttribute('data-width', 'auto');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('maps variant props to data attributes and does not leak them to the DOM', () => {
    render(
      <Button intent="outline" size="lg" width="full">
        Next
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('data-intent', 'outline');
    expect(button).toHaveAttribute('data-size', 'lg');
    expect(button).not.toHaveAttribute('intent');
  });

  it('handles clicks and blocks them while loading', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Pay</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} loading>
        Pay
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders its child with button styling when asChild is set', () => {
    render(
      <Button asChild intent="ghost">
        <a href="/plans">See plans</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'See plans' });
    expect(link).toHaveClass('pz-button');
    expect(link).toHaveAttribute('data-intent', 'ghost');
    expect(link).not.toHaveAttribute('type');
  });

  it('keeps custom class names', () => {
    render(<Button className="mt-4">Go</Button>);
    expect(screen.getByRole('button')).toHaveClass('pz-button', 'mt-4');
  });
});
