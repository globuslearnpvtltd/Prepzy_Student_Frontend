import type { ContactMethod, Parent, ParentDetails } from '../../api';

export interface ParentDraft {
  firstName: string;
  lastName: string;
  contactMethod: ContactMethod;
  /** WhatsApp: the 10 local digits (+91 is fixed). Email: the address. */
  contactValue: string;
}

export const EMPTY_DRAFT: ParentDraft = { firstName: '', lastName: '', contactMethod: 'whatsapp', contactValue: '' };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What the backend expects: +91XXXXXXXXXX for WhatsApp, the trimmed address for email. */
export const toDetails = (draft: ParentDraft): ParentDetails => ({
  firstName: draft.firstName.trim(),
  lastName: draft.lastName.trim(),
  contactMethod: draft.contactMethod,
  contactValue: draft.contactMethod === 'whatsapp' ? `+91${draft.contactValue}` : draft.contactValue.trim(),
});

export const formatContact = (method: ContactMethod, value: string) => {
  if (method === 'email') return value;
  const digits = value.replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : value;
};

export const draftFromParent = (parent: Parent): ParentDraft => ({
  firstName: parent.firstName,
  lastName: parent.lastName,
  contactMethod: parent.contactMethod,
  contactValue:
    parent.contactMethod === 'whatsapp' ? parent.contactValue.replace(/\D/g, '').slice(-10) : parent.contactValue,
});

export const parentName = (p: { firstName?: string; lastName?: string }) =>
  `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();

export const isContactValid = (draft: ParentDraft) =>
  draft.contactMethod === 'whatsapp'
    ? /^[6-9]\d{9}$/.test(draft.contactValue)
    : EMAIL_REGEX.test(draft.contactValue.trim());

/** Never an error for an empty value; the form only shows it after the field is left. */
export const contactError = (draft: ParentDraft) => {
  const value = draft.contactValue.trim();
  if (!value || isContactValid(draft)) return '';
  if (draft.contactMethod === 'email') return 'Enter a full email, like name@gmail.com.';
  if (value.length !== 10) return `Enter a 10-digit mobile number. This one has ${value.length}.`;
  return 'Enter a valid mobile number. It starts with 6, 7, 8 or 9.';
};

export const sameDraft = (a: ParentDraft, b: ParentDraft) =>
  a.firstName.trim() === b.firstName.trim() &&
  a.lastName.trim() === b.lastName.trim() &&
  a.contactMethod === b.contactMethod &&
  a.contactValue.trim() === b.contactValue.trim();

export const parentInputClass =
  'w-full px-[14px] py-[13px] lg:py-[11px] rounded-[12px] border border-account-outline bg-surface text-[14px] lg:text-[13px] text-account-ink placeholder:text-account-placeholder outline-none focus:border-brand';
