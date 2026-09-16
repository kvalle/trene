import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { ActiveWorkoutVisibilityScreen } from '../ActiveWorkoutVisibilityScreen';
import { AppThemeProvider } from '../../ui/AppThemeProvider';
import { useActiveWorkoutVisibility } from '../../activeWorkoutVisibility/ActiveWorkoutVisibilityContext';

jest.mock('../../activeWorkoutVisibility/ActiveWorkoutVisibilityContext', () => ({
  useActiveWorkoutVisibility: jest.fn(),
}));

const mockedUseVisibility = jest.mocked(useActiveWorkoutVisibility);
const setPreference = jest.fn();
const openSystemSettings = jest.fn();
const reconcile = jest.fn();
const navigation = {
  addListener: jest.fn(() => jest.fn()),
} as never;

beforeEach(() => {
  jest.clearAllMocks();
  setPreference.mockResolvedValue(true);
  openSystemSettings.mockResolvedValue(true);
  reconcile.mockResolvedValue(undefined);
  mockedUseVisibility.mockReturnValue({
    preference: 'enabled',
    changingPreference: false,
    capability: { supported: true, authorized: true, canShow: true },
    setPreference,
    reconcile,
    openSystemSettings,
    navigationIntent: null,
    consumeNavigationIntent: jest.fn(),
  });
});

it('uses the single-selection pattern and persists a new choice', async () => {
  renderScreen();

  expect(screen.getByTestId('active-workout-visibility-options')).toHaveProp('accessibilityRole', 'radiogroup');
  expect(screen.getByTestId('active-workout-visibility-enabled-selected')).toHaveProp(
    'accessibilityState',
    { checked: true, disabled: false },
  );
  fireEvent.press(screen.getByTestId('active-workout-visibility-disabled'));

  await waitFor(() => expect(setPreference).toHaveBeenCalledWith('disabled'));
  expect(screen.getByText('Viser bare at trening pågår')).toBeOnTheScreen();
  expect(screen.getByText(/Ingen info om øvelser eller sett blir vist/)).toBeOnTheScreen();
});

it.each([
  ['android', 'Varsler er slått av', 'Android tillater ikke at Trene viser varsel'],
  ['ios', 'Direkteaktiviteter er slått av', 'iOS tillater ikke at Trene viser direkteaktivitet'],
] as const)('explains unavailable authorization and opens %s settings', async (platform, title, message) => {
  jest.replaceProperty(Platform, 'OS', platform);
  mockedUseVisibility.mockReturnValue({
    ...mockedUseVisibility(),
    capability: { supported: true, authorized: false, canShow: false },
  });
  renderScreen();

  expect(screen.getByText(title)).toBeOnTheScreen();
  expect(screen.getByText(new RegExp(message))).toBeOnTheScreen();
  fireEvent.press(screen.getByTestId('active-workout-visibility-open-settings'));
  await waitFor(() => expect(openSystemSettings).toHaveBeenCalled());
});

it('keeps the previous choice visible when persistence fails', async () => {
  setPreference.mockResolvedValue(false);
  renderScreen();
  fireEvent.press(screen.getByTestId('active-workout-visibility-disabled'));
  expect(await screen.findByTestId('active-workout-visibility-error')).toBeOnTheScreen();
  expect(screen.getByTestId('active-workout-visibility-enabled-selected')).toHaveProp(
    'accessibilityState',
    { checked: true, disabled: false },
  );
});

function renderScreen() {
  return render(
    <AppThemeProvider scheme="light">
      <ActiveWorkoutVisibilityScreen navigation={navigation} route={{} as never} />
    </AppThemeProvider>,
  );
}
