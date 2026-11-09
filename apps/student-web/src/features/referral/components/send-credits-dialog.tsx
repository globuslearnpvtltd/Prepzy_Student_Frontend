'use client';

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@prepzy/design-system';
import { useMutation } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { userMessage } from '@/shared/lib/errors';
import { inr, referralApi } from '../api';

const INPUT =
  'border-neutral-150 bg-surface text-ink focus:border-brand placeholder:text-neutral-350 w-full rounded-[10px] border px-[14px] py-3 text-[14px] outline-none lg:rounded-md';
const LABEL = 'text-ink text-[13px] font-semibold';
const LOOKUP_DELAY = 500;

type Lookup = { state: 'idle' | 'looking' } | { state: 'found'; accountId: number; name: string } | { state: 'error'; message: string };

/** Looks the recipient up 0.5 s after a 10-digit number is typed (stale lookups are cancelled). */
function useRecipient(phone: string): Lookup {
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });
  useEffect(() => {
    if (phone.replace(/\D/g, '').length < 10) {
      setLookup({ state: 'idle' });
      return;
    }
    setLookup({ state: 'looking' });
    const controller = new AbortController();
    const timer = setTimeout(() => {
      referralApi
        .lookup(phone, controller.signal)
        .then((found) => setLookup({ state: 'found', ...found }))
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setLookup({ state: 'error', message: userMessage(error, "Couldn't find a student with that number") });
        });
    }, LOOKUP_DELAY);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [phone]);
  return lookup;
}

export function SendCreditsDialog({ open, balance, onClose, onSent }: { open: boolean; balance: number; onClose: () => void; onSent: () => void }) {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const recipient = useRecipient(phone);
  const send = useMutation({ mutationFn: referralApi.transfer, onSuccess: onSent });

  const parsed = Number(amount);
  const validAmount = amount.trim() !== '' && parsed > 0 && parsed <= balance;
  const found = recipient.state === 'found' ? recipient : null;
  const canSend = !!found && validAmount && !send.isPending;

  const close = () => {
    setPhone('');
    setAmount('');
    setNote('');
    send.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        {send.isSuccess ? (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <span className="bg-success-50 text-success-700 flex size-14 items-center justify-center rounded-full text-[24px] font-bold">✓</span>
            <DialogTitle className="text-ink mt-[6px] text-[18px] font-semibold">Credits sent</DialogTitle>
            <DialogDescription className="text-[14px] leading-[1.5] text-neutral-600">
              {inr(parsed)} is on its way to {found?.name}.
            </DialogDescription>
            <button type="button" onClick={close} className="bg-brand text-on-brand hover:bg-brand-hover mt-3 w-full rounded-md py-[13px] text-[14px] font-semibold">
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <DialogTitle className="text-ink text-[18px] font-semibold">Send credits</DialogTitle>
                <DialogDescription className="text-[13px] leading-[1.5] text-neutral-600">
                  You have {inr(balance)} to send to another Prepzy student.
                </DialogDescription>
              </div>
              <DialogClose aria-label="Close" className="text-neutral-550 hover:bg-brand-50 hover:text-brand flex size-8 shrink-0 items-center justify-center rounded-full">
                <X aria-hidden className="size-5" />
              </DialogClose>
            </div>
            <div className="flex flex-col gap-[6px]">
              <label htmlFor="send-phone" className={LABEL}>
                Their mobile number
              </label>
              {found ? (
                <div className="border-neutral-150 bg-brand-50 flex items-center justify-between gap-2 rounded-[10px] border px-[14px] py-3 lg:rounded-md">
                  <span className="text-ink min-w-0 truncate text-[14px] font-semibold">
                    {found.name} · {phone.trim()}
                  </span>
                  <button type="button" onClick={() => setPhone('')} className="text-brand shrink-0 text-[13px] font-semibold hover:underline">
                    Change
                  </button>
                </div>
              ) : (
                <input
                  id="send-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="10-digit mobile number"
                  className={INPUT}
                />
              )}
              {recipient.state === 'looking' && <span className="text-neutral-550 text-[12px]">Looking them up…</span>}
              {recipient.state === 'error' && (
                <span role="alert" className="text-danger text-[12.5px]">
                  {recipient.message}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-[6px]">
              <label htmlFor="send-amount" className={LABEL}>
                Amount
              </label>
              <input
                id="send-amount"
                type="number"
                inputMode="decimal"
                min="1"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="₹0"
                className={INPUT}
              />
              {amount.trim() !== '' && parsed > balance && <span className="text-danger text-[12.5px]">You only have {inr(balance)} to send</span>}
              {validAmount && <span className="text-[12.5px] text-neutral-600">You will have {inr(balance - parsed)} left</span>}
            </div>
            <div className="flex flex-col gap-[6px]">
              <label htmlFor="send-note" className={LABEL}>
                Note <span className="text-neutral-550 font-normal">(optional)</span>
              </label>
              <textarea
                id="send-note"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, 255))}
                placeholder="Say why you're sending this"
                className={`${INPUT} resize-none`}
              />
            </div>
            <p className="bg-accent-50 text-accent-800 rounded-md px-[14px] py-[10px] text-[12.5px] leading-[1.5] font-medium">
              Credits go student to student only. They can&apos;t be turned into cash.
            </p>
            {send.isError && (
              <p role="alert" className="text-danger text-[12.5px]">
                {userMessage(send.error)}
              </p>
            )}
            <button
              type="button"
              disabled={!canSend}
              onClick={() => found && send.mutate({ recipientAccountId: found.accountId, amount: parsed, note: note.trim() || undefined })}
              className="bg-brand text-on-brand hover:bg-brand-hover w-full rounded-md py-[13px] text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              {send.isPending ? 'Sending…' : 'Send credits'}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
