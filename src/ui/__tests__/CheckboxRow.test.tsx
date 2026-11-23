import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '../AppThemeProvider';
import { CheckboxRow } from '../CheckboxRow';

it.each(['light', 'dark'] as const)('toggles from the whole row and exposes checkbox state in the %s theme', (scheme) => {
  const onCheckedChange = jest.fn();
  const { rerender } = render(
    <AppThemeProvider scheme={scheme}>
      <CheckboxRow title="Eksempel" checked={false} onCheckedChange={onCheckedChange} testID="row" />
    </AppThemeProvider>,
  );

  const row = screen.getByRole('checkbox', { name: 'Eksempel' });
  expect(row).toHaveProp('accessibilityState', { checked: false, disabled: false });
  fireEvent.press(row);
  expect(onCheckedChange).toHaveBeenLastCalledWith(true);

  rerender(
    <AppThemeProvider scheme={scheme}>
      <CheckboxRow title="Eksempel" checked onCheckedChange={onCheckedChange} testID="row" />
    </AppThemeProvider>,
  );
  expect(screen.getByRole('checkbox', { name: 'Eksempel' })).toHaveProp('accessibilityState', { checked: true, disabled: false });
  fireEvent.press(screen.getByTestId('row'));
  expect(onCheckedChange).toHaveBeenLastCalledWith(false);
});

it('keeps a locked row checked and cannot be unchecked', () => {
  const onCheckedChange = jest.fn();
  render(
    <AppThemeProvider scheme="light">
      <CheckboxRow title="Eksempel" checked locked onCheckedChange={onCheckedChange} />
    </AppThemeProvider>,
  );

  const row = screen.getByRole('checkbox', { name: 'Eksempel' });
  expect(row).toHaveProp('accessibilityState', { checked: true, disabled: true });
  fireEvent.press(row);
  expect(onCheckedChange).not.toHaveBeenCalled();
});

it('marks disabled rows unavailable', () => {
  const onCheckedChange = jest.fn();
  render(
    <AppThemeProvider scheme="light">
      <CheckboxRow title="Eksempel" checked={false} disabled onCheckedChange={onCheckedChange} />
    </AppThemeProvider>,
  );

  const row = screen.getByRole('checkbox', { name: 'Eksempel' });
  expect(row).toHaveProp('accessibilityState', { checked: false, disabled: true });
  fireEvent.press(row);
  expect(onCheckedChange).not.toHaveBeenCalled();
});

it('shows an optional trailing count and includes it in the accessible name', () => {
  render(
    <AppThemeProvider scheme="light">
      <CheckboxRow title="Eksempel" checked count={12} testID="row" />
    </AppThemeProvider>,
  );

  expect(screen.getByTestId('row-count')).toHaveTextContent('12');
  expect(screen.getByRole('checkbox', { name: 'Eksempel, 12' })).toBeOnTheScreen();
});

it('omits the count when none is given', () => {
  render(
    <AppThemeProvider scheme="light">
      <CheckboxRow title="Eksempel" checked={false} testID="row" />
    </AppThemeProvider>,
  );

  expect(screen.queryByTestId('row-count')).toBeNull();
});
