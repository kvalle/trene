export const APP_LOCALE = 'nb-NO';

export function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(value);
}

export function formatLoad(value: number): string {
  return new Intl.NumberFormat(APP_LOCALE, {
    maximumFractionDigits: 1,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}
