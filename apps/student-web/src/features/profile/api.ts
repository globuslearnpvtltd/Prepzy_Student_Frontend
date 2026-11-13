import { apiClient } from '@/shared/lib/api-client';
import { assertOk, unwrapData } from '@/shared/lib/unwrap';

type Envelope<T> = { success?: boolean; message?: string; error?: string; data?: T };

export type Gender = 'male' | 'female' | 'other';

/** Everything My Account shows and edits (richer than the session's Student). */
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

/** Fields PUT /account overwrites; a blank or missing field keeps the stored value. */
export type ProfileUpdate = Partial<
  Pick<Profile, 'firstName' | 'lastName' | 'email' | 'dateOfBirth' | 'address' | 'city' | 'school'> & {
    gender: Gender | '';
  }
>;

export type ContactMethod = 'whatsapp' | 'email';

export interface Parent {
  id: number;
  firstName: string;
  lastName: string;
  contactMethod: ContactMethod;
  /** +91XXXXXXXXXX for WhatsApp, the address for email. */
  contactValue: string;
}

export interface ParentDetails {
  firstName: string;
  lastName: string;
  contactMethod: ContactMethod;
  /** +<digits> for WhatsApp, the address for email. */
  contactValue: string;
}

/** A "Report a problem" request (CMS statuses: new, in_progress, resolved, rejected). */
export interface HelpRequest {
  id: number;
  topic: string;
  description: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
}

/** The header-style plan summary of one exam (competitive exams show it on My Account). */
export interface PlanSummary {
  planName: string;
  planType: 'basic' | 'topper';
  status: string;
  expiryDate: string | null;
  daysLeft: number | null;
  isFreeForever: boolean;
}

export interface DeleteInfo {
  activePaidPlans: number;
  graceDays: number;
}

export interface DeleteRequestResult {
  requestedOn: Date;
  deleteOn: Date;
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() && value !== 'null' ? value.trim() : '');
const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const date = (value: unknown, fallback: Date) => {
  const parsed = typeof value === 'string' ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : fallback;
};

/** Dates arrive as ISO timestamps or plain dates; forms keep yyyy-mm-dd. */
export function toDateInput(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
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

export function toHelpRequest(raw: unknown): HelpRequest {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    id: num(row.request_id),
    topic: text(row.topic),
    description: typeof row.description === 'string' ? row.description : '',
    status: text(row.status) || 'new',
    createdAt: text(row.created_at) || null,
    updatedAt: text(row.updated_at) || null,
  };
}

const mentorBody = (details: ParentDetails) => ({
  first_name: details.firstName,
  last_name: details.lastName,
  contact_method: details.contactMethod,
  contact_value: details.contactValue,
});

/** v4 profile endpoints (always the signed-in student; no account id is ever sent). */
export const profileApi = {
  async get(): Promise<Profile> {
    return toProfile(unwrapData(await apiClient.get<Envelope<unknown>>('/api/v4/student/account')));
  },

  /** Returns the saved account (PUT answers with it, as GET does). */
  async update(values: ProfileUpdate): Promise<Profile> {
    const body = await apiClient.put<Envelope<unknown>>('/api/v4/student/account', {
      first_name: values.firstName,
      last_name: values.lastName,
      email: values.email,
      date_of_birth: values.dateOfBirth,
      address: values.address,
      city: values.city,
      gender: values.gender,
      school: values.school,
    });
    return toProfile(unwrapData(body));
  },

  async uploadPhoto(file: File, signal?: AbortSignal): Promise<{ picture: string | null; completion: number }> {
    const form = new FormData();
    form.append('image', file);
    const body = await apiClient.put<Envelope<{ profile_picture?: unknown; completion_percentage?: unknown }>>(
      '/api/v4/student/account/photo',
      form,
      { timeout: 60_000, signal },
    );
    const data = assertOk(body).data ?? {};
    return { picture: text(data.profile_picture) || null, completion: Math.round(num(data.completion_percentage)) };
  },

  async removePhoto(): Promise<{ picture: null; completion: number }> {
    const body = await apiClient.delete<Envelope<{ completion_percentage?: unknown }>>('/api/v4/student/account/photo');
    return { picture: null, completion: Math.round(num(assertOk(body).data?.completion_percentage)) };
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    assertOk(
      await apiClient.put<Envelope<never>>('/api/v4/student/account/password', {
        old_password: oldPassword,
        new_password: newPassword,
      }),
    );
  },

  async parent(): Promise<Parent | null> {
    const body = await apiClient.get<Envelope<{ mentor_data?: unknown }>>('/api/v4/student/mentor');
    return toParent(assertOk(body).data?.mentor_data);
  },

  async sendParentOtp(details: ParentDetails): Promise<void> {
    assertOk(await apiClient.post<Envelope<never>>('/api/v4/student/mentor/otp', mentorBody(details)));
  },

  /** Creates (or links) the parent account; a wrong or expired code is a 400 (INVALID_OTP / OTP_EXPIRED). */
  async verifyParentOtp(details: ParentDetails, otp: string): Promise<number> {
    const body = await apiClient.post<Envelope<{ mentor_id?: number }>>('/api/v4/student/mentor/verify', {
      ...mentorBody(details),
      otp,
    });
    return num(assertOk(body).data?.mentor_id);
  },

  /** Renames the student's own linked parent (the backend never takes a parent id from the client). */
  async renameParent(firstName: string, lastName: string): Promise<void> {
    assertOk(
      await apiClient.put<Envelope<unknown>>('/api/v4/student/mentor', { first_name: firstName, last_name: lastName }),
    );
  },

  /** Unlinks the parent; the token undoes it for 10 minutes. */
  async removeParent(): Promise<string | null> {
    const body = await apiClient.delete<Envelope<{ undo_token?: string }>>('/api/v4/student/mentor');
    return assertOk(body).data?.undo_token ?? null;
  },

  async restoreParent(undoToken: string): Promise<Parent> {
    const body = await apiClient.post<Envelope<{ mentor_data?: unknown }>>('/api/v4/student/mentor/restore', {
      undo_token: undoToken,
    });
    const parent = toParent(assertOk(body).data?.mentor_data);
    if (!parent) throw new Error('No parent returned');
    return parent;
  },

  async helpRequests(): Promise<HelpRequest[]> {
    const body = await apiClient.get<Envelope<{ requests?: unknown[] }>>('/api/v4/student/help/requests');
    return (assertOk(body).data?.requests ?? []).map(toHelpRequest);
  },

  /** "Report a problem" (multipart; the screenshot is optional). */
  async reportProblem(input: { topic: string; description: string; image: File | null }): Promise<HelpRequest> {
    const form = new FormData();
    form.append('topic', input.topic);
    form.append('description', input.description);
    if (input.image) form.append('image', input.image);
    const body = await apiClient.post<Envelope<{ request_id?: unknown; status?: unknown; created_at?: unknown }>>(
      '/api/v4/student/help/requests',
      form,
      { timeout: 60_000 },
    );
    const saved = assertOk(body).data ?? {};
    const created = text(saved.created_at) || new Date().toISOString();
    return {
      id: num(saved.request_id),
      topic: input.topic,
      description: input.description,
      status: text(saved.status) || 'new',
      createdAt: created,
      updatedAt: created,
    };
  },

  /** null when the student has no plan for the exam. */
  async planSummary(examId: number): Promise<PlanSummary | null> {
    const body = await apiClient.get<Envelope<PlanSummary | null>>(`/api/v4/student/plans/${examId}/summary`);
    const data = assertOk(body).data;
    return data && typeof data === 'object' && 'planName' in data ? data : null;
  },

  async deleteInfo(): Promise<DeleteInfo> {
    const data = unwrapData(
      await apiClient.get<Envelope<{ active_paid_plans?: unknown; grace_days?: unknown }>>(
        '/api/v4/student/account/deletion',
      ),
    );
    return { activePaidPlans: num(data.active_paid_plans), graceDays: num(data.grace_days) || 30 };
  },

  /** Texts a code to the account's own login number. */
  async sendDeleteOtp(): Promise<void> {
    assertOk(await apiClient.post<Envelope<never>>('/api/v4/student/account/deletion/otp'));
  },

  /** Saves the delete request and ends the session. 400 OTP_MISSING / OTP_EXPIRED / INVALID_OTP on a bad code. */
  async confirmDelete(otp: string, reason: string, graceDays: number): Promise<DeleteRequestResult> {
    const body = await apiClient.post<Envelope<{ requested_on?: unknown; delete_on?: unknown }>>(
      '/api/v4/student/account/deletion/confirm',
      { otp, reason },
    );
    const data = assertOk(body).data ?? {};
    const requestedOn = date(data.requested_on, new Date());
    return { requestedOn, deleteOn: date(data.delete_on, new Date(requestedOn.getTime() + graceDays * 86_400_000)) };
  },
};
