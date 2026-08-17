import { asFileUri } from '../nativeRestorePlatform';

test.each([
  ['/data/user/0/no.kvalle.trene/databases', 'file:///data/user/0/no.kvalle.trene/databases'],
  ['file:///data/user/0/no.kvalle.trene/databases', 'file:///data/user/0/no.kvalle.trene/databases'],
])('normalizes the SQLite directory for the file-system boundary', (path, expected) => {
  expect(asFileUri(path)).toBe(expected);
});
