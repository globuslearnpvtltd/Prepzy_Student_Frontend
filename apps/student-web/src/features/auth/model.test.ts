import { pickActivePlan } from './hooks';
import { isValidPhone, normalizePhone, planName, planTier, toStudent, type ActivePlan } from './model';
import { otpSchema, phoneSchema } from './schemas';
import { testExam } from '@/test/exams';

describe('toStudent', () => {
  it('maps the backend account row', () => {
    const student = toStudent({
      account_id: '15',
      first_name: ' Asha ',
      last_name: 'K',
      phone: '+919876543210',
      class: 12,
      target_exam: 'NEET-UG',
      email: '',
    });
    expect(student).toMatchObject({
      accountId: 15,
      firstName: 'Asha',
      fullName: 'Asha K',
      classId: 12,
      targetExam: 'neet',
      email: null,
    });
  });

  it('falls back to a generic name and unknown exam', () => {
    expect(toStudent({ account_id: 1, target_exam: 'JEE' })).toMatchObject({ fullName: 'Student', targetExam: null });
  });

  it('rejects responses without an account id', () => {
    expect(() => toStudent({ success: true })).toThrow(/account_id/);
  });
});

describe('phone numbers', () => {
  it.each([
    ['98765 43210', '+919876543210'],
    ['+91 98765-43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['+447700900123', '+447700900123'],
  ])('normalises %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it('validates Indian mobiles strictly and others loosely', () => {
    expect(isValidPhone('+919876543210')).toBe(true);
    expect(isValidPhone('+911234567890')).toBe(false);
    expect(isValidPhone('+91987654321')).toBe(false);
    expect(isValidPhone('+447700900123')).toBe(true);
  });

  it('schema returns the normalised number or a friendly error', () => {
    expect(phoneSchema.parse(' 9876543210 ')).toBe('+919876543210');
    expect(phoneSchema.safeParse('123').error?.issues[0]?.message).toBe('Enter a valid 10-digit mobile number');
    expect(otpSchema.safeParse('12345').success).toBe(false);
    expect(otpSchema.safeParse('123456').success).toBe(true);
  });
});

describe('plans', () => {
  const plan = (extra: Partial<ActivePlan> = {}): ActivePlan => ({
    planId: 1,
    examId: 2,
    classId: 20,
    className: 'NEET',
    streamName: '',
    durationMonths: 12,
    expiryDate: '2027-05-01',
    status: 'active',
    relatedExams: [],
    year: 2027,
    ...extra,
  });

  it('names plans like the previous app', () => {
    const neet = testExam('neet');
    const cbse = testExam('cbse');
    expect(planName(plan(), neet)).toBe('Topper NEET 2027 Plan');
    // The bundled board exam is named from the backend catalog (GET /api/v4/exams), not a hard-coded id.
    const catalog = [{ examId: 41, name: 'CBSE', category: 'board' }];
    expect(planName(plan({ relatedExams: [41] }), neet, catalog)).toBe('Topper NEET 2027 + CBSE Plan');
    expect(planName(plan({ relatedExams: [41] }), neet)).toBe('Topper NEET 2027 Plan');
    expect(planName(plan({ durationMonths: 1 }), neet)).toBe('Topper NEET Monthly Plan');
    expect(planName(plan({ durationMonths: 0 }), neet)).toBe('Basic NEET Plan');
    expect(planName(plan({ durationMonths: 0 }), cbse)).toBe('Basic Plan');
    expect(planName(plan({ durationMonths: 1 }), cbse)).toBe('Topper Monthly Plan');
    expect(planName(plan(), cbse)).toBe('Topper Academic Year Plan');
    expect(planTier(plan({ durationMonths: 0 }))).toBe('Basic');
  });

  it('picks the selected active plan, else the first active one', () => {
    const plans = [plan({ planId: 1, status: 'expired' }), plan({ planId: 2 }), plan({ planId: 3 })];
    expect(pickActivePlan(plans, 3)?.planId).toBe(3);
    expect(pickActivePlan(plans, 1)?.planId).toBe(2);
    expect(pickActivePlan(plans, null)?.planId).toBe(2);
    expect(pickActivePlan([], null)).toBeNull();
  });

  it('reads the gender for the welcome illustration', () => {
    expect(toStudent({ account_id: 1, gender: 'female' }).gender).toBe('female');
    expect(toStudent({ account_id: 1, gender: 'other' }).gender).toBeNull();
  });
});
