import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { SettingsScreen } from '../SettingsScreen';
import { AppThemeProvider } from '../../ui/AppThemeProvider';

test('opens Data from one accessible whole-row action', () => {
  const navigate = jest.fn();
  render(
    <AppThemeProvider scheme="light">
      <NavigationContainer>
        <SettingsScreen navigation={{ navigate } as never} route={{} as never} />
      </NavigationContainer>
    </AppThemeProvider>,
  );

  const dataRow = screen.getByTestId('settings-data');
  expect(dataRow).toHaveProp('accessibilityRole', 'button');
  expect(screen.getByRole('button', { name: 'Data' })).toBe(dataRow);

  fireEvent.press(dataRow);
  expect(navigate).toHaveBeenCalledWith('Data');
});
