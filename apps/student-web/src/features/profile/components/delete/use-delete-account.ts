'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { forgetExam, useCurrentUser } from '@/features/auth';
import { isApiError, userMessage } from '@/shared/lib/errors';
import { profileApi, type DeleteRequestResult } from '../../api';
import { useDeleteInfo } from '../../hooks';
import { formatPhone, showProfileToast } from '../kit';

// Deleting is only a request: support deletes the account after the grace period. The code goes to the
// account's own login number; confirming saves the request and ends the session.

export const RESEND_SECONDS = 30;
export const SUPPORT_EMAIL = 'contact@prepzy.ai';
const DEFAULT_GRACE_DAYS = 30;

export const REASONS = [
  'I don’t use Prepzy any more',
  'It’s too expensive',
  'I found another app',
  'Something isn’t working for me',
  'I’m worried about my data',
  'Something else',
];

export type DeleteStep = 'info' | 'code' | 'done';

export interface DeleteResultInfo extends DeleteRequestResult {
  phone: string;
}

export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

/** A bad code is a 400 with one of these codes. */
const CODE_ERRORS: Record<string, string> = {
  INVALID_OTP: 'That code doesn’t match. Check it and try again.',
  OTP_EXPIRED: 'That code has expired. Tap Resend code to get a new one.',
  OTP_MISSING: 'That code is no longer valid. Tap Resend code to get a new one.',
};

export function useDeleteAccount(onDone?: (info: DeleteResultInfo) => void) {
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const info = useDeleteInfo();
  const displayPhone = formatPhone(user.data?.phone);
  const graceDays = info.data?.graceDays ?? DEFAULT_GRACE_DAYS;

  const [step, setStep] = useState<DeleteStep>('info');
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [codeKey, setCodeKey] = useState(0); // bumps when a new code is sent, clearing the boxes
  const [result, setResult] = useState<DeleteResultInfo | null>(null);

  const deleteOn = addDays(new Date(), graceDays);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendCode = useCallback(async () => {
    setSending(true);
    try {
      await profileApi.sendDeleteOtp();
      setCodeError('');
      setResendIn(RESEND_SECONDS);
      setCodeKey((k) => k + 1);
      return true;
    } catch (error) {
      showProfileToast(
        isApiError(error) && error.isRateLimited ? userMessage(error) : 'Could not send the code. Please try again.',
        { kind: 'error' },
      );
      return false;
    } finally {
      setSending(false);
    }
  }, []);

  const continueToCode = async () => {
    if (await sendCode()) setStep('code');
  };

  const confirm = async (code: string) => {
    setVerifying(true);
    try {
      const saved = await profileApi.confirmDelete(code, reason, graceDays);
      const done = { ...saved, phone: displayPhone };
      // The backend has ended the session. Keep the cached pages as they are (no refetch that would 401 and
      // jump to login) so the result stays on screen; "Go to log in" does a full page load.
      forgetExam();
      await queryClient.cancelQueries();
      queryClient.setDefaultOptions({
        queries: {
          ...queryClient.getDefaultOptions().queries,
          enabled: false,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
        },
      });
      setResult(done);
      setStep('done');
      onDone?.(done);
    } catch (error) {
      if (isApiError(error) && CODE_ERRORS[error.code]) {
        setCodeError(CODE_ERRORS[error.code]!);
        return;
      }
      showProfileToast(
        isApiError(error) && error.status > 0 && error.status < 500
          ? userMessage(error)
          : 'Something went wrong. Your account is not deleted. Please try again.',
        { kind: 'error' },
      );
    } finally {
      setVerifying(false);
    }
  };

  return {
    step,
    setStep,
    reason,
    setReason,
    paidPlans: info.data?.activePaidPlans ?? 0,
    graceDays,
    displayPhone,
    deleteOn,
    sending,
    verifying,
    codeError,
    clearCodeError: () => setCodeError(''),
    resendIn,
    codeKey,
    result,
    continueToCode,
    resend: sendCode,
    confirm,
  };
}

export type DeleteAccountState = ReturnType<typeof useDeleteAccount>;
