import { toAssessments, toChildren, toDoubts, toLearningHours, toLectureCompletion, toParent } from './api';
import { buildWeek, colorAt, formatMinutes, formatSince, initials, share, weekTicks } from './model';

describe('parents model', () => {
  it('orders the week so it ends on Today and converts hours to minutes', () => {
    const wednesday = new Date('2026-11-04T12:00:00');
    expect(buildWeek({ Thu: 1, Tue: 0.5, Today: 0.25 }, wednesday)).toEqual([
      { name: 'Thu', minutes: 60 },
      { name: 'Fri', minutes: 0 },
      { name: 'Sat', minutes: 0 },
      { name: 'Sun', minutes: 0 },
      { name: 'Mon', minutes: 0 },
      { name: 'Tue', minutes: 30 },
      { name: 'Today', minutes: 15 },
    ]);
  });

  it('picks round axis ticks', () => {
    expect(weekTicks(0)).toEqual([0, 5, 10, 15, 20]);
    expect(weekTicks(120)).toEqual([0, 30, 60, 90, 120]);
    expect(weekTicks(10_000)).toEqual([0, 2500, 5000, 7500, 10_000]);
  });

  it('formats names, dates and durations', () => {
    expect(initials('ravi kumar')).toBe('RK');
    expect(initials('')).toBe('?');
    expect(formatSince(null)).toBe('—');
    expect(formatSince('not a date')).toBe('—');
    expect(formatSince('2025-06-14T10:00:00Z')).toBe('14 Jun 2025');
    expect(formatMinutes(54)).toBe('54 Min');
    expect(formatMinutes(375)).toBe('6h 15 Min');
    expect(formatMinutes(120)).toBe('2h');
    expect(share(1, 4)).toBe('25%');
    expect(share(1, 0)).toBe('0%');
    expect(colorAt(5)).toBe(colorAt(1));
  });
});

describe('parents api normalisers', () => {
  it('tolerates missing or malformed fields', () => {
    expect(toParent(null)).toBeNull();
    expect(toParent({ account_id: 3, first_name: 'A' })).toEqual({ id: '3', firstName: 'A', lastName: '', email: '', phone: '' });
    expect(toChildren(undefined)).toEqual([]);
    expect(toChildren([{ account_id: '7', classes: [{ class_id: '9', class_name: 'CLASS 9', stream_name: null }] }])).toEqual([
      { id: 7, firstName: '', lastName: '', createdAt: null, classes: [{ id: 9, name: 'CLASS 9' }] },
    ]);
    expect(toLearningHours(undefined)).toEqual({ graph: {}, engagement: null });
    expect(toLearningHours({ graph_data: { Mon: '1.5', Tue: 'x' }, study_engagement: {} })).toEqual({
      graph: { Mon: 1.5, Tue: 0 },
      engagement: { weekMinutes: 0, totalMinutes: 0, avgMinutesPerActiveDay: 0 },
    });
    expect(toLectureCompletion(null)).toEqual({ total: 0, subjects: [], chapters: [] });
    expect(toDoubts({ subjects: [{ name: 'Physics', count: 2 }] }).subjects[0]).toEqual({
      id: 'Physics',
      name: 'Physics',
      count: 2,
      color: null,
    });
    expect(toAssessments({ total: '4', categories: [{ label: 'Quiz', count: 1, percentage: '50' }] })).toEqual({
      total: 4,
      categories: [{ label: 'Quiz', count: 1, percentage: 50 }],
    });
  });
});
