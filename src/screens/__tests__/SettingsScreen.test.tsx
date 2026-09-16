import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { SettingsScreen } from '../SettingsScreen';
import { AppThemeProvider } from '../../ui/AppThemeProvider';

test('shows the active choices and opens settings destinations', () => {
  const navigate = jest.fn();
  render(
    <AppThemeProvider scheme="light">
      <NavigationContainer>
        <SettingsScreen navigation={{ navigate } as never} route={{} as never} />
      </NavigationContainer>
    </AppThemeProvider>,
  );

  const dataRow = screen.getByTestId('settings-data');
  const appearanceRow = screen.getByTestId('settings-appearance');
  const visibilityRow = screen.getByTestId('settings-active-workout-visibility');
  expect(screen.queryByRole('header', { name: 'Innstillinger' })).not.toBeOnTheScreen();
  expect(appearanceRow).toHaveAccessibleName('Utseende, Lys');
  expect(visibilityRow).toHaveAccessibleName('Notifikasjoner, Vis aktiv trening');
  fireEvent.press(appearanceRow);
  expect(navigate).toHaveBeenCalledWith('Appearance');
  fireEvent.press(visibilityRow);
  expect(navigate).toHaveBeenCalledWith('ActiveWorkoutVisibility');
  expect(dataRow).toHaveProp('accessibilityRole', 'button');
  expect(screen.getByRole('button', { name: 'Dine data' })).toBe(dataRow);

  fireEvent.press(dataRow);
  expect(navigate).toHaveBeenCalledWith('Data');
});
