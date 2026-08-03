import { APP_LOCALE, formatDateTime, formatLoad } from '../locale';

test('formats dates in Norwegian Bokmål', () => {
  expect(APP_LOCALE).toBe('nb-NO');
  expect(formatDateTime(new Date('2026-08-03T10:30:00Z'))).toMatch(/august/);
  expect(formatLoad(12.5)).toBe('12,5');
});
