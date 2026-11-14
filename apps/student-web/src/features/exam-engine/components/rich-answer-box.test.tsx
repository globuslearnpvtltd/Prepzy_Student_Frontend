import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { toast } from 'sonner';
import { renderWithProviders } from '@/test/render';
import { API, server } from '@/test/server';
import type { WrittenAnswer } from '../model';
import { AnswerBox } from './answer-box';
import { editorAnswer } from './rich-answer-box';
import { testExam } from '@/test/exams';

const cbse = testExam('cbse');

function Harness({ initial, onChange, inkDraftKey }: { initial: WrittenAnswer; onChange: (v: WrittenAnswer) => void; inkDraftKey?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <AnswerBox
      label="Your answer"
      inkDraftKey={inkDraftKey}
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

describe('writing pad in the written answer', () => {
  const DRAFT = JSON.stringify([[0, [1, 1, 0.5, 40, 30, 0.5]]]);
  let uploads = 0;
  beforeEach(() => {
    uploads = 0;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => new Proxy({}, { get: () => () => undefined, set: () => true }) as never,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'], { type: 'image/png' })));
    server.use(
      http.post(`${API}/api/v4/assessments/answer-images`, () => {
        uploads += 1;
        return HttpResponse.json({ success: true, data: { url: `https://cdn.test/ink-${uploads}.png`, public_id: `ink${uploads}` } });
      }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it('opens the pad inside the box and adds the page to the answer as a picture', async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness initial={{ text: 'Ohm', html: '<p>Ohm</p>', images: [] }} onChange={onChange} inkDraftKey="answer:a1:q1" />, { exam: cbse });
    const editor = await screen.findByRole('textbox', { name: 'Your answer' });
    await userEvent.click(screen.getByRole('button', { name: 'Write by hand' }));
    expect(screen.getByRole('toolbar', { name: 'Handwriting tools' })).toBeInTheDocument();
    // Nothing written yet: nothing to add.
    expect(screen.getByRole('button', { name: 'Add to answer' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Back to typing' }));
    expect(screen.queryByRole('toolbar', { name: 'Handwriting tools' })).not.toBeInTheDocument();
    expect(uploads).toBe(0);

    // A page written before a reload comes back with the pad open.
    sessionStorage.setItem('prepzy-ink:answer:a1:q2', DRAFT);
    renderWithProviders(<Harness initial={{ text: '', images: [] }} onChange={onChange} inkDraftKey="answer:a1:q2" />, { exam: cbse });
    const add = await screen.findByRole('button', { name: 'Add to answer' });
    await waitFor(() => expect(add).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Bigger writing area' }));
    expect(screen.getByRole('dialog', { name: 'Write your answer' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(add);

    // Back to the answer, which now shows the page.
    await waitFor(() => expect(screen.queryByRole('toolbar', { name: 'Handwriting tools' })).not.toBeInTheDocument());
    const editors = screen.getAllByRole('textbox', { name: 'Your answer' });
    await waitFor(() => expect(editors[1]!.querySelector('img')).toHaveAttribute('alt', 'Handwritten answer'));
    const last = onChange.mock.calls.at(-1)![0] as WrittenAnswer;
    expect(last.images).toEqual([{ url: 'https://cdn.test/ink-1.png', publicId: 'ink1' }]);
    expect(last.html).toContain('alt="Handwritten answer"');
    expect(editor).toBeInTheDocument();
    await waitFor(() => expect(sessionStorage.getItem('prepzy-ink:answer:a1:q2')).toBeNull());
  });

  it('adds a page still on the pad when the student moves to another question', async () => {
    const onChange = vi.fn();
    sessionStorage.setItem('prepzy-ink:answer:a1:q3', DRAFT);
    const view = renderWithProviders(
      <Harness initial={{ text: 'V = IR', html: '<p>V = IR</p>', images: [] }} onChange={onChange} inkDraftKey="answer:a1:q3" />,
      { exam: cbse },
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add to answer' })).toBeEnabled());
    view.unmount();
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)![0]).toEqual({
      text: 'V = IR',
      html: '<p>V = IR</p><p><img src="https://cdn.test/ink-1.png" alt="Handwritten answer"></p>',
      images: [{ url: 'https://cdn.test/ink-1.png', publicId: 'ink1' }],
    });
    expect(sessionStorage.getItem('prepzy-ink:answer:a1:q3')).toBeNull();
  });

  it('keeps the page when the answer already has ten pictures, and when the upload fails', async () => {
    const error = vi.spyOn(toast, 'error');
    const full = Array.from({ length: 10 }, (_, i) => ({ url: `https://cdn/${i}.png`, publicId: `p${i}` }));
    sessionStorage.setItem('prepzy-ink:answer:a1:q4', DRAFT);
    renderWithProviders(<Harness initial={{ text: '', images: full }} onChange={() => undefined} inkDraftKey="answer:a1:q4" />, { exam: cbse });
    const add = await screen.findByRole('button', { name: 'Add to answer' });
    await waitFor(() => expect(add).toBeEnabled());
    await userEvent.click(add);
    expect(error).toHaveBeenCalledWith('An answer can have up to 10 pictures.');
    expect(uploads).toBe(0);
    // A photo on top is refused too.
    await userEvent.click(screen.getByRole('button', { name: 'Back to typing' }));
    expect(screen.getByRole('toolbar', { name: 'Handwriting tools' })).toBeInTheDocument();
    error.mockClear();
    server.use(http.post(`${API}/api/v4/assessments/answer-images`, () => HttpResponse.json({ success: false, message: 'Nope' }, { status: 500 })));
    sessionStorage.setItem('prepzy-ink:answer:a1:q5', DRAFT);
    renderWithProviders(<Harness initial={{ text: '', images: [] }} onChange={() => undefined} inkDraftKey="answer:a1:q5" />, { exam: cbse });
    const adds = await screen.findAllByRole('button', { name: 'Add to answer' });
    await waitFor(() => expect(adds[1]).toBeEnabled());
    await userEvent.click(adds[1]!);
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(adds[1]).toBeEnabled(); // still on the pad, ready to try again
    // Leaving with the pages still on the pads tries once more (and fails the same way) before the next test.
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  it('refuses photos beyond the limit', async () => {
    const error = vi.spyOn(toast, 'error');
    const nine = Array.from({ length: 9 }, (_, i) => ({ url: `https://cdn/${i}.png`, publicId: `p${i}` }));
    renderWithProviders(<Harness initial={{ text: '', images: nine }} onChange={() => undefined} />, { exam: cbse });
    const input = await screen.findByTestId('answer-gallery');
    await userEvent.upload(input, [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })]);
    expect(error).toHaveBeenCalledWith('An answer can have up to 10 pictures.');
    await waitFor(() => expect(uploads).toBe(1));
  });
});
