/**
 * Some agent replies arrive with the backslashes of their LaTeX removed: `\( \int_0^{\pi/4} \sec^4 x \, dx \)` comes
 * as `(int_0^{pi/4} sec^4 x \, dx)`, which MathJax can't recognise. This puts the maths back: a bracketed part that
 * is clearly a formula (it has `^`, `_` or a LaTeX space like `\,`, and no plain sentence) gets its command names
 * back (`int` → `\int`, `pi` → `\pi` …) and becomes `\( … \)` (`[ … ]` becomes `\[ … \]`).
 *
 * Replies that already use maths delimiters ($, \(, \[) are left as they are, and brackets of ordinary text
 * ("(A) 2/3", "(see the figure)") don't look like formulas, so they are never touched.
 */

/** LaTeX command names that lose their backslash. Plain English words (to, left, dot …) are not in the list. */
const COMMANDS = [
  'iiint', 'iint', 'oint', 'int', 'sum', 'prod', 'lim', 'limsup', 'liminf', 'max', 'min',
  'dfrac', 'tfrac', 'frac', 'sqrt', 'binom', 'cdot', 'cdots', 'ldots', 'times', 'div', 'pm', 'mp',
  'leq', 'geq', 'neq', 'le', 'ge', 'ne', 'approx', 'equiv', 'propto', 'infty', 'partial', 'nabla',
  'rightarrow', 'leftarrow', 'Rightarrow', 'Leftarrow', 'implies', 'iff',
  'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'exp',
  'alpha', 'beta', 'gamma', 'Gamma', 'delta', 'Delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'Theta',
  'vartheta', 'iota', 'kappa', 'lambda', 'Lambda', 'mu', 'nu', 'xi', 'Xi', 'pi', 'Pi', 'rho', 'sigma', 'Sigma', 'tau',
  'upsilon', 'phi', 'Phi', 'varphi', 'chi', 'psi', 'Psi', 'omega', 'Omega',
  'vec', 'overline', 'underline', 'mathrm', 'mathbf', 'mathit', 'operatorname', 'degree', 'circ', 'angle', 'perp',
  'parallel', 'in', 'notin', 'subset', 'cup', 'cap', 'forall', 'exists', 'quad', 'qquad',
];

const COMMAND = new RegExp(`(?<![\\\\A-Za-z])(${[...COMMANDS].sort((a, b) => b.length - a.length).join('|')})(?![A-Za-z])`, 'g');
/** `left(` / `right)` pairs (only before a delimiter, so the words "left" / "right" stay words). */
const LEFT_RIGHT = /(?<![\\A-Za-z])(left|right)(?=[()[\]|.]|\\[{}])/g;

/**
 * Is this bracketed text a formula? It needs maths syntax (`^`, `_`, `\,`) and no plain word of three or more letters
 * once the command names are taken out ("see", "value" …): words mean it is text around a formula, whose own
 * brackets are checked separately.
 */
const looksLikeMath = (inner: string): boolean => {
  if (!/[_^]|\\[,;:! ]/.test(inner)) return false;
  return !/(?<![\\A-Za-z])[A-Za-z]{3,}/.test(inner.replace(COMMAND, ' ').replace(LEFT_RIGHT, ' '));
};

const restoreCommands = (inner: string): string => inner.replace(COMMAND, '\\$1').replace(LEFT_RIGHT, '\\$1');

/** Index of the bracket closing `text[start]`, or -1. */
const closing = (text: string, start: number): number => {
  const open = text[start]!;
  const close = open === '(' ? ')' : ']';
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (c === '\n' && open === '(') return -1; // inline maths stays on one line
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
};

export function restoreStrippedLatex(text: string): string {
  // Delimited maths is fine as it is.
  if (/\\\(|\\\[|\$/.test(text)) return text;
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if ((c === '(' || c === '[') && text[i - 1] !== '\\') {
      const end = closing(text, i);
      if (end > i) {
        const inner = text.slice(i + 1, end);
        if (looksLikeMath(inner)) {
          const math = restoreCommands(inner.trim());
          out += c === '(' ? `\\(${math}\\)` : `\\[${math}\\]`;
          i = end + 1;
          continue;
        }
      }
    }
    out += c;
    i += 1;
  }
  return out;
}
