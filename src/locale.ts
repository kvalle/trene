export const APP_LOCALE = 'nb-NO';

export function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(value);
}

export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new RangeError('Duration must be a non-negative finite number');
  }
  const totalMinutes = Math.floor(milliseconds / 60_000);
  if (totalMinutes < 1) return '< 1 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} t`;
  return `${hours} t ${minutes} min`;
}

export function formatLoad(value: number): string {
  return new Intl.NumberFormat(APP_LOCALE, {
    maximumFractionDigits: 1,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}
