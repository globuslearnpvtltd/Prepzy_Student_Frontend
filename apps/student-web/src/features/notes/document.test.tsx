import { render } from '@testing-library/react';
import { prepareNotes } from './document';
import { NotesHtml } from './ui';

const page = (head: string, body: string) => `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;

describe('prepareNotes: the document’s own styles', () => {
  it('scopes the head styles to the notes box and keeps only Google Fonts links', () => {
    const doc = prepareNotes(
      page(
        `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins" />
         <link rel="stylesheet" href="https://evil.example/x.css" />
         <script src="https://cdn.example/mathjax.js"></script>
         <style>
           @import url('https://fonts.googleapis.com/css2?family=Inter');
           @import url('https://evil.example/y.css');
           :root { --brand: red; }
           body { margin: 0; background-color: gray; color: black; }
           html body p, .card:is(.a, .b) { color: blue; }
           body.dark h1 { color: white; }
           @media (max-width: 768px) { h2 { font-size: 1rem; } }
           @supports (display: grid) { .grid { display: grid; } }
           @font-face { font-family: X; }
           @keyframes spin { from { opacity: 0; } }
           @page { margin: 0; }
           .x::after { content: "\\3c/style>"; }
         </style>`,
        '<h2>Waves</h2><p>text</p><style>body{color:red}</style><link rel="stylesheet" href="https://evil.example/body.css">',
      ),
      [],
    );

    expect(doc.fonts).toEqual(['https://fonts.googleapis.com/css2?family=Poppins', 'https://fonts.googleapis.com/css2?family=Inter']);
    expect(doc.css).toContain('[data-notes-doc] { --brand: red; }');
    // The page background is the reader's, not the notes'.
    expect(doc.css).toContain('[data-notes-doc] { margin: 0px; color: black; }');
    expect(doc.css).toContain('[data-notes-doc] p, [data-notes-doc] .card:is(.a, .b) { color: blue; }');
    expect(doc.css).toContain('[data-notes-doc].dark h1 { color: white; }');
    expect(doc.css).toMatch(/@media \(max-width: ?768px\) \{ \[data-notes-doc\] h2 \{ font-size: 1rem; \} \}/);
    expect(doc.css).toContain('@supports (display: grid) { [data-notes-doc] .grid { display: grid; } }');
    expect(doc.css).toContain('@font-face');
    expect(doc.css).toContain('@keyframes spin');
    expect(doc.css).not.toMatch(/@page|@import|evil|<\/style/);
    // Body styles, links and scripts never reach the page.
    expect(doc.html).toBe('<h2 id="notes-waves">Waves</h2><p>text</p>');
  });

  it('has no stylesheet for plain notes or unparsable CSS', () => {
    expect(prepareNotes('<p>plain</p>', [])).toMatchObject({ css: '', fonts: [] });
    const replaceSync = vi.spyOn(CSSStyleSheet.prototype, 'replaceSync').mockImplementation(() => {
      throw new Error('bad');
    });
    expect(prepareNotes(page('<style>p{color:red}</style>', '<p>x</p>'), [])).toMatchObject({ css: '', html: '<p>x</p>' });
    replaceSync.mockRestore();
  });
});

describe('NotesHtml', () => {
  it('shows notes with their own scoped stylesheet', () => {
    const { container } = render(<NotesHtml html={page('<style>h2{color:red}</style>', '<h2>Light</h2>')} fallbackClassName="fallback" />);
    const box = container.querySelector('[data-notes-doc]')!;
    expect(box.querySelector('style')!.textContent).toBe('[data-notes-doc] h2 { color: red; }');
    expect(box.querySelector('.fallback')).toBeNull();
    expect(box).toHaveTextContent('Light');
  });

  it('uses the fallback styles when the notes have none', () => {
    const { container } = render(<NotesHtml html="<p>plain</p>" fallbackClassName="fallback" />);
    expect(container.querySelector('style')).toBeNull();
    expect(container.querySelector('.fallback')).toHaveTextContent('plain');
  });
});
