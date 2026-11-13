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

  it('picks the target exam by its slice, so exams named differently from their slug resolve (JHARKHAND BOARD → jac)', () => {
    expect(toStudent({ account_id: 1, target_exam: 'JHARKHAND BOARD', target_exam_slice: 'jac' })).toMatchObject({ targetExam: 'jac' });
    expect(toStudent({ account_id: 1, target_exam: 'NEET-UG', target_exam_slice: 'neet-ug' })).toMatchObject({ targetExam: 'neet' });
  });

  it('falls back to a generic name and unknown exam', () => {
    expect(toStudent({ account_id: 1, target_exam: 'JEE' })).toMatchObject({ fullName: 'Student', targetExam: null });
  });

  it('maps the content medium ({ id, name }) and ignores anything else', () => {
    expect(toStudent({ account_id: 1, language: { id: 2, name: 'hindi' } }).language).toEqual({ id: 2, name: 'hindi' });
    expect(toStudent({ account_id: 1, language: { id: '1', name: ' english ' } }).language).toEqual({ id: 1, name: 'english' });
    expect(toStudent({ account_id: 1, language: 2 }).language).toBeNull();
    expect(toStudent({ account_id: 1, language: { id: 0, name: 'x' } }).language).toBeNull();
    expect(toStudent({ account_id: 1, language: { id: 3, name: '' } }).language).toBeNull();
    expect(toStudent({ account_id: 1 }).language).toBeNull();
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

  it('names plans by the server rule, with exam and bundle names from the backend exam list', () => {
    const neet = testExam('neet');
    const cbse = testExam('cbse');
    // Names come from the backend catalog (GET /api/v4/exams), never from code.
    const catalog = [
      { examId: neet.examId, name: 'Exam X', category: 'competitive' },
      { examId: cbse.examId, name: 'Board Y', category: 'board' },
    ];
    expect(planName(plan(), neet, catalog)).toBe('Topper Exam X 2027');
    expect(planName(plan({ relatedExams: [cbse.examId] }), neet, catalog)).toBe('Topper Exam X 2027 + Board Y');
    expect(planName(plan({ durationMonths: 1, relatedExams: [cbse.examId] }), neet, catalog)).toBe('Topper Exam X + Board Y Monthly');
    expect(planName(plan({ durationMonths: 0 }), neet, catalog)).toBe('Basic Exam X');
    expect(planName(plan({ durationMonths: 0 }), cbse, catalog)).toBe('Basic Board Y');
    expect(planName(plan({ durationMonths: 1 }), cbse, catalog)).toBe('Topper Board Y Monthly');
    expect(planName(plan(), cbse, catalog)).toBe('Topper Board Y Academic');
    // Without the exam list the tier still reads.
    expect(planName(plan({ durationMonths: 1 }), neet)).toBe('Topper Monthly');
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
