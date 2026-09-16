import Storage from 'expo-sqlite/kv-store';

import { activeWorkoutVisibilityPreferenceStore } from '../activeWorkoutVisibilityPreference';

jest.mock('expo-sqlite/kv-store', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

const mockedStorage = jest.mocked(Storage);

beforeEach(() => jest.clearAllMocks());

it.each([
  ['enabled', 'enabled'],
  ['disabled', 'disabled'],
  [null, 'enabled'],
  ['invalid', 'enabled'],
] as const)('resolves stored value %s as %s', async (stored, expected) => {
  mockedStorage.getItem.mockResolvedValue(stored);
  await expect(activeWorkoutVisibilityPreferenceStore.read()).resolves.toBe(expected);
});

it('persists under an independent key', async () => {
  mockedStorage.setItem.mockResolvedValue();
  await activeWorkoutVisibilityPreferenceStore.write('disabled');
  expect(mockedStorage.setItem).toHaveBeenCalledWith('active-workout-system-visibility', 'disabled');
});
