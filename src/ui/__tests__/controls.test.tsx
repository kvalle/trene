import { createRef } from 'react';
import { TextInput, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '../Button';
import { TextField } from '../TextField';
import { FieldError } from '../FieldError';
import { ListContainer } from '../ListContainer';
import { NavigationRow } from '../NavigationRow';
import { Card } from '../Card';
import { CompactAction } from '../CompactAction';
import { DataRow } from '../DataRow';
import { AppThemeProvider } from '../AppThemeProvider';
import { darkColors, lightColors } from '../../theme';

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

describe('CompactAction', () => {
  it.each([
    ['light', 'accent', lightColors.primary],
    ['light', 'neutral', lightColors.text],
    ['light', 'destructive', lightColors.danger],
    ['dark', 'accent', darkColors.primary],
    ['dark', 'neutral', darkColors.text],
    ['dark', 'destructive', darkColors.danger],
  ] as const)('uses the %s theme color for the %s tone', (scheme, tone, color) => {
    render(
      <AppThemeProvider scheme={scheme}>
        <CompactAction icon="trash" label="Handling" tone={tone} testID="compact" />
      </AppThemeProvider>,
    );

    expect(screen.getByText('Handling')).toHaveStyle({ color });
    expect(screen.getByTestId('compact-icon', { includeHiddenElements: true })).toHaveProp('color', color);
  });

  it('supports Pressable style objects and callbacks', () => {
    const callbackStyle = jest.fn(() => ({ marginTop: 9 }));
    const { rerender } = renderWithTheme(
      <CompactAction icon="plus" label="Legg til" style={{ marginBottom: 7 }} testID="compact" />,
    );
    expect(screen.getByTestId('compact')).toHaveStyle({ marginBottom: 7 });

    rerender(
      <AppThemeProvider>
        <CompactAction icon="plus" label="Legg til" style={callbackStyle} testID="compact" />
      </AppThemeProvider>,
    );
    expect(callbackStyle).toHaveBeenCalledWith(expect.objectContaining({ pressed: false }));
    expect(screen.getByTestId('compact')).toHaveStyle({ marginTop: 9 });
  });

  it('renders a decorative typed icon while the control owns the accessible name', () => {
    renderWithTheme(<CompactAction icon="trash" label="Fjern" testID="compact" />);

    expect(screen.getByRole('button', { name: 'Fjern' })).toBeOnTheScreen();
    expect(screen.getByTestId('compact-icon', { includeHiddenElements: true })).toHaveProp('accessible', false);
  });

  it('preserves button semantics, visible text, focus and minimum target sizing', () => {
    const onFocus = jest.fn();
    renderWithTheme(<CompactAction accessibilityLabel="Tilpasset navn" icon="edit" label="Synlig etikett" onFocus={onFocus} testID="compact" />);

    const action = screen.getByRole('button', { name: 'Tilpasset navn' });
    expect(screen.getByText('Synlig etikett')).toBeOnTheScreen();
    expect(action).toHaveStyle({ minHeight: 48, minWidth: 48 });
    fireEvent(action, 'focus');
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it.each(['accent', 'neutral', 'destructive'] as const)('preserves press behavior for the %s tone', (tone) => {
    const onPress = jest.fn();
    renderWithTheme(<CompactAction icon="edit" label="Handling" onPress={onPress} tone={tone} testID="compact" />);

    fireEvent.press(screen.getByTestId('compact'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each(
    (['light', 'dark'] as const).flatMap((scheme) =>
      (['accent', 'neutral', 'destructive'] as const).flatMap((tone) =>
        (['disabled', 'busy'] as const).map((state) => [scheme, tone, state] as const),
      ),
    ),
  )('uses neutral disabled treatment in the %s theme for the %s tone when %s', (scheme, tone, state) => {
    const onPress = jest.fn();
    const muted = scheme === 'dark' ? darkColors.muted : lightColors.muted;
    render(
      <AppThemeProvider scheme={scheme}>
        <CompactAction
          {...{ [state]: true }}
          icon="trash"
          label="Fjern"
          onPress={onPress}
          tone={tone}
          testID="compact"
        />
      </AppThemeProvider>,
    );

    const action = screen.getByRole('button', { name: 'Fjern' });
    expect(action).toBeDisabled();
    expect(action).toHaveProp('accessibilityState', { busy: state === 'busy', disabled: true });
    expect(screen.getByText('Fjern')).toHaveStyle({ color: muted });
    if (state === 'busy') {
      expect(screen.getByTestId('compact-busy')).toHaveProp('color', muted);
      expect(screen.queryByTestId('compact-icon', { includeHiddenElements: true })).not.toBeOnTheScreen();
    } else {
      expect(screen.getByTestId('compact-icon', { includeHiddenElements: true })).toHaveProp('color', muted);
    }
    fireEvent.press(action);
    expect(onPress).not.toHaveBeenCalled();
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

describe('NavigationRow', () => {
  it('forwards ref, metadata, accessibility and press behavior', () => {
    const ref = createRef<View>();
    const onPress = jest.fn();
    renderWithTheme(
      <ListContainer testID="list">
        <NavigationRow
          ref={ref}
          title="Data"
          description="Administrer sikkerhetskopier"
          accessibilityHint="Åpner data"
          onPress={onPress}
          showSeparator
          testID="row"
        />
      </ListContainer>,
    );

    const row = screen.getByTestId('row');
    expect(screen.getByTestId('list')).toBeOnTheScreen();
    expect(ref.current).not.toBeNull();
    expect(row).toHaveProp('accessibilityRole', 'button');
    expect(row).toHaveProp('accessibilityLabel', 'Data, Administrer sikkerhetskopier');
    expect(row).toHaveProp('accessibilityHint', 'Åpner data');
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders trailing metadata without a description', () => {
    renderWithTheme(<NavigationRow title="Benkpress" metadata="Brukt i 1 trening" onPress={() => {}} testID="metadata-row" />);

    expect(screen.getByTestId('metadata-row')).toHaveProp('accessibilityLabel', 'Benkpress, Brukt i 1 trening');
    expect(screen.getByText('Brukt i 1 trening')).toBeOnTheScreen();
  });
});

describe('Card and DataRow', () => {
  it('groups static data and exposes its accessible summary', () => {
    renderWithTheme(<Card testID="card"><DataRow label="Sett 1" value="80 kg · 5 repetisjoner" testID="row" /></Card>);
    expect(screen.getByTestId('card')).toBeOnTheScreen();
    expect(screen.getByTestId('row')).toHaveProp('accessibilityLabel', 'Sett 1, 80 kg · 5 repetisjoner');
  });
});
