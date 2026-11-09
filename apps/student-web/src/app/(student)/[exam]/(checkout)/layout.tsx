/** Checkout: full-screen, no header or navigation (the previous app's purchase page). */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="bg-surface min-h-dvh">
      {children}
    </main>
  );
}
