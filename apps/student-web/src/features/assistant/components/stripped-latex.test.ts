import { restoreStrippedLatex } from './stripped-latex';

describe('restoreStrippedLatex', () => {
  it("puts back a Socrates formula's backslashes and delimiters", () => {
    const reply =
      'We’re evaluating the accumulated value of (int_0^{pi/4} sec^4 x \\, dx).\n\nBefore working it out, what do you notice?';
    expect(restoreStrippedLatex(reply)).toBe(
      'We’re evaluating the accumulated value of \\(\\int_0^{\\pi/4} \\sec^4 x \\, dx\\).\n\nBefore working it out, what do you notice?',
    );
    expect(restoreStrippedLatex('Try (frac{1}{2} x^2 + C) or [sqrt{x^2 + 1}]')).toBe('Try \\(\\frac{1}{2} x^2 + C\\) or \\[\\sqrt{x^2 + 1}\\]');
    expect(restoreStrippedLatex('(left( x^2 right))')).toBe('\\(\\left( x^2 \\right)\\)');
    expect(restoreStrippedLatex('(x^2 + sin theta)')).toBe('\\(x^2 + \\sin \\theta\\)');
  });

  it('leaves ordinary brackets, sentences and delimited maths alone', () => {
    for (const text of [
      '(A) 2 / 3\n(B) - (2 / 3)',
      'Look at the figure (the one on the left) first.',
      '(this is a sentence with x_1 in the middle of many words)',
      'Already fine: \\(\\int x\\, dx\\) and (x^2)',
      'Cost is $5 (x^2)',
      'A line break (x^2\n+ 1) is not inline maths',
    ]) {
      expect(restoreStrippedLatex(text)).toBe(text);
    }
    // A bracket around a formula: only the formula becomes maths.
    expect(restoreStrippedLatex('(see (x_1 + x_2))')).toBe('(see \\(x_1 + x_2\\))');
  });
});
