'use client';

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@prepzy/design-system';
import { Loader2, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useCurrentUser } from '@/features/auth';
import { userMessage } from '@/shared/lib/errors';
import { useDeleteAccount } from '../hooks';

/** "Delete Account?" confirmation (the previous header's DeleteAccountModal). `trigger` opens it. */
export function DeleteAccountDialog({ trigger }: { trigger: (open: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const user = useCurrentUser();
  const remove = useDeleteAccount();
  const accountId = user.data?.accountId;

  return (
    <>
      {trigger(() => setOpen(true))}
      <Dialog open={open} onOpenChange={(next) => !remove.isPending && setOpen(next)}>
        <DialogContent className="max-w-[380px]">
          <div className="flex justify-center">
            <span className="bg-danger-soft rounded-full p-3">
              <Trash2 aria-hidden className="text-danger size-6" />
            </span>
          </div>
          <DialogTitle className="text-center text-[18px] font-bold text-neutral-950">Delete Account?</DialogTitle>
          <DialogDescription className="text-center text-[14px]">
            Are you sure you want to delete your account?
          </DialogDescription>
          <p className="border-brand/20 bg-brand/5 text-brand rounded-md border p-3 text-center text-[13px] font-medium">
            Your account data will be saved and will not be lost.
          </p>
          {remove.isError && (
            <p role="alert" className="text-danger text-center text-sm">
              {userMessage(remove.error)}
            </p>
          )}
          <div className="mt-2 flex gap-3">
            <DialogClose asChild>
              <button
                type="button"
                disabled={remove.isPending}
                className="border-line bg-surface flex-1 rounded-md border p-3 text-[14px] font-semibold text-neutral-950 hover:bg-neutral-50 disabled:opacity-60"
              >
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              disabled={remove.isPending || !accountId}
              onClick={() => accountId && remove.mutate(accountId)}
              className="bg-danger text-on-brand flex flex-1 items-center justify-center gap-2 rounded-md p-3 text-[14px] font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {remove.isPending && <Loader2 aria-hidden className="size-4 animate-spin" />}
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
