import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';

export type MonthCalendarDay = {
  /** Caller-supplied description of the day, used for assistive technology. */
  accessibilityLabel: string;
  highlighted?: boolean;
  today?: boolean;
  /** Days that are not part of the relevant range, such as future days. */
  inactive?: boolean;
  /** Makes the day a button. Ignored for inactive days. */
  onPress?: () => void;
};

type MonthCalendarProps = {
  year: number;
  /** Calendar month, 1 = January. */
  month: number;
  getDay: (day: number) => MonthCalendarDay;
  testID?: string;
};

const WEEKDAYS = [
  { short: 'Ma', long: 'mandag' },
  { short: 'Ti', long: 'tirsdag' },
  { short: 'On', long: 'onsdag' },
  { short: 'To', long: 'torsdag' },
  { short: 'Fr', long: 'fredag' },
  { short: 'Lø', long: 'lørdag' },
  { short: 'Sø', long: 'søndag' },
];

/** Number of empty cells before day 1 in a Monday-first week. */
export function leadingEmptyDays(year: number, month: number): number {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function MonthCalendar({ year, month, getDay, testID }: MonthCalendarProps) {
  const { colors } = useAppTheme();
  const leading = leadingEmptyDays(year, month);
  const length = daysInMonth(year, month);
  const cells: (number | 'leading' | 'trailing')[] = [
    ...Array.from({ length: leading }, () => 'leading' as const),
    ...Array.from({ length }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push('trailing');
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));

  return (
    <View style={styles.calendar} testID={testID}>
      <View style={styles.week}>
        {WEEKDAYS.map((weekday) => (
          <Text
            key={weekday.short}
            accessibilityLabel={weekday.long}
            style={[typography.metadata, styles.weekday, { color: colors.muted }]}
          >
            {weekday.short}
          </Text>
        ))}
      </View>
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.week}>
          {week.map((day, dayIndex) => {
            if (typeof day !== 'number') {
              return (
                <View
                  key={`${day}-${dayIndex}`}
                  style={styles.cell}
                  testID={testID ? `${testID}-${day}` : undefined}
                  importantForAccessibility="no-hide-descendants"
                  accessibilityElementsHidden
                />
              );
            }
            return <DayCell key={day} day={day} state={getDay(day)} testID={testID ? `${testID}-day-${day}` : undefined} />;
          })}
        </View>
      ))}
    </View>
  );
}

function DayCell({ day, state, testID }: { day: number; state: MonthCalendarDay; testID?: string }) {
  const { colors } = useAppTheme();
  const { accessibilityLabel, highlighted = false, today = false, inactive = false, onPress } = state;
  const backgroundColor = inactive ? 'transparent' : highlighted ? colors.primary : colors.surfaceAlt;
  const color = inactive ? colors.muted : highlighted ? colors.onPrimary : colors.text;
  const cellStyle = [
    styles.cell,
    styles.day,
    { backgroundColor },
    today && { borderColor: colors.text, borderWidth: 2 },
  ];
  const number = (
    <Text
      style={[typography.metadata, styles.number, { color }, highlighted && !inactive && styles.bold, today && styles.bold]}
    >
      {day}
    </Text>
  );

  if (onPress && !inactive) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [cellStyle, pressed && styles.pressed]}
      >
        {number}
      </Pressable>
    );
  }

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={cellStyle} testID={testID}>
      {number}
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { gap: 4 },
  week: { flexDirection: 'row', gap: 4 },
  weekday: { flex: 1, fontWeight: '700', textAlign: 'center' },
  cell: { flex: 1, minHeight: 48 },
  day: { alignItems: 'center', borderRadius: radii.control, justifyContent: 'center', paddingVertical: 4 },
  number: { textAlign: 'center' },
  bold: { fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
