import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeekChart } from './week-chart';

describe('WeekChart', () => {
  it('scales bars to the top tick and lists the minutes for screen readers', () => {
    render(
      <WeekChart
        days={[
          { label: 'Mon', minutes: 40 },
          { label: 'Today', minutes: 0 },
        ]}
      />,
    );
    expect(screen.getByTitle('Mon: 40 min')).toHaveStyle({ height: '100%' });
    expect(screen.getByTitle('Today: 0 min')).toHaveStyle({ height: '0%' });
    const table = screen.getByRole('table', { name: 'Minutes on Prepzy this week' });
    expect(table).toHaveTextContent('Mon40 minutes');
  });

  it('draws an empty week on a 0–4 axis', () => {
    render(<WeekChart days={[{ label: 'Mon', minutes: 0 }]} />);
    expect(screen.getByTitle('Mon: 0 min')).toHaveStyle({ height: '0%' });
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});
