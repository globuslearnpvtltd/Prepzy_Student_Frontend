/** Ask Socrates runs full screen with its own header (no app header or navigation), as before. */
export default function SolverLayout({ children }: { children: React.ReactNode }) {
  return <main id="main">{children}</main>;
}
