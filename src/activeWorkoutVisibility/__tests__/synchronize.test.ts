import { getActiveWorkoutId } from '../../database/workouts';
import {
  resolveActiveWorkoutVisibilityNavigationIntent,
  synchronizeActiveWorkoutVisibility,
} from '../synchronize';
import type { ActiveWorkoutVisibilityPlatform } from '../platform';

jest.mock('../../database/workouts', () => ({ getActiveWorkoutId: jest.fn() }));

const mockedGetActiveWorkoutId = jest.mocked(getActiveWorkoutId);
const database = {} as never;

function createPlatform(): jest.Mocked<ActiveWorkoutVisibilityPlatform> {
  return {
    inspectCapability: jest.fn(),
    show: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    openSettings: jest.fn(),
    getInitialTap: jest.fn(),
    subscribeToTaps: jest.fn(),
  };
}

beforeEach(() => jest.clearAllMocks());

it.each([
  [7, 'enabled', 'show'],
  [7, 'disabled', 'remove'],
  [null, 'enabled', 'remove'],
  [null, 'disabled', 'remove'],
] as const)('projects active workout %s and preference %s through %s', async (activeWorkoutId, preference, operation) => {
  mockedGetActiveWorkoutId.mockResolvedValue(activeWorkoutId);
  const preferenceStore = { read: jest.fn().mockResolvedValue(preference), write: jest.fn() };
  const platform = createPlatform();

  await expect(synchronizeActiveWorkoutVisibility(database, preferenceStore, platform)).resolves.toEqual({
    activeWorkoutId,
    enabled: preference === 'enabled',
  });

  expect(platform[operation]).toHaveBeenCalledTimes(1);
  expect(platform[operation === 'show' ? 'remove' : 'show']).not.toHaveBeenCalled();
});

it('does not let native failures reject synchronization', async () => {
  mockedGetActiveWorkoutId.mockResolvedValue(7);
  const platform = createPlatform();
  platform.show.mockRejectedValue(new Error('native failed'));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

  await expect(synchronizeActiveWorkoutVisibility(
    database,
    { read: jest.fn().mockResolvedValue('enabled'), write: jest.fn() },
    platform,
  )).resolves.toEqual({ activeWorkoutId: 7, enabled: true });
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

it.each([
  [9, 'Workout'],
  [null, 'Home'],
] as const)('resolves notification taps with active workout %s to %s', async (activeWorkoutId, destination) => {
  mockedGetActiveWorkoutId.mockResolvedValue(activeWorkoutId);
  await expect(resolveActiveWorkoutVisibilityNavigationIntent(database)).resolves.toBe(destination);
});

it('does not inspect platform capability before deciding the projection', async () => {
  mockedGetActiveWorkoutId.mockResolvedValue(7);
  const platform = createPlatform();
  platform.inspectCapability.mockRejectedValue(new Error('inspection unavailable'));

  await synchronizeActiveWorkoutVisibility(
    database,
    { read: jest.fn().mockResolvedValue('enabled'), write: jest.fn() },
    platform,
  );

  expect(platform.show).toHaveBeenCalled();
  expect(platform.inspectCapability).not.toHaveBeenCalled();
});
