import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

export const lightTheme: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: '#155e4b',
    background: '#f7f5ef',
    card: '#ffffff',
    text: '#17201d',
    border: '#66736e',
    notification: '#b42318',
  },
};

export const darkTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: '#78d6b7',
    background: '#101614',
    card: '#19211e',
    text: '#edf2ef',
    border: '#87948f',
    notification: '#ffb4ab',
  },
};
