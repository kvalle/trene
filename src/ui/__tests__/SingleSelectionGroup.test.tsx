import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '../AppThemeProvider';
import { SingleSelectionGroup } from '../SingleSelectionGroup';

const options = [
  { value: 'first', label: 'Første valg' },
  { value: 'second', label: 'Andre valg' },
  { value: 'disabled', label: 'Utilgjengelig valg', disabled: true },
] as const;

test('exposes an exclusive radio group and changes the selected value', () => {
  const onValueChange = jest.fn();
  render(
    <AppThemeProvider scheme="light">
      <SingleSelectionGroup
        accessibilityLabel="Eksempelvalg"
        onValueChange={onValueChange}
        options={options}
        value="first"
      />
    </AppThemeProvider>,
  );

  expect(screen.getByLabelText('Eksempelvalg')).toHaveProp('accessibilityRole', 'radiogroup');
  expect(screen.getByRole('radio', { name: 'Første valg' })).toHaveProp('accessibilityHint', 'Eksempelvalg');
  expect(screen.getByRole('radio', { name: 'Første valg' })).toHaveProp('accessibilityState', { checked: true, disabled: false });
  expect(screen.getByRole('radio', { name: 'Andre valg' })).toHaveProp('accessibilityState', { checked: false, disabled: false });

  fireEvent.press(screen.getByRole('radio', { name: 'Andre valg' }));
  expect(onValueChange).toHaveBeenCalledWith('second');
});

test('announces and prevents disabled choices', () => {
  const onValueChange = jest.fn();
  render(
    <AppThemeProvider scheme="dark">
      <SingleSelectionGroup
        accessibilityLabel="Eksempelvalg"
        onValueChange={onValueChange}
        options={options}
        value="first"
      />
    </AppThemeProvider>,
  );

  const disabledOption = screen.getByRole('radio', { name: 'Utilgjengelig valg' });
  expect(disabledOption).toHaveProp('accessibilityState', { checked: false, disabled: true });
  fireEvent.press(disabledOption);
  expect(onValueChange).not.toHaveBeenCalled();
});

test('rejects a value that does not select exactly one option', () => {
  expect(() => render(
    <AppThemeProvider scheme="light">
      <SingleSelectionGroup
        accessibilityLabel="Eksempelvalg"
        onValueChange={() => {}}
        options={options}
        value={'missing' as 'first'}
      />
    </AppThemeProvider>,
  )).toThrow('SingleSelectionGroup requires unique options and exactly one option matching value.');

  expect(() => render(
    <AppThemeProvider scheme="light">
      <SingleSelectionGroup
        accessibilityLabel="Eksempelvalg"
        onValueChange={() => {}}
        options={[{ value: 'same', label: 'Første' }, { value: 'same', label: 'Andre' }]}
        value="same"
      />
    </AppThemeProvider>,
  )).toThrow('SingleSelectionGroup requires unique options and exactly one option matching value.');
});
