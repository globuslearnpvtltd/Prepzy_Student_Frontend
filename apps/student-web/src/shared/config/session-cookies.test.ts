import { describe, expect, it } from 'vitest';
import { PREVIOUS_ACCESS_COOKIES, STUDENT_COOKIES } from './session-cookies';

describe('student session cookies', () => {
  it('uses the same names as the backend in every environment', () => {
    expect(STUDENT_COOKIES).toEqual({ access: 'prepzy_student_access_token', session: 'prepzy_student_session_token' });
  });

  it("still accepts the earlier names until the backend renames them", () => {
    expect(PREVIOUS_ACCESS_COOKIES).toEqual(
      expect.arrayContaining(['prepzyAccessToken', 'prepzy_student_staging_access_token', 'accessToken']),
    );
  });
});
