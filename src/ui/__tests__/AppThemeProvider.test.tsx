import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Appearance, Button, Text } from 'react-native';
import * as SystemUI from 'expo-system-ui';

import type { AppearancePreferenceStore } from '../../preferences/appearancePreference';
import { AppThemeProvider, useAppTheme } from '../AppThemeProvider';

let mockColorScheme: 'light' | 'dark' = 'light';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: () => mockColorScheme,
}));
jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn(() => Promise.resolve()) }));

function ThemeReader() {
  const { preference, scheme, setPreference } = useAppTheme();
  return <><Text>{`${preference}:${scheme}`}</Text><Button title="dark" onPress={() => { void setPreference('dark'); }} /></>;
}

function createStore(value: 'system' | 'light' | 'dark' = 'system'): jest.Mocked<AppearancePreferenceStore> {
  return { read: jest.fn().mockResolvedValue(value), write: jest.fn().mockResolvedValue(undefined) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockColorScheme = 'light';
  jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
});

it('waits for the stored preference before rendering normal content', async () => {
  let finish!: (value: 'dark') => void;
  const store = createStore();
  store.read.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  render(<AppThemeProvider store={store}><ThemeReader /></AppThemeProvider>);

  expect(screen.queryByText(/:/)).not.toBeOnTheScreen();
  await act(async () => finish('dark'));
  expect(screen.getByText('dark:dark')).toBeOnTheScreen();
});

it.each([
  ['system', 'dark', 'system:dark'],
  ['light', 'dark', 'light:light'],
  ['dark', 'light', 'dark:dark'],
] as const)('resolves %s against a %s phone theme', async (preference, phoneTheme, expected) => {
  mockColorScheme = phoneTheme;
  render(<AppThemeProvider store={createStore(preference)}><ThemeReader /></AppThemeProvider>);
  expect(await screen.findByText(expected)).toBeOnTheScreen();
});

it('falls back to Follow phone after a read failure', async () => {
  mockColorScheme = 'dark';
  const store = createStore();
  store.read.mockRejectedValue(new Error('read failed'));
  render(<AppThemeProvider store={store}><ThemeReader /></AppThemeProvider>);
  expect(await screen.findByText('system:dark')).toBeOnTheScreen();
});

it('follows live phone changes only in system mode', async () => {
  const store = createStore('system');
  const view = render(<AppThemeProvider store={store}><ThemeReader /></AppThemeProvider>);
  expect(await screen.findByText('system:light')).toBeOnTheScreen();
  mockColorScheme = 'dark';
  view.rerender(<AppThemeProvider store={store}><ThemeReader /></AppThemeProvider>);
  expect(screen.getByText('system:dark')).toBeOnTheScreen();

  fireEvent.press(screen.getByRole('button', { name: 'dark' }));
  expect(await screen.findByText('dark:dark')).toBeOnTheScreen();
  mockColorScheme = 'light';
  view.rerender(<AppThemeProvider store={store}><ThemeReader /></AppThemeProvider>);
  expect(screen.getByText('dark:dark')).toBeOnTheScreen();
});

it('synchronizes the native appearance and root surface', async () => {
  render(<AppThemeProvider store={createStore('dark')}><ThemeReader /></AppThemeProvider>);
  await screen.findByText('dark:dark');
  expect(Appearance.setColorScheme).toHaveBeenLastCalledWith('dark');
  expect(SystemUI.setBackgroundColorAsync).toHaveBeenLastCalledWith('#111713');
});
