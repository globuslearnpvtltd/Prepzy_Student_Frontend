'use client';

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { formatPhone } from '../format';
import { BackLink, ErrorBanner, InfoCards, MobileBanner, MobileInfoCards, type InfoCard } from './chrome';

const EMPTY_OTP = ['', '', '', '', '', ''];

const BENEFITS: InfoCard[] = [
  { icon: 'icon-link-22.svg', mobileIcon: 'icon-link.svg', title: 'One link for every exam', desc: 'CBSE, NEET and more' },
  { icon: 'icon-userplus-22.svg', mobileIcon: 'icon-userplus.svg', title: '₹50 per sign-up', desc: 'The moment a student joins' },
  { icon: 'icon-percent-22.svg', mobileIcon: 'icon-percent.svg', title: 'A share of every plan', desc: '10% of what they pay' },
  { icon: 'icon-bank-22.svg', mobileIcon: 'icon-bank.svg', title: 'Earnings Paid to bank', desc: 'Direct Cash, no points' },
];

export interface VerifyOtpProps {
  phone: string;
  error: string;
  verifying: boolean;
  sending: boolean;
  resendTimer: number;
  onBack: () => void;
  onResend: () => void;
  /** Resolves false when the code was rejected, so the boxes are cleared for another try. */
  onVerify: (code: string) => Promise<boolean>;
  /** Sign-in uses this screen too. */
  mode?: 'signup' | 'login';
}

/** Six one-digit boxes; on desktop the step scales with the window height so it fits one screen. */
export function VerifyOtp({ phone, error, verifying, sending, resendTimer, onBack, onResend, onVerify, mode = 'signup' }: VerifyOtpProps) {
  const [otp, setOtp] = useState(EMPTY_OTP);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const complete = otp.every(Boolean);
  const focusBox = (index: number) => boxes.current[index]?.focus();

  const verify = async () => {
    if (!complete || verifying) return;
    const ok = await onVerify(otp.join(''));
    if (!ok) {
      setOtp(EMPTY_OTP);
      focusBox(0);
    }
  };

  const resend = () => {
    setOtp(EMPTY_OTP);
    focusBox(0);
    onResend();
  };

  const change = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) focusBox(index + 1);
  };

  const keyDown = (event: KeyboardEvent, index: number) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) focusBox(index - 1);
    if (event.key === 'Enter') void verify();
  };

  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    if (digits.length === 0) return;
    setOtp(EMPTY_OTP.map((_, i) => digits[i] ?? ''));
    focusBox(Math.min(digits.length, 5));
  };

  const sentTo = (
    <>
      We sent a 6-digit code on WhatsApp to <span className="whitespace-nowrap">{formatPhone(phone)}</span>
    </>
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col lg:h-full lg:min-h-0">
      <MobileBanner
        label={mode === 'signup' ? 'Verify mobile' : 'Partner sign in'}
        heading="Verify your number"
        subtitle={sentTo}
        subtitleClassName="text-[16px] leading-[23px]"
      />

      <main className="relative -mt-[32px] flex flex-col items-center gap-[28px] px-[24px] pb-[32px] lg:mt-0 lg:min-h-0 lg:flex-1 lg:[justify-content:safe_center] lg:gap-[clamp(12px,2.6vh,26px)] lg:overflow-y-auto lg:px-[16px] lg:pt-[clamp(16px,4vh,42px)] lg:pb-[clamp(16px,4vh,48px)]">
        <div className="hidden lg:contents">
          <BackLink onClick={onBack} />
        </div>

        <div className="hidden w-full max-w-[560px] flex-col items-center gap-[10px] text-center lg:flex">
          <h1 className="font-display text-partner-ink m-0 text-[32px] leading-[normal] font-extrabold sm:text-[40px] lg:text-[length:clamp(28px,4.4vh,40px)]">
            Verify your number
          </h1>
          <p className="text-partner-muted m-0 text-[18px] leading-[26px]">{sentTo}</p>
        </div>

        <div className="bg-neutral-0 lg:border-partner-line flex w-full max-w-[560px] flex-col items-center gap-[16px] rounded-[24px] p-[22px] shadow-[0px_10px_28px_0px_rgba(36,29,82,0.1)] lg:gap-[clamp(12px,2vh,20px)] lg:border-[1px] lg:border-solid lg:p-[clamp(20px,3.6vh,34px)] lg:shadow-none">
          <ErrorBanner message={error} />

          <div className="grid w-full max-w-[468px] grid-cols-6 gap-[10px] lg:gap-[12px]">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(node) => {
                  boxes.current[i] = node;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                aria-label={`Digit ${i + 1}`}
                maxLength={1}
                value={digit}
                autoFocus={i === 0}
                onChange={(event) => change(event.target.value, i)}
                onKeyDown={(event) => keyDown(event, i)}
                onPaste={paste}
                className="font-display border-partner-input-line bg-partner-input text-partner-ink focus:border-brand-700 h-[50px] w-full min-w-0 rounded-[13px] border-[1.4px] border-solid text-center text-[26px] font-bold outline-none transition-colors focus:border-[1.8px] lg:h-[clamp(76px,8vh,80px)] lg:rounded-[14px]"
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => void verify()}
            disabled={verifying || !complete}
            className="font-display bg-brand-700 text-neutral-0 hover:bg-partner-hover disabled:bg-partner-disabled flex w-full items-center justify-center rounded-[15px] py-[18px] text-[19px] leading-[normal] font-bold shadow-[0px_8px_18px_0px_rgba(61,52,139,0.28)] transition-colors disabled:cursor-not-allowed disabled:shadow-none lg:max-w-[300px] lg:rounded-[14px] lg:py-[clamp(12px,2vh,18px)]"
          >
            {verifying ? 'Verifying…' : mode === 'signup' ? 'Verify & continue' : 'Verify & sign in'}
          </button>

          <div className="flex items-center justify-center gap-[5px] text-[15px] leading-[normal] whitespace-nowrap lg:gap-[6px] lg:text-[16px]">
            <span className="text-partner-muted">Didn&apos;t get it?</span>
            {resendTimer > 0 ? (
              <span className="text-brand-700 font-bold">Resend in {resendTimer}s</span>
            ) : (
              <button
                type="button"
                onClick={resend}
                disabled={sending}
                className="text-brand-700 font-bold hover:underline disabled:opacity-60"
              >
                {sending ? 'Sending…' : 'Resend code'}
              </button>
            )}
          </div>
        </div>

        <div className="hidden lg:contents">
          <InfoCards heading="What you get as a partner" cards={BENEFITS} fitHeight />
        </div>
        <MobileInfoCards heading="What you get as a partner" cards={BENEFITS} />
      </main>
    </div>
  );
}
