import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AppThemeProvider, useAppTheme } from '../AppThemeProvider';

let mockColorScheme: 'light' | 'dark' = 'light';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: () => mockColorScheme,
}));

function ThemeReader() {
  const { scheme } = useAppTheme();
  return <Text>{scheme}</Text>;
}

it.each(['light', 'dark'] as const)('follows the %s system theme', (scheme) => {
  mockColorScheme = scheme;
  render(
    <AppThemeProvider>
      <ThemeReader />
    </AppThemeProvider>,
  );

  expect(screen.getByText(scheme)).toBeOnTheScreen();
});

it('updates mounted content when the system theme changes', () => {
  mockColorScheme = 'light';
  const view = render(
    <AppThemeProvider>
      <ThemeReader />
    </AppThemeProvider>,
  );

  expect(screen.getByText('light')).toBeOnTheScreen();
  mockColorScheme = 'dark';
  view.rerender(
    <AppThemeProvider>
      <ThemeReader />
    </AppThemeProvider>,
  );

  expect(screen.getByText('dark')).toBeOnTheScreen();
});
