import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '../AppThemeProvider';
import { SelectionRow } from '../SelectionRow';

test('keeps its title while busy, exposes progress, and prevents another press', () => {
  const onPress = jest.fn();
  render(
    <AppThemeProvider scheme="light">
      <SelectionRow title="Eksempel" busy onPress={onPress} testID="selection-row" />
    </AppThemeProvider>,
  );

  const row = screen.getByRole('button', { name: 'Eksempel' });
  expect(row).toHaveProp('accessibilityState', { busy: true, disabled: true });
  expect(screen.getByTestId('selection-row-busy')).toBeOnTheScreen();
  fireEvent.press(row);
  expect(onPress).not.toHaveBeenCalled();
});

test('forwards a normal selection and marks disabled rows unavailable', () => {
  const onPress = jest.fn();
  const { rerender } = render(
    <AppThemeProvider scheme="light">
      <SelectionRow title="Eksempel" onPress={onPress} />
    </AppThemeProvider>,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Eksempel' }));
  expect(onPress).toHaveBeenCalledTimes(1);

  rerender(
    <AppThemeProvider scheme="light">
      <SelectionRow title="Eksempel" disabled onPress={onPress} />
    </AppThemeProvider>,
  );
  expect(screen.getByRole('button', { name: 'Eksempel' })).toHaveProp('accessibilityState', { busy: false, disabled: true });
});
