'use client';

import { cx } from '@prepzy/design-system';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { Gender, Profile, ProfileUpdate } from '../../api';
import { useUpdateProfile } from '../../hooks';
import { FieldError, formatDay, formatPhone, fullName, Icon, showProfileToast, StateIcon } from '../kit';
import { percentOf } from './profile-card';
import { PhotoPicker } from './photo-picker';

type Section = 'personal' | 'school';

// Same 10 fields the backend counts in calculateProfileCompletion.
const COMPLETION_FIELDS: (keyof Profile)[] = [
  'firstName',
  'email',
  'address',
  'phone',
  'dateOfBirth',
  'city',
  'classId',
  'gender',
  'picture',
  'school',
];

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const labelClass = 'flex gap-[2px] text-[12px] font-semibold text-account-ink';
// dense: desktop personal info inputs are 45px tall instead of 47px.
// The 1.5px focus / error border takes half a pixel off the padding so the height stays the same.
const inputBase =
  'w-full rounded-[12px] bg-surface text-[14px] text-account-ink placeholder:text-account-placeholder outline-none';
export const inputClass = (hasError?: boolean, dense?: boolean) => {
  const pad = dense
    ? 'px-[14px] py-[12px] lg:px-[12px] lg:py-[11px] focus:px-[13.5px] focus:py-[11.5px] lg:focus:px-[11.5px] lg:focus:py-[10.5px]'
    : 'px-[14px] py-[12px] focus:px-[13.5px] focus:py-[11.5px]';
  const errorPad = dense ? 'px-[13.5px] py-[11.5px] lg:px-[11.5px] lg:py-[10.5px]' : 'px-[13.5px] py-[11.5px]';
  return hasError
    ? cx(inputBase, 'border-account-error-line border-[1.5px]', errorPad)
    : cx(inputBase, 'border-account-outline focus:border-brand border focus:border-[1.5px]', pad);
};

function SectionCard({
  title,
  editing,
  canEdit,
  onEdit,
  children,
}: {
  title: string;
  editing: boolean;
  canEdit: boolean;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        'bg-surface w-full rounded-[16px] p-[16px]',
        editing ? 'border-brand flex flex-col gap-[14px] border-[1.5px]' : 'border-account-line border',
      )}
    >
      <div className="flex min-h-[28px] items-center justify-between pb-[4px]">
        <p className="text-neutral-550 text-[11px] leading-normal font-semibold">{title}</p>
        {!editing && canEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${title.toLowerCase()}`}
            className="flex items-center gap-[4px] py-[4px] pl-[6px]"
          >
            <Icon name="pen.svg" size={14} />
            <span className="text-brand text-[13px] font-semibold">Edit</span>
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function ReadRow({
  label,
  value,
  onAdd,
  canEdit,
  inline,
}: {
  label: string;
  value?: string;
  onAdd: () => void;
  canEdit: boolean;
  inline?: boolean;
}) {
  return (
    <div className={cx('flex min-w-0 flex-1 flex-col gap-[2px]', !inline && 'border-account-line border-t py-[12px]')}>
      <p className="text-neutral-550 text-[12px] leading-normal">{label}</p>
      {value ? (
        <p className="text-account-ink text-[14px] leading-normal font-medium break-words">{value}</p>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          disabled={!canEdit}
          aria-label={`Add ${label.toLowerCase()}`}
          className="text-brand w-fit text-[14px] font-semibold disabled:cursor-default"
        >
          Add
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
        {required && <span className="text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

function FormActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <div className="flex gap-[10px] pt-[4px]">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="border-account-outline bg-surface text-account-ink hover:bg-account-soft flex-1 rounded-full border py-[13px] text-[14px] font-semibold transition-colors disabled:opacity-60"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className="bg-brand hover:bg-account-hover text-on-brand flex flex-1 items-center justify-center gap-[8px] rounded-full py-[13px] text-[14px] font-semibold transition-colors disabled:opacity-80"
      >
        {saving && <StateIcon name="loader-button" size={16} className="animate-spin" />}
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

/** PUT /account only overwrites the fields it gets a value for. */
function useSaveAccount(desktopMessage: string) {
  const update = useUpdateProfile();
  const save = async (payload: ProfileUpdate) => {
    try {
      await update.mutateAsync(payload);
      showProfileToast('Profile updated', { desktopMessage });
      return true;
    } catch {
      showProfileToast('Couldn’t save your changes. Please try again.', { kind: 'error' });
      return false;
    }
  };
  return { save, saving: update.isPending };
}

function ProfileHeader({ profile }: { profile: Profile }) {
  const percent = percentOf(profile);
  const missing = COMPLETION_FIELDS.filter((key) => !profile[key]).length;
  return (
    <div className="bg-surface border-account-line flex w-full flex-col items-center gap-[4px] rounded-[16px] border px-[20px] pt-[24px] pb-[20px]">
      <PhotoPicker profile={profile} />
      <p className="text-account-ink mt-[12px] text-center text-[20px] leading-normal font-semibold break-words">
        {fullName(profile)}
      </p>
      <p className="text-neutral-550 text-[13px] leading-normal">{formatPhone(profile.phone)}</p>
      <div className="flex w-full flex-col gap-[8px] pt-[16px]">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-account-ink font-medium">Profile complete</span>
          <span className="text-brand font-semibold">{percent}%</span>
        </div>
        <div className="bg-brand-75 h-[6px] w-full overflow-hidden rounded-[3px]">
          <div className="bg-brand h-[6px] rounded-[3px]" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-neutral-550 text-[11px] leading-normal">
          {missing === 0
            ? 'Your profile is complete.'
            : `Add ${missing} more detail${missing > 1 ? 's' : ''} to finish your profile.`}
        </p>
      </div>
    </div>
  );
}

interface PersonalForm {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  gender: Gender | '';
}

interface CardProps {
  profile: Profile;
  editing: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onClose: () => void;
}

function PersonalInfoCard({ profile, editing, canEdit, onEdit, onClose }: CardProps) {
  const { save, saving } = useSaveAccount('Personal info saved');
  const genderLabel = GENDERS.find((g) => g.value === profile.gender)?.label;
  const initialForm = (): PersonalForm => ({
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    dateOfBirth: profile.dateOfBirth,
    gender: profile.gender,
  });
  const [form, setForm] = useState<PersonalForm>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof PersonalForm, string>>>({});

  const startEditing = () => {
    setForm(initialForm());
    setErrors({});
    onEdit();
  };

  const setField = <K extends keyof PersonalForm>(name: K, value: PersonalForm[K]) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: Partial<Record<keyof PersonalForm, string>> = {};
    if (!form.firstName.trim()) next.firstName = 'Enter your first name.';
    if (!form.lastName.trim()) next.lastName = 'Enter your last name.';
    if (form.email.trim() && !EMAIL_REGEX.test(form.email.trim()))
      next.email = 'Enter a full email, like name@gmail.com.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const saved = await save({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      dateOfBirth: form.dateOfBirth,
      gender: form.gender,
    });
    if (saved) onClose();
  };

  if (!editing) {
    return (
      <SectionCard title="PERSONAL INFO" editing={false} canEdit={canEdit} onEdit={startEditing}>
        <div className="border-account-line flex gap-[16px] border-t py-[12px]">
          <ReadRow label="First name" value={profile.firstName} onAdd={startEditing} canEdit={canEdit} inline />
          <ReadRow label="Last name" value={profile.lastName} onAdd={startEditing} canEdit={canEdit} inline />
        </div>
        <div className="border-account-line flex flex-col gap-[2px] border-t py-[12px]">
          <p className="text-neutral-550 text-[12px] leading-normal">Phone number</p>
          <div className="flex items-center justify-between gap-[8px]">
            <p className="text-account-ink text-[14px] leading-normal font-medium">{formatPhone(profile.phone)}</p>
            <Icon name="lock.svg" size={16} alt="Locked" />
          </div>
          <p className="text-neutral-550 pt-[2px] text-[11px] leading-normal">This is your login</p>
        </div>
        <ReadRow label="Email" value={profile.email} onAdd={startEditing} canEdit={canEdit} />
        <ReadRow
          label="Date of birth"
          value={formatDay(profile.dateOfBirth ? `${profile.dateOfBirth}T00:00:00` : null)}
          onAdd={startEditing}
          canEdit={canEdit}
        />
        <ReadRow label="Gender" value={genderLabel} onAdd={startEditing} canEdit={canEdit} />
      </SectionCard>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <SectionCard title="PERSONAL INFO" editing canEdit={false} onEdit={startEditing}>
        <div className="flex gap-[12px]">
          <Field label="First name" htmlFor="first_name" required>
            <input
              id="first_name"
              value={form.firstName}
              onChange={(e) => setField('firstName', e.target.value)}
              placeholder="First name"
              aria-invalid={!!errors.firstName}
              className={inputClass(!!errors.firstName, true)}
            />
            <FieldError message={errors.firstName} />
          </Field>
          <Field label="Last name" htmlFor="last_name" required>
            <input
              id="last_name"
              value={form.lastName}
              onChange={(e) => setField('lastName', e.target.value)}
              placeholder="Last name"
              aria-invalid={!!errors.lastName}
              className={inputClass(!!errors.lastName, true)}
            />
            <FieldError message={errors.lastName} />
          </Field>
        </div>

        <Field label="Phone number">
          <div className="border-account-outline bg-account-soft flex items-center gap-[8px] rounded-[12px] border px-[14px] py-[12px] lg:px-[12px] lg:py-[11px]">
            <span className="text-account-ink flex-1 text-[14px]">{formatPhone(profile.phone)}</span>
            <Icon name="lock.svg" size={16} alt="Locked" />
          </div>
          <p className="text-neutral-550 text-[11px] leading-normal">
            This is your login. Contact support to change it.
          </p>
        </Field>

        <Field label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            placeholder="Add your email"
            aria-invalid={!!errors.email}
            className={inputClass(!!errors.email, true)}
          />
          <FieldError message={errors.email} />
        </Field>

        <Field label="Date of birth" htmlFor="date_of_birth">
          <input
            id="date_of_birth"
            type="date"
            value={form.dateOfBirth}
            max={today()}
            onChange={(e) => setField('dateOfBirth', e.target.value)}
            className={cx(inputClass(false, true), !form.dateOfBirth && 'text-account-placeholder')}
          />
        </Field>

        <Field label="Gender">
          <div className="flex flex-wrap gap-[8px]">
            {GENDERS.map((g) => {
              const selected = form.gender === g.value;
              return (
                <button
                  key={g.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setField('gender', g.value)}
                  className={cx(
                    'rounded-full border px-[16px] py-[8px] text-[12px] font-medium transition-colors',
                    selected
                      ? 'border-brand text-brand bg-brand-75'
                      : 'border-account-outline text-account-body hover:bg-account-soft',
                  )}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </Field>

        <FormActions saving={saving} onCancel={onClose} />
      </SectionCard>
    </form>
  );
}

type SchoolForm = Pick<Profile, 'school' | 'city' | 'address'>;

// The design's State field has no account column, so it is left out (as in the previous app).
const SCHOOL_FIELDS: { key: keyof SchoolForm; label: string; placeholder: string }[] = [
  { key: 'school', label: 'School', placeholder: 'Add your school' },
  { key: 'city', label: 'City', placeholder: 'Add your city' },
  { key: 'address', label: 'Address', placeholder: 'House number, street, area' },
];

function SchoolAddressCard({ profile, editing, canEdit, onEdit, onClose }: CardProps) {
  const { save, saving } = useSaveAccount('School and address saved');
  const initialForm = (): SchoolForm => ({ school: profile.school, city: profile.city, address: profile.address });
  const [form, setForm] = useState<SchoolForm>(initialForm);

  const startEditing = () => {
    setForm(initialForm());
    onEdit();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const saved = await save({ school: form.school.trim(), city: form.city.trim(), address: form.address.trim() });
    if (saved) onClose();
  };

  if (!editing) {
    return (
      <SectionCard title="SCHOOL AND ADDRESS" editing={false} canEdit={canEdit} onEdit={startEditing}>
        {SCHOOL_FIELDS.map((f) => (
          <ReadRow key={f.key} label={f.label} value={profile[f.key]} onAdd={startEditing} canEdit={canEdit} />
        ))}
      </SectionCard>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <SectionCard title="SCHOOL AND ADDRESS" editing canEdit={false} onEdit={startEditing}>
        {SCHOOL_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} htmlFor={f.key}>
            <input
              id={f.key}
              value={form[f.key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className={inputClass()}
            />
          </Field>
        ))}
        <FormActions saving={saving} onCancel={onClose} />
      </SectionCard>
    </form>
  );
}

/** Edit profile (?edit=1): photo and completion, then personal info and school, one section editable at a time. */
export function EditColumn({ profile }: { profile: Profile }) {
  const [editing, setEditing] = useState<Section | null>(null);
  const close = () => setEditing(null);
  return (
    <div className="flex w-full shrink-0 flex-col gap-[16px] lg:w-[320px]">
      <ProfileHeader profile={profile} />
      <PersonalInfoCard
        profile={profile}
        editing={editing === 'personal'}
        canEdit={editing === null}
        onEdit={() => setEditing('personal')}
        onClose={close}
      />
      <SchoolAddressCard
        profile={profile}
        editing={editing === 'school'}
        canEdit={editing === null}
        onEdit={() => setEditing('school')}
        onClose={close}
      />
    </div>
  );
}
