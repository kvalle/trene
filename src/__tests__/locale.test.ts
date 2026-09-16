import { APP_LOCALE, formatDateTime, formatDuration, formatLoad } from '../locale';

test('formats dates in Norwegian Bokmål', () => {
  expect(APP_LOCALE).toBe('nb-NO');
  expect(formatDateTime(new Date(2026, 7, 3, 10, 30))).toBe('3. august 2026 kl. 10:30');
  expect(formatLoad(12.5)).toBe('12,5');
});

test('formats compact Norwegian durations', () => {
  expect(formatDuration(0)).toBe('< 1 min');
  expect(formatDuration(30_000)).toBe('< 1 min');
  expect(formatDuration(60_000)).toBe('1 min');
  expect(formatDuration(45 * 60_000)).toBe('45 min');
  expect(formatDuration(60 * 60_000)).toBe('1 t');
  expect(formatDuration(90 * 60_000)).toBe('1 t 30 min');
  expect(formatDuration(25 * 60 * 60_000)).toBe('25 t');
  expect(() => formatDuration(-1)).toThrow(RangeError);
  expect(() => formatDuration(Number.NaN)).toThrow(RangeError);
});
