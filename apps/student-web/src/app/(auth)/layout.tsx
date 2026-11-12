/**
 * Frame of the sign-in and onboarding pages. Single column, as in the previous app: login and sign-up draw
 * their own brand panel (AuthScreen), the OTP / exam / setup steps are full width (OtpForm, OnboardingStep).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-surface min-h-dvh">{children}</div>;
}
