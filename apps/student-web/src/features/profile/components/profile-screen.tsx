'use client';

import { Button } from '@prepzy/design-system';
import Link from 'next/link';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { PageSpinner, StatusScreen } from '@/shared/layout/status-screens';
import { userMessage } from '@/shared/lib/errors';
import { formatUpdated } from '../api';
import { useProfile } from '../hooks';
import { AvatarProgress } from './avatar-progress';
import { ParentLink } from './parent-link';
import { PersonalInfoForm } from './personal-info-form';
import { UploadPhoto } from './upload-photo';

/** "Edit Profile": photo + completion, personal details, linked parent. */
export function ProfileScreen() {
  const exam = useExam();
  const profile = useProfile();

  if (profile.isPending) return <PageSpinner label="Loading your profile" />;
  if (profile.isError)
    return (
      <StatusScreen
        title="We couldn't load your profile"
        description={userMessage(profile.error)}
        action={<Button onClick={() => profile.refetch()}>Try again</Button>}
      />
    );

  const data = profile.data;
  const updated = formatUpdated(data.updatedAt);
  return (
    <div className="flex flex-col md:px-10">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-[20px] font-bold text-neutral-900">Edit Profile</h1>
        <Link href={routes.changePassword(exam.slug)} className="text-info-600 text-sm font-semibold hover:underline">
          Change Password
        </Link>
      </div>
      <div className="bg-surface relative rounded-xl">
        <div className="flex flex-col gap-4 p-[14px] md:flex-row md:items-center md:p-10">
          <AvatarProgress picture={data.picture} percent={data.completion || 20} />
          <UploadPhoto />
          {updated && (
            <span className="absolute top-0 right-0 flex flex-col p-4 text-[14px] font-bold text-neutral-400 md:flex-row">
              Last Updated: <span className="ml-2 text-neutral-850">{updated}</span>
            </span>
          )}
        </div>
        <div className="bg-info-50 h-[10px] md:h-3" />
        <PersonalInfoForm key={data.updatedAt ?? 'profile'} profile={data} />
        <div className="bg-info-50 h-[10px] md:h-3" />
        <ParentLink />
      </div>
    </div>
  );
}
