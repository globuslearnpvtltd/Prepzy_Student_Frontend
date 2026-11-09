import {
  countStatuses,
  emptySnapshot,
  htmlImageUrls,
  htmlToText,
  isAnswered,
  statusOf,
  withAnswer,
  withMarkToggled,
  withVisit,
  writtenToHtml,
} from './attempt';
import { toWritten, writtenPayload } from './adapters/board';
import type { ExamQuestion } from './model';

const q = (id: string): ExamQuestion => ({
  id,
  kind: 'mcq',
  typeLabel: 'MCQ',
  html: '',
  image: null,
  marks: 4,
  options: [],
  parts: [],
});

describe('attempt state', () => {
  it('starts every question as not visited', () => {
    expect(statusOf('1', emptySnapshot())).toBe('not-visited');
  });

  it('marks a visited but blank question as skipped', () => {
    expect(statusOf('1', withVisit(emptySnapshot(), '1'))).toBe('skipped');
  });

  it('marks an answered question as answered', () => {
    const snap = withAnswer(emptySnapshot(), '1', { kind: 'option', optionId: 'b' });
    expect(statusOf('1', snap)).toBe('answered');
  });

  it('lets review marks win over answered, and toggles off', () => {
    let snap = withAnswer(emptySnapshot(), '1', { kind: 'option', optionId: 'b' });
    snap = withMarkToggled(snap, '1');
    expect(statusOf('1', snap)).toBe('marked');
    snap = withMarkToggled(snap, '1');
    expect(statusOf('1', snap)).toBe('answered');
  });

  it('clears an option answer when null is given', () => {
    let snap = withAnswer(emptySnapshot(), '1', { kind: 'option', optionId: 'b' });
    snap = withAnswer(snap, '1', null);
    expect(snap.answers['1']).toBeUndefined();
    expect(statusOf('1', snap)).toBe('skipped');
  });

  it('treats blank written answers as unanswered and text or images as answered', () => {
    expect(isAnswered({ kind: 'written', text: '   ', images: [] })).toBe(false);
    expect(isAnswered({ kind: 'written', text: 'Photosynthesis', images: [] })).toBe(true);
    expect(isAnswered({ kind: 'written', text: '', images: [{ url: 'u', publicId: 'p' }] })).toBe(true);
    expect(isAnswered({ kind: 'parts', parts: { a: { text: '', images: [] }, b: { text: 'x', images: [] } } })).toBe(
      true,
    );
    expect(isAnswered({ kind: 'parts', parts: { a: { text: '', images: [] } } })).toBe(false);
  });

  it('counts statuses across the paper', () => {
    const questions = [q('1'), q('2'), q('3'), q('4')];
    let snap = withAnswer(emptySnapshot(), '1', { kind: 'option', optionId: 'a' });
    snap = withVisit(snap, '2');
    snap = withMarkToggled(snap, '3');
    const counts = countStatuses(questions, snap);
    expect(counts).toMatchObject({
      answered: 1,
      skipped: 1,
      marked: 1,
      'not-visited': 1,
      answeredTotal: 1,
      unanswered: 3,
    });
  });
});

describe('written answer HTML', () => {
  it('escapes text, keeps paragraphs and line breaks, and appends images', () => {
    const html = writtenToHtml({
      text: 'First <b>line</b>\nsecond\n\nNew para',
      images: [{ url: 'https://img/x.png', publicId: 'x' }],
    });
    expect(html).toBe(
      '<p>First &lt;b&gt;line&lt;/b&gt;<br>second</p><p>New para</p><p><img src="https://img/x.png" alt="Answer image"></p>',
    );
  });

  it('round-trips back to editable text', () => {
    const text = 'Line one\nline two\n\nPara & more';
    expect(htmlToText(writtenToHtml({ text, images: [] }))).toBe(text);
    expect(htmlToText(null)).toBe('');
  });
});

describe('rich written answers', () => {
  const image = { url: 'https://cdn/a.png?x=1&y=2', publicId: 'p1' };
  const html = '<p>F = <strong>qE</strong></p><ul><li>vector</li></ul><img src="https://cdn/a.png?x=1&amp;y=2" alt="Uploaded answer"><p></p>';

  it('stores the editor HTML as is and round-trips it with the images', () => {
    const answer = { text: 'F = qE vector', html, images: [image] };
    const payload = writtenPayload(answer);
    expect(payload).toEqual({ text: html, images: [{ url: image.url, public_id: 'p1' }] });
    expect(toWritten(payload)).toEqual({ text: 'F = qE\n\nvector', html, images: [image] });
    expect(htmlImageUrls(html)).toEqual([image.url]);
  });

  it('appends listed images the HTML does not show, and keeps plain answers working', () => {
    const extra = { url: 'https://cdn/b.png', publicId: 'p2' };
    expect(writtenToHtml({ text: 'x', html: '<p>x</p>', images: [extra] })).toBe('<p>x</p><p><img src="https://cdn/b.png" alt="Answer image"></p>');
    expect(writtenToHtml({ text: 'plain', html: '', images: [] })).toBe('<p>plain</p>');
    expect(toWritten({ text: '', images: [] })).toEqual({ text: '', images: [] });
    expect(isAnswered({ kind: 'written', text: '', html: '<p><img src="u"></p>', images: [extra] })).toBe(true);
  });
});
