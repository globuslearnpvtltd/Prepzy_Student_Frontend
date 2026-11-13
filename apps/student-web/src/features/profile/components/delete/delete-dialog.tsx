'use client';

import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Sheet, StateIcon } from '../kit';
import { CodeBoxes, CodeMeta, deleteButtonClass, DeleteInfo, DeleteResult, outlineButtonClass } from './delete-parts';
import { useDeleteAccount, type DeleteResultInfo } from './use-delete-account';

/** Desktop delete flow: info, then the code. Once saved the session ends and `onDone` gets the result. */
export function DeleteAccountModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (info: DeleteResultInfo) => void;
}) {
  const flow = useDeleteAccount(onDone);
  const [code, setCode] = useState('');
  const busy = flow.sending || flow.verifying;
  const close = () => !busy && onClose();

  if (flow.step === 'code') {
    return (
      <Sheet width={480} onClose={close} label="Confirm it’s you">
        <h2 className="text-account-ink text-[20px] leading-normal font-bold">Confirm it’s you</h2>
        <p className="text-neutral-550 text-[14px] leading-normal">
          Enter the 6-digit code we sent to <span className="whitespace-nowrap">{flow.displayPhone}</span>.
        </p>
        <CodeBoxes
          resetKey={flow.codeKey}
          hasError={!!flow.codeError}
          onChange={(value) => {
            setCode(value);
            if (flow.codeError) flow.clearCodeError();
          }}
        />
        <CodeMeta flow={flow} />
        <div className="flex gap-[12px] pt-[8px]">
          <button
            type="button"
            onClick={() => flow.setStep('info')}
            disabled={busy}
            className={`${outlineButtonClass} flex-1`}
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => flow.confirm(code)}
            disabled={code.length < 6 || busy}
            className={`${deleteButtonClass} flex-1`}
          >
            {flow.verifying && <StateIcon name="loader-button" size={16} className="animate-spin" />}
            {flow.verifying ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet width={600} compact onClose={close} label="Delete your account?">
      <DeleteInfo flow={flow} onKeep={onClose} />
    </Sheet>
  );
}

/**
 * The delete flow for places outside My Account (the header's account menu): `trigger` opens it, and the result
 * covers the page once the request is saved.
 */
export function DeleteAccountDialog({ trigger }: { trigger: (open: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<DeleteResultInfo | null>(null);
  return (
    <>
      {trigger(() => setOpen(true))}
      {open && (
        <DeleteAccountModal
          onClose={() => setOpen(false)}
          onDone={(info) => {
            setOpen(false);
            setResult(info);
          }}
        />
      )}
      {result &&
        createPortal(
          <div className="bg-canvas fixed inset-0 z-[1300] overflow-y-auto">
            <DeleteResult info={result} />
          </div>,
          document.body,
        )}
    </>
  );
}
