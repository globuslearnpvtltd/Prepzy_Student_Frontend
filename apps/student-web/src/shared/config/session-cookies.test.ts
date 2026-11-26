import { describe, expect, it } from 'vitest';
import { studentCookieNames } from './session-cookies';

describe('studentCookieNames', () => {
  it('matches the backend: per application and environment', () => {
    expect(studentCookieNames('development')).toEqual({
      access: 'prepzy_student_dev_access_token',
      session: 'prepzy_student_dev_session_token',
    });
    expect(studentCookieNames('staging').access).toBe('prepzy_student_staging_access_token');
    expect(studentCookieNames('production').access).toBe('prepzy_student_prod_access_token');
    expect(studentCookieNames().access).toBe('prepzy_student_test_access_token');
    expect(studentCookieNames('unknown').access).toBe('prepzy_student_dev_access_token');
  });
});
