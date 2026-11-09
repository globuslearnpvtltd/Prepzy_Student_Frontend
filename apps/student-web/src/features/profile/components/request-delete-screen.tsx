'use client';

import Script from 'next/script';

declare global {
  interface Window {
    Tally?: { loadEmbeds: () => void };
  }
}

const FORM = 'https://tally.so/embed/QKK9b8?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1';

/** Account deletion request (Tally form), as on the previous site. */
export function RequestDeleteScreen() {
  return (
    <div className="bg-surface border-line mx-auto flex max-w-[1440px] flex-col gap-[50px] border p-[30px]">
      <h1 className="text-[28px] leading-6 font-semibold">Delete Your Account</h1>
      <div className="flex flex-col gap-[50px]">
        <p className="text-[18px] leading-[22px]">We&apos;re sorry to hear you&apos;d like to delete your account.</p>
        <div className="flex flex-col gap-[10px]">
          <p className="text-[16px] font-semibold">If you delete your account:</p>
          <ul className="list-disc pl-5 text-[14px]">
            <li>We&apos;ll delete your email address, password, and phone number</li>
            <li>You won&apos;t lose your information saved, but you will need to create a new prepzy.ai account</li>
          </ul>
        </div>
      </div>
      <p className="text-[16px] font-semibold">Fill This Form To Delete Your Account</p>
      <div className="border-neutral-200 bg-surface w-full max-w-[800px] rounded-sm border-2 p-6 shadow-sm">
        <iframe data-tally-src={FORM} loading="lazy" width="100%" height="600" title="Prepzy - Account Deletion Request" className="border-0" />
        <Script id="tally-js" src="https://tally.so/widgets/embed.js" strategy="afterInteractive" onLoad={() => window.Tally?.loadEmbeds()} />
      </div>
    </div>
  );
}
