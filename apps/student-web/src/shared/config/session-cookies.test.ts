import { describe, expect, it } from 'vitest';
import { PREVIOUS_ACCESS_COOKIES, studentCookieNames } from './session-cookies';

describe('student session cookies', () => {
  it("are named after this website's environment, like the backend", () => {
    expect(studentCookieNames('production')).toEqual({
      access: 'prepzy_student_prod_access_token',
      session: 'prepzy_student_prod_session_token',
    });
    expect(studentCookieNames('staging').access).toBe('prepzy_student_staging_access_token');
    expect(studentCookieNames('development').access).toBe('prepzy_student_dev_access_token');
    expect(studentCookieNames().access).toBe('prepzy_student_test_access_token');
    expect(studentCookieNames('unknown').access).toBe('prepzy_student_dev_access_token');
  });

  it('still accepts the earlier names until the backend renames them', () => {
    expect(PREVIOUS_ACCESS_COOKIES).toEqual(['prepzyAccessToken', 'prepzy_student_access_token', 'accessToken']);
  });
});
