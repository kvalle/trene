import { NavigationContainer } from '@react-navigation/native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, type AppStateStatus, Modal } from 'react-native';
import * as Haptics from 'expo-haptics';

import { AppThemeProvider } from '../../ui/AppThemeProvider';
import { DatabaseProvider } from '../../database/DatabaseContext';
import type { Database } from '../../database/types';
import {
  addWorkoutSet,
  cancelActiveWorkout,
  completeWorkout,
  confirmWorkoutSet,
  deletePlannedWorkoutSet,
  getActiveWorkoutId,
  loadActiveWorkout,
  removeExerciseFromWorkout,
  savePlannedWorkoutSet,
  unconfirmWorkoutSet,
} from '../../database/workouts';
import { WorkoutScreen } from '../WorkoutScreen';
import { WorkoutDraftProvider } from '../../workoutDrafts';
import { HomeScreen } from '../HomeScreen';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: jest.fn((node) => node ? 12 : null),
}));
jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Error: 'error', Success: 'success' },
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  usePreventRemove: jest.fn(),
}));
jest.mock('../../database/workouts', () => ({
  addWorkoutSet: jest.fn(),
  cancelActiveWorkout: jest.fn(),
  completeWorkout: jest.fn(),
  confirmWorkoutSet: jest.fn(),
  deletePlannedWorkoutSet: jest.fn(),
  getActiveWorkoutId: jest.fn(),
  loadActiveWorkout: jest.fn(),
  removeExerciseFromWorkout: jest.fn(),
  savePlannedWorkoutSet: jest.fn(),
  unconfirmWorkoutSet: jest.fn(),
}));
const database = {} as Database;
const mockedAddSet = jest.mocked(addWorkoutSet);
const mockedLoad = jest.mocked(loadActiveWorkout);
const mockedCancel = jest.mocked(cancelActiveWorkout);
const mockedComplete = jest.mocked(completeWorkout);
const mockedConfirm = jest.mocked(confirmWorkoutSet);
const mockedDelete = jest.mocked(deletePlannedWorkoutSet);
const mockedGetActiveWorkoutIdForSharedDraft = jest.mocked(getActiveWorkoutId);
const mockedSave = jest.mocked(savePlannedWorkoutSet);
const mockedRemoveExercise = jest.mocked(removeExerciseFromWorkout);
const mockedUnconfirm = jest.mocked(unconfirmWorkoutSet);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 1;
  });
});

const workoutWithSets = {
  id: 3,
  exercises: [{
    id: 4, exerciseId: 5, name: 'Knebøy', position: 0,
    sets: [
      { id: 7, loadKg: 80, repetitions: 5, confirmedAt: '2026-01-01T10:00:00Z' },
      { id: 6, loadKg: null, repetitions: null, confirmedAt: null },
    ],
  }],
};

test('shows an active workout and opens its cancellable exercise picker', async () => {
  const navigate = jest.fn();
  const setParams = jest.fn();
  mockedLoad.mockResolvedValue({ id: 3, exercises: [] });
  renderScreen({ navigate, setParams });

  expect(await screen.findByText('Ingen øvelser lagt til ennå', {}, { timeout: 3000 })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Ferdig' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Avbryt' })).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Legg til øvelse' }));
  await waitFor(() => expect(setParams).toHaveBeenCalledWith({ focusAddExercise: true }));
  expect(navigate).toHaveBeenCalledWith('ExercisePicker', { workoutId: 3 });
});

test('opens the selected exercise with an editable planned set', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    exercises: [{
      id: 4, exerciseId: 5, name: 'Knebøy', position: 0,
      sets: [{ id: 6, loadKg: null, repetitions: null, confirmedAt: null }],
    }],
  });
  renderScreen();

  expect(await screen.findByText('Knebøy')).toBeOnTheScreen();
  expect(screen.getByText('Planlagt sett')).toBeOnTheScreen();
  expect(screen.getByLabelText('Belastning for Knebøy')).not.toHaveProp('editable', false);
  expect(screen.getByLabelText('Repetisjoner for Knebøy')).not.toHaveProp('editable', false);
  expect(screen.getByRole('button', { name: 'Legg til sett' })).toBeOnTheScreen();
});

test('exposes every suggested set as editable labeled fields in suggestion order', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    exercises: [{
      id: 4, exerciseId: 5, name: 'Knebøy', position: 0,
      sets: [
        { id: 6, loadKg: 80, repetitions: 5, confirmedAt: null },
        { id: 8, loadKg: 90, repetitions: 3, confirmedAt: null },
      ],
    }],
  });
  renderScreen();

  const loads = await screen.findAllByLabelText('Belastning for Knebøy');
  const repetitions = screen.getAllByLabelText('Repetisjoner for Knebøy');
  expect(loads.map((input) => input.props.value)).toEqual(['80', '90']);
  expect(repetitions.map((input) => input.props.value)).toEqual(['5', '3']);
  expect(screen.getAllByText('Planlagt sett')).toHaveLength(2);
  expect(screen.queryByText('Sett 1')).not.toBeOnTheScreen();
});

test('shows completed receipts above planned sets with derived numbering', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  renderScreen();

  expect(await screen.findByText('Sett 1')).toBeOnTheScreen();
  expect(screen.getByText('80 kg · 5 repetisjoner')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Rediger sett 1' })).toBeOnTheScreen();
  expect(screen.getByText('Planlagt sett')).toBeOnTheScreen();
});

test('enables completion only for durable completed sets and warns about planned sets', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  renderScreen();

  const complete = await screen.findByRole('button', { name: 'Ferdig' });
  expect(complete).toBeEnabled();
  fireEvent.press(complete);

  expect(screen.getByRole('header', { name: 'Fullfør økten?' })).toBeOnTheScreen();
  expect(screen.getByText(
    'Det er sett som ikke er bekreftet. Disse vil bli forkastet om du fortsetter.',
  )).toBeOnTheScreen();
  expect(mockedComplete).not.toHaveBeenCalled();
});

test('keeps completion disabled for a planned-only workout', async () => {
  mockedLoad.mockResolvedValue({
    ...workoutWithSets,
    exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }],
  });
  renderScreen();

  expect(await screen.findByRole('button', { name: 'Ferdig' })).toBeDisabled();
});

test('does not warn about planned sets when all sets are completed', async () => {
  mockedLoad.mockResolvedValue({
    ...workoutWithSets,
    exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[0]] }],
  });
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Ferdig' }));
  expect(screen.queryByText(
    'Det er sett som ikke er bekreftet. Disse vil bli forkastet om du fortsetter.',
  )).not.toBeOnTheScreen();
});

test('focuses completion confirmation and restores focus when it is dismissed', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue(workoutWithSets);
  const { UNSAFE_getAllByType } = renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Ferdig' }));
  fireEvent(UNSAFE_getAllByType(Modal).find((modal) => modal.props.visible)!, 'show');
  fireEvent.press(screen.getByRole('button', { name: 'Fortsett økten' }));

  expect(screen.queryByRole('header', { name: 'Fullfør økten?' })).not.toBeOnTheScreen();
  expect(focus).toHaveBeenCalledTimes(2);
});

test('platform Back dismisses completion confirmation without saving', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  const { UNSAFE_getAllByType } = renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Ferdig' }));
  fireEvent(UNSAFE_getAllByType(Modal).find((modal) => modal.props.visible)!, 'requestClose');

  expect(screen.queryByRole('header', { name: 'Fullfør økten?' })).not.toBeOnTheScreen();
  expect(mockedComplete).not.toHaveBeenCalled();
});

test('blocks completion while relevant data is not durable', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedSave.mockRejectedValue(new Error('write failed'));
  renderScreen();
  const load = await screen.findByLabelText('Belastning for Knebøy');
  fireEvent.changeText(load, '90');
  fireEvent(load, 'blur');

  expect(await screen.findByText('Endringene er ikke lagret')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Ferdig' })).toBeDisabled();
});

test('opens completed detail only after the completion transaction succeeds', async () => {
  let finish: () => void = () => undefined;
  const replace = jest.fn();
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedComplete.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  renderScreen({ replace });

  fireEvent.press(await screen.findByRole('button', { name: 'Ferdig' }));
  fireEvent.press(screen.getByRole('button', { name: 'Fullfør økt' }));
  expect(replace).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Fullfører' })).toBeDisabled();

  finish();
  await waitFor(() => expect(replace).toHaveBeenCalledWith('CompletedWorkout', {
    workoutId: 3, fromCompletion: true,
  }));
});

test('preserves the active workout, announces retry, focuses it, and stays put on completion failure', async () => {
  const replace = jest.fn();
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedComplete.mockRejectedValue(new Error('write failed'));
  renderScreen({ replace });

  fireEvent.press(await screen.findByRole('button', { name: 'Ferdig' }));
  fireEvent.press(screen.getByRole('button', { name: 'Fullfør økt' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Kunne ikke fullføre økten');
  expect(screen.getByRole('button', { name: 'Prøv igjen' })).toBeOnTheScreen();
  expect(screen.getByText('Knebøy')).toBeOnTheScreen();
  expect(announce).toHaveBeenCalledWith('Kunne ikke fullføre økten. Prøv igjen.');
  expect(focus).toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
});

test('adds a separately confirmable set returned by durable storage', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedAddSet.mockResolvedValue({ id: 8, loadKg: 80, repetitions: 5, confirmedAt: null });
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Legg til sett' }));

  await waitFor(() => expect(mockedAddSet).toHaveBeenCalledWith(database, 3, 4));
  expect(screen.getAllByText('Planlagt sett')).toHaveLength(2);
  expect(screen.getAllByLabelText('Belastning for Knebøy')).toHaveLength(2);
  expect(mockedConfirm).not.toHaveBeenCalled();
  expect(Haptics.selectionAsync).toHaveBeenCalled();
});

test('allows only one expanded card and lets it collapse independently', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    exercises: [
      ...workoutWithSets.exercises,
      { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] },
    ],
  });
  renderScreen();

  expect(await screen.findByText('Planlagt sett')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Markløft' }));
  expect(screen.queryByText('Planlagt sett')).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Markløft' })).toHaveProp('accessibilityState', { expanded: true });
  expect(screen.getByRole('button', { name: 'Knebøy' })).toHaveProp('accessibilityState', { expanded: false });
  fireEvent.press(screen.getByRole('button', { name: 'Markløft' }));
  expect(screen.getByRole('button', { name: 'Markløft' })).toHaveProp('accessibilityState', { expanded: false });
});

test('removes a planned-only exercise immediately', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue({
    ...workoutWithSets,
    exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }],
  });
  mockedRemoveExercise.mockResolvedValue();
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Fjern Knebøy fra økten' }));

  await waitFor(() => expect(mockedRemoveExercise).toHaveBeenCalledWith(database, 3, 4));
  expect(screen.queryByRole('header', { name: 'Fjern øvelsen?' })).not.toBeOnTheScreen();
  expect(screen.getByText('Ingen øvelser lagt til ennå')).toBeOnTheScreen();
  expect(focus).toHaveBeenCalled();
});

test('requires confirmation before removing an exercise with completed sets', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedRemoveExercise.mockResolvedValue();
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Fjern Knebøy fra økten' }));
  expect(screen.getByRole('header', { name: 'Fjern øvelsen?' })).toBeOnTheScreen();
  expect(mockedRemoveExercise).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Bekreft fjerning av øvelsen' }));

  await waitFor(() => expect(mockedRemoveExercise).toHaveBeenCalledWith(database, 3, 4));
  expect(screen.getByText('Ingen øvelser lagt til ennå')).toBeOnTheScreen();
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
});

test('closes the removal modal before unmounting its focus launcher', async () => {
  const frames: FrameRequestCallback[] = [];
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedRemoveExercise.mockResolvedValue();
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Fjern Knebøy fra økten' }));
  fireEvent.press(screen.getByRole('button', { name: 'Bekreft fjerning av øvelsen' }));

  await waitFor(() => expect(mockedRemoveExercise).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText('Fjern øvelsen?')).not.toBeOnTheScreen());
  expect(screen.getByText('Knebøy')).toBeOnTheScreen();

  await act(async () => frames.shift()?.(0));
  expect(screen.queryByText('Knebøy')).not.toBeOnTheScreen();
  expect(screen.getByText('Ingen øvelser lagt til ennå')).toBeOnTheScreen();
});

test('shows busy removal state and restores focus when removal is cancelled', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  let finishRemove: () => void = () => undefined;
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedRemoveExercise.mockImplementation(() => new Promise<void>((resolve) => { finishRemove = resolve; }));
  const { UNSAFE_getAllByType } = renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Fjern Knebøy fra økten' }));
  fireEvent.press(screen.getByRole('button', { name: 'Behold øvelsen' }));
  expect(screen.queryByText('Fjern øvelsen?')).not.toBeOnTheScreen();
  expect(focus).toHaveBeenCalled();

  fireEvent.press(screen.getByRole('button', { name: 'Fjern Knebøy fra økten' }));
  fireEvent.press(screen.getByRole('button', { name: 'Bekreft fjerning av øvelsen' }));
  expect(await screen.findByRole('button', { name: 'Bekreft fjerning av øvelsen' })).toBeDisabled();
  expect(screen.getByText('Fjerner øvelse')).toBeOnTheScreen();
  fireEvent(UNSAFE_getAllByType(Modal)[0], 'requestClose');
  expect(screen.getByText('Fjern øvelsen?')).toBeOnTheScreen();
  await act(async () => finishRemove());
});

test('keeps the card and offers retry when adding a set fails', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedAddSet.mockRejectedValueOnce(new Error('write failed')).mockResolvedValueOnce({
    id: 8, loadKg: 80, repetitions: 5, confirmedAt: null,
  });
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Legg til sett' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Kunne ikke legge til settet. Prøv igjen.');
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
  expect(focus).toHaveBeenCalled();
  expect(screen.getByText('Knebøy')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Prøv igjen' }));

  await waitFor(() => expect(mockedAddSet).toHaveBeenCalledTimes(2));
  expect(screen.getAllByText('Planlagt sett')).toHaveLength(2);
});

test('keeps the exercise and offers retry when removal fails', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue({
    ...workoutWithSets,
    exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }],
  });
  mockedRemoveExercise.mockRejectedValueOnce(new Error('write failed')).mockResolvedValueOnce();
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Fjern Knebøy fra økten' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Kunne ikke fjerne øvelsen. Prøv igjen.');
  expect(focus).toHaveBeenCalled();
  expect(screen.getByText('Knebøy')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Prøv igjen' }));

  await waitFor(() => expect(mockedRemoveExercise).toHaveBeenCalledTimes(2));
  expect(screen.getByText('Ingen øvelser lagt til ennå')).toBeOnTheScreen();
});

test('keeps core controls at accessible target sizes and vertically stackable at narrow widths', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  renderScreen();

  const card = await screen.findByRole('button', { name: 'Knebøy' });
  const addSet = screen.getByRole('button', { name: 'Legg til sett' });
  expect(card).toHaveStyle({ minHeight: 48 });
  expect(addSet).toHaveStyle({ minHeight: 50 });
  expect(screen.getByLabelText('Handlinger for planlagt sett for Knebøy')).not.toHaveStyle({ flexDirection: 'row' });
});

test('validates input and atomically confirms comma decimals', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }] });
  mockedConfirm.mockResolvedValue();
  renderScreen();
  const load = await screen.findByLabelText('Belastning for Knebøy');
  const repetitions = screen.getByLabelText('Repetisjoner for Knebøy');

  fireEvent.changeText(load, '1000');
  fireEvent.changeText(repetitions, '0');
  fireEvent.press(screen.getByRole('button', { name: 'Bekreft planlagt sett for Knebøy' }));
  expect(await screen.findAllByRole('alert')).toHaveLength(2);
  expect(load).toHaveProp('aria-invalid', true);
  expect(repetitions).toHaveProp('aria-invalid', true);
  expect(focus).toHaveBeenCalled();
  expect(mockedConfirm).not.toHaveBeenCalled();

  fireEvent.changeText(load, '80,5');
  fireEvent.changeText(repetitions, '5');
  fireEvent.press(screen.getByRole('button', { name: 'Bekreft planlagt sett for Knebøy' }));
  await waitFor(() => expect(mockedConfirm).toHaveBeenCalledWith(database, 3, 6, 80.5, 5, expect.any(String)));
});

test('keeps a failed valid autosave visible until manual retry succeeds', async () => {
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }] });
  mockedSave.mockRejectedValueOnce(new Error('write failed')).mockResolvedValueOnce();
  renderScreen();
  const load = await screen.findByLabelText('Belastning for Knebøy');

  fireEvent.changeText(load, '80');
  fireEvent(load, 'blur');
  expect(await screen.findByText('Endringene er ikke lagret')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Bekreft planlagt sett for Knebøy' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Prøv å lagre igjen' }));

  await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('Endringene er ikke lagret')).not.toBeOnTheScreen();
});

test('focuses manual retry after autosave fails', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }] });
  mockedSave.mockRejectedValue(new Error('write failed'));
  renderScreen();
  const load = await screen.findByLabelText('Belastning for Knebøy');

  fireEvent.changeText(load, '80');
  fireEvent(load, 'blur');

  expect(await screen.findByRole('button', { name: 'Prøv å lagre igjen' })).toBeOnTheScreen();
  expect(focus).toHaveBeenCalled();
});

test('serializes field autosaves', async () => {
  let finishFirst: () => void = () => undefined;
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }] });
  mockedSave.mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; })).mockResolvedValueOnce();
  renderScreen();
  const load = await screen.findByLabelText('Belastning for Knebøy');
  const repetitions = screen.getByLabelText('Repetisjoner for Knebøy');
  fireEvent.changeText(load, '80');
  fireEvent.changeText(repetitions, '5');

  fireEvent(load, 'blur');
  fireEvent(repetitions, 'blur');
  await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(1));
  finishFirst();

  await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(2));
});

test('persists valid drafts before backgrounding', async () => {
  let onAppStateChange: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    onAppStateChange = listener;
    return { remove: jest.fn() };
  });
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }] });
  mockedSave.mockResolvedValue();
  renderScreen();
  fireEvent.changeText(await screen.findByLabelText('Belastning for Knebøy'), '80');
  fireEvent.changeText(screen.getByLabelText('Repetisjoner for Knebøy'), '5');

  act(() => onAppStateChange?.('background'));

  await waitFor(() => expect(mockedSave).toHaveBeenCalledWith(database, 3, 6, 80, 5));
});

test('reloads the active workout from SQLite on foreground', async () => {
  let onAppStateChange: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    onAppStateChange = listener;
    return { remove: jest.fn() };
  });
  mockedLoad.mockResolvedValueOnce({ id: 3, exercises: [] }).mockResolvedValueOnce(workoutWithSets);
  renderScreen();
  expect(await screen.findByText('Ingen øvelser lagt til ennå')).toBeOnTheScreen();

  act(() => onAppStateChange?.('active'));

  expect(await screen.findByText('Knebøy')).toBeOnTheScreen();
  expect(mockedLoad).toHaveBeenCalledTimes(2);
});

test('waits for every background save before foreground reload', async () => {
  let onAppStateChange: ((state: AppStateStatus) => void) | undefined;
  let finishFirst: () => void = () => undefined;
  let finishSecond: () => void = () => undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    onAppStateChange = listener;
    return { remove: jest.fn() };
  });
  const twoPlannedSets = {
    ...workoutWithSets,
    exercises: [{
      ...workoutWithSets.exercises[0],
      sets: [
        workoutWithSets.exercises[0].sets[1],
        { id: 8, loadKg: null, repetitions: null, confirmedAt: null },
      ],
    }],
  };
  mockedLoad.mockResolvedValue(twoPlannedSets);
  mockedSave
    .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; }))
    .mockImplementationOnce(() => new Promise<void>((resolve) => { finishSecond = resolve; }));
  renderScreen();
  const loads = await screen.findAllByLabelText('Belastning for Knebøy');
  fireEvent.changeText(loads[0], '80');
  fireEvent.changeText(loads[1], '90');

  act(() => onAppStateChange?.('background'));
  await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(1));
  act(() => onAppStateChange?.('active'));
  await act(async () => finishFirst());
  await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(2));
  expect(mockedLoad).toHaveBeenCalledTimes(1);

  await act(async () => finishSecond());
  await waitFor(() => expect(mockedLoad).toHaveBeenCalledTimes(2));
});

test('does not retry a failed background save on foreground', async () => {
  let onAppStateChange: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    onAppStateChange = listener;
    return { remove: jest.fn() };
  });
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }] });
  mockedSave.mockRejectedValue(new Error('write failed'));
  renderScreen();
  fireEvent.changeText(await screen.findByLabelText('Belastning for Knebøy'), '80');

  act(() => onAppStateChange?.('background'));
  expect(await screen.findByText('Endringene er ikke lagret')).toBeOnTheScreen();
  act(() => onAppStateChange?.('active'));

  await waitFor(() => expect(mockedLoad).toHaveBeenCalledTimes(2));
  expect(mockedSave).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Prøv å lagre igjen' })).toBeOnTheScreen();
});

test('stops queued autosaves after failure until manual retry', async () => {
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }] });
  mockedSave.mockRejectedValueOnce(new Error('write failed')).mockResolvedValue();
  renderScreen();
  const load = await screen.findByLabelText('Belastning for Knebøy');
  const repetitions = screen.getByLabelText('Repetisjoner for Knebøy');
  fireEvent.changeText(load, '80');
  fireEvent.changeText(repetitions, '5');

  fireEvent(load, 'blur');
  fireEvent(repetitions, 'blur');

  expect(await screen.findByText('Endringene er ikke lagret')).toBeOnTheScreen();
  await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByRole('button', { name: 'Prøv å lagre igjen' }));
  await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(2));
});

test('retains a failed draft across Home and reopening the workout', async () => {
  mockedGetActiveWorkoutIdForSharedDraft.mockResolvedValue(3);
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }] });
  mockedSave.mockRejectedValue(new Error('write failed'));
  const view = renderSharedScreen('workout');
  const load = await screen.findByLabelText('Belastning for Knebøy');
  fireEvent.changeText(load, '80');
  fireEvent(load, 'blur');
  expect(await screen.findByText('Endringene er ikke lagret')).toBeOnTheScreen();

  view.rerender(sharedScreen('home'));
  expect(await screen.findByText('Økten har endringer som ikke er lagret')).toBeOnTheScreen();
  expect(screen.getByTestId('home-unsaved-warning').props.accessibilityRole).toBe('alert');
  view.rerender(sharedScreen('workout'));
  const reopenedLoad = await screen.findByLabelText('Belastning for Knebøy');
  expect(reopenedLoad).toHaveProp('value', '80');
  expect(screen.getByRole('button', { name: 'Prøv å lagre igjen' })).toBeOnTheScreen();
  fireEvent(reopenedLoad, 'blur');
  await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(1));
});

test('focuses retry after a set mutation fails', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedUnconfirm.mockRejectedValue(new Error('write failed'));
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Rediger sett 1' }));

  expect(await screen.findByRole('button', { name: 'Prøv igjen' })).toBeOnTheScreen();
  expect(focus).toHaveBeenCalled();
});

test('persists a valid field without overwriting invalid input in the other field', async () => {
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }] });
  mockedSave.mockResolvedValue();
  renderScreen();
  const load = await screen.findByLabelText('Belastning for Knebøy');
  const repetitions = screen.getByLabelText('Repetisjoner for Knebøy');

  fireEvent.changeText(load, '80,5');
  fireEvent.changeText(repetitions, 'ugyldig');
  fireEvent(load, 'blur');

  await waitFor(() => expect(mockedSave).toHaveBeenCalledWith(database, 3, 6, 80.5, null));
  expect(repetitions).toHaveProp('value', 'ugyldig');
});

test('retains values with visible retry after confirmation fails', async () => {
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }] });
  mockedConfirm.mockRejectedValue(new Error('write failed'));
  renderScreen();
  const load = await screen.findByLabelText('Belastning for Knebøy');
  const repetitions = screen.getByLabelText('Repetisjoner for Knebøy');
  fireEvent.changeText(load, '80');
  fireEvent.changeText(repetitions, '5');

  fireEvent.press(screen.getByRole('button', { name: 'Bekreft planlagt sett for Knebøy' }));

  expect(await screen.findByText('Kunne ikke bekrefte settet')).toBeOnTheScreen();
  expect(load).toHaveProp('value', '80');
  expect(repetitions).toHaveProp('value', '5');
  expect(screen.queryByText('Sett 1')).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Prøv å bekrefte igjen' })).toBeOnTheScreen();
});

test('unconfirms before editing and deletes the preserved planned set', async () => {
  mockedLoad.mockResolvedValueOnce(workoutWithSets).mockResolvedValueOnce({
    ...workoutWithSets,
    exercises: [{ ...workoutWithSets.exercises[0], sets: [{ ...workoutWithSets.exercises[0].sets[0], confirmedAt: null }] }],
  }).mockResolvedValueOnce({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [] }] });
  mockedUnconfirm.mockResolvedValue();
  mockedDelete.mockResolvedValue();
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Rediger sett 1' }));
  await waitFor(() => expect(mockedUnconfirm).toHaveBeenCalledWith(database, 3, 7));
  fireEvent.press((await screen.findAllByRole('button', { name: 'Slett planlagt sett for Knebøy' }))[1]);
  await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith(database, 3, 7));
});

test.each([
  ['empty', []],
  ['populated', [{ id: 4, exerciseId: 5, name: 'Knebøy', position: 0, sets: [] }]],
])('confirms cancellation of an %s workout before returning Home', async (_, exercises) => {
  const popTo = jest.fn();
  mockedLoad.mockResolvedValue({ id: 3, exercises });
  mockedCancel.mockResolvedValue();
  renderScreen({ popTo });

  fireEvent.press(await screen.findByRole('button', { name: 'Avbryt' }));
  expect(screen.getByRole('header', { name: 'Avbryt økten?' })).toBeOnTheScreen();
  expect(screen.getByText('Økten slettes permanent og vises ikke i historikken.')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Avbryt økten' }));

  await waitFor(() => expect(mockedCancel).toHaveBeenCalledWith(database, 3));
  expect(popTo).toHaveBeenCalledWith('Home', { focusStartWorkout: true });
});

test('closes the dialog without deleting and restores focus to Avbryt', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue({ id: 3, exercises: [] });
  const { UNSAFE_getByType } = renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Avbryt' }));
  expect(UNSAFE_getByType(Modal).props.onShow).toEqual(expect.any(Function));
  fireEvent.press(screen.getByRole('button', { name: 'Behold økten' }));

  expect(screen.queryByText('Avbryt økten?')).not.toBeOnTheScreen();
  expect(mockedCancel).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Avbryt' })).toBeOnTheScreen();
  expect(focus).toHaveBeenCalled();
});

test('platform Back closes the confirmation dialog first', async () => {
  mockedLoad.mockResolvedValue({ id: 3, exercises: [] });
  const { UNSAFE_getByType } = renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Avbryt' }));
  fireEvent(UNSAFE_getByType(Modal), 'requestClose');

  expect(screen.queryByText('Avbryt økten?')).not.toBeOnTheScreen();
  expect(mockedCancel).not.toHaveBeenCalled();
});

test('preserves the workout, announces retry, and does not navigate when cancellation fails', async () => {
  const popTo = jest.fn();
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue({ id: 3, exercises: [] });
  mockedCancel.mockRejectedValue(new Error('write failed'));
  renderScreen({ popTo });

  fireEvent.press(await screen.findByRole('button', { name: 'Avbryt' }));
  fireEvent.press(screen.getByRole('button', { name: 'Avbryt økten' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Kunne ikke avbryte økten');
  expect(screen.queryByText('Avbryt økten?')).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Prøv igjen' })).toBeOnTheScreen();
  expect(announce).toHaveBeenCalledWith('Kunne ikke avbryte økten. Prøv igjen.');
  expect(focus).toHaveBeenCalled();
  expect(popTo).not.toHaveBeenCalled();
});

function renderScreen(navigation: Record<string, jest.Mock> = {}) {
  const mergedNavigation = { navigate: jest.fn(), popTo: jest.fn(), replace: jest.fn(), setParams: jest.fn(), ...navigation };
  return render(
    <AppThemeProvider>
      <DatabaseProvider database={database}>
        <WorkoutDraftProvider>
          <NavigationContainer>
            <WorkoutScreen
            navigation={mergedNavigation as never}
            route={{ params: undefined } as never}
          />
          </NavigationContainer>
        </WorkoutDraftProvider>
      </DatabaseProvider>
    </AppThemeProvider>,
  );
}

function sharedScreen(screenName: 'home' | 'workout') {
  return (
    <AppThemeProvider>
      <DatabaseProvider database={database}>
        <WorkoutDraftProvider>
          <NavigationContainer>
          {screenName === 'home' ? (
            <HomeScreen navigation={{ navigate: jest.fn() } as never} route={{ params: undefined } as never} />
          ) : (
            <WorkoutScreen
              navigation={{ navigate: jest.fn(), popTo: jest.fn(), setParams: jest.fn() } as never}
              route={{ params: undefined } as never}
            />
          )}
          </NavigationContainer>
        </WorkoutDraftProvider>
      </DatabaseProvider>
    </AppThemeProvider>
  );
}

function renderSharedScreen(screenName: 'home' | 'workout') {
  return render(sharedScreen(screenName));
}
