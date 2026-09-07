import Storage from 'expo-sqlite/kv-store';

import { appearancePreferenceStore } from '../appearancePreference';

jest.mock('expo-sqlite/kv-store', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

const mockedStorage = jest.mocked(Storage);

beforeEach(() => jest.clearAllMocks());

it.each([
  ['system', 'system'],
  ['light', 'light'],
  ['dark', 'dark'],
  [null, 'system'],
  ['invalid', 'system'],
] as const)('resolves stored value %s as %s', async (stored, expected) => {
  mockedStorage.getItem.mockResolvedValue(stored);
  await expect(appearancePreferenceStore.read()).resolves.toBe(expected);
});

it('persists independently under the appearance key', async () => {
  mockedStorage.setItem.mockResolvedValue();
  await appearancePreferenceStore.write('dark');
  expect(mockedStorage.setItem).toHaveBeenCalledWith('appearance-preference', 'dark');
});
