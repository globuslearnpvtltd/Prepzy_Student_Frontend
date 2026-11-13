import { cx } from '@prepzy/design-system';
import type { Profile } from '../../api';
import { formatPhone, fullName, Icon, ProfileAvatar } from '../kit';

export interface Chip {
  label: string;
  highlight?: boolean;
}

// Only fields the student can fill from this page are suggested in the hint.
const HINT_FIELDS: { key: keyof Profile; label: string }[] = [
  { key: 'picture', label: 'photo' },
  { key: 'email', label: 'email' },
  { key: 'school', label: 'school' },
  { key: 'dateOfBirth', label: 'date of birth' },
  { key: 'gender', label: 'gender' },
  { key: 'address', label: 'address' },
];

export const percentOf = (profile: Profile) => Math.min(100, Math.max(0, profile.completion));

export function Avatar({ profile, size }: { profile: Profile; size: number }) {
  return (
    <ProfileAvatar picture={profile.picture} firstName={profile.firstName} lastName={profile.lastName} size={size} />
  );
}

export function ChipList({ chips }: { chips: Chip[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-center gap-[8px]">
      {chips.map((chip) => (
        <span
          key={chip.label}
          className={cx(
            'rounded-full px-[10px] py-[4px] text-[11px] font-semibold',
            chip.highlight ? 'bg-account-gold-soft text-account-gold' : 'text-brand bg-brand-75',
          )}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}

/** Desktop: photo, name, exam / class / plan chips, completion and Edit profile. */
export function ProfileCard({ profile, chips, onEdit }: { profile: Profile; chips: Chip[]; onEdit: () => void }) {
  const percent = percentOf(profile);
  const missing = HINT_FIELDS.filter(({ key }) => !profile[key]).map(({ label }) => label);
  const hint =
    missing.length === 0 ? 'Your profile is complete.' : `Add your ${missing.slice(0, 2).join(' and ')} to finish.`;

  return (
    <div className="bg-surface border-account-line flex w-full shrink-0 flex-col items-center gap-[16px] rounded-[16px] border p-[24px] lg:w-[320px]">
      <Avatar profile={profile} size={88} />
      <div className="flex flex-col items-center gap-[2px] text-center">
        <p className="text-account-ink text-[20px] leading-normal font-bold break-words">{fullName(profile)}</p>
        <p className="text-neutral-550 text-[13px] leading-normal">{formatPhone(profile.phone)}</p>
      </div>
      <ChipList chips={chips} />
      <div className="bg-account-soft flex w-full flex-col gap-[8px] rounded-[12px] p-[14px]">
        <div className="flex justify-between text-[12px] font-semibold">
          <span className="text-account-ink">Profile {percent}% complete</span>
          <span className="text-brand">{percent}%</span>
        </div>
        <div className="bg-account-track h-[6px] w-full overflow-hidden rounded-[6px]">
          <div className="bg-brand h-[6px] rounded-[6px]" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-neutral-550 text-[11px] leading-normal">{hint}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="border-account-outline hover:bg-brand-50 flex w-full items-center justify-center gap-[8px] rounded-full border py-[12px] transition-colors"
      >
        <Icon name="edit.svg" size={16} />
        <span className="text-brand text-[14px] font-semibold">Edit profile</span>
      </button>
    </div>
  );
}

/** Phones: purple card with photo, name, number · class and completion. */
export function MobileProfileCard({
  profile,
  classLabel,
  offline,
  onEdit,
}: {
  profile: Profile;
  classLabel: string;
  offline: boolean;
  onEdit: () => void;
}) {
  const percent = percentOf(profile);
  const meta = [formatPhone(profile.phone), classLabel].filter(Boolean).join(' · ');
  return (
    <div className="bg-brand flex w-full flex-col gap-[14px] rounded-[20px] p-[16px]">
      <div className="flex items-center gap-[14px]">
        <Avatar profile={profile} size={56} />
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <p className="text-on-brand truncate text-[17px] leading-normal font-bold">{fullName(profile)}</p>
          {meta && <p className="text-on-brand truncate text-[12px] leading-normal opacity-80">{meta}</p>}
          <span className="h-[4px]" />
          <div className="bg-surface/25 h-[5px] w-[200px] max-w-full overflow-hidden rounded-[5px]">
            <div className="bg-account-progress h-[5px] rounded-[5px]" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-account-progress-text text-[11px] leading-normal font-semibold">
            Profile {percent}% complete
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        disabled={offline}
        className="bg-surface flex w-full items-center justify-center gap-[8px] rounded-full py-[12px] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Icon name="edit.svg" size={16} />
        <span className="text-brand text-[14px] font-semibold">Edit profile</span>
      </button>
    </div>
  );
}
