/** Ask Socrates logic (cheap to import). Screens live in ./ui. */
export { buildSolvePayload, formatSubject, htmlToText, shortSubject, solverApi, stripDiagrams } from './api';
export type { BankQuestion, ConceptCard, SolvePayload, SolverBook, SolverSubject } from './api';
export { solverKeys, useBooks, useDoubtHistory, useSolveQuestion, useSolverChat } from './hooks';
export { useSolver } from './store';
