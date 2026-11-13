'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { Icon, StateIcon } from '../kit';
import { CodeBoxes, CodeMeta, deleteButtonClass, DeleteInfo, DeleteResult } from './delete-parts';
import { useDeleteAccount } from './use-delete-account';

/** The delete flow as a page: used on phones and when /profile/request-account-delete is opened directly. */
export function DeleteAccountPage() {
  const router = useRouter();
  const exam = useExam();
  const flow = useDeleteAccount();
  const [code, setCode] = useState('');

  if (flow.step === 'done' && flow.result) return <DeleteResult info={flow.result} />;

  const onCode = flow.step === 'code';
  const back = () => (onCode ? flow.setStep('info') : router.push(routes.profile(exam.slug)));

  return (
    <div className="flex w-full justify-center leading-normal">
      <div
        className={`flex w-full max-w-[600px] flex-col gap-[16px] px-[20px] pt-[16px] lg:pt-[28px] ${onCode ? 'pb-[108px] lg:pb-[40px]' : 'pb-[32px] lg:pb-[40px]'}`}
      >
        <div className="flex items-center gap-[10px]">
          <button type="button" onClick={back} aria-label="Back" className="flex shrink-0">
            <Icon name="back-mobile.svg" size={22} />
          </button>
          <h1 className="text-account-ink text-[22px] leading-normal font-bold">
            {onCode ? 'Confirm it’s you' : 'Delete account'}
          </h1>
        </div>

        {!onCode && <DeleteInfo flow={flow} onKeep={() => router.push(routes.profile(exam.slug))} />}

        {onCode && (
          <>
            <p className="text-neutral-550 text-[13px] leading-normal">
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
            <div className="bg-surface border-account-line fixed inset-x-0 bottom-0 z-[50] border-t px-[20px] pt-[12px] pb-[24px] lg:static lg:border-0 lg:bg-transparent lg:px-0 lg:pb-0">
              <button
                type="button"
                onClick={() => flow.confirm(code)}
                disabled={code.length < 6 || flow.verifying}
                className={deleteButtonClass}
              >
                {flow.verifying && <StateIcon name="loader-button" size={16} className="animate-spin" />}
                {flow.verifying ? 'Deleting…' : 'Delete my account'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
