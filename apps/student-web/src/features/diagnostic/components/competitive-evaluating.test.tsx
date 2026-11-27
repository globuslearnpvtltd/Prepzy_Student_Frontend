import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompetitiveEvaluating } from './competitive-evaluating';

describe('CompetitiveEvaluating', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const tick = (seconds: number) => {
    for (let i = 0; i < seconds; i += 1)
      act(() => {
        vi.advanceTimersByTime(1000);
      });
  };

  it('counts down, ticks the steps off one by one and then finishes', () => {
    const onDone = vi.fn();
    render(<CompetitiveEvaluating onDone={onDone} />);

    expect(screen.getByRole('dialog', { name: 'Evaluating your test' })).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('12');
    expect(screen.getByText('Verifying Submitted Answers').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Every mistake helps improve your final NEET score.')).toBeInTheDocument();

    // The Figma state: 09 left, step 1 done, step 2 in progress.
    tick(3);
    expect(screen.getByRole('timer')).toHaveTextContent('09');
    expect(screen.getByText('Verifying Submitted Answers')).toHaveTextContent('(done)');
    expect(screen.getByText('Calculating Total Score').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(onDone).not.toHaveBeenCalled();

    tick(9);
    expect(screen.getByRole('timer')).toHaveTextContent('00');
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
