import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '../AppThemeProvider';
import { leadingEmptyDays, MonthCalendar, type MonthCalendarDay } from '../MonthCalendar';
import { darkColors, lightColors } from '../../theme';

function renderCalendar(getDay: (day: number) => MonthCalendarDay, scheme: 'light' | 'dark' = 'light', year = 2026, month = 10) {
  return render(
    <AppThemeProvider scheme={scheme}>
      <MonthCalendar year={year} month={month} getDay={getDay} testID="cal" />
    </AppThemeProvider>,
  );
}

const label = (day: number): MonthCalendarDay => ({ accessibilityLabel: `Dag ${day}` });

function flatStyle(testID: string) {
  const style = screen.getByTestId(testID).props.style;
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

test('renders a Monday-first weekday header', () => {
  renderCalendar(label);
  const header = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'].map((short) => screen.getByText(short));
  expect(header.map((node) => node.props.accessibilityLabel)).toEqual([
    'mandag',
    'tirsdag',
    'onsdag',
    'torsdag',
    'fredag',
    'lørdag',
    'søndag',
  ]);
});

test.each([
  [2026, 6, 0], // 1 June 2026 is a Monday
  [2026, 10, 3], // 1 October 2026 is a Thursday
  [2026, 11, 6], // 1 November 2026 is a Sunday
])('places day 1 on its weekday (%i-%i has %i leading cells)', (year, month, expected) => {
  expect(leadingEmptyDays(year, month)).toBe(expected);
  renderCalendar(label, 'light', year, month);
  expect(screen.queryAllByTestId('cal-leading', { includeHiddenElements: true })).toHaveLength(expected);
  expect(screen.getByTestId('cal-day-1')).toBeOnTheScreen();
  expect(screen.getByText(String(new Date(year, month, 0).getDate()))).toBeOnTheScreen();
});

test('only pressable, active days are buttons with the caller label', () => {
  const onPress = jest.fn();
  renderCalendar((day) => ({
    accessibilityLabel: `Dag ${day}`,
    onPress: day === 3 || day === 20 ? () => onPress(day) : undefined,
    inactive: day === 20,
  }));

  const buttons = screen.getAllByRole('button');
  expect(buttons).toHaveLength(1);
  fireEvent.press(screen.getByRole('button', { name: 'Dag 3' }));
  expect(onPress).toHaveBeenCalledWith(3);

  const plain = screen.getByTestId('cal-day-4');
  expect(plain).toHaveProp('accessibilityLabel', 'Dag 4');
  expect(plain.props.accessibilityRole).toBeUndefined();
  fireEvent.press(screen.getByTestId('cal-day-20'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test.each([
  ['light', lightColors],
  ['dark', darkColors],
] as const)('distinguishes cell states with semantic colours in %s mode', (scheme, colors) => {
  renderCalendar(
    (day) => ({
      accessibilityLabel: `Dag ${day}`,
      highlighted: day === 2,
      today: day === 3,
      inactive: day === 4,
    }),
    scheme,
  );

  expect(flatStyle('cal-day-1')).toMatchObject({ backgroundColor: colors.surfaceAlt });
  expect(flatStyle('cal-day-1').borderWidth).toBeUndefined();
  expect(flatStyle('cal-day-2')).toMatchObject({ backgroundColor: colors.primary });
  expect(flatStyle('cal-day-3')).toMatchObject({ backgroundColor: colors.surfaceAlt, borderColor: colors.text, borderWidth: 2 });
  expect(flatStyle('cal-day-4')).toMatchObject({ backgroundColor: 'transparent' });
  expect(screen.getByText('2')).toHaveStyle({ color: colors.onPrimary });
  expect(screen.getByText('4')).toHaveStyle({ color: colors.muted });
});
