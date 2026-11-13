'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { isApiError, userMessage } from '@/shared/lib/errors';
import { profileApi, type Parent } from '../../api';
import { useParent, useSetParent } from '../../hooks';
import { PageHeading, showProfileToast } from '../kit';
import { draftFromParent, EMPTY_DRAFT, parentName, toDetails, type ParentDraft } from './parent-model';
import { ParentForm, ParentLinked, ParentOtpStep, RemoveParentSheet } from './parent-parts';

type Step = 'loading' | 'form' | 'otp' | 'linked';
type Mode = 'add' | 'edit';

const WHAT_THEY_SEE = ['Study time and streaks', 'Test scores and reports', 'Plan and its end date'];

// The backend limits checks per contact; the page also locks Verify after this many wrong codes until a new one is sent.
const MAX_WRONG_TRIES = 5;

const otpErrorText = (code?: string) => {
  if (code === 'OTP_EXPIRED') return 'That code has expired. Tap Resend code to get a new one.';
  return "That code doesn't match. Check it and try again.";
};

const apiMessage = (error: unknown, fallback: string) =>
  isApiError(error) && error.status > 0 && error.status < 500 ? userMessage(error) : fallback;

/** Parent: add (with a code to their WhatsApp or email), edit, remove with undo. */
export function ParentScreen() {
  const exam = useExam();
  const router = useRouter();
  const query = useParent();
  const setCached = useSetParent();
  const profileHref = routes.profile(exam.slug);

  const [step, setStep] = useState<Step>('loading');
  const [mode, setMode] = useState<Mode>('add');
  const [parent, setParentState] = useState<Parent | null>(null);
  const [justLinked, setJustLinked] = useState(false);
  const [draft, setDraft] = useState<ParentDraft>(EMPTY_DRAFT);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [wrongTries, setWrongTries] = useState(0);
  const [resendKey, setResendKey] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const locked = wrongTries >= MAX_WRONG_TRIES;

  const setParent = (next: Parent | null) => {
    setParentState(next);
    setCached(next);
  };

  // First load decides the step; later refetches don't pull the student out of a form.
  useEffect(() => {
    if (step !== 'loading' || query.isPending) return;
    const loaded = query.data ?? null;
    setParentState(loaded);
    setStep(loaded ? 'linked' : 'form');
  }, [step, query.isPending, query.data]);

  const sendOtp = async () => {
    try {
      await profileApi.sendParentOtp(toDetails(draft));
      setOtpError('');
      setWrongTries(0);
      setResendKey((k) => k + 1);
      return true;
    } catch (error) {
      showProfileToast(apiMessage(error, 'Could not send the code. Please try again.'), { kind: 'error' });
      return false;
    }
  };

  const contactChanged = () => {
    if (!parent) return true;
    const saved = draftFromParent(parent);
    return saved.contactMethod !== draft.contactMethod || saved.contactValue.trim() !== draft.contactValue.trim();
  };

  const handleSubmit = async () => {
    setSending(true);
    try {
      // A new number or email has to be verified first; a name change saves straight away.
      if (mode === 'add' || contactChanged()) {
        if (await sendOtp()) setStep('otp');
        return;
      }
      await profileApi.renameParent(draft.firstName.trim(), draft.lastName.trim());
      setParent({ ...parent!, firstName: draft.firstName.trim(), lastName: draft.lastName.trim() });
      setStep('linked');
      showProfileToast('Changes saved');
    } catch (error) {
      showProfileToast(apiMessage(error, 'Could not save the changes. Please try again.'), { kind: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (code: string) => {
    if (locked) return;
    setVerifying(true);
    const details = toDetails(draft);
    try {
      const mentorId = await profileApi.verifyParentOtp(details, code);
      // An existing parent account keeps its old name when linked, so an edit renames it after.
      if (mode === 'edit') await profileApi.renameParent(details.firstName, details.lastName).catch(() => undefined);
      setParent({ id: mentorId, ...details });
      setJustLinked(true);
      setDraft(EMPTY_DRAFT);
      setStep('linked');
      if (mode === 'edit') showProfileToast('Changes saved');
    } catch (error) {
      if (isApiError(error) && (error.code === 'INVALID_OTP' || error.code === 'OTP_EXPIRED')) {
        const tries = wrongTries + 1;
        setWrongTries(tries);
        setOtpError(tries >= MAX_WRONG_TRIES ? 'Too many wrong tries. Ask for a new code.' : otpErrorText(error.code));
        return;
      }
      if (isApiError(error) && error.isRateLimited) {
        setWrongTries(MAX_WRONG_TRIES);
        setOtpError('Too many wrong tries. Ask for a new code.');
        return;
      }
      showProfileToast('Something went wrong. Please try again.', { kind: 'error' });
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    if (await sendOtp())
      showProfileToast(draft.contactMethod === 'whatsapp' ? 'New code sent on WhatsApp' : 'New code sent to email');
    setResending(false);
  };

  const startAdd = () => {
    setMode('add');
    setDraft(EMPTY_DRAFT);
    setStep('form');
  };

  const startEdit = () => {
    if (!parent) return;
    setMode('edit');
    setDraft(draftFromParent(parent));
    setStep('form');
  };

  const handleCancel = () => {
    setDraft(EMPTY_DRAFT);
    if (parent) setStep('linked');
    else router.push(profileHref);
  };

  const backToForm = () => {
    setOtpError('');
    setStep('form');
  };

  // Undo puts the same parent back with the token from the remove call (valid for 10 minutes).
  const restoreParent = async (undoToken: string, name: string) => {
    try {
      const restored = await profileApi.restoreParent(undoToken);
      setParent(restored);
      setJustLinked(false);
      setDraft(EMPTY_DRAFT);
      setStep('linked');
      showProfileToast(`${name} added back`);
    } catch (error) {
      showProfileToast(apiMessage(error, 'Could not undo. Please add them again.'), { kind: 'error' });
    }
  };

  const handleRemove = async () => {
    if (!parent) return;
    const name = parentName(parent);
    setRemoving(true);
    try {
      const undoToken = await profileApi.removeParent();
      setConfirmRemove(false);
      setParent(null);
      setJustLinked(false);
      startAdd();
      showProfileToast(
        `${name} removed`,
        undoToken ? { actionLabel: 'Undo', onAction: () => restoreParent(undoToken, name) } : {},
      );
    } catch (error) {
      showProfileToast(apiMessage(error, 'Could not remove. Please try again.'), { kind: 'error' });
    } finally {
      setRemoving(false);
    }
  };

  const editName = parent ? parentName(parent) : '';
  const mobileTitle = step === 'otp' ? 'Verify' : step === 'form' && mode === 'edit' ? `Edit ${editName}` : 'Parent';
  const mobileBack = () => {
    if (step === 'otp') backToForm();
    else if (step === 'form') handleCancel();
    else router.push(profileHref);
  };
  let mobileIntro = '';
  if (step === 'form') {
    mobileIntro =
      mode === 'edit'
        ? draft.contactMethod === 'whatsapp'
          ? 'Change their name or WhatsApp number. A new number needs a fresh code.'
          : 'Change their name or email. A new email needs a fresh code.'
        : 'Add a parent. They get a view-only account to follow your progress.';
  }

  return (
    <div className="flex w-full flex-col gap-[16px] px-[20px] pt-[16px] pb-[120px] leading-normal md:px-[40px] lg:gap-[20px] lg:px-[90px] lg:pt-[20px] lg:pb-[32px]">
      <PageHeading
        backHref={profileHref}
        backLabel="Back to My Account"
        title="Parent"
        mobileTitle={mobileTitle}
        intro="Let a parent or teacher follow your progress."
        onMobileBack={mobileBack}
        mobileIntro={mobileIntro || undefined}
      />

      <div className="flex w-full flex-col items-start gap-[20px] lg:flex-row">
        <div className="lg:bg-surface lg:border-account-line w-full min-w-0 flex-1 lg:rounded-[16px] lg:border lg:p-[20px]">
          {step === 'loading' && (
            <div className="flex justify-center py-[40px]">
              <Loader2 aria-label="Loading" className="text-brand animate-spin" size={24} />
            </div>
          )}
          {step === 'form' && (
            <ParentForm
              mode={mode}
              draft={draft}
              original={mode === 'edit' && parent ? draftFromParent(parent) : undefined}
              onChange={setDraft}
              onCancel={handleCancel}
              onSubmit={handleSubmit}
              sending={sending}
            />
          )}
          {step === 'otp' && (
            <ParentOtpStep
              draft={draft}
              error={otpError}
              locked={locked}
              verifying={verifying}
              resending={resending}
              resendKey={resendKey}
              onEditDetails={backToForm}
              onVerify={handleVerify}
              onResend={handleResend}
              onCodeChange={() => setOtpError('')}
            />
          )}
          {step === 'linked' && parent && (
            <ParentLinked
              parent={parent}
              justLinked={justLinked}
              onEdit={startEdit}
              onRemove={() => setConfirmRemove(true)}
            />
          )}
        </div>

        <div className="bg-surface border-account-line hidden w-[340px] shrink-0 flex-col gap-[14px] rounded-[16px] border p-[20px] lg:flex">
          <p className="text-neutral-550 text-[11px] leading-normal font-semibold">WHAT THEY SEE</p>
          {WHAT_THEY_SEE.map((item) => (
            <p key={item} className="text-account-body text-[13px] leading-normal">
              ✓&nbsp;&nbsp;{item}
            </p>
          ))}
          <div className="bg-account-soft rounded-[12px] px-[14px] py-[12px]">
            <p className="text-neutral-550 text-[12px] leading-normal">
              View only. They can&apos;t change your course, medium or plan.
            </p>
          </div>
        </div>
      </div>

      {confirmRemove && parent && (
        <RemoveParentSheet
          name={parentName(parent)}
          removing={removing}
          onConfirm={handleRemove}
          onClose={() => setConfirmRemove(false)}
        />
      )}
    </div>
  );
}
