import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearInkDraft, InkDoc, InkPad } from '.';

/** A 2D context that records nothing: jsdom has no canvas. */
const fakeContext = () =>
  new Proxy({} as Record<string | symbol, unknown>, {
    get: (target, key) => (key in target ? target[key] : () => undefined),
    set: (target, key, value) => {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeContext() as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback) {
    callback(new Blob(['png'], { type: 'image/png' }));
  });
});
afterEach(() => vi.restoreAllMocks());

const line = (doc: InkDoc, x: number, y: number, pen = false) => {
  const stroke = doc.begin({ x, y, p: 0.5 }, pen);
  doc.extend(stroke, { x: x + 10, y: y + 10, p: 0.8 });
  doc.extend(stroke, { x: x + 10.1, y: y + 10.1, p: 0.8 }); // too close: ignored
  doc.commit(stroke);
  return stroke;
};

describe('InkDoc', () => {
  it('adds strokes and undoes, redoes and clears them', () => {
    const doc = new InkDoc();
    const changes = vi.fn();
    doc.subscribe(changes);
    expect(doc.isEmpty).toBe(true);
    const stroke = line(doc, 5, 5);
    expect(stroke.pts).toHaveLength(2);
    expect(doc.bottom).toBe(15);
    expect(doc.right).toBe(15);
    doc.undo();
    expect(doc.isEmpty).toBe(true);
    doc.redo();
    expect(doc.strokes).toHaveLength(1);
    doc.clear();
    expect(doc.isEmpty).toBe(true);
    doc.undo();
    expect(doc.strokes).toHaveLength(1);
    expect(changes).toHaveBeenCalled();
    doc.reset();
    expect(doc.canUndo).toBe(false);
  });

  it('erases whole strokes near the eraser and puts them back on undo', () => {
    const doc = new InkDoc();
    line(doc, 0, 0);
    line(doc, 100, 100);
    const erased: Parameters<InkDoc['commitErase']>[0] = [];
    expect(doc.eraseAt(5, 5, 3, erased)).toBe(true);
    expect(doc.eraseAt(500, 500, 3, erased)).toBe(false);
    doc.commitErase(erased);
    expect(doc.strokes).toHaveLength(1);
    doc.undo();
    expect(doc.strokes).toHaveLength(2);
    doc.redo();
    expect(doc.strokes).toHaveLength(1);
  });

  it('saves and restores a draft, ignoring broken data', () => {
    const doc = new InkDoc();
    line(doc, 1, 2, true);
    const copy = new InkDoc();
    copy.restore(doc.serialize());
    expect(copy.strokes).toHaveLength(1);
    expect(copy.strokes[0]).toMatchObject({ pen: true, x0: 1, y0: 2, x1: 11, y1: 12 });
    copy.restore('not json');
    copy.restore('{}');
    expect(copy.strokes).toHaveLength(1);
  });

  it('exports the writing as a PNG file, or nothing when empty', async () => {
    const doc = new InkDoc();
    expect(await doc.toFile()).toBeNull();
    line(doc, 0, 0);
    const file = await doc.toFile('w.png');
    expect(file).toMatchObject({ name: 'w.png', type: 'image/png' });
  });

  it('paints the sheet, the newest segment and the stroke end', () => {
    const doc = new InkDoc();
    const ctx = fakeContext();
    const stroke = line(doc, 0, 0);
    doc.paint(ctx, 100, 100, 'black');
    doc.paintLatest(ctx, stroke, 'black');
    doc.paintEnd(ctx, doc.begin({ x: 1, y: 1, p: 0.5 }, false), 'black');
    expect(ctx.strokeStyle).toBe('black');
  });
});

describe('InkPad', () => {
  const pointer = (type: string, x: number, y: number) => ({ pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: x, clientY: y, type });

  it('writes with the mouse, then undoes, redoes, clears and erases', async () => {
    const doc = new InkDoc();
    const onExpandedChange = vi.fn();
    render(<InkPad doc={doc} onExpandedChange={onExpandedChange} />);
    const sheet = screen.getByRole('img', { name: 'Handwriting area, empty' });
    expect(screen.getByText('Write here with your finger, stylus or trackpad')).toBeInTheDocument();

    fireEvent.pointerDown(sheet, pointer('pointerdown', 10, 10));
    fireEvent.pointerMove(sheet, pointer('pointermove', 30, 30));
    fireEvent.pointerUp(sheet, pointer('pointerup', 30, 30));
    expect(doc.strokes).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'Handwriting area with your writing' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(doc.isEmpty).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(doc.strokes).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Eraser' }));
    fireEvent.pointerDown(sheet, pointer('pointerdown', 10, 10));
    fireEvent.pointerUp(sheet, pointer('pointerup', 10, 10));
    expect(doc.isEmpty).toBe(true);

    fireEvent.keyDown(sheet, { key: 'z', ctrlKey: true });
    expect(doc.strokes).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Clear writing' }));
    expect(doc.isEmpty).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Bigger writing area' }));
    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('does not write while disabled', () => {
    const doc = new InkDoc();
    render(<InkPad doc={doc} disabled />);
    const sheet = screen.getByRole('img');
    fireEvent.pointerDown(sheet, pointer('pointerdown', 10, 10));
    fireEvent.pointerUp(sheet, pointer('pointerup', 30, 30));
    expect(doc.isEmpty).toBe(true);
  });
});

describe('clearInkDraft', () => {
  it('forgets a saved draft, and ignores no key', () => {
    sessionStorage.setItem('prepzy-ink:k1', '[]');
    clearInkDraft(undefined);
    expect(sessionStorage.getItem('prepzy-ink:k1')).toBe('[]');
    clearInkDraft('k1');
    expect(sessionStorage.getItem('prepzy-ink:k1')).toBeNull();
  });
});
