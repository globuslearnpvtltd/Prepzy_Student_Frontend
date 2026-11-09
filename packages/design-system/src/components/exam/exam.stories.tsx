import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { variantOptions } from '../../stories/variant-options.ts';
import { OptionGroup, OptionTile, PaletteItem } from './exam.tsx';

const meta = { title: 'Exam/Question parts' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Options: Story = {
  render: function Render() {
    const [value, setValue] = useState('2');
    return (
      <OptionGroup aria-label="Which organelle makes ATP?" value={value} onValueChange={setValue} className="max-w-xl">
        {['Ribosome', 'Mitochondria', 'Golgi body', 'Lysosome'].map((text, i) => (
          <OptionTile key={text} value={String(i + 1)} marker={String.fromCharCode(65 + i)}>
            {text}
          </OptionTile>
        ))}
      </OptionGroup>
    );
  },
};

export const ReviewResults: Story = {
  render: () => (
    <OptionGroup aria-label="Review" value="1" disabled className="max-w-xl">
      <OptionTile value="1" marker="A" result="incorrect">
        Your answer: Ribosome
      </OptionTile>
      <OptionTile value="2" marker="B" result="correct">
        Correct answer: Mitochondria
      </OptionTile>
      <OptionTile value="3" marker="C">
        Golgi body
      </OptionTile>
    </OptionGroup>
  ),
};

/** Every palette status defined in design.config.ts. */
export const Palette: Story = {
  render: () => (
    <div className="flex max-w-xs flex-wrap gap-2">
      {Array.from({ length: 20 }, (_, i) => {
        const statuses = variantOptions('palette-item', 'status');
        const status = statuses[i % statuses.length];
        return (
          <PaletteItem
            key={i}
            number={i + 1}
            status={status as never}
            current={i === 5 ? 'yes' : 'no'}
            statusLabel={status}
          />
        );
      })}
    </div>
  ),
};
