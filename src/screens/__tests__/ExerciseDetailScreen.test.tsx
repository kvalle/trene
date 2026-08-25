import { NavigationContainer, usePreventRemove } from '@react-navigation/native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Modal, TextInput } from 'react-native';

import { DatabaseProvider } from '../../database/DatabaseContext';
import {
  deleteExercise,
  DuplicateExerciseNameError,
  DUPLICATE_EXERCISE_NAME,
  ExerciseDeletionIneligibleError,
  ExerciseNotFoundError,
  loadExerciseDetail,
  renameExercise,
  type ExerciseDetail,
} from '../../database/exercises';
import type { Database } from '../../database/types';
import { EXERCISE_NAME_REQUIRED, EXERCISE_NAME_TOO_LONG } from '../../domain/exerciseName';
import { ExerciseDetailScreen } from '../ExerciseDetailScreen';
import { AppThemeProvider } from '../../ui/AppThemeProvider';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: jest.fn((node) => node ? 12 : null),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  usePreventRemove: jest.fn(),
}));
jest.mock('../../database/exercises', () => ({
  ...jest.requireActual('../../database/exercises'),
  deleteExercise: jest.fn(),
  loadExerciseDetail: jest.fn(),
  renameExercise: jest.fn(),
}));

const database = {} as Database;
const mockedDelete = jest.mocked(deleteExercise);
const mockedLoad = jest.mocked(loadExerciseDetail);
const mockedRename = jest.mocked(renameExercise);
const exercise: ExerciseDetail = {
  id: 7,
  name: 'Knebøy',
  canDelete: true,
  history: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedLoad.mockResolvedValue(exercise);
  mockedRename.mockResolvedValue();
  mockedDelete.mockResolvedValue({ focusExerciseId: null });
});

test('renders newest-first workout groups and every completed set in supplied order', async () => {
  mockedLoad.mockResolvedValue({
    ...exercise,
    canDelete: false,
    history: [
      {
        id: 11,
        completedAt: '2026-08-05T10:30:00Z',
        sets: [
          { id: 21, loadKg: 80, repetitions: 5, confirmedAt: '2026-08-05T10:00:00Z' },
          { id: 22, loadKg: 82.5, repetitions: 4, confirmedAt: '2026-08-05T10:05:00Z' },
        ],
      },
      {
        id: 10,
        completedAt: '2026-08-04T09:00:00Z',
        sets: [{ id: 20, loadKg: 75, repetitions: 8, confirmedAt: '2026-08-04T08:30:00Z' }],
      },
    ],
  });
  renderScreen();

  await screen.findByRole('header', { name: 'Knebøy' });
  const headers = screen.getAllByRole('header').map((node) => String(node.props.children));
  expect(headers[0]).toBe('Knebøy');
  expect(headers[1]).toBe('Endre navn');
  expect(headers[2]).toBe('Historikk');
  expect(headers[3]).toMatch(/5. august 2026/);
  expect(headers[4]).toMatch(/4. august 2026/);
  expect(screen.getByLabelText('Sett 1, 5 repetisjoner med 80 kilogram')).toBeOnTheScreen();
  expect(screen.getByLabelText('Sett 2, 4 repetisjoner med 82,5 kilogram')).toBeOnTheScreen();
  expect(screen.getByLabelText('Sett 1, 8 repetisjoner med 75 kilogram')).toBeOnTheScreen();
});

test('shows the exact no-history message while keeping management available', async () => {
  renderScreen();

  expect(await screen.findByText('Ingen fullførte økter med denne øvelsen ennå')).toBeOnTheScreen();
  expect(screen.getByLabelText('Navn')).toHaveDisplayValue('Knebøy');
  expect(screen.getByRole('button', { name: 'Slett øvelse' })).toBeOnTheScreen();
});

test.each([
  ['', EXERCISE_NAME_REQUIRED],
  ['x'.repeat(101), EXERCISE_NAME_TOO_LONG],
])('validates rename draft %p without writing', async (draft, message) => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  renderScreen();

  fireEvent.changeText(await screen.findByLabelText('Navn'), draft);
  fireEvent.press(screen.getByRole('button', { name: 'Lagre navn' }));

  expect(screen.getByRole('alert')).toHaveTextContent(message);
  expect(screen.getByLabelText(`Navn. Feil: ${message}`)).toHaveDisplayValue(draft);
  expect(announce).toHaveBeenCalledWith(message);
  expect(mockedRename).not.toHaveBeenCalled();
});

test('normalizes and persists a valid rename before updating the displayed identity', async () => {
  renderScreen();

  fireEvent.changeText(await screen.findByLabelText('Navn'), '  NY\tKNEBØY  ');
  fireEvent.press(screen.getByRole('button', { name: 'Lagre navn' }));

  await waitFor(() => expect(mockedRename).toHaveBeenCalledWith(database, 7, 'NY KNEBØY', 'ny knebøy'));
  expect(screen.getByRole('header', { name: 'NY KNEBØY' })).toBeOnTheScreen();
  expect(screen.getByLabelText('Navn')).toHaveDisplayValue('NY KNEBØY');
});

test.each([
  [new DuplicateExerciseNameError(), DUPLICATE_EXERCISE_NAME],
  [new Error('write failed'), 'Kunne ikke endre navnet. Prøv igjen.'],
])('retains and focuses the draft after rename failure', async (failure, message) => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  const focus = jest.spyOn(TextInput.prototype, 'focus');
  mockedRename.mockRejectedValue(failure);
  renderScreen();

  const input = await screen.findByLabelText('Navn');
  fireEvent.changeText(input, 'NY KNEBØY');
  fireEvent.press(screen.getByRole('button', { name: 'Lagre navn' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(message);
  expect(screen.getByDisplayValue('NY KNEBØY')).toHaveProp('accessibilityLabel', `Navn. Feil: ${message}`);
  expect(screen.getByRole('header', { name: 'Knebøy' })).toBeOnTheScreen();
  expect(announce).toHaveBeenCalledWith(message);
  expect(focus).toHaveBeenCalled();
});

test('ignores repeated rename submissions before disabled state renders', async () => {
  mockedRename.mockImplementation(() => new Promise(() => undefined));
  renderScreen();

  fireEvent.changeText(await screen.findByLabelText('Navn'), 'Ny knebøy');
  const save = screen.getByRole('button', { name: 'Lagre navn' });
  fireEvent.press(save);
  fireEvent.press(save);

  expect(mockedRename).toHaveBeenCalledTimes(1);
});

test('hides deletion when the exercise has active or completed references', async () => {
  mockedLoad.mockResolvedValue({ ...exercise, canDelete: false });
  renderScreen();

  await screen.findByRole('header', { name: 'Knebøy' });
  expect(screen.queryByRole('button', { name: 'Slett øvelse' })).not.toBeOnTheScreen();
});

test('uses a named destructive dialog and cancellation returns focus to its launcher', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  const view = renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Slett øvelse' }));
  expect(screen.getByRole('header', { name: 'Slett Knebøy?' })).toBeOnTheScreen();
  expect(screen.getByText('Øvelsen slettes permanent. Dette kan ikke angres.')).toBeOnTheScreen();
  fireEvent(view.UNSAFE_getByType(Modal), 'show');
  expect(focus).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'Avbryt' }));

  expect(mockedDelete).not.toHaveBeenCalled();
  expect(screen.queryByRole('header', { name: 'Slett Knebøy?' })).not.toBeOnTheScreen();
  await waitFor(() => expect(focus).toHaveBeenCalledTimes(2));
});

test.each([
  [8, { focusExerciseId: 8 }],
  [null, { focusEmptyAction: true }],
] as const)('deletes before returning to the list with focus target %p', async (focusExerciseId, params) => {
  const popTo = jest.fn();
  mockedDelete.mockResolvedValue({ focusExerciseId });
  renderScreen({ popTo });

  fireEvent.press(await screen.findByRole('button', { name: 'Slett øvelse' }));
  fireEvent.press(screen.getByRole('button', { name: 'Slett' }));

  await waitFor(() => expect(popTo).toHaveBeenCalledWith('Exercises', params));
  expect(mockedDelete).toHaveBeenCalledWith(database, 7);
});

test('blocks rename, dialog cancellation, and navigation while deletion is pending', async () => {
  let preventRemove: ((event: { data: { action: object } }) => void) | undefined;
  jest.mocked(usePreventRemove).mockImplementation((_, callback) => { preventRemove = callback as typeof preventRemove; });
  mockedDelete.mockImplementation(() => new Promise(() => undefined));
  const dispatch = jest.fn();
  renderScreen({ dispatch });

  fireEvent.press(await screen.findByRole('button', { name: 'Slett øvelse' }));
  fireEvent.press(screen.getByRole('button', { name: 'Slett' }));

  expect(await screen.findByRole('button', { name: 'Sletter øvelse' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Avbryt' })).toBeDisabled();
  expect(screen.getByLabelText('Navn')).toBeDisabled();
  act(() => preventRemove?.({ data: { action: {} } }));
  expect(dispatch).not.toHaveBeenCalled();
});

test('keeps detail, closes confirmation, and offers focused retry after deletion failure', async () => {
  let focusFrame: FrameRequestCallback | undefined;
  const requestFrame = jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
    focusFrame = callback;
    return 1;
  });
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  try {
    mockedDelete.mockRejectedValue(new Error('write failed'));
    renderScreen();

    fireEvent.press(await screen.findByRole('button', { name: 'Slett øvelse' }));
    fireEvent.press(screen.getByRole('button', { name: 'Slett' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('!Kunne ikke slette øvelsen');
    expect(screen.queryByRole('header', { name: 'Slett Knebøy?' })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Prøv igjen' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Lukk' })).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('Kunne ikke slette øvelsen. Prøv igjen.');
    expect(focusFrame).toBeDefined();
    act(() => focusFrame?.(0));
    expect(focus).toHaveBeenCalled();
  } finally {
    requestFrame.mockRestore();
  }
});

test('dismisses deletion failure and returns focus to delete', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedDelete.mockRejectedValue(new Error('write failed'));
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Slett øvelse' }));
  fireEvent.press(screen.getByRole('button', { name: 'Slett' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Lukk' }));

  expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Knebøy' })).toBeOnTheScreen();
  await waitFor(() => expect(focus).toHaveBeenCalled());
});

test('reloads detail after an eligibility race while preserving retryable failure feedback', async () => {
  mockedLoad
    .mockResolvedValueOnce(exercise)
    .mockResolvedValueOnce({ ...exercise, canDelete: false });
  mockedDelete.mockRejectedValue(new ExerciseDeletionIneligibleError());
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Slett øvelse' }));
  fireEvent.press(screen.getByRole('button', { name: 'Slett' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('!Kunne ikke slette øvelsen');
  fireEvent.press(screen.getByRole('button', { name: 'Prøv igjen' }));
  await waitFor(() => expect(mockedLoad).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('button', { name: 'Slett øvelse' })).not.toBeOnTheScreen();
});

test.each([
  ['rename', () => mockedRename.mockRejectedValue(new ExerciseNotFoundError())],
  ['delete', () => mockedDelete.mockRejectedValue(new ExerciseNotFoundError())],
] as const)('shows a fresh-list route when the exercise disappears during %s', async (operation, reject) => {
  reject();
  const popTo = jest.fn();
  renderScreen({ popTo });

  if (operation === 'rename') {
    fireEvent.changeText(await screen.findByLabelText('Navn'), 'Ny knebøy');
    fireEvent.press(screen.getByRole('button', { name: 'Lagre navn' }));
  } else {
    fireEvent.press(await screen.findByRole('button', { name: 'Slett øvelse' }));
    fireEvent.press(screen.getByRole('button', { name: 'Slett' }));
  }

  fireEvent.press(await screen.findByRole('button', { name: 'Tilbake til øvelser' }));
  expect(popTo).toHaveBeenCalledWith('Exercises');
  expect(screen.queryByRole('button', { name: 'Prøv igjen' })).not.toBeOnTheScreen();
});

test('distinguishes missing detail from a retryable read failure', async () => {
  mockedLoad.mockRejectedValueOnce(new Error('read failed')).mockResolvedValueOnce(null);
  renderScreen();

  expect(await screen.findByRole('alert')).toHaveTextContent('Kunne ikke laste inn øvelsen.');
  expect(mockedLoad).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'Prøv igjen' }));

  expect(await screen.findByRole('header', { name: 'Finnes ikke lenger' })).toBeOnTheScreen();
  expect(mockedLoad).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('button', { name: 'Prøv igjen' })).not.toBeOnTheScreen();
});

function renderScreen(navigation: Record<string, jest.Mock> = {}) {
  return render(
    <DatabaseProvider database={database}>
      <AppThemeProvider scheme="light">
        <NavigationContainer>
          <ExerciseDetailScreen
            navigation={{ dispatch: jest.fn(), popTo: jest.fn(), ...navigation } as never}
            route={{ params: { exerciseId: 7 } } as never}
          />
        </NavigationContainer>
      </AppThemeProvider>
    </DatabaseProvider>,
  );
}
