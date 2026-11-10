import { learnApiBase, type ExamRef } from '@/shared/config/exams';
import { apiClient } from '@/shared/lib/api-client';
import { assertOk, unwrapData } from '@/shared/lib/unwrap';

type Envelope<T> = { success?: boolean; message?: string; error?: string; data?: T };

export type Gender = 'male' | 'female' | 'other';

/** Everything the profile page shows and edits (richer than the session's Student). */
export interface Profile {
  accountId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  city: string;
  school: string;
  gender: Gender | '';
  classId: string;
  picture: string | null;
  completion: number;
  updatedAt: string | null;
}

export interface ProfileUpdate {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  address: string;
  city: string;
  gender: Gender | '';
  classId: string;
  school: string;
}

export type ContactMethod = 'whatsapp' | 'email';

export interface Parent {
  id: number;
  firstName: string;
  lastName: string;
  contactMethod: ContactMethod;
  contactValue: string;
}

export interface ParentDetails {
  firstName: string;
  lastName: string;
  contactMethod: ContactMethod;
  /** +<digits> for WhatsApp, the address for email. */
  contactValue: string;
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() && value !== 'null' ? value.trim() : '');
const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Dates arrive as ISO timestamps or plain dates; the form keeps yyyy-mm-dd. */
export function toDateInput(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toProfile(raw: unknown): Profile {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const gender = row.gender === 'male' || row.gender === 'female' || row.gender === 'other' ? row.gender : '';
  return {
    accountId: num(row.account_id),
    firstName: text(row.first_name),
    lastName: text(row.last_name),
    email: text(row.email),
    phone: text(row.phone),
    dateOfBirth: toDateInput(row.date_of_birth),
    address: text(row.address),
    city: text(row.city),
    school: text(row.school),
    gender,
    classId: row.class === null || row.class === undefined || row.class === '' ? '' : String(row.class),
    picture: text(row.profile_picture) || null,
    completion: Math.round(num(row.completion_percentage)),
    updatedAt: text(row.updated_at) || null,
  };
}

/** "12 October 2024", as the previous page showed it. */
export function formatUpdated(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function toParent(raw: unknown): Parent | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const contactValue = text(row.contactValue);
  if (!row.account_id || !contactValue) return null;
  return {
    id: num(row.account_id),
    firstName: text(row.firstName),
    lastName: text(row.lastName),
    contactMethod: row.contactMethod === 'email' ? 'email' : 'whatsapp',
    contactValue,
  };
}

export const profileApi = {
  async get(): Promise<Profile> {
    return toProfile(unwrapData(await apiClient.get<Envelope<unknown>>('/api/v4/student/account')));
  },

  async update(values: ProfileUpdate): Promise<void> {
    assertOk(
      await apiClient.put<Envelope<unknown>>('/api/v4/student/account', {
        first_name: values.firstName,
        last_name: values.lastName,
        email: values.email,
        date_of_birth: values.dateOfBirth,
        address: values.address,
        city: values.city,
        gender: values.gender,
        student_class: values.classId,
        school: values.school,
      }),
    );
  },

  async uploadPhoto(file: File): Promise<void> {
    const form = new FormData();
    form.append('image', file);
    assertOk(await apiClient.put<Envelope<unknown>>('/api/accounts/profile_image', form, { timeout: 60_000 }));
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    assertOk(
      await apiClient.put<Envelope<never>>('/api/changePassword', { old_password: oldPassword, new_password: newPassword }),
    );
  },

  async deleteAccount(accountId: number): Promise<void> {
    assertOk(await apiClient.delete<Envelope<never>>(`/api/accounts/${accountId}`));
  },

  /** Classes of the student's exam (the class select). */
  async classes(exam: ExamRef): Promise<{ id: string; title: string }[]> {
    const body = await apiClient.get<Envelope<{ classes: { class_id: number; title: string }[] }>>(`${learnApiBase(exam)}/classes`);
    return unwrapData(body).classes.map((c) => ({ id: String(c.class_id), title: c.title }));
  },

  async parent(): Promise<Parent | null> {
    const body = await apiClient.get<Envelope<{ mentor_data?: unknown }>>('/api/mentor/v1/auth/get-mentor-data');
    return toParent(assertOk(body).data?.mentor_data);
  },

  async sendParentOtp(details: ParentDetails): Promise<void> {
    assertOk(
      await apiClient.post<Envelope<never>>('/api/mentor/v1/auth/generate-signup-otp', {
        first_name: details.firstName,
        last_name: details.lastName,
        contact_method: details.contactMethod,
        contact_value: details.contactValue,
      }),
    );
  },

  /** Creates (or links) the parent account; the backend answers 200 + success:false on a wrong code. */
  async verifyParentOtp(details: ParentDetails, otp: string): Promise<number> {
    const body = await apiClient.post<Envelope<{ mentor_id?: number }>>('/api/mentor/v1/auth/verify-signup-otp', {
      first_name: details.firstName,
      last_name: details.lastName,
      contact_method: details.contactMethod,
      contact_value: details.contactValue,
      otp,
    });
    return num(assertOk(body).data?.mentor_id);
  },

  async renameParent(id: number, details: ParentDetails): Promise<void> {
    assertOk(
      await apiClient.put<Envelope<never>>('/api/mentor/v1/auth/edit-mentor-datas', {
        mentor_id: id,
        first_name: details.firstName,
        last_name: details.lastName,
        contact_method: details.contactMethod,
        contact_value: details.contactValue,
      }),
    );
  },
};
