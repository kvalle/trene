import { NavigationContainer } from '@react-navigation/native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { AppearancePreferenceStore } from '../../preferences/appearancePreference';
import { AppThemeProvider } from '../../ui/AppThemeProvider';
import { AppearanceScreen } from '../AppearanceScreen';

const listeners: Record<string, () => void> = {};
const navigation = { addListener: jest.fn((event: string, listener: () => void) => {
  listeners[event] = listener;
  return () => { delete listeners[event]; };
}) };

function createStore(initial: 'system' | 'light' | 'dark' = 'system'): jest.Mocked<AppearancePreferenceStore> {
  return { read: jest.fn().mockResolvedValue(initial), write: jest.fn().mockResolvedValue(undefined) };
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(listeners).forEach((key) => delete listeners[key]);
});

test('offers one accessible choice for each approved preference', async () => {
  renderScreen(createStore());
  expect(await screen.findByRole('header', { name: 'Utseende' })).toBeOnTheScreen();
  expect(screen.getByText('Tema')).toBeOnTheScreen();
  expect(screen.getByTestId('appearance-options')).toHaveProp('accessibilityRole', 'radiogroup');
  expect(screen.getByTestId('appearance-options')).toHaveAccessibleName('Tema');
  expect(screen.getByRole('radio', { name: 'Følg telefonen' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Lys' })).not.toBeChecked();
  expect(screen.getByRole('radio', { name: 'Mørk' })).not.toBeChecked();
});

test.each([
  ['system', 'Mørk', 'dark'],
  ['dark', 'Lys', 'light'],
  ['light', 'Følg telefonen', 'system'],
] as const)('applies and persists %s to %s immediately', async (initial, label, expected) => {
  const store = createStore(initial);
  renderScreen(store);
  fireEvent.press(await screen.findByRole('radio', { name: label }));
  expect(await screen.findByTestId(`appearance-${expected}-selected`)).toBeChecked();
  expect(store.write).toHaveBeenCalledWith(expected);
});

test('restores the previous choice after failure and clears the error on a later attempt', async () => {
  const store = createStore();
  store.write.mockRejectedValueOnce(new Error('write failed')).mockResolvedValueOnce();
  renderScreen(store);
  fireEvent.press(await screen.findByRole('radio', { name: 'Mørk' }));
  expect(await screen.findByText('Det forrige valget er fortsatt aktivt. Prøv igjen.')).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Følg telefonen' })).toBeChecked();

  fireEvent.press(screen.getByRole('radio', { name: 'Lys' }));
  await act(async () => {});
  expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Lys' })).toBeChecked();
});

test('clears a write error when navigating away', async () => {
  const store = createStore();
  store.write.mockRejectedValue(new Error('write failed'));
  renderScreen(store);
  fireEvent.press(await screen.findByRole('radio', { name: 'Mørk' }));
  expect(await screen.findByRole('alert')).toBeOnTheScreen();
  act(() => listeners.blur());
  expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
});

test('does not restore a late write error after navigating away', async () => {
  let failWrite!: (error: Error) => void;
  const store = createStore();
  store.write.mockReturnValue(new Promise((_, reject) => { failWrite = reject; }));
  renderScreen(store);
  fireEvent.press(await screen.findByRole('radio', { name: 'Mørk' }));
  act(() => listeners.blur());
  await act(async () => failWrite(new Error('write failed')));
  expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
});

function renderScreen(store: AppearancePreferenceStore) {
  return render(
    <AppThemeProvider store={store}>
      <NavigationContainer>
        <AppearanceScreen navigation={navigation as never} route={{} as never} />
      </NavigationContainer>
    </AppThemeProvider>,
  );
}
