import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { SettingsScreen } from '../SettingsScreen';
import { AppThemeProvider } from '../../ui/AppThemeProvider';

test('shows the active appearance and opens both settings destinations', () => {
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
  expect(screen.queryByRole('header', { name: 'Innstillinger' })).not.toBeOnTheScreen();
  expect(appearanceRow).toHaveAccessibleName('Utseende, Lys');
  fireEvent.press(appearanceRow);
  expect(navigate).toHaveBeenCalledWith('Appearance');
  expect(dataRow).toHaveProp('accessibilityRole', 'button');
  expect(screen.getByRole('button', { name: 'Dine data' })).toBe(dataRow);

  fireEvent.press(dataRow);
  expect(navigate).toHaveBeenCalledWith('Data');
});
