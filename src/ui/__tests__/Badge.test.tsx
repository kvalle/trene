import { render, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '../AppThemeProvider';
import { Badge } from '../Badge';

it.each(['light', 'dark'] as const)('shows its label as plain text in the %s theme', (scheme) => {
  render(<AppThemeProvider scheme={scheme}><Badge label="Eksempel" testID="badge" /></AppThemeProvider>);

  expect(screen.getByTestId('badge')).toHaveTextContent('Eksempel');
  expect(screen.getByText('Eksempel')).toBeOnTheScreen();
  expect(screen.queryByRole('button')).toBeNull();
});
