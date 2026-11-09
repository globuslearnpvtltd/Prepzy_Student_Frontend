import { render, screen } from '@testing-library/react';
import { Alert, AlertTitle, Badge, Progress, Skeleton, Spinner } from './feedback.tsx';

describe('Badge', () => {
  it('uses the config default tone and accepts others', () => {
    const { rerender } = render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toHaveAttribute('data-tone', 'brand');
    rerender(<Badge tone="success">Done</Badge>);
    expect(screen.getByText('Done')).toHaveAttribute('data-tone', 'success');
  });
});

describe('Alert', () => {
  it('is a polite status by default and an assertive alert for danger', () => {
    const { rerender } = render(
      <Alert>
        <AlertTitle>Saved</AlertTitle>
      </Alert>,
    );
    expect(screen.getByRole('status')).toHaveAttribute('data-tone', 'info');
    rerender(<Alert tone="danger">Payment failed</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Payment failed');
  });
});

describe('Spinner and Skeleton', () => {
  it('announces loading and hides skeletons from assistive technology', () => {
    render(
      <>
        <Spinner label="Loading tests" size="lg" />
        <Skeleton data-testid="sk" />
      </>,
    );
    expect(screen.getByRole('status', { name: 'Loading tests' })).toHaveAttribute('data-size', 'lg');
    expect(screen.getByTestId('sk')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Progress', () => {
  it('exposes the value and clamps out-of-range input', () => {
    const { rerender } = render(<Progress value={40} aria-label="Syllabus" />);
    const bar = screen.getByRole('progressbar', { name: 'Syllabus' });
    expect(bar).toHaveAttribute('aria-valuenow', '40');
    rerender(<Progress value={140} aria-label="Syllabus" tone="success" />);
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(bar).toHaveAttribute('data-tone', 'success');
  });
});
