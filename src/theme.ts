import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

export type SemanticColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  muted: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  border: string;
  danger: string;
  onDanger: string;
  focus: string;
};

export const lightColors: SemanticColors = {
  background: '#f5f7f2',
  surface: '#ffffff',
  surfaceAlt: '#e8f0e6',
  text: '#17261e',
  muted: '#617168',
  primary: '#246b4d',
  onPrimary: '#ffffff',
  secondary: '#d8e8dc',
  onSecondary: '#214b35',
  border: '#bdcbbf',
  danger: '#a43f36',
  onDanger: '#ffffff',
  focus: '#8abfa4',
};

export const darkColors: SemanticColors = {
  background: '#111713',
  surface: '#1a241e',
  surfaceAlt: '#24382c',
  text: '#edf4ef',
  muted: '#a6b7ad',
  primary: '#80c9a2',
  onPrimary: '#102019',
  secondary: '#294535',
  onSecondary: '#d9f2e2',
  border: '#405247',
  danger: '#ffb4aa',
  onDanger: '#2b0b08',
  focus: '#80c9a2',
};

export const typography = {
  screenTitle: { fontSize: 30, fontWeight: '700' as const, lineHeight: 37 },
  sectionTitle: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  body: { fontSize: 17, fontWeight: '400' as const, lineHeight: 25 },
  metadata: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  control: { fontSize: 17, fontWeight: '700' as const, lineHeight: 23 },
};

export const radii = { container: 12, control: 9 } as const;

export const lightTheme: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: lightColors.primary,
    background: lightColors.background,
    card: lightColors.surface,
    text: lightColors.text,
    border: lightColors.border,
    notification: lightColors.danger,
  },
};

export const darkTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: darkColors.primary,
    background: darkColors.background,
    card: darkColors.surface,
    text: darkColors.text,
    border: darkColors.border,
    notification: darkColors.danger,
  },
};

export function getTheme(scheme: string | null | undefined) {
  return scheme === 'dark'
    ? { colors: darkColors, navigation: darkTheme, scheme: 'dark' as const }
    : { colors: lightColors, navigation: lightTheme, scheme: 'light' as const };
}
