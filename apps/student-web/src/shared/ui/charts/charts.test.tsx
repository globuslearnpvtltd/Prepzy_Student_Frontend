import { render, screen } from '@testing-library/react';
import { BarChart, LineChart, niceMax, ProgressRing } from './index';

describe('BarChart', () => {
  const data = [
    { name: 'Monday', label: 'M', value: 2, display: '2h 0m' },
    { name: 'Tuesday', label: 'T', value: 0, display: '0h 0m' },
    { name: 'Wednesday', label: 'W', value: 1, display: '1h 0m' },
  ];

  it('alternates dark and light bars, highlights the last one and scales to the largest value', () => {
    render(<BarChart data={data} caption="Hours" />);
    const bars = screen.getAllByTestId('bar');
    expect(bars[0]).toHaveClass('bg-brand-700');
    expect(bars[1]).toHaveClass('bg-brand-75');
    expect(bars[2]).toHaveClass('bg-accent-400');
    expect(bars[0]).toHaveStyle({ height: 'max(5px, 100%)' });
    expect(bars[2]).toHaveStyle({ height: 'max(5px, 50%)' });
  });

  it('keeps a minimum height when every value is zero and exposes a table', () => {
    render(<BarChart data={[{ name: 'Monday', label: 'M', value: 0, display: '0h 0m' }]} caption="Hours" />);
    expect(screen.getByTestId('bar')).toHaveStyle({ height: '5px' });
    expect(screen.getByRole('table', { name: 'Hours' })).toHaveTextContent('Monday0h 0m');
  });
});

describe('LineChart', () => {
  it('draws one marker per value and a legend per series', () => {
    const { container } = render(
      <LineChart
        caption="Scores"
        categories={['Physics', 'Chemistry']}
        series={[
          { name: 'Last Attempt', tone: 'light', values: [50, 60] },
          { name: 'Current Attempt', tone: 'strong', values: [55, 70] },
        ]}
      />,
    );
    expect(container.querySelectorAll('circle')).toHaveLength(4);
    expect(container.querySelector('[data-series="Current Attempt"] circle')).toHaveClass('fill-accent-400');
    expect(screen.getAllByText('Last Attempt')).toHaveLength(2);
    expect(screen.getByRole('table', { name: 'Scores' })).toHaveTextContent('Chemistry60%70%');
  });

  it('centres a single category', () => {
    const { container } = render(
      <LineChart caption="One" categories={['Physics']} series={[{ name: 'Now', tone: 'strong', values: [40] }]} />,
    );
    expect(container.querySelector('circle')).toHaveAttribute('cx', '50%');
  });

  it('rounds the axis like the previous charts', () => {
    expect(niceMax([72, 48])).toBe(80);
    expect(niceMax([95])).toBe(100);
    expect(niceMax([])).toBe(100);
  });
});

describe('ProgressRing', () => {
  it('shows the clamped percentage', () => {
    render(<ProgressRing percent={130} label="Botany" />);
    expect(screen.getByRole('img', { name: 'Botany: 100%' })).toHaveTextContent('100%');
  });
});

describe('chart tooltips (previous app: the value on hover)', () => {
  it('shows each bar\'s value above it, keeping the edge boxes inside the chart', () => {
    render(
      <BarChart
        data={[
          { name: 'Monday', label: 'M', value: 1.5, display: '1h 30m' },
          { name: 'Tuesday', label: 'T', value: 0.5, display: '0h 30m' },
          { name: 'Wednesday', label: 'W', value: 2, display: '2h 0m' },
        ]}
        caption="Hours"
      />,
    );
    const tips = screen.getAllByTestId('bar-tooltip');
    expect(tips.map((t) => t.textContent)).toEqual(['1h 30m', '0h 30m', '2h 0m']);
    expect(tips[0]!.className).toContain('group-hover:block');
    expect(tips[0]!.className).toContain('left-0');
    expect(tips[2]!.className).toContain('right-0');
  });

  it('shows the subject and every series value for a hovered column', () => {
    render(
      <LineChart
        categories={['Physics', 'Chemistry']}
        series={[
          { name: 'Previous Attempt', values: [40, 55], tone: 'light' },
          { name: 'Current Attempt', values: [60, 70.4], tone: 'strong' },
        ]}
        caption="Scores"
      />,
    );
    const zones = screen.getAllByTestId('line-hover');
    expect(zones).toHaveLength(2);
    expect(zones[0]!.style.left).toBe('0%');
    expect(zones[1]!.style.width).toBe('50%');
    const tips = screen.getAllByTestId('line-tooltip');
    expect(tips[1]).toHaveTextContent('Subject: Chemistry');
    expect(tips[1]).toHaveTextContent('Previous Attempt: 55%');
    expect(tips[1]).toHaveTextContent('Current Attempt: 70%');
    expect(tips[1]!.className).toContain('group-hover:flex');
  });
});
