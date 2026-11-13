import { File as NodeFile } from 'node:buffer';
import { http, HttpResponse } from 'msw';
import { API, server } from '@/test/server';
import { profileApi } from './api';
import { fail, ok } from './test-fixtures';

/** jsdom's File can't be streamed by Node's fetch; a Node File goes through as multipart. */
const nodeFile = (name: string) => new NodeFile(['png'], name, { type: 'image/png' }) as unknown as File;

describe('profileApi', () => {
  it('uploads the photo as multipart and maps the reply', async () => {
    let image: unknown = null;
    server.use(
      http.put(`${API}/api/v4/student/account/photo`, async ({ request }) => {
        image = (await request.formData()).get('image');
        return ok({ profile_picture: ' https://cdn.test/me.png ', completion_percentage: 72.6 });
      }),
    );
    expect(await profileApi.uploadPhoto(nodeFile('me.png'))).toEqual({
      picture: 'https://cdn.test/me.png',
      completion: 73,
    });
    expect(image).not.toBeNull();

    server.use(http.put(`${API}/api/v4/student/account/photo`, () => ok(null)));
    expect(await profileApi.uploadPhoto(nodeFile('me.png'))).toEqual({ picture: null, completion: 0 });
  });

  it('removes the photo and changes the password', async () => {
    let password: unknown = null;
    server.use(
      http.delete(`${API}/api/v4/student/account/photo`, () => ok({ completion_percentage: '40' })),
      http.put(`${API}/api/v4/student/account/password`, async ({ request }) => {
        password = await request.json();
        return ok(null);
      }),
    );
    expect(await profileApi.removePhoto()).toEqual({ picture: null, completion: 40 });
    await profileApi.changePassword('a', 'b');
    expect(password).toEqual({ old_password: 'a', new_password: 'b' });
  });

  it('reads the parent and restores a removed one', async () => {
    server.use(
      http.get(`${API}/api/v4/student/mentor`, () =>
        ok({
          mentor_data: { account_id: 4, firstName: 'A', lastName: 'B', contactMethod: 'email', contactValue: 'a@x.in' },
        }),
      ),
      http.delete(`${API}/api/v4/student/mentor`, () => ok(null)),
      http.post(`${API}/api/v4/student/mentor/restore`, () => ok({ mentor_data: null })),
    );
    expect(await profileApi.parent()).toMatchObject({ id: 4, contactMethod: 'email' });
    expect(await profileApi.removeParent()).toBeNull();
    await expect(profileApi.restoreParent('t')).rejects.toThrow('No parent returned');
  });

  it('sends a report with its screenshot and fills in what the backend leaves out', async () => {
    let fields: string[] = [];
    server.use(
      http.post(`${API}/api/v4/student/help/requests`, async ({ request }) => {
        fields = [...(await request.formData()).keys()];
        return HttpResponse.json({ success: true, data: null }, { status: 201 });
      }),
    );
    const saved = await profileApi.reportProblem({ topic: 'Login', description: 'x', image: nodeFile('s.png') });
    expect(fields).toEqual(['topic', 'description', 'image']);
    expect(saved).toMatchObject({ id: 0, topic: 'Login', status: 'new' });
    expect(saved.createdAt).toBe(saved.updatedAt);
  });

  it('lists help requests, plan summary and delete info', async () => {
    server.use(
      http.get(`${API}/api/v4/student/help/requests`, () => ok({})),
      http.get(`${API}/api/v4/student/plans/2/summary`, () => ok({ planName: 'Topper', planType: 'topper' })),
      http.get(`${API}/api/v4/student/plans/1/summary`, () => ok({ nothing: true })),
      http.get(`${API}/api/v4/student/account/deletion`, () => ok({ active_paid_plans: '1', grace_days: 0 })),
    );
    expect(await profileApi.helpRequests()).toEqual([]);
    expect(await profileApi.planSummary(2)).toMatchObject({ planName: 'Topper' });
    expect(await profileApi.planSummary(1)).toBeNull();
    expect(await profileApi.deleteInfo()).toEqual({ activePaidPlans: 1, graceDays: 30 });
  });

  it('confirms a delete, falling back to now + grace days for missing dates', async () => {
    server.use(http.post(`${API}/api/v4/student/account/deletion/confirm`, () => ok({ requested_on: 'nope' })));
    const before = Date.now();
    const { requestedOn, deleteOn } = await profileApi.confirmDelete('123456', '', 30);
    expect(requestedOn.getTime()).toBeGreaterThanOrEqual(before);
    expect(deleteOn.getTime() - requestedOn.getTime()).toBe(30 * 86_400_000);
  });

  it('turns a failed reply into an error', async () => {
    server.use(http.post(`${API}/api/v4/student/account/deletion/otp`, () => fail(429, 'RATE_LIMITED')));
    await expect(profileApi.sendDeleteOtp()).rejects.toMatchObject({ status: 429 });
  });
});
