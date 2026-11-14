import { buildMonthOverview, monthKey } from '../monthOverview';

const workout = (id: number, at: Date, exerciseCount = 2) => ({ id, completedAt: at.toISOString(), exerciseCount });

describe('buildMonthOverview', () => {
  const today = new Date(2026, 10, 8, 12, 0); // Sunday 8 November 2026

  test('returns no months without completed workouts', () => {
    expect(buildMonthOverview([], today)).toEqual({ months: [], initiallyExpanded: null });
  });

  test('covers the current month back to the first workout month, including empty months, newest first', () => {
    const { months } = buildMonthOverview([
      workout(2, new Date(2026, 8, 20, 18)),
      workout(1, new Date(2026, 7, 15, 9)),
    ], today);

    expect(months.map((month) => [month.year, month.month, month.title])).toEqual([
      [2026, 11, 'November 2026'],
      [2026, 10, 'Oktober 2026'],
      [2026, 9, 'September 2026'],
      [2026, 8, 'August 2026'],
    ]);
    expect(months.map((month) => month.current)).toEqual([true, false, false, false]);
  });

  test('crosses year boundaries', () => {
    const { months } = buildMonthOverview([workout(1, new Date(2025, 11, 31, 22))], new Date(2026, 0, 2));
    expect(months.map((month) => month.key)).toEqual(['2026-01', '2025-12']);
  });

  test('groups workouts by local calendar day and counts them', () => {
    const { months } = buildMonthOverview([
      workout(3, new Date(2026, 9, 12, 23, 30)),
      workout(2, new Date(2026, 9, 12, 0, 15)),
      workout(1, new Date(2026, 9, 1, 8)),
    ], today);
    const october = months[1];

    expect(october.count).toBe(3);
    expect(october.days.get(12)?.map((item) => item.id)).toEqual([3, 2]);
    expect(october.days.get(1)?.map((item) => item.id)).toEqual([1]);
    expect(october.days.has(13)).toBe(false);
  });

  test('averages a full month over all its days', () => {
    // 8 trainings in 31 days: 8 / 31 * 7 = 1.806...
    const items = Array.from({ length: 8 }, (_, index) => workout(10 + index, new Date(2026, 9, 2 + index * 3, 10)));
    const { months } = buildMonthOverview([...items.reverse(), workout(1, new Date(2026, 8, 1, 10))], today);

    expect(months[1].summary).toBe('8 treninger. I snitt 1,8 per uke.');
  });

  test('averages the current month over the days elapsed so far', () => {
    // 2 trainings in 8 days: 1.75 => «1,8»
    const { months } = buildMonthOverview([
      workout(3, new Date(2026, 10, 5, 10)),
      workout(2, new Date(2026, 10, 2, 10)),
      workout(1, new Date(2026, 8, 1, 10)),
    ], today);

    expect(months[0].summary).toBe('2 treninger så langt. I snitt 1,8 per uke.');
  });

  test('averages the first month from the day of the first workout', () => {
    // 2 trainings from 25 to 30 September (6 days): 2 / 6 * 7 = 2.33
    const { months } = buildMonthOverview([
      workout(2, new Date(2026, 8, 30, 10)),
      workout(1, new Date(2026, 8, 25, 10)),
    ], today);

    expect(months.at(-1)?.summary).toBe('2 treninger. I snitt 2,3 per uke.');
  });

  test('averages a first month that is also the current month from the first workout to today', () => {
    // 1 training from 5 to 8 November (4 days): 1.75
    const { months } = buildMonthOverview([workout(1, new Date(2026, 10, 5, 10))], today);

    expect(months).toHaveLength(1);
    expect(months[0].summary).toBe('1 trening så langt. I snitt 1,8 per uke.');
  });

  test('uses one decimal even for whole averages', () => {
    // 1 training in 7 days of the current month
    const { months } = buildMonthOverview([workout(1, new Date(2026, 10, 1, 10))], new Date(2026, 10, 7, 20));
    expect(months[0].summary).toBe('1 trening så langt. I snitt 1,0 per uke.');
  });

  test('summarises months without trainings without an average', () => {
    const { months } = buildMonthOverview([workout(1, new Date(2026, 8, 1, 10))], today);

    expect(months[0].summary).toBe('Ingen treninger så langt.');
    expect(months[1].summary).toBe('Ingen treninger.');
  });

  test('uses singular for one training', () => {
    const { months } = buildMonthOverview([workout(1, new Date(2026, 9, 1, 10))], today);
    expect(months[1].summary).toBe('1 trening. I snitt 0,2 per uke.');
  });

  test('initially expands the newest month with a workout', () => {
    expect(buildMonthOverview([workout(1, new Date(2026, 8, 1, 10))], today).initiallyExpanded).toBe('2026-09');
    expect(buildMonthOverview([workout(1, new Date(2026, 10, 1, 10))], today).initiallyExpanded).toBe('2026-11');
  });

  test('describes each day with its full date and position relative to the history', () => {
    const { months } = buildMonthOverview([
      workout(2, new Date(2026, 10, 3, 10)),
      workout(1, new Date(2026, 10, 3, 18)),
    ], today);
    const november = months[0];

    expect(november.dayLabel(3)).toBe('tirsdag 3. november 2026, 2 treninger');
    expect(november.dayLabel(4)).toBe('onsdag 4. november 2026');
    expect(november.isToday(8)).toBe(true);
    expect(november.isToday(7)).toBe(false);
    expect(november.isInactive(2)).toBe(true);
    expect(november.isInactive(3)).toBe(false);
    expect(november.isInactive(8)).toBe(false);
    expect(november.isInactive(9)).toBe(true);
  });
});

test('monthKey uses local year and month', () => {
  expect(monthKey(new Date(2026, 0, 1, 0, 30))).toBe('2026-01');
});
