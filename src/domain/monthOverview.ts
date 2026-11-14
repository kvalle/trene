import { APP_LOCALE } from '../locale';

export type MonthOverviewWorkout = { id: number; completedAt: string; exerciseCount: number };

export type MonthOverviewMonth<W extends MonthOverviewWorkout = MonthOverviewWorkout> = {
  key: string;
  year: number;
  /** Calendar month, 1 = January. */
  month: number;
  title: string;
  summary: string;
  count: number;
  current: boolean;
  /** Workouts by local day of month, in the order they were given. */
  days: Map<number, W[]>;
  dayLabel: (day: number) => string;
  isToday: (day: number) => boolean;
  /** Days outside the history range: before the first workout or after today. */
  isInactive: (day: number) => boolean;
};

export type MonthOverview<W extends MonthOverviewWorkout = MonthOverviewWorkout> = {
  months: MonthOverviewMonth<W>[];
  /** Key of the newest month containing a workout. */
  initiallyExpanded: string | null;
};

const monthTitleFormat = new Intl.DateTimeFormat(APP_LOCALE, { month: 'long', year: 'numeric' });
const dayFormat = new Intl.DateTimeFormat(APP_LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const averageFormat = new Intl.NumberFormat(APP_LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function trainings(count: number): string {
  return `${count} ${count === 1 ? 'trening' : 'treninger'}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Groups completed workouts into calendar months from the month of `today`
 * back to the month of the earliest workout, newest first, in local time.
 */
export function buildMonthOverview<W extends MonthOverviewWorkout>(workouts: W[], today: Date): MonthOverview<W> {
  if (workouts.length === 0) return { months: [], initiallyExpanded: null };

  const dates = workouts.map((workout) => new Date(workout.completedAt));
  const first = dates.reduce((earliest, date) => (date < earliest ? date : earliest));
  const firstDay = new Date(first.getFullYear(), first.getMonth(), first.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const byMonth = new Map<string, Map<number, W[]>>();
  workouts.forEach((workout, index) => {
    const date = dates[index];
    const key = monthKey(date);
    const days = byMonth.get(key) ?? new Map<number, W[]>();
    byMonth.set(key, days);
    days.set(date.getDate(), [...(days.get(date.getDate()) ?? []), workout]);
  });

  const months: MonthOverviewMonth<W>[] = [];
  const firstMonth = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1);
  for (
    let cursor = new Date(todayDay.getFullYear(), todayDay.getMonth(), 1);
    cursor >= firstMonth;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)
  ) {
    const year = cursor.getFullYear();
    const monthIndex = cursor.getMonth();
    const key = monthKey(cursor);
    const days = byMonth.get(key) ?? new Map<number, W[]>();
    const count = [...days.values()].reduce((sum, items) => sum + items.length, 0);
    const current = key === monthKey(todayDay);
    const length = new Date(year, monthIndex + 1, 0).getDate();
    const from = key === monthKey(firstDay) ? firstDay.getDate() : 1;
    const to = current ? todayDay.getDate() : length;
    const soFar = current ? ' så langt' : '';
    const summary = count === 0
      ? `Ingen treninger${soFar}.`
      : `${trainings(count)}${soFar}. I snitt ${averageFormat.format((count / (to - from + 1)) * 7)} per uke.`;
    const dateOf = (day: number) => new Date(year, monthIndex, day);

    months.push({
      key,
      year,
      month: monthIndex + 1,
      title: capitalize(monthTitleFormat.format(cursor)),
      summary,
      count,
      current,
      days,
      dayLabel: (day) => {
        const items = days.get(day);
        const label = dayFormat.format(dateOf(day));
        return items ? `${label}, ${trainings(items.length)}` : label;
      },
      isToday: (day) => current && day === todayDay.getDate(),
      isInactive: (day) => dateOf(day) < firstDay || dateOf(day) > todayDay,
    });
  }

  return { months, initiallyExpanded: months.find((month) => month.count > 0)?.key ?? null };
}
