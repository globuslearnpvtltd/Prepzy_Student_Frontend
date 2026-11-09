import { render, screen } from '@testing-library/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card.tsx';

describe('Card', () => {
  it('applies config defaults and slot classes', () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Physics</CardTitle>
          <CardDescription>12 chapters</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('pz-card');
    expect(card).toHaveAttribute('data-appearance', 'elevated');
    expect(card).toHaveAttribute('data-padding', 'md');
    expect(screen.getByRole('heading', { name: 'Physics' })).toHaveClass('pz-card__title');
    expect(screen.getByText('12 chapters')).toHaveClass('pz-card__description');
    expect(screen.getByText('Body')).toHaveClass('pz-card__content');
    expect(screen.getByText('Footer')).toHaveClass('pz-card__footer');
  });

  it('accepts variant props from the config', () => {
    render(<Card data-testid="card" appearance="highlight" padding="lg" />);
    expect(screen.getByTestId('card')).toHaveAttribute('data-appearance', 'highlight');
    expect(screen.getByTestId('card')).toHaveAttribute('data-padding', 'lg');
  });
});
