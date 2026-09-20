import { NavigationContainer, usePreventRemove } from '@react-navigation/native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, type AppStateStatus, Keyboard, LayoutAnimation, Modal } from 'react-native';
import * as Haptics from 'expo-haptics';

import { AppThemeProvider } from '../../ui/AppThemeProvider';
import { DatabaseProvider } from '../../database/DatabaseContext';
import type { Database } from '../../database/types';
import {
  addWorkoutSet,
  cancelActiveWorkout,
  completeWorkout,
  confirmWorkoutSet,
  deleteCompletedWorkoutSet,
  deletePlannedWorkoutSet,
  getActiveWorkoutId,
  loadActiveWorkout,
  removeExerciseFromWorkout,
  reorderActiveWorkoutExercises,
  saveCompletedWorkoutSet,
  savePlannedWorkoutSet,
  unconfirmWorkoutSet,
} from '../../database/workouts';
import { WorkoutScreen } from '../WorkoutScreen';
import { TrainingDataDeletionProvider } from '../../trainingDataDeletion';
import { WorkoutSetDraftProvider } from '../../workoutSetDrafts';
import { HomeScreen } from '../HomeScreen';
import { lightColors, typography } from '../../theme';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: jest.fn((node) => node ? 12 : null),
}));
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Error: 'error', Success: 'success' },
  impactAsync: jest.fn(),
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
  deleteCompletedWorkoutSet: jest.fn(),
  deletePlannedWorkoutSet: jest.fn(),
  getActiveWorkoutId: jest.fn(),
  loadActiveWorkout: jest.fn(),
  removeExerciseFromWorkout: jest.fn(),
  reorderActiveWorkoutExercises: jest.fn(),
  saveCompletedWorkoutSet: jest.fn(),
  savePlannedWorkoutSet: jest.fn(),
  unconfirmWorkoutSet: jest.fn(),
}));
const database = {} as Database;
const mockedAddSet = jest.mocked(addWorkoutSet);
const mockedLoad = jest.mocked(loadActiveWorkout);
const mockedCancel = jest.mocked(cancelActiveWorkout);
const mockedComplete = jest.mocked(completeWorkout);
const mockedConfirm = jest.mocked(confirmWorkoutSet);
const mockedDeleteCompleted = jest.mocked(deleteCompletedWorkoutSet);
const mockedDelete = jest.mocked(deletePlannedWorkoutSet);
const mockedGetActiveWorkoutIdForSharedDraft = jest.mocked(getActiveWorkoutId);
const mockedSave = jest.mocked(savePlannedWorkoutSet);
const mockedSaveCompleted = jest.mocked(saveCompletedWorkoutSet);
const mockedRemoveExercise = jest.mocked(removeExerciseFromWorkout);
const mockedReorderExercises = jest.mocked(reorderActiveWorkoutExercises);
const mockedUnconfirm = jest.mocked(unconfirmWorkoutSet);
const STARTED_AT = new Date(2026, 7, 5, 10, 0).toISOString();

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 1;
  });
});

const workoutWithSets = {
  id: 3,
  startedAt: STARTED_AT,
  exercises: [{
    id: 4, exerciseId: 5, name: 'Knebøy', position: 0,
    sets: [
      { id: 7, loadKg: 80, repetitions: 5, confirmedAt: '2026-01-01T10:00:00Z' },
      { id: 6, loadKg: null, repetitions: null, confirmedAt: null },
    ],
  }],
};

function exerciseProgress(exerciseId: number) {
  const style = screen.UNSAFE_getByProps({ testID: `workout-exercise-${exerciseId}-progress` }).props.style.flat(Infinity);
  return style.find((entry: { transform?: unknown }) => entry?.transform)?.transform[0].scaleX._value;
}

test('shows an active workout and opens its cancellable exercise picker', async () => {
  const navigate = jest.fn();
  const setParams = jest.fn();
  mockedLoad.mockResolvedValue({ id: 3, startedAt: STARTED_AT, exercises: [] });
  renderScreen({ navigate, setParams });

  const metadata = await screen.findByText('Startet 5. august 2026 kl. 10:00', {}, { timeout: 3000 });
  expect(metadata).toHaveStyle({ ...typography.metadata, color: lightColors.muted });
  expect(screen.getByText('Ingen øvelser lagt til ennå')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Ferdig' })).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Avbryt' })).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Legg til øvelse' }));
  await waitFor(() => expect(setParams).toHaveBeenCalledWith({ focusAddExercise: true }));
  expect(navigate).toHaveBeenCalledWith('ExercisePicker', { workoutId: 3 });
});

test('keeps loading and total failure distinct from an empty workout and retries loading', async () => {
  let finishLoad: (workout: { id: number; startedAt: string; exercises: never[] }) => void = () => undefined;
  mockedLoad
    .mockImplementationOnce(() => new Promise((resolve) => { finishLoad = resolve; }))
    .mockRejectedValueOnce(new Error('read failed'))
    .mockResolvedValueOnce({ id: 3, startedAt: STARTED_AT, exercises: [] });
  const initialView = renderScreen();

  expect(screen.getByLabelText('Laster treningsøkt')).toBeOnTheScreen();
  expect(screen.queryByText('Ingen øvelser lagt til ennå')).not.toBeOnTheScreen();
  await act(async () => finishLoad({ id: 3, startedAt: STARTED_AT, exercises: [] }));
  expect(await screen.findByText('Ingen øvelser lagt til ennå')).toBeOnTheScreen();
  initialView.unmount();

  const view = renderScreen();
  expect(await screen.findByText('Kunne ikke laste inn')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Prøv igjen' }));
  expect(await screen.findByText('Ingen øvelser lagt til ennå')).toBeOnTheScreen();
  view.unmount();
});

test('opens and focuses the exercise requested by route params, then consumes them', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  const setParams = jest.fn();
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [
      ...workoutWithSets.exercises,
      { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] },
    ],
  });
  renderScreen({ setParams }, { focusExerciseId: 10 });

  expect(await screen.findByRole('button', { name: 'Markløft' })).toHaveProp('accessibilityState', { expanded: true });
  expect(screen.getByRole('button', { name: 'Knebøy' })).toHaveProp('accessibilityState', { expanded: false });
  expect(focus).toHaveBeenCalled();
  expect(setParams).toHaveBeenCalledWith({ focusExerciseId: undefined, focusAddExercise: undefined });
});

test('opens a newly added exercise without closing an exercise already open', async () => {
  const navigation = { setParams: jest.fn() };
  const workout = {
    id: 3,
    startedAt: STARTED_AT,
    exercises: [
      ...workoutWithSets.exercises,
      { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] },
    ],
  };
  mockedLoad.mockResolvedValue(workout);
  const view = renderScreen(navigation, null);
  const squat = await screen.findByRole('button', { name: 'Knebøy' });
  fireEvent.press(squat);

  view.rerender(workoutScreen(navigation, { focusExerciseId: 10 }));

  expect(squat).toHaveProp('accessibilityState', { expanded: true });
  expect(screen.getByRole('button', { name: 'Markløft' })).toHaveProp('accessibilityState', { expanded: true });
  expect(navigation.setParams).toHaveBeenCalledWith({ focusExerciseId: undefined, focusAddExercise: undefined });
});

test('focuses the add-exercise action requested by route params, then consumes them', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  const setParams = jest.fn();
  mockedLoad.mockResolvedValue({ id: 3, startedAt: STARTED_AT, exercises: [] });
  renderScreen({ setParams }, { focusAddExercise: true });

  expect(await screen.findByRole('button', { name: 'Legg til øvelse' })).toBeOnTheScreen();
  expect(focus).toHaveBeenCalled();
  expect(setParams).toHaveBeenCalledWith({ focusExerciseId: undefined, focusAddExercise: undefined });
});

test('shows a compact planned set and opens its editor on request', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [{
      id: 4, exerciseId: 5, name: 'Knebøy', position: 0,
      sets: [{ id: 6, loadKg: null, repetitions: null, confirmedAt: null }],
    }],
  });
  renderScreen();

  expect(await screen.findByText('Knebøy')).toBeOnTheScreen();
  expect(screen.getByText('Planlagt')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Belastning for Knebøy')).not.toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Rediger sett 1 for Knebøy' }));
  expect(screen.getByLabelText('Belastning for Knebøy')).not.toHaveProp('editable', false);
  expect(screen.getByLabelText('Repetisjoner for Knebøy')).not.toHaveProp('editable', false);
  expect(screen.getByRole('button', { name: 'Legg til sett' })).toBeOnTheScreen();
  expect(screen.getByLabelText('Belastning for Knebøy')).toHaveProp('keyboardType', 'decimal-pad');
  expect(screen.getByLabelText('Repetisjoner for Knebøy')).toHaveProp('keyboardType', 'number-pad');
});

test('dismisses the keyboard when the inline editor closes', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  mockedLoad.mockResolvedValue(workoutWithSets);
  renderScreen();
  await openEditor(1);

  fireEvent.press(screen.getByRole('button', { name: 'Lukk redigering av sett 1 for Knebøy' }));

  await waitFor(() => expect(dismiss).toHaveBeenCalled());
});

test('keeps suggested sets compact in source order and permits one editor', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [{
      id: 4, exerciseId: 5, name: 'Knebøy', position: 0,
      sets: [
        { id: 6, loadKg: 80, repetitions: 5, confirmedAt: null },
        { id: 8, loadKg: 90, repetitions: 3, confirmedAt: null },
      ],
    }],
  });
  renderScreen();

  expect(await screen.findByLabelText('Sett 1, 80 kilogram, 5 repetisjoner, Planlagt')).toBeOnTheScreen();
  expect(screen.getByLabelText('Sett 2, 90 kilogram, 3 repetisjoner, Planlagt')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Rediger sett 1 for Knebøy' }));
  expect(screen.getByLabelText('Belastning for Knebøy')).toHaveProp('value', '80');
  fireEvent.press(screen.getByRole('button', { name: 'Rediger sett 2 for Knebøy' }));
  await waitFor(() => expect(screen.getByLabelText('Belastning for Knebøy')).toHaveProp('value', '90'));
  expect(screen.getAllByLabelText('Belastning for Knebøy')).toHaveLength(1);
});

test('saves a valid dirty draft before switching editors', async () => {
  let finishSave: () => void = () => undefined;
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [{
      id: 4, exerciseId: 5, name: 'Knebøy', position: 0,
      sets: [
        { id: 6, loadKg: 80, repetitions: 5, confirmedAt: null },
        { id: 8, loadKg: 90, repetitions: 3, confirmedAt: null },
      ],
    }],
  });
  mockedSave.mockImplementation(() => new Promise<void>((resolve) => { finishSave = resolve; }));
  renderScreen({}, null);
  fireEvent.press(await screen.findByRole('button', { name: 'Knebøy' }));
  await openEditor(1);
  fireEvent.changeText(screen.getByLabelText('Belastning for Knebøy'), '82,5');

  fireEvent.press(screen.getByRole('button', { name: 'Rediger sett 2 for Knebøy' }));

  await waitFor(() => expect(mockedSave).toHaveBeenCalledWith(database, 3, 6, 82.5, 5));
  expect(screen.getByLabelText('Belastning for Knebøy')).toHaveProp('value', '82,5');
  await act(async () => finishSave());
  await waitFor(() => expect(screen.getByLabelText('Belastning for Knebøy')).toHaveProp('value', '90'));
});

test('invalid input blocks editor transitions but not exercise card collapse', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [{
      id: 4, exerciseId: 5, name: 'Knebøy', position: 0,
      sets: [
        { id: 6, loadKg: 80, repetitions: 5, confirmedAt: null },
        { id: 8, loadKg: 90, repetitions: 3, confirmedAt: null },
      ],
    }],
  });
  renderScreen({}, null);
  fireEvent.press(await screen.findByRole('button', { name: 'Knebøy' }));
  await openEditor(1);
  fireEvent.changeText(screen.getByLabelText('Belastning for Knebøy'), '1000');

  fireEvent.press(screen.getByRole('button', { name: 'Rediger sett 2 for Knebøy' }));
  expect(await screen.findByText('Skriv inn en belastning fra 0 til 999,9 med maks én desimal')).toBeOnTheScreen();
  expect(screen.getByLabelText('Belastning for Knebøy')).toHaveProp('value', '1000');
  fireEvent.press(screen.getByRole('button', { name: 'Marker sett 2 som gjennomført for Knebøy' }));
  expect(mockedConfirm).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Lukk redigering av sett 1 for Knebøy' }));
  expect(screen.getByLabelText('Belastning for Knebøy')).toBeOnTheScreen();

  const card = screen.getByRole('button', { name: 'Knebøy' });
  fireEvent.press(card);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Knebøy' })).toHaveProp('accessibilityState', { expanded: false }));
  expect(screen.queryByLabelText('Belastning for Knebøy')).not.toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Knebøy' }));
  expect(screen.getByLabelText('Belastning for Knebøy')).toHaveProp('value', '1000');
});

test('reveals a collapsed invalid editor when another editor is requested', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [
      { id: 4, exerciseId: 5, name: 'Knebøy', position: 0, sets: [{ id: 6, loadKg: 80, repetitions: 5, confirmedAt: null }] },
      { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [{ id: 11, loadKg: 100, repetitions: 3, confirmedAt: null }] },
    ],
  });
  renderScreen({}, null);
  fireEvent.press(await screen.findByRole('button', { name: 'Knebøy' }));
  fireEvent.press(screen.getByRole('button', { name: 'Markløft' }));
  await openEditor(1);
  fireEvent.changeText(screen.getByLabelText('Belastning for Knebøy'), '1000');
  fireEvent.press(screen.getByRole('button', { name: 'Knebøy' }));

  fireEvent.press(screen.getByRole('button', { name: 'Rediger sett 1 for Markløft' }));

  expect(await screen.findByRole('button', { name: 'Knebøy' })).toHaveProp('accessibilityState', { expanded: true });
  expect(screen.getByText('Skriv inn en belastning fra 0 til 999,9 med maks én desimal')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Belastning for Markløft')).not.toBeOnTheScreen();
});

test('shows mixed statuses in stable source order with explicit actions', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  renderScreen();

  expect(await screen.findByLabelText('Sett 1, 80 kilogram, 5 repetisjoner, Gjennomført')).toBeOnTheScreen();
  expect(screen.getByText('80 kg · 5 repetisjoner')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Rediger sett 1 for Knebøy' })).toBeOnTheScreen();
  expect(screen.getByLabelText('Sett 2, belastning ikke angitt, repetisjoner ikke angitt, Planlagt')).toBeOnTheScreen();
});

test('derives accessible and visual exercise completion from durable set status, including zero sets', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [
      { id: 4, exerciseId: 5, name: 'Fullført', position: 0, sets: [{ id: 6, loadKg: 80, repetitions: 5, confirmedAt: STARTED_AT }] },
      { id: 9, exerciseId: 10, name: 'Delvis', position: 1, sets: workoutWithSets.exercises[0].sets },
      { id: 11, exerciseId: 12, name: 'Planlagt', position: 2, sets: [{ id: 13, loadKg: null, repetitions: null, confirmedAt: null }] },
      { id: 14, exerciseId: 15, name: 'Ingen sett', position: 3, sets: [] },
      { id: 16, exerciseId: 17, name: 'Tre av fire', position: 4, sets: [
        { id: 18, loadKg: 20, repetitions: 10, confirmedAt: STARTED_AT },
        { id: 19, loadKg: 20, repetitions: 10, confirmedAt: STARTED_AT },
        { id: 20, loadKg: 20, repetitions: 10, confirmedAt: STARTED_AT },
        { id: 21, loadKg: 20, repetitions: 10, confirmedAt: null },
      ] },
    ],
  });
  renderScreen({}, null);

  expect(await screen.findByRole('button', { name: 'Fullført, 1 av 1 sett gjennomført, fullført' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Delvis, 1 av 2 sett gjennomført, ikke fullført' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Planlagt, 0 av 1 sett gjennomført, ikke fullført' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Ingen sett, 0 av 0 sett gjennomført, ikke fullført' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Tre av fire, 3 av 4 sett gjennomført, ikke fullført' })).toBeOnTheScreen();
  expect(screen.getByTestId('workout-exercise-4-completion', { includeHiddenElements: true })).toHaveStyle({
    backgroundColor: lightColors.secondary,
    borderColor: lightColors.primary,
  });
  expect(screen.getByTestId('workout-exercise-14-completion', { includeHiddenElements: true })).toHaveStyle({
    backgroundColor: lightColors.surfaceAlt,
    borderColor: lightColors.border,
  });
  expect(screen.getByTestId('workout-exercise-4-completion-icon-check', { includeHiddenElements: true })).toBeOnTheScreen();
  expect(screen.getByTestId('workout-exercise-14-completion-icon-hourglass', { includeHiddenElements: true })).toBeOnTheScreen();
  expect(exerciseProgress(4)).toBe(1);
  expect(exerciseProgress(9)).toBe(0.5);
  expect(exerciseProgress(11)).toBe(0);
  expect(exerciseProgress(14)).toBe(0);
  expect(exerciseProgress(16)).toBe(0.75);
});

test('uses neutral planned and green completed set-number treatments', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  renderScreen();

  await screen.findByLabelText('Sett 1, 80 kilogram, 5 repetisjoner, Gjennomført');
  expect(screen.UNSAFE_getByProps({ testID: 'workout-set-7-number' }).props.style).toEqual(expect.arrayContaining([
    expect.objectContaining({
    backgroundColor: lightColors.secondary,
    borderColor: lightColors.primary,
    }),
  ]));
  expect(screen.UNSAFE_getByProps({ testID: 'workout-set-7-number-text' }).props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: lightColors.onSecondary })]));
  expect(screen.UNSAFE_getByProps({ testID: 'workout-set-6-number' }).props.style).toEqual(expect.arrayContaining([
    expect.objectContaining({
    backgroundColor: lightColors.surface,
    borderColor: lightColors.border,
    }),
  ]));
  expect(screen.UNSAFE_getByProps({ testID: 'workout-set-6-number-text' }).props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: lightColors.muted })]));
});

test('changes final-set completion only after persistence succeeds and preserves it on failed reopening', async () => {
  let finishConfirm: () => void = () => undefined;
  const plannedOnly = {
    ...workoutWithSets,
    exercises: [{
      ...workoutWithSets.exercises[0],
      sets: [{ ...workoutWithSets.exercises[0].sets[0], confirmedAt: null }],
    }],
  };
  mockedLoad.mockResolvedValue(plannedOnly);
  mockedConfirm.mockImplementation(() => new Promise<void>((resolve) => { finishConfirm = resolve; }));
  renderScreen();

  const incompleteName = 'Knebøy, 0 av 1 sett gjennomført, ikke fullført';
  expect(await screen.findByRole('button', { name: incompleteName })).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Marker sett 1 som gjennomført for Knebøy' }));
  expect(screen.getByRole('button', { name: incompleteName })).toBeOnTheScreen();
  await act(async () => finishConfirm());
  expect(await screen.findByRole('button', { name: 'Knebøy, 1 av 1 sett gjennomført, fullført' })).toBeOnTheScreen();
  expect(exerciseProgress(4)).toBe(1);

  mockedUnconfirm.mockRejectedValue(new Error('write failed'));
  fireEvent.press(screen.getByRole('button', { name: 'Endre sett 1 til planlagt for Knebøy' }));
  expect(await screen.findByRole('button', { name: 'Prøv igjen' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Knebøy, 1 av 1 sett gjennomført, fullført' })).toBeOnTheScreen();
  expect(exerciseProgress(4)).toBe(1);
});

test('recalculates completion after durable add and delete operations', async () => {
  const completedOnly = { ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[0]] }] };
  mockedLoad.mockResolvedValue(completedOnly);
  mockedAddSet.mockResolvedValue({ id: 8, loadKg: 80, repetitions: 5, confirmedAt: null });
  mockedDelete.mockResolvedValue();
  renderScreen();

  expect(await screen.findByRole('button', { name: 'Knebøy, 1 av 1 sett gjennomført, fullført' })).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Legg til sett' }));
  expect(await screen.findByRole('button', { name: 'Knebøy, 1 av 2 sett gjennomført, ikke fullført' })).toBeOnTheScreen();
  expect(exerciseProgress(4)).toBe(0.5);
  await openEditor(2);
  fireEvent.press(screen.getByRole('button', { name: 'Fjern sett 2 for Knebøy' }));
  expect(await screen.findByRole('button', { name: 'Knebøy, 1 av 1 sett gjennomført, fullført' })).toBeOnTheScreen();
  expect(exerciseProgress(4)).toBe(1);
});

test('preserves completed exercise status when adding a planned set fails', async () => {
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[0]] }] });
  mockedAddSet.mockRejectedValue(new Error('write failed'));
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Legg til sett' }));

  expect(await screen.findByRole('button', { name: 'Prøv igjen' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Knebøy, 1 av 1 sett gjennomført, fullført' })).toBeOnTheScreen();
});

test('deleting the final completed set applies the zero-set incomplete exception', async () => {
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[0]] }] });
  mockedDeleteCompleted.mockResolvedValue();
  renderScreen();

  await openEditor(1);
  fireEvent.press(screen.getByRole('button', { name: 'Fjern sett 1 for Knebøy' }));
  fireEvent.press(screen.getByRole('button', { name: 'Bekreft fjerning av gjennomført sett' }));

  expect(await screen.findByRole('button', { name: 'Knebøy, 0 av 0 sett gjennomført, ikke fullført' })).toBeOnTheScreen();
  expect(exerciseProgress(4)).toBe(0);
});

test('preserves completed exercise status when final-set deletion fails', async () => {
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[0]] }] });
  mockedDeleteCompleted.mockRejectedValue(new Error('write failed'));
  renderScreen();

  await openEditor(1);
  fireEvent.press(screen.getByRole('button', { name: 'Fjern sett 1 for Knebøy' }));
  fireEvent.press(screen.getByRole('button', { name: 'Bekreft fjerning av gjennomført sett' }));

  expect(await screen.findByText('Kunne ikke fjerne det gjennomførte settet. Prøv igjen.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Knebøy, 1 av 1 sett gjennomført, fullført' })).toBeOnTheScreen();
});

test('enables completion only for durable completed sets and warns about planned sets', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  renderScreen();

  const complete = await screen.findByRole('button', { name: 'Ferdig' });
  expect(complete).toBeEnabled();
  fireEvent.press(complete);

  expect(screen.getByRole('header', { name: 'Fullfør treningen?' })).toBeOnTheScreen();
  expect(screen.getByText('Treningen lagres i historikken.')).toHaveStyle(typography.body);
  expect(screen.getByText(
    'Det er sett som ikke er bekreftet. Disse vil bli forkastet om du fortsetter.',
  )).toHaveStyle({ ...typography.body, color: lightColors.danger });
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

  const complete = await screen.findByRole('button', { name: 'Ferdig' });
  focus.mockClear();
  fireEvent.press(complete);
  fireEvent(UNSAFE_getAllByType(Modal).find((modal) => modal.props.visible)!, 'show');
  fireEvent.press(screen.getByRole('button', { name: 'Fortsett treningen' }));

  expect(screen.queryByRole('header', { name: 'Fullfør treningen?' })).not.toBeOnTheScreen();
  expect(focus).toHaveBeenCalledTimes(2);
});

test('platform Back dismisses completion confirmation without saving', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  const { UNSAFE_getAllByType } = renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Ferdig' }));
  fireEvent(UNSAFE_getAllByType(Modal).find((modal) => modal.props.visible)!, 'requestClose');

  expect(screen.queryByRole('header', { name: 'Fullfør treningen?' })).not.toBeOnTheScreen();
  expect(mockedComplete).not.toHaveBeenCalled();
});

test('blocks completion while relevant data is not durable', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedSave.mockRejectedValue(new Error('write failed'));
  renderScreen();
  await openEditor(2);
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
  fireEvent.press(screen.getByRole('button', { name: 'Fullfør trening' }));
  expect(replace).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Fullfører' })).toHaveProp('accessibilityState', { busy: true, disabled: true });
  expect(screen.getByRole('button', { name: 'Fortsett treningen' })).toBeDisabled();

  finish();
  await waitFor(() => expect(replace).toHaveBeenCalledWith('CompletedWorkout', {
    workoutId: 3, fromCompletion: true,
  }));
});

test('does not dismiss the completion dialog while completion is pending', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedComplete.mockImplementation(() => new Promise(() => {}));
  const { UNSAFE_getAllByType } = renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Ferdig' }));
  fireEvent.press(screen.getByRole('button', { name: 'Fullfør trening' }));
  fireEvent(UNSAFE_getAllByType(Modal).find((modal) => modal.props.visible)!, 'requestClose');

  expect(screen.getByRole('header', { name: 'Fullfør treningen?' })).toBeOnTheScreen();
});

test('preserves the active workout, announces retry, focuses it, and stays put on completion failure', async () => {
  const replace = jest.fn();
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedComplete.mockRejectedValue(new Error('write failed'));
  renderScreen({ replace });

  fireEvent.press(await screen.findByRole('button', { name: 'Ferdig' }));
  fireEvent.press(screen.getByRole('button', { name: 'Fullfør trening' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/Kunne ikke fullføre treningen/);
  expect(screen.getByRole('button', { name: 'Prøv igjen' })).toBeOnTheScreen();
  expect(screen.getByText('Knebøy')).toBeOnTheScreen();
  expect(announce).toHaveBeenCalledWith('Kunne ikke fullføre treningen. Prøv igjen.');
  expect(focus).toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
});

test('adds a separately confirmable set returned by durable storage', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedAddSet.mockResolvedValue({ id: 8, loadKg: 80, repetitions: 5, confirmedAt: null });
  renderScreen();

  focus.mockClear();
  fireEvent.press(await screen.findByRole('button', { name: 'Legg til sett' }));

  await waitFor(() => expect(mockedAddSet).toHaveBeenCalledWith(database, 3, 4));
  expect(screen.getByLabelText('Sett 3, 80 kilogram, 5 repetisjoner, Planlagt')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Belastning for Knebøy')).not.toBeOnTheScreen();
  expect(mockedConfirm).not.toHaveBeenCalled();
  expect(Haptics.selectionAsync).toHaveBeenCalled();
  expect(focus).toHaveBeenCalled();
});

test.each([
  ['Legg til sett', 'add-set'],
  ['Legg til øvelse', 'add-exercise'],
] as const)('flushes a dirty draft before %s and waits for durability', async (actionName, action) => {
  let finishSave: () => void = () => undefined;
  const navigate = jest.fn();
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedSave.mockImplementation(() => new Promise<void>((resolve) => { finishSave = resolve; }));
  mockedAddSet.mockResolvedValue({ id: 8, loadKg: null, repetitions: null, confirmedAt: null });
  renderScreen({ navigate });
  await openEditor(2);
  fireEvent.changeText(await screen.findByLabelText('Belastning for Knebøy'), '90');

  fireEvent.press(screen.getByRole('button', { name: actionName }));
  await waitFor(() => expect(mockedSave).toHaveBeenCalledWith(database, 3, 6, 90, null));
  expect(mockedAddSet).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();

  await act(async () => finishSave());
  if (action === 'add-set') await waitFor(() => expect(mockedAddSet).toHaveBeenCalled());
  else await waitFor(() => expect(navigate).toHaveBeenCalledWith('ExercisePicker', { workoutId: 3 }));
});

test('does not continue navigation when flushing a dirty draft fails', async () => {
  const navigate = jest.fn();
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedSave.mockRejectedValue(new Error('write failed'));
  renderScreen({ navigate });
  await openEditor(2);
  fireEvent.changeText(await screen.findByLabelText('Belastning for Knebøy'), '90');

  fireEvent.press(screen.getByRole('button', { name: 'Legg til øvelse' }));

  expect(await screen.findByText('Endringene er ikke lagret')).toBeOnTheScreen();
  expect(navigate).not.toHaveBeenCalled();
});

test('starts collapsed and lets every exercise expand and collapse independently', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [
      ...workoutWithSets.exercises,
      { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] },
    ],
  });
  renderScreen({}, null);

  const squat = await screen.findByRole('button', { name: 'Knebøy' });
  const deadlift = screen.getByRole('button', { name: 'Markløft' });
  expect(squat).toHaveProp('accessibilityState', { expanded: false });
  expect(deadlift).toHaveProp('accessibilityState', { expanded: false });
  expect(screen.queryByText('Planlagt')).not.toBeOnTheScreen();

  fireEvent.press(squat);
  expect(squat).toHaveProp('accessibilityState', { expanded: true });
  fireEvent.press(screen.getByRole('button', { name: 'Markløft' }));
  expect(squat).toHaveProp('accessibilityState', { expanded: true });
  expect(deadlift).toHaveProp('accessibilityState', { expanded: true });
  expect(screen.getByText('Planlagt')).toBeOnTheScreen();

  fireEvent.press(squat);
  expect(squat).toHaveProp('accessibilityState', { expanded: false });
  expect(deadlift).toHaveProp('accessibilityState', { expanded: true });
  fireEvent.press(deadlift);
  expect(deadlift).toHaveProp('accessibilityState', { expanded: false });
});

test('exposes only possible reorder actions on exercise headers', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [
      ...workoutWithSets.exercises,
      { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] },
      { id: 11, exerciseId: 12, name: 'Benkpress', position: 2, sets: [] },
    ],
  });
  renderScreen({}, null);

  expect(await screen.findByRole('button', { name: 'Knebøy' })).toHaveProp(
    'accessibilityActions',
    [{ name: 'moveDown', label: 'Flytt ned' }],
  );
  expect(screen.getByRole('button', { name: 'Markløft' })).toHaveProp('accessibilityActions', [
    { name: 'moveUp', label: 'Flytt opp' },
    { name: 'moveDown', label: 'Flytt ned' },
  ]);
  expect(screen.getByRole('button', { name: 'Benkpress' })).toHaveProp(
    'accessibilityActions',
    [{ name: 'moveUp', label: 'Flytt opp' }],
  );
});

test('does not expose reorder actions for a one-exercise workout', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  renderScreen({}, null);

  expect(await screen.findByRole('button', { name: 'Knebøy' })).toHaveProp('accessibilityActions', []);
});

test('moves exercises in both directions immediately, persists each complete order, and announces success', async () => {
  let finishFirstMove: () => void = () => undefined;
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [
      ...workoutWithSets.exercises,
      { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] },
      { id: 11, exerciseId: 12, name: 'Benkpress', position: 2, sets: [] },
    ],
  });
  mockedReorderExercises
    .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirstMove = resolve; }))
    .mockResolvedValueOnce();
  renderScreen({}, null);

  const deadlift = await screen.findByRole('button', { name: 'Markløft' });
  fireEvent(deadlift, 'accessibilityAction', { nativeEvent: { actionName: 'moveUp' } });

  expect(screen.getAllByText(/^(Knebøy|Markløft|Benkpress)$/).map((node) => node.props.children))
    .toEqual(['Markløft', 'Knebøy', 'Benkpress']);
  expect(mockedReorderExercises).toHaveBeenCalledWith(database, 3, [9, 4, 11]);
  expect(screen.getByRole('button', { name: 'Knebøy' })).toHaveProp('accessibilityActions', []);

  await act(async () => finishFirstMove());
  expect(announce).toHaveBeenCalledWith('Markløft flyttet til plass 1 av 3.');

  fireEvent(screen.getByRole('button', { name: 'Markløft' }), 'accessibilityAction', {
    nativeEvent: { actionName: 'moveDown' },
  });
  await waitFor(() => expect(mockedReorderExercises).toHaveBeenLastCalledWith(database, 3, [4, 9, 11]));
  expect(screen.getAllByText(/^(Knebøy|Markløft|Benkpress)$/).map((node) => node.props.children))
    .toEqual(['Knebøy', 'Markløft', 'Benkpress']);
  expect(announce).toHaveBeenCalledWith('Markløft flyttet til plass 2 av 3.');
});

test('collapses every card when reordered with an accessibility action', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [...workoutWithSets.exercises, { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] }],
  });
  renderScreen({}, null);
  fireEvent.press(await screen.findByRole('button', { name: /Knebøy/ }));
  fireEvent.press(screen.getByRole('button', { name: /Markløft/ }));

  fireEvent(screen.getAllByRole('button', { name: /Markløft/ })[0], 'accessibilityAction', {
    nativeEvent: { actionName: 'moveUp' },
  });

  await waitFor(() => expect(mockedReorderExercises).toHaveBeenCalled());
  expect(screen.getByRole('button', { name: /Knebøy/ })).toHaveProp('accessibilityState', { expanded: false });
  expect(screen.getByRole('button', { name: /Markløft/ })).toHaveProp('accessibilityState', { expanded: false });
});

test('drags an exercise across positions, collapses every card, and persists once on drop', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [
      ...workoutWithSets.exercises,
      { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] },
      { id: 11, exerciseId: 12, name: 'Benkpress', position: 2, sets: [] },
    ],
  });
  renderScreen({}, null);
  const cardBeforeDrag = await screen.findByTestId('workout-exercise-9');
  fireEvent.press(await screen.findByRole('button', { name: 'Knebøy' }));
  fireEvent.press(screen.getByRole('button', { name: 'Markløft' }));
  fireEvent(screen.getByTestId('workout-exercise-4'), 'layout', { nativeEvent: { layout: { height: 70, width: 300, x: 0, y: 40 } } });
  fireEvent(screen.getByTestId('workout-exercise-9'), 'layout', { nativeEvent: { layout: { height: 70, width: 300, x: 0, y: 126 } } });
  fireEvent(screen.getByTestId('workout-exercise-11'), 'layout', { nativeEvent: { layout: { height: 70, width: 300, x: 0, y: 212 } } });

  fireEvent(screen.getAllByRole('button', { name: /Markløft/ })[0], 'longPress');

  expect(screen.getByRole('button', { name: /Knebøy/ })).toHaveProp('accessibilityState', { expanded: false });
  expect(screen.getByRole('button', { name: /Markløft/ })).toHaveProp('accessibilityState', { expanded: false });
  expect(screen.getByText('Dra for å endre rekkefølge')).toBeOnTheScreen();
  expect(screen.UNSAFE_getByProps({ testID: 'workout-exercise-9-completion-icon-move-vertical' })).toBeDefined();

  fireEvent(screen.getByRole('button', { name: /Markløft/ }), 'touchMove', { nativeEvent: { pageY: 260 } });
  expect(screen.getAllByText(/^(Knebøy|Markløft|Benkpress)$/).map((node) => node.props.children))
    .toEqual(['Knebøy', 'Benkpress', 'Markløft']);
  expect(screen.getByText('Flytt til #3')).toBeOnTheScreen();
  expect(mockedReorderExercises).not.toHaveBeenCalled();

  fireEvent(screen.getByRole('button', { name: /Markløft/ }), 'pressOut');
  fireEvent(screen.getByRole('button', { name: /Markløft/ }), 'touchEnd');
  await waitFor(() => expect(mockedReorderExercises).toHaveBeenCalledTimes(1));
  expect(mockedReorderExercises).toHaveBeenCalledWith(database, 3, [4, 11, 9]);
  expect(screen.getByTestId('workout-exercise-9')).not.toBe(cardBeforeDrag);
  fireEvent.press(screen.getByRole('button', { name: /Markløft/ }));
  expect(screen.getByRole('button', { name: 'Legg til sett' })).toBeOnTheScreen();
});

test('does not persist an unchanged drag and keeps cards collapsed', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [...workoutWithSets.exercises, { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] }],
  });
  renderScreen({}, null);
  const squat = await screen.findByRole('button', { name: 'Knebøy' });
  fireEvent.press(squat);
  fireEvent(squat, 'longPress');
  fireEvent(screen.getByRole('button', { name: /Knebøy/ }), 'pressOut');
  fireEvent(screen.getByRole('button', { name: /Knebøy/ }), 'touchEnd');

  expect(mockedReorderExercises).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: /Knebøy/ })).toHaveProp('accessibilityState', { expanded: false });
});

test('blocks navigation and screen actions during an active drag', async () => {
  let preventRemove: ((event: { data: { action: object } }) => void) | undefined;
  const dispatch = jest.fn();
  jest.mocked(usePreventRemove).mockImplementation((_, callback) => { preventRemove = callback as typeof preventRemove; });
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [...workoutWithSets.exercises, { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] }],
  });
  renderScreen({ dispatch }, null);
  fireEvent(await screen.findByRole('button', { name: /Knebøy/ }), 'longPress');

  await waitFor(() => expect(usePreventRemove).toHaveBeenLastCalledWith(true, expect.any(Function)));
  expect(screen.getByRole('button', { name: 'Legg til øvelse' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Avbryt' })).toBeDisabled();
  act(() => preventRemove?.({ data: { action: { type: 'GO_BACK' } } }));
  expect(dispatch).not.toHaveBeenCalled();
});

test('keeps a dirty set draft attached while dragging and does not save it on collapse', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [...workoutWithSets.exercises, { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] }],
  });
  renderScreen({}, null);
  fireEvent.press(await screen.findByRole('button', { name: /Knebøy/ }));
  await openEditor(2);
  fireEvent.changeText(screen.getByLabelText('Belastning for Knebøy'), '90');
  const deadlift = screen.getByRole('button', { name: /Markløft/ });

  fireEvent(deadlift, 'longPress');
  fireEvent(deadlift, 'pressOut');
  fireEvent(deadlift, 'touchEnd');

  expect(screen.getByRole('button', { name: /Knebøy/ })).toHaveProp('accessibilityState', { expanded: false });
  fireEvent.press(screen.getByRole('button', { name: /Knebøy/ }));
  expect(screen.getByLabelText('Belastning for Knebøy')).toHaveProp('value', '90');
  expect(mockedSave).not.toHaveBeenCalled();
  expect(mockedReorderExercises).not.toHaveBeenCalled();
});

test('cancels a drag without persistence and restores the saved order collapsed', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [...workoutWithSets.exercises, { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] }],
  });
  renderScreen({}, null);
  const cardBeforeDrag = await screen.findByTestId('workout-exercise-4');
  fireEvent(cardBeforeDrag, 'layout', { nativeEvent: { layout: { height: 70, width: 300, x: 0, y: 40 } } });
  fireEvent(screen.getByTestId('workout-exercise-9'), 'layout', { nativeEvent: { layout: { height: 70, width: 300, x: 0, y: 126 } } });
  fireEvent(await screen.findByRole('button', { name: /Knebøy/ }), 'longPress');
  fireEvent(screen.getByRole('button', { name: /Knebøy/ }), 'touchMove', { nativeEvent: { pageY: 180 } });
  fireEvent(screen.getByRole('button', { name: /Knebøy/ }), 'touchCancel');

  expect(screen.getAllByText(/^(Knebøy|Markløft)$/).map((node) => node.props.children)).toEqual(['Knebøy', 'Markløft']);
  expect(screen.getByTestId('workout-exercise-4')).not.toBe(cardBeforeDrag);
  fireEvent.press(screen.getByRole('button', { name: /Knebøy/ }));
  expect(screen.getByLabelText('Sett 1, 80 kilogram, 5 repetisjoner, Gjennomført')).toBeOnTheScreen();
  expect(mockedReorderExercises).not.toHaveBeenCalled();
});

test('removes optional reorder animation when reduced motion is enabled', async () => {
  const animate = jest.spyOn(LayoutAnimation, 'configureNext');
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [...workoutWithSets.exercises, { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] }],
  });
  renderScreen({}, null);
  fireEvent(await screen.findByTestId('workout-exercise-4'), 'layout', { nativeEvent: { layout: { height: 70, width: 300, x: 0, y: 40 } } });
  fireEvent(screen.getByTestId('workout-exercise-9'), 'layout', { nativeEvent: { layout: { height: 70, width: 300, x: 0, y: 126 } } });
  fireEvent(screen.getAllByRole('button', { name: /Knebøy/ })[0], 'longPress');
  animate.mockClear();

  fireEvent(screen.getByRole('button', { name: /Knebøy/ }), 'touchMove', { nativeEvent: { pageY: 180 } });

  expect(animate).not.toHaveBeenCalled();
});

test('rolls a failed reorder back without losing exercise data or draft values', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [
      ...workoutWithSets.exercises,
      { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] },
    ],
  });
  mockedReorderExercises.mockRejectedValue(new Error('write failed'));
  renderScreen({}, null);
  fireEvent.press(await screen.findByRole('button', { name: 'Knebøy' }));
  await openEditor(2);
  fireEvent.changeText(screen.getByLabelText('Belastning for Knebøy'), '82,5');

  fireEvent(screen.getByRole('button', { name: 'Knebøy' }), 'accessibilityAction', {
    nativeEvent: { actionName: 'moveDown' },
  });

  expect(await screen.findByRole('alert')).toHaveTextContent(/Kunne ikke flytte øvelsen\. Prøv igjen\./);
  expect(screen.getAllByText(/^(Knebøy|Markløft)$/).map((node) => node.props.children))
    .toEqual(['Knebøy', 'Markløft']);
  fireEvent.press(screen.getByRole('button', { name: /Knebøy/ }));
  expect(screen.getByLabelText('Belastning for Knebøy')).toHaveProp('value', '82,5');
  expect(screen.getByLabelText('Sett 1, 80 kilogram, 5 repetisjoner, Gjennomført')).toBeOnTheScreen();
  expect(announce).toHaveBeenCalledWith('Kunne ikke flytte øvelsen. Prøv igjen.');
  expect(screen.getByRole('button', { name: 'Knebøy' })).toHaveProp('accessibilityActions', [
    { name: 'moveDown', label: 'Flytt ned' },
  ]);
});

test('rolls a failed drag reorder back and keeps every card collapsed', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [...workoutWithSets.exercises, { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] }],
  });
  mockedReorderExercises.mockRejectedValue(new Error('write failed'));
  renderScreen({}, null);
  fireEvent.press(await screen.findByRole('button', { name: /Knebøy/ }));
  fireEvent(screen.getByTestId('workout-exercise-4'), 'layout', { nativeEvent: { layout: { height: 70, width: 300, x: 0, y: 40 } } });
  fireEvent(screen.getByTestId('workout-exercise-9'), 'layout', { nativeEvent: { layout: { height: 70, width: 300, x: 0, y: 126 } } });
  fireEvent(screen.getAllByRole('button', { name: /Knebøy/ })[0], 'longPress');
  fireEvent(screen.getByRole('button', { name: /Knebøy/ }), 'touchMove', { nativeEvent: { pageY: 180 } });
  fireEvent(screen.getByRole('button', { name: /Knebøy/ }), 'pressOut');
  fireEvent(screen.getByRole('button', { name: /Knebøy/ }), 'touchEnd');

  expect(await screen.findByRole('alert')).toHaveTextContent(/Kunne ikke flytte øvelsen\. Prøv igjen\./);
  expect(screen.getAllByText(/^(Knebøy|Markløft)$/).map((node) => node.props.children)).toEqual(['Knebøy', 'Markløft']);
  expect(screen.getByRole('button', { name: /Knebøy/ })).toHaveProp('accessibilityState', { expanded: false });
  expect(announce).toHaveBeenCalledWith('Kunne ikke flytte øvelsen. Prøv igjen.');
});

test('blocks navigation and further workout mutations while a reorder is being saved', async () => {
  let preventRemove: ((event: { data: { action: object } }) => void) | undefined;
  const dispatch = jest.fn();
  jest.mocked(usePreventRemove).mockImplementation((_, callback) => { preventRemove = callback as typeof preventRemove; });
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [
      ...workoutWithSets.exercises,
      { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] },
    ],
  });
  mockedReorderExercises.mockImplementation(() => new Promise(() => {}));
  renderScreen({ dispatch }, null);

  fireEvent(await screen.findByRole('button', { name: 'Knebøy' }), 'accessibilityAction', {
    nativeEvent: { actionName: 'moveDown' },
  });

  await waitFor(() => expect(usePreventRemove).toHaveBeenLastCalledWith(true, expect.any(Function)));
  expect(screen.getByRole('button', { name: 'Knebøy' })).toHaveProp('accessibilityActions', []);
  expect(screen.getByRole('button', { name: 'Legg til øvelse' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Avbryt' })).toBeDisabled();
  act(() => preventRemove?.({ data: { action: { type: 'GO_BACK' } } }));
  expect(dispatch).not.toHaveBeenCalled();
});

test('does not reorder while a set save is in progress', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [
      ...workoutWithSets.exercises,
      { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] },
    ],
  });
  mockedSave.mockImplementation(() => new Promise(() => {}));
  renderScreen({}, null);
  fireEvent.press(await screen.findByRole('button', { name: 'Knebøy' }));
  await openEditor(2);
  const load = await screen.findByLabelText('Belastning for Knebøy');
  fireEvent.changeText(load, '90');
  fireEvent(load, 'blur');
  await waitFor(() => expect(mockedSave).toHaveBeenCalled());

  const squat = screen.getByRole('button', { name: 'Knebøy' });
  expect(squat).toHaveProp('accessibilityActions', []);
  fireEvent(squat, 'accessibilityAction', { nativeEvent: { actionName: 'moveDown' } });
  expect(mockedReorderExercises).not.toHaveBeenCalled();
});

test('preserves expansion while the workout screen instance remains mounted', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  const view = renderScreen({}, null);
  const squat = await screen.findByRole('button', { name: 'Knebøy' });
  fireEvent.press(squat);

  view.rerender(workoutScreen({}, null));

  expect(squat).toHaveProp('accessibilityState', { expanded: true });
});

test('starts collapsed again after the workout screen is remounted', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  const view = renderScreen({}, null);
  const squat = await screen.findByRole('button', { name: 'Knebøy' });
  fireEvent.press(squat);
  expect(squat).toHaveProp('accessibilityState', { expanded: true });
  view.unmount();

  renderScreen({}, null);

  expect(await screen.findByRole('button', { name: 'Knebøy' })).toHaveProp('accessibilityState', { expanded: false });
});

test('removes only the deleted exercise from the expansion set', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [
      { ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] },
      { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] },
    ],
  });
  mockedRemoveExercise.mockResolvedValue();
  renderScreen();

  const deadlift = await screen.findByRole('button', { name: 'Markløft' });
  fireEvent.press(deadlift);
  fireEvent.press(screen.getByRole('button', { name: 'Fjern Knebøy fra treningen' }));

  await waitFor(() => expect(screen.queryByRole('button', { name: 'Knebøy' })).not.toBeOnTheScreen());
  expect(deadlift).toHaveProp('accessibilityState', { expanded: true });
});

test('removes a planned-only exercise immediately', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue({
    ...workoutWithSets,
    exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }],
  });
  mockedRemoveExercise.mockResolvedValue();
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Fjern Knebøy fra treningen' }));

  await waitFor(() => expect(mockedRemoveExercise).toHaveBeenCalledWith(database, 3, 4));
  expect(screen.queryByRole('header', { name: 'Fjern øvelsen?' })).not.toBeOnTheScreen();
  expect(screen.getByText('Ingen øvelser lagt til ennå')).toHaveStyle(typography.body);
  expect(focus).toHaveBeenCalled();
});

test('requires confirmation before removing an exercise with completed sets', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedRemoveExercise.mockResolvedValue();
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Fjern Knebøy fra treningen' }));
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

  fireEvent.press(await screen.findByRole('button', { name: 'Fjern Knebøy fra treningen' }));
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

  fireEvent.press(await screen.findByRole('button', { name: 'Fjern Knebøy fra treningen' }));
  fireEvent.press(screen.getByRole('button', { name: 'Behold øvelsen' }));
  expect(screen.queryByText('Fjern øvelsen?')).not.toBeOnTheScreen();
  expect(focus).toHaveBeenCalled();

  fireEvent.press(screen.getByRole('button', { name: 'Fjern Knebøy fra treningen' }));
  fireEvent.press(screen.getByRole('button', { name: 'Bekreft fjerning av øvelsen' }));
  expect(await screen.findByRole('button', { name: 'Bekreft fjerning av øvelsen' })).toHaveProp('accessibilityState', { busy: true, disabled: true });
  expect(screen.getByRole('button', { name: 'Behold øvelsen' })).toBeDisabled();
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
  expect(await screen.findByRole('alert')).toHaveTextContent(/Kunne ikke legge til settet. Prøv igjen\./);
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
  expect(focus).toHaveBeenCalled();
  expect(screen.getByText('Knebøy')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Prøv igjen' }));

  await waitFor(() => expect(mockedAddSet).toHaveBeenCalledTimes(2));
  expect(screen.getAllByText('Planlagt')).toHaveLength(2);
});

test('keeps the exercise and offers retry when removal fails', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue({
    ...workoutWithSets,
    exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }],
  });
  mockedRemoveExercise.mockRejectedValueOnce(new Error('write failed')).mockResolvedValueOnce();
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Fjern Knebøy fra treningen' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Kunne ikke fjerne øvelsen. Prøv igjen\./);
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
  expect(card).toHaveStyle({ minHeight: 56 });
  expect(addSet).toHaveStyle({ minHeight: 48 });
  await openEditor(2);
  expect(screen.getByLabelText('Handlinger for sett 2 for Knebøy')).toHaveStyle({ flexDirection: 'row', flexWrap: 'wrap' });
});

test('validates input and atomically confirms comma decimals', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }] });
  mockedConfirm.mockResolvedValue();
  renderScreen();
  await openEditor(1);
  const load = await screen.findByLabelText('Belastning for Knebøy');
  const repetitions = screen.getByLabelText('Repetisjoner for Knebøy');

  fireEvent.changeText(load, '1000');
  fireEvent.changeText(repetitions, '0');
  fireEvent.press(screen.getByRole('button', { name: 'Marker sett 1 som gjennomført for Knebøy' }));
  expect(await screen.findAllByRole('alert')).toHaveLength(2);
  expect(load).toHaveProp('aria-invalid', true);
  expect(repetitions).toHaveProp('aria-invalid', true);
  expect(load).toHaveProp('aria-describedby', 'load-error-6');
  expect(repetitions).toHaveProp('aria-describedby', 'repetitions-error-6');
  expect(screen.getByText('Skriv inn en belastning fra 0 til 999,9 med maks én desimal')).toHaveProp('nativeID', 'load-error-6');
  expect(screen.getByText('Skriv inn et helt antall repetisjoner fra 1 til 999')).toHaveProp('nativeID', 'repetitions-error-6');
  expect(focus).toHaveBeenCalled();
  expect(mockedConfirm).not.toHaveBeenCalled();

  fireEvent.changeText(load, '80,5');
  fireEvent.changeText(repetitions, '5');
  mockedSave.mockResolvedValue();
  fireEvent.press(screen.getByRole('button', { name: 'Marker sett 1 som gjennomført for Knebøy' }));
  await waitFor(() => expect(mockedSave).toHaveBeenCalledWith(database, 3, 6, 80.5, 5));
  await waitFor(() => expect(mockedConfirm).toHaveBeenCalledWith(database, 3, 6, 80.5, 5, expect.any(String)));
  expect(screen.getByLabelText('Belastning for Knebøy')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Lukk redigering av sett 1 for Knebøy' })).toBeOnTheScreen();
});

test('does not let input blur consume a status action', async () => {
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }] });
  mockedSave.mockResolvedValue();
  mockedConfirm.mockResolvedValue();
  renderScreen();
  await openEditor(1);
  fireEvent.changeText(screen.getByLabelText('Belastning for Knebøy'), '80');
  fireEvent.changeText(screen.getByLabelText('Repetisjoner for Knebøy'), '5');
  const status = screen.getByRole('button', { name: 'Marker sett 1 som gjennomført for Knebøy' });

  fireEvent(screen.getByLabelText('Belastning for Knebøy'), 'blur');
  fireEvent.press(status);

  await waitFor(() => expect(mockedConfirm).toHaveBeenCalled());
  expect(mockedSave).toHaveBeenCalledTimes(1);
});

test('uses a secondary button to mark a planned set as completed', async () => {
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }] });
  renderScreen();

  const statusButton = await screen.findByRole('button', { name: 'Marker sett 1 som gjennomført for Knebøy' });
  expect(statusButton).toHaveStyle({
    backgroundColor: lightColors.surface,
    borderColor: lightColors.border,
    borderWidth: 1,
  });
});

test('preserves an open completed-set editor when returning it to planned', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedUnconfirm.mockResolvedValue();
  renderScreen();
  await openEditor(1);

  fireEvent.press(screen.getByRole('button', { name: 'Endre sett 1 til planlagt for Knebøy' }));

  await waitFor(() => expect(mockedUnconfirm).toHaveBeenCalledWith(database, 3, 7));
  expect(exerciseProgress(4)).toBe(0);
  expect(screen.getByLabelText('Belastning for Knebøy')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Lukk redigering av sett 1 for Knebøy' })).toBeOnTheScreen();
});

test('flushes a dirty draft before allowing stack navigation', async () => {
  let preventRemove: ((event: { data: { action: object } }) => void) | undefined;
  let finishSave: () => void = () => undefined;
  const dispatch = jest.fn();
  jest.mocked(usePreventRemove).mockImplementation((_, callback) => { preventRemove = callback as typeof preventRemove; });
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedSave.mockImplementation(() => new Promise<void>((resolve) => { finishSave = resolve; }));
  renderScreen({ dispatch });
  await openEditor(2);
  fireEvent.changeText(await screen.findByLabelText('Belastning for Knebøy'), '90');
  await waitFor(() => expect(usePreventRemove).toHaveBeenLastCalledWith(true, expect.any(Function)));
  const action = { type: 'GO_BACK' };

  act(() => preventRemove?.({ data: { action } }));
  expect(dispatch).not.toHaveBeenCalled();
  await waitFor(() => expect(mockedSave).toHaveBeenCalled());
  await act(async () => finishSave());
  await waitFor(() => expect(dispatch).toHaveBeenCalledWith(action));
});

test('keeps stack navigation blocked when its draft flush fails', async () => {
  let preventRemove: ((event: { data: { action: object } }) => void) | undefined;
  const dispatch = jest.fn();
  jest.mocked(usePreventRemove).mockImplementation((_, callback) => { preventRemove = callback as typeof preventRemove; });
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedSave.mockRejectedValue(new Error('write failed'));
  renderScreen({ dispatch });
  await openEditor(2);
  fireEvent.changeText(await screen.findByLabelText('Belastning for Knebøy'), '90');

  act(() => preventRemove?.({ data: { action: { type: 'GO_BACK' } } }));

  expect(await screen.findByText('Endringene er ikke lagret')).toBeOnTheScreen();
  expect(dispatch).not.toHaveBeenCalled();
});

test('keeps a failed valid autosave visible until manual retry succeeds', async () => {
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }] });
  mockedSave.mockRejectedValueOnce(new Error('write failed')).mockResolvedValueOnce();
  renderScreen();
  await openEditor(1);
  const load = await screen.findByLabelText('Belastning for Knebøy');

  fireEvent.changeText(load, '80');
  fireEvent(load, 'blur');
  expect(await screen.findByText('Endringene er ikke lagret')).toBeOnTheScreen();
  expect(screen.getByText('Endringene er ikke lagret')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Prøv å lagre igjen' }));

  await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('Endringene er ikke lagret')).not.toBeOnTheScreen();
});

test('focuses manual retry after autosave fails', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }] });
  mockedSave.mockRejectedValue(new Error('write failed'));
  renderScreen();
  await openEditor(1);
  const load = await screen.findByLabelText('Belastning for Knebøy');

  fireEvent.changeText(load, '80');
  fireEvent.changeText(screen.getByLabelText('Repetisjoner for Knebøy'), '5');
  fireEvent(load, 'blur');

  expect(await screen.findByRole('button', { name: 'Prøv å lagre igjen' })).toBeOnTheScreen();
  expect(focus).toHaveBeenCalled();
});

test('serializes field autosaves', async () => {
  let finishFirst: () => void = () => undefined;
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }] });
  mockedSave.mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; })).mockResolvedValueOnce();
  renderScreen();
  await openEditor(1);
  const load = await screen.findByLabelText('Belastning for Knebøy');
  const repetitions = screen.getByLabelText('Repetisjoner for Knebøy');
  fireEvent.changeText(load, '80');
  fireEvent.changeText(repetitions, '5');

  fireEvent(load, 'blur');
  await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(1));
  await act(async () => finishFirst());
  fireEvent.changeText(repetitions, '6');
  fireEvent(repetitions, 'blur');

  await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(2));
});

test('keeps fields editable while an autosave is pending', async () => {
  let finishSave: () => void = () => undefined;
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }] });
  mockedSave.mockImplementation(() => new Promise<void>((resolve) => { finishSave = resolve; }));
  renderScreen();
  await openEditor(1);
  const load = await screen.findByLabelText('Belastning for Knebøy');
  const repetitions = screen.getByLabelText('Repetisjoner for Knebøy');

  fireEvent.changeText(load, '80');
  fireEvent(load, 'blur');
  await waitFor(() => expect(mockedSave).toHaveBeenCalledWith(database, 3, 6, 80, null));

  expect(load).not.toHaveProp('editable', false);
  expect(repetitions).not.toHaveProp('editable', false);
  fireEvent.changeText(repetitions, '5');
  expect(repetitions).toHaveProp('value', '5');

  await act(async () => finishSave());
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
  await openEditor(1);
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
  mockedLoad.mockResolvedValueOnce({ id: 3, startedAt: STARTED_AT, exercises: [] }).mockResolvedValueOnce(workoutWithSets);
  renderScreen();
  expect(await screen.findByText('Ingen øvelser lagt til ennå')).toBeOnTheScreen();

  act(() => onAppStateChange?.('active'));

  expect(await screen.findByText('Knebøy')).toBeOnTheScreen();
  expect(mockedLoad).toHaveBeenCalledTimes(2);
});

test('preserves expanded exercises when the mounted screen reloads', async () => {
  let onAppStateChange: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    onAppStateChange = listener;
    return { remove: jest.fn() };
  });
  const workout = {
    id: 3,
    startedAt: STARTED_AT,
    exercises: [
      ...workoutWithSets.exercises,
      { id: 9, exerciseId: 10, name: 'Markløft', position: 1, sets: [] },
    ],
  };
  mockedLoad.mockResolvedValue(workout);
  renderScreen({}, null);
  const squat = await screen.findByRole('button', { name: 'Knebøy' });
  const deadlift = screen.getByRole('button', { name: 'Markløft' });
  fireEvent.press(squat);
  fireEvent.press(deadlift);

  act(() => onAppStateChange?.('active'));

  await waitFor(() => expect(mockedLoad).toHaveBeenCalledTimes(2));
  expect(squat).toHaveProp('accessibilityState', { expanded: true });
  expect(deadlift).toHaveProp('accessibilityState', { expanded: true });
});

test('waits for the background editor save before foreground reload', async () => {
  let onAppStateChange: ((state: AppStateStatus) => void) | undefined;
  let finishFirst: () => void = () => undefined;
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
  mockedSave.mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; }));
  renderScreen();
  await openEditor(1);
  fireEvent.changeText(screen.getByLabelText('Belastning for Knebøy'), '80');

  act(() => onAppStateChange?.('background'));
  await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(1));
  act(() => onAppStateChange?.('active'));
  await act(async () => finishFirst());
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
  await openEditor(1);
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
  await openEditor(1);
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
  await openEditor(1);
  const load = await screen.findByLabelText('Belastning for Knebøy');
  fireEvent.changeText(load, '80');
  fireEvent(load, 'blur');
  expect(await screen.findByText('Endringene er ikke lagret')).toBeOnTheScreen();

  view.rerender(sharedScreen('home'));
  expect(await screen.findByText('Treningen har endringer som ikke er lagret')).toBeOnTheScreen();
  expect(screen.getByTestId('home-unsaved-warning').props.accessibilityRole).toBe('alert');
  view.rerender(sharedScreen('workout'));
  await openEditor(1);
  const reopenedLoad = await screen.findByLabelText('Belastning for Knebøy');
  expect(reopenedLoad).toHaveProp('value', '80');
  expect(screen.getByRole('button', { name: 'Prøv å lagre igjen' })).toBeOnTheScreen();
  fireEvent(reopenedLoad, 'blur');
  await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(1));
});

test('focuses retry after a status mutation fails', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedUnconfirm.mockRejectedValue(new Error('write failed'));
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Endre sett 1 til planlagt for Knebøy' }));

  expect(await screen.findByRole('button', { name: 'Prøv igjen' })).toBeOnTheScreen();
  expect(focus).toHaveBeenCalled();
});

test('focuses the next set after removing the first planned set', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue({
    id: 3,
    startedAt: STARTED_AT,
    exercises: [{
      id: 4, exerciseId: 5, name: 'Knebøy', position: 0,
      sets: [
        { id: 6, loadKg: 80, repetitions: 5, confirmedAt: null },
        { id: 8, loadKg: 90, repetitions: 3, confirmedAt: null },
      ],
    }],
  });
  mockedDelete.mockResolvedValue();
  renderScreen();
  await openEditor(1);
  focus.mockClear();

  fireEvent.press(screen.getByRole('button', { name: 'Fjern sett 1 for Knebøy' }));

  await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith(database, 3, 6));
  expect(screen.getByLabelText('Sett 1, 90 kilogram, 3 repetisjoner, Planlagt')).toBeOnTheScreen();
  expect(focus).toHaveBeenCalled();
});

test.each([
  ['success', undefined, Haptics.NotificationFeedbackType.Success],
  ['error', new Error('write failed'), Haptics.NotificationFeedbackType.Error],
] as const)('uses %s haptics for completed-set autosave', async (_, failure, feedback) => {
  mockedLoad.mockResolvedValue({
    ...workoutWithSets,
    exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[0]] }],
  });
  if (failure) mockedSaveCompleted.mockRejectedValue(failure);
  else mockedSaveCompleted.mockResolvedValue();
  renderScreen();
  await openEditor(1);
  jest.mocked(Haptics.notificationAsync).mockClear();

  const load = screen.getByLabelText('Belastning for Knebøy');
  fireEvent.changeText(load, '82,5');
  fireEvent(load, 'blur');

  await waitFor(() => expect(mockedSaveCompleted).toHaveBeenCalledWith(database, 3, 7, 82.5, 5));
  await waitFor(() => expect(Haptics.notificationAsync).toHaveBeenCalledWith(feedback));
});

test('persists a valid field without overwriting invalid input in the other field', async () => {
  mockedLoad.mockResolvedValue({ ...workoutWithSets, exercises: [{ ...workoutWithSets.exercises[0], sets: [workoutWithSets.exercises[0].sets[1]] }] });
  mockedSave.mockResolvedValue();
  renderScreen();
  await openEditor(1);
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
  await openEditor(1);
  const load = await screen.findByLabelText('Belastning for Knebøy');
  const repetitions = screen.getByLabelText('Repetisjoner for Knebøy');
  fireEvent.changeText(load, '80');
  fireEvent.changeText(repetitions, '5');
  mockedSave.mockResolvedValue();

  fireEvent.press(screen.getByRole('button', { name: 'Marker sett 1 som gjennomført for Knebøy' }));

  expect(await screen.findByText('Kunne ikke bekrefte settet')).toBeOnTheScreen();
  expect(load).toHaveProp('value', '80');
  expect(repetitions).toHaveProp('value', '5');
  expect(screen.getByLabelText('Sett 1, 80 kilogram, 5 repetisjoner, Planlagt')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Prøv å bekrefte igjen' })).toBeOnTheScreen();
});

test('atomically saves and confirms deletion of a completed set without changing status', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedSaveCompleted.mockResolvedValue();
  mockedDeleteCompleted.mockResolvedValue();
  renderScreen();

  await openEditor(1);
  fireEvent.changeText(screen.getByLabelText('Belastning for Knebøy'), '82,5');
  fireEvent(screen.getByLabelText('Belastning for Knebøy'), 'blur');
  await waitFor(() => expect(mockedSaveCompleted).toHaveBeenCalledWith(database, 3, 7, 82.5, 5));
  expect(mockedUnconfirm).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Fjern sett 1 for Knebøy' }));
  expect(dismiss).toHaveBeenCalled();
  expect(screen.getByRole('header', { name: 'Fjern gjennomført sett?' })).toBeOnTheScreen();
  expect(mockedDeleteCompleted).not.toHaveBeenCalled();
  focus.mockClear();
  fireEvent.press(screen.getByRole('button', { name: 'Bekreft fjerning av gjennomført sett' }));
  await waitFor(() => expect(mockedDeleteCompleted).toHaveBeenCalledWith(database, 3, 7));
  expect(focus).toHaveBeenCalled();
});

test('requires renewed confirmation when completed-set deletion fails', async () => {
  mockedLoad.mockResolvedValue(workoutWithSets);
  mockedDeleteCompleted.mockRejectedValueOnce(new Error('write failed')).mockResolvedValueOnce();
  renderScreen();
  await openEditor(1);
  fireEvent.press(screen.getByRole('button', { name: 'Fjern sett 1 for Knebøy' }));

  fireEvent.press(screen.getByRole('button', { name: 'Bekreft fjerning av gjennomført sett' }));

  expect(await screen.findByText('Kunne ikke fjerne det gjennomførte settet. Prøv igjen.')).toBeOnTheScreen();
  expect(screen.queryByRole('header', { name: 'Fjern gjennomført sett?' })).not.toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Prøv igjen' }));
  expect(screen.getByRole('header', { name: 'Fjern gjennomført sett?' })).toBeOnTheScreen();
  expect(mockedDeleteCompleted).toHaveBeenCalledTimes(1);

  fireEvent.press(screen.getByRole('button', { name: 'Bekreft fjerning av gjennomført sett' }));
  await waitFor(() => expect(mockedDeleteCompleted).toHaveBeenCalledTimes(2));
});

test.each([
  ['empty', []],
  ['populated', [{ id: 4, exerciseId: 5, name: 'Knebøy', position: 0, sets: [] }]],
])('confirms cancellation of an %s workout before returning Home', async (_, exercises) => {
  const popTo = jest.fn();
  mockedLoad.mockResolvedValue({ id: 3, startedAt: STARTED_AT, exercises });
  mockedCancel.mockResolvedValue();
  renderScreen({ popTo });

  fireEvent.press(await screen.findByRole('button', { name: 'Avbryt' }));
  expect(screen.getByRole('header', { name: 'Avbryt treningen?' })).toBeOnTheScreen();
  expect(screen.getByText('Treningen slettes permanent og vises ikke i historikken.')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Avbryt treningen' }));

  await waitFor(() => expect(mockedCancel).toHaveBeenCalledWith(database, 3));
  expect(popTo).toHaveBeenCalledWith('Home', { focusStartWorkout: true });
});

test('closes the dialog without deleting and restores focus to Avbryt', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue({ id: 3, startedAt: STARTED_AT, exercises: [] });
  const { UNSAFE_getByType } = renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Avbryt' }));
  expect(UNSAFE_getByType(Modal).props.onShow).toEqual(expect.any(Function));
  fireEvent.press(screen.getByRole('button', { name: 'Behold treningen' }));

  expect(screen.queryByText('Avbryt treningen?')).not.toBeOnTheScreen();
  expect(mockedCancel).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Avbryt' })).toBeOnTheScreen();
  expect(focus).toHaveBeenCalled();
});

test('platform Back closes the confirmation dialog first', async () => {
  mockedLoad.mockResolvedValue({ id: 3, startedAt: STARTED_AT, exercises: [] });
  const { UNSAFE_getByType } = renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Avbryt' }));
  fireEvent(UNSAFE_getByType(Modal), 'requestClose');

  expect(screen.queryByText('Avbryt treningen?')).not.toBeOnTheScreen();
  expect(mockedCancel).not.toHaveBeenCalled();
});

test('exposes cancellation busy state and ignores dismissal while cancellation is pending', async () => {
  mockedLoad.mockResolvedValue({ id: 3, startedAt: STARTED_AT, exercises: [] });
  mockedCancel.mockImplementation(() => new Promise(() => {}));
  const { UNSAFE_getByType } = renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Avbryt' }));
  fireEvent.press(screen.getByRole('button', { name: 'Avbryt treningen' }));
  expect(screen.getByRole('button', { name: 'Avbryter' })).toHaveProp('accessibilityState', { busy: true, disabled: true });
  expect(screen.getByRole('button', { name: 'Behold treningen' })).toBeDisabled();
  fireEvent(UNSAFE_getByType(Modal), 'requestClose');
  expect(screen.getByRole('header', { name: 'Avbryt treningen?' })).toBeOnTheScreen();
});

test('preserves the workout, announces retry, and does not navigate when cancellation fails', async () => {
  const popTo = jest.fn();
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue({ id: 3, startedAt: STARTED_AT, exercises: [] });
  mockedCancel.mockRejectedValue(new Error('write failed'));
  renderScreen({ popTo });

  fireEvent.press(await screen.findByRole('button', { name: 'Avbryt' }));
  fireEvent.press(screen.getByRole('button', { name: 'Avbryt treningen' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/Kunne ikke avbryte treningen/);
  expect(screen.queryByText('Avbryt treningen?')).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Prøv igjen' })).toBeOnTheScreen();
  expect(announce).toHaveBeenCalledWith('Kunne ikke avbryte treningen. Prøv igjen.');
  expect(focus).toHaveBeenCalled();
  expect(popTo).not.toHaveBeenCalled();
});

function renderScreen(
  navigation: Record<string, jest.Mock> = {},
  params: { focusExerciseId?: number; focusAddExercise?: boolean } | null = { focusExerciseId: 5 },
) {
  return render(workoutScreen(navigation, params));
}

async function openEditor(setNumber: number) {
  fireEvent.press(await screen.findByRole('button', { name: `Rediger sett ${setNumber} for Knebøy` }));
}

function workoutScreen(
  navigation: Record<string, jest.Mock> = {},
  params: { focusExerciseId?: number; focusAddExercise?: boolean } | null = { focusExerciseId: 5 },
) {
  const mergedNavigation = { navigate: jest.fn(), popTo: jest.fn(), replace: jest.fn(), setParams: jest.fn(), ...navigation };
  return (
    <AppThemeProvider>
      <DatabaseProvider database={database}>
        <WorkoutSetDraftProvider>
          <NavigationContainer>
            <WorkoutScreen
            navigation={mergedNavigation as never}
            route={{ params: params ?? undefined } as never}
          />
          </NavigationContainer>
        </WorkoutSetDraftProvider>
      </DatabaseProvider>
    </AppThemeProvider>
  );
}

function sharedScreen(screenName: 'home' | 'workout') {
  return (
    <AppThemeProvider><TrainingDataDeletionProvider>
      <DatabaseProvider database={database}>
        <WorkoutSetDraftProvider>
          <NavigationContainer>
          {screenName === 'home' ? (
            <HomeScreen navigation={{ navigate: jest.fn() } as never} route={{ params: undefined } as never} />
          ) : (
            <WorkoutScreen
              navigation={{ navigate: jest.fn(), popTo: jest.fn(), setParams: jest.fn() } as never}
              route={{ params: { focusExerciseId: 5 } } as never}
            />
          )}
          </NavigationContainer>
        </WorkoutSetDraftProvider>
      </DatabaseProvider>
    </TrainingDataDeletionProvider></AppThemeProvider>
  );
}

function renderSharedScreen(screenName: 'home' | 'workout') {
  return render(sharedScreen(screenName));
}
