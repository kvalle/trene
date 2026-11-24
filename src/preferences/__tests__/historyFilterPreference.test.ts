import Storage from 'expo-sqlite/kv-store';

import { historyFilterPreferenceStore } from '../historyFilterPreference';

jest.mock('expo-sqlite/kv-store', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

const mockedStorage = jest.mocked(Storage);

beforeEach(() => jest.clearAllMocks());

it.each([
  ['[2,5]', [2, 5]],
  [null, []],
  ['invalid', []],
  ['{"a":1}', []],
  ['[1,"x",2.5,3]', [1, 3]],
] as const)('reads stored value %s as hidden ids %j', async (stored, expected) => {
  mockedStorage.getItem.mockResolvedValue(stored);
  await expect(historyFilterPreferenceStore.read()).resolves.toEqual(new Set(expected));
});

it('persists the hidden ids under an independent key', async () => {
  mockedStorage.setItem.mockResolvedValue();
  await historyFilterPreferenceStore.write(new Set([5, 2]));
  expect(mockedStorage.setItem).toHaveBeenCalledWith('history-hidden-training-contexts', '[2,5]');
});
