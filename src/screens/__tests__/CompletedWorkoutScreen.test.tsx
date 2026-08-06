import { NavigationContainer, usePreventRemove } from '@react-navigation/native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Modal } from 'react-native';

import { DatabaseProvider } from '../../database/DatabaseContext';
import type { Database } from '../../database/types';
import { deleteCompletedWorkout, loadCompletedWorkout } from '../../database/workouts';
import { CompletedWorkoutScreen } from '../CompletedWorkoutScreen';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: jest.fn((node) => node ? 12 : null),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  usePreventRemove: jest.fn(),
}));

jest.mock('../../database/workouts', () => ({ deleteCompletedWorkout: jest.fn(), loadCompletedWorkout: jest.fn() }));

const database = {} as Database;
const mockedLoad = jest.mocked(loadCompletedWorkout);
const mockedDelete = jest.mocked(deleteCompletedWorkout);

beforeEach(() => {
  jest.clearAllMocks();
  mockedDelete.mockResolvedValue({ focusWorkoutId: null });
});

test('shows the exact read-only completed result in saved card order', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    completedAt: '2026-08-05T10:30:00Z',
    exercises: [
      { id: 4, exerciseId: 5, name: 'Knebøy', position: 0, sets: [
        { id: 7, loadKg: 80, repetitions: 5, confirmedAt: '2026-08-05T10:00:00Z' },
      ] },
      { id: 8, exerciseId: 9, name: 'Benkpress', position: 1, sets: [
        { id: 10, loadKg: 60, repetitions: 8, confirmedAt: '2026-08-05T10:05:00Z' },
      ] },
    ],
  });
  renderScreen();

  expect(await screen.findByRole('header', { name: 'Fullført økt' })).toBeOnTheScreen();
  expect(screen.getByText(/5. august 2026/)).toBeOnTheScreen();
  const headers = screen.getAllByRole('header').map((node) => node.props.children);
  expect(headers).toEqual(['Fullført økt', 'Knebøy', 'Benkpress']);
  expect(screen.getByLabelText('Sett 1, 5 repetisjoner med 80 kilogram')).toBeOnTheScreen();
  expect(screen.getByLabelText('Sett 1, 8 repetisjoner med 60 kilogram')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Rediger' })).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Slett økt' })).toBeOnTheScreen();
});

test('requires explicit confirmation and cancellation preserves the workout', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue({ id: 3, completedAt: '2026-08-05T10:30:00Z', exercises: [] });
  const view = renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Slett økt' }));
  expect(screen.getByRole('header', { name: 'Slett fullført økt?' })).toBeOnTheScreen();
  fireEvent(view.UNSAFE_getByType(Modal), 'show');
  expect(focus).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'Avbryt' }));

  expect(mockedDelete).not.toHaveBeenCalled();
  expect(screen.getByRole('header', { name: 'Fullført økt' })).toBeOnTheScreen();
  await waitFor(() => expect(focus).toHaveBeenCalledTimes(2));
});

test('blocks confirmation actions while deletion is pending', async () => {
  mockedLoad.mockResolvedValue({ id: 3, completedAt: '2026-08-05T10:30:00Z', exercises: [] });
  mockedDelete.mockImplementation(() => new Promise(() => undefined));
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Slett økt' }));
  fireEvent.press(screen.getByRole('button', { name: 'Slett' }));

  expect(await screen.findByRole('button', { name: 'Sletter økt' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Avbryt' })).toBeDisabled();
});

test('deletes a post-completion workout before replacing detail with focused history', async () => {
  const replace = jest.fn();
  mockedLoad.mockResolvedValue({ id: 3, completedAt: '2026-08-05T10:30:00Z', exercises: [] });
  mockedDelete.mockResolvedValue({ focusWorkoutId: 2 });
  renderScreen({ replace });

  fireEvent.press(await screen.findByRole('button', { name: 'Slett økt' }));
  fireEvent.press(screen.getByRole('button', { name: 'Slett' }));

  await waitFor(() => expect(replace).toHaveBeenCalledWith('History', { focusWorkoutId: 2 }));
  expect(mockedDelete).toHaveBeenCalledWith(database, 3);
});

test('deletes a history workout before popping to focused history', async () => {
  const popTo = jest.fn();
  mockedLoad.mockResolvedValue({ id: 3, completedAt: '2026-08-05T10:30:00Z', exercises: [] });
  mockedDelete.mockResolvedValue({ focusWorkoutId: 2 });
  renderScreen({ popTo }, false);

  fireEvent.press(await screen.findByRole('button', { name: 'Slett økt' }));
  fireEvent.press(screen.getByRole('button', { name: 'Slett' }));

  await waitFor(() => expect(popTo).toHaveBeenCalledWith('History', { focusWorkoutId: 2 }));
  expect(mockedDelete).toHaveBeenCalledWith(database, 3);
});

test('keeps detail, closes confirmation, and offers focused retry after deletion failure', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  const popTo = jest.fn();
  mockedLoad.mockResolvedValue({ id: 3, completedAt: '2026-08-05T10:30:00Z', exercises: [] });
  mockedDelete.mockRejectedValue(new Error('write failed'));
  renderScreen({ popTo });

  fireEvent.press(await screen.findByRole('button', { name: 'Slett økt' }));
  fireEvent.press(screen.getByRole('button', { name: 'Slett' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Kunne ikke slette økten');
  expect(screen.queryByRole('header', { name: 'Slett fullført økt?' })).not.toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Fullført økt' })).toBeOnTheScreen();
  expect(announce).toHaveBeenCalledWith('Kunne ikke slette økten. Prøv igjen.');
  await waitFor(() => expect(focus).toHaveBeenCalled());
  expect(popTo).not.toHaveBeenCalled();
});

test('returns Home from post-completion detail', async () => {
  const popTo = jest.fn();
  mockedLoad.mockResolvedValue({ id: 3, completedAt: '2026-08-05T10:30:00Z', exercises: [] });
  renderScreen({ popTo });

  fireEvent.press(await screen.findByRole('button', { name: 'Tilbake til forsiden' }));
  expect(popTo).toHaveBeenCalledWith('Home', { focusStartWorkout: true });
});

test('shows retry instead of an empty result when loading fails', async () => {
  mockedLoad.mockRejectedValueOnce(new Error('read failed')).mockResolvedValueOnce({
    id: 3, completedAt: '2026-08-05T10:30:00Z', exercises: [],
  });
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Prøv igjen' }));
  await waitFor(() => expect(mockedLoad).toHaveBeenCalledTimes(2));
});

test('distinguishes a missing workout from a retryable load failure', async () => {
  mockedLoad.mockResolvedValue(null);
  renderScreen();

  expect(await screen.findByRole('header', { name: 'Finnes ikke lenger' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Prøv igjen' })).not.toBeOnTheScreen();
});

test('returns to fresh history when a history workout no longer exists', async () => {
  const popTo = jest.fn();
  mockedLoad.mockResolvedValue(null);
  renderScreen({ popTo }, false);

  fireEvent.press(await screen.findByRole('button', { name: 'Tilbake til tidligere økter' }));
  expect(popTo).toHaveBeenCalledWith('History');
});

test('uses ordinary stack Back when opened from history', async () => {
  mockedLoad.mockResolvedValue({ id: 3, completedAt: '2026-08-05T10:30:00Z', exercises: [] });
  renderScreen({}, false);

  await screen.findByRole('header', { name: 'Fullført økt' });
  expect(usePreventRemove).toHaveBeenCalledWith(false, expect.any(Function));
  expect(screen.queryByRole('button', { name: 'Tilbake til forsiden' })).not.toBeOnTheScreen();
});

function renderScreen(navigation: Record<string, jest.Mock> = {}, fromCompletion = true) {
  return render(
    <DatabaseProvider database={database}>
      <NavigationContainer>
        <CompletedWorkoutScreen
          navigation={{ dispatch: jest.fn(), popTo: jest.fn(), replace: jest.fn(), ...navigation } as never}
          route={{ params: { workoutId: 3, fromCompletion } } as never}
        />
      </NavigationContainer>
    </DatabaseProvider>,
  );
}
