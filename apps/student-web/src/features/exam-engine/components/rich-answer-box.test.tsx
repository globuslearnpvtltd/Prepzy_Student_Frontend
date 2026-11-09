import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { getExam } from '@/shared/config/exams';
import { renderWithProviders } from '@/test/render';
import type { WrittenAnswer } from '../model';
import { AnswerBox } from './answer-box';
import { editorAnswer } from './rich-answer-box';

const cbse = getExam('cbse')!;

function Harness({ initial, onChange }: { initial: WrittenAnswer; onChange: (v: WrittenAnswer) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <AnswerBox
      label="Your answer"
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe('rich written answer box', () => {
  it('restores saved HTML with its images and inserts symbols from the fx palette', async () => {
    const onChange = vi.fn();
    const image = { url: 'https://cdn/a.png', publicId: 'p1' };
    renderWithProviders(
      <Harness initial={{ text: 'Area', html: '<p>Area <strong>r</strong></p><img src="https://cdn/a.png">', images: [image] }} onChange={onChange} />,
      { exam: cbse },
    );
    const editor = await screen.findByRole('textbox', { name: 'Your answer' });
    await waitFor(() => expect(editor).toHaveTextContent('Area r'));
    expect(editor.querySelector('strong')).toHaveTextContent('r');
    expect(editor.querySelector('img')).toHaveAttribute('src', 'https://cdn/a.png');

    await userEvent.click(screen.getByRole('button', { name: 'Math symbols' }));
    const palette = screen.getByRole('group', { name: 'Math symbols' });
    await userEvent.click(within(palette).getByRole('button', { name: 'Insert π' }));
    await userEvent.click(within(palette).getByRole('button', { name: 'Insert ²' }));

    await waitFor(() => expect(editor).toHaveTextContent('π²'));
    const last = onChange.mock.calls.at(-1)![0] as WrittenAnswer;
    expect(last.html).toContain('π²');
    expect(last.html).toContain('<strong>r</strong>');
    expect(last.html).toContain('src="https://cdn/a.png"');
    expect(last.images).toEqual([image]);
    expect(last.text).toContain('π²');
  });

  it('drops images removed from the text and reports an empty editor as blank', () => {
    const image = { url: 'https://cdn/a.png', publicId: 'p1' };
    expect(editorAnswer({ isEmpty: true, getHTML: () => '<p></p>', getText: () => '' }, [image])).toEqual({ text: '', html: '', images: [] });
    expect(editorAnswer({ isEmpty: false, getHTML: () => '<p>x</p>', getText: () => ' x ' }, [image])).toEqual({ text: 'x', html: '<p>x</p>', images: [] });
  });
});
