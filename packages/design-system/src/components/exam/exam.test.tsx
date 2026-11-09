import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OptionGroup, OptionTile, PaletteItem } from './exam.tsx';

describe('OptionGroup / OptionTile', () => {
  function Question({ onChange = vi.fn(), value }: { onChange?: (v: string) => void; value?: string }) {
    return (
      <OptionGroup aria-label="Question 1" value={value} onValueChange={onChange}>
        <OptionTile value="1" marker="A">
          Mitochondria
        </OptionTile>
        <OptionTile value="2" marker="B">
          Ribosome
        </OptionTile>
      </OptionGroup>
    );
  }

  it('selects an option by click and reports its value', async () => {
    const onChange = vi.fn();
    render(<Question onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: /Ribosome/ }));
    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('marks the selected option as checked', () => {
    render(<Question value="1" />);
    expect(screen.getByRole('radio', { name: /Mitochondria/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Ribosome/ })).toHaveAttribute('aria-checked', 'false');
  });

  it('shows review results through the config variant', () => {
    render(
      <OptionGroup aria-label="Review" value="2" disabled>
        <OptionTile value="1" result="correct">
          Right
        </OptionTile>
        <OptionTile value="2" result="incorrect">
          Wrong
        </OptionTile>
      </OptionGroup>,
    );
    expect(screen.getByRole('radio', { name: 'Right' })).toHaveAttribute('data-result', 'correct');
    expect(screen.getByRole('radio', { name: 'Wrong' })).toHaveAttribute('data-result', 'incorrect');
  });
});

describe('PaletteItem', () => {
  it('describes number and status for screen readers and marks the current question', async () => {
    const onClick = vi.fn();
    render(<PaletteItem number={7} status="answered" current="yes" statusLabel="answered" onClick={onClick} />);
    const item = screen.getByRole('button', { name: 'Question 7, answered' });
    expect(item).toHaveAttribute('data-status', 'answered');
    expect(item).toHaveAttribute('aria-current', 'step');
    await userEvent.click(item);
    expect(onClick).toHaveBeenCalled();
  });

  it('defaults to not visited', () => {
    render(<PaletteItem number={1} />);
    expect(screen.getByRole('button', { name: 'Question 1' })).toHaveAttribute('data-status', 'not-visited');
  });
});
