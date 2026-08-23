import { createRef } from 'react';
import { TextInput, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '../Button';
import { TextField } from '../TextField';
import { FieldError } from '../FieldError';
import { AppThemeProvider } from '../AppThemeProvider';

function renderWithTheme(ui: React.ReactElement) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

describe('Button', () => {
  it('forwards ref, testID, role, accessibilityState and handles press', () => {
    const ref = createRef<View>();
    const onPress = jest.fn();
    renderWithTheme(
      <Button ref={ref} title="Opprett" testID="create-exercise-submit" onPress={onPress} />,
    );
    const button = screen.getByTestId('create-exercise-submit');
    expect(button).toBeOnTheScreen();
    expect(button.props.accessibilityRole).toBe('button');
    expect(ref.current).not.toBeNull();
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('applies disabled and busy native behavior and prevents press', () => {
    const onPress = jest.fn();
    const { rerender } = renderWithTheme(
      <Button title="Opprett" testID="btn" disabled onPress={onPress} />,
    );
    expect(screen.getByTestId('btn')).toBeDisabled();
    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();

    rerender(
      <AppThemeProvider>
        <Button title="Lagrer…" testID="btn2" busy onPress={onPress} />
      </AppThemeProvider>,
    );
    const busyBtn = screen.getByTestId('btn2');
    expect(busyBtn).toBeDisabled();
    expect(busyBtn.props.accessibilityState.busy).toBe(true);
    expect(screen.getByTestId('btn2-busy')).toBeOnTheScreen();
    fireEvent.press(busyBtn);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes name via accessibilityLabel and supports hint', () => {
    renderWithTheme(
      <Button title="Avbryt" testID="cancel" accessibilityHint="Går tilbake uten å lagre" variant="text" />,
    );
    expect(screen.getByRole('button', { name: 'Avbryt' })).toBeOnTheScreen();
    expect(screen.getByTestId('cancel').props.accessibilityHint).toBe('Går tilbake uten å lagre');
  });

  it('supports primary and text variants', () => {
    const { rerender } = renderWithTheme(<Button title="Primær" testID="p" variant="primary" />);
    expect(screen.getByTestId('p')).toBeOnTheScreen();
    rerender(
      <AppThemeProvider>
        <Button title="Tekst" testID="t" variant="text" />
      </AppThemeProvider>,
    );
    expect(screen.getByTestId('t')).toBeOnTheScreen();
  });
});

describe('TextField', () => {
  it('forwards ref, testID, label, value and handles change', () => {
    const ref = createRef<TextInput>();
    const onChangeText = jest.fn();
    renderWithTheme(
      <TextField ref={ref} label="Navn" value="Benk" onChangeText={onChangeText} testID="exercise-name-input" />,
    );
    const input = screen.getByTestId('exercise-name-input');
    expect(input).toBeOnTheScreen();
    expect(screen.getByText('Navn')).toBeOnTheScreen();
    expect(input.props.value).toBe('Benk');
    expect(ref.current).not.toBeNull();
    fireEvent.changeText(input, 'Knebøy');
    expect(onChangeText).toHaveBeenCalledWith('Knebøy');
  });

  it('reflects error via accessibilityLabel, hint and FieldError', () => {
    renderWithTheme(
      <TextField label="Navn" value="" onChangeText={jest.fn()} error="Skriv inn et navn" testID="exercise-name-input" />,
    );
    const input = screen.getByTestId('exercise-name-input');
    expect(input.props.accessibilityLabel).toBe('Navn. Feil: Skriv inn et navn');
    expect(input.props.accessibilityHint).toBe('Rett navnet og prøv igjen');
    expect(screen.getByText('Skriv inn et navn')).toBeOnTheScreen();
    expect(screen.getByTestId('exercise-name-input-error')).toBeOnTheScreen();
  });

  it('forwards native disabled/editable and input events', () => {
    const onSubmitEditing = jest.fn();
    const onFocus = jest.fn();
    const { rerender } = renderWithTheme(
      <TextField
        label="Navn"
        value="a"
        onChangeText={jest.fn()}
        testID="exercise-name-input"
        editable={false}
        onFocus={onFocus}
      />,
    );
    expect(screen.getByTestId('exercise-name-input').props.editable).toBe(false);
    rerender(
      <AppThemeProvider>
        <TextField
          label="Navn"
          value="a"
          onChangeText={jest.fn()}
          testID="exercise-name-input"
          onSubmitEditing={onSubmitEditing}
          onFocus={onFocus}
        />
      </AppThemeProvider>,
    );
    const input = screen.getByTestId('exercise-name-input');
    fireEvent(input, 'submitEditing');
    expect(onSubmitEditing).toHaveBeenCalled();
    fireEvent(input, 'focus');
    expect(onFocus).toHaveBeenCalled();
  });
});

describe('FieldError', () => {
  it('renders message with alert role and danger color', () => {
    renderWithTheme(<FieldError message="Feil" testID="err" />);
    const el = screen.getByTestId('err');
    expect(el).toBeOnTheScreen();
    expect(el.props.accessibilityRole).toBe('alert');
    expect(screen.getByText('Feil')).toBeOnTheScreen();
  });
});
