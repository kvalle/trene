import { fireEvent, render, screen } from '@testing-library/react-native';
import ComponentCatalog from '../ComponentCatalog';

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => (
    require('react').createElement(require('react-native').View, null, children)
  ),
  DarkTheme: { dark: true, colors: {} },
  DefaultTheme: { dark: false, colors: {} },
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => (
      require('react').createElement(require('react-native').View, null, children)
    ),
    Screen: ({ children, name }: { children?: (props: object) => React.ReactNode; name: string }) =>
      name === 'Overview'
        ? children?.({ navigation: { navigate: jest.fn() }, route: { key: 'Overview', name: 'Overview' } })
        : require('react').createElement(require('react-native').Text, null, name),
  }),
}));

it('renders production theme contexts and switches theme', () => {
  render(<ComponentCatalog />);

  expect(screen.getByRole('header', { name: 'Komponentbibliotek' })).toBeOnTheScreen();
  expect(screen.getByText(/Aktuell systemskala:/)).toBeOnTheScreen();
  // overview groups and components
  expect(screen.getByText('HANDLINGER')).toBeOnTheScreen();
  expect(screen.getByText('Button')).toBeOnTheScreen();
  expect(screen.getByText('SKJEMA')).toBeOnTheScreen();
  expect(screen.getByText('TextField')).toBeOnTheScreen();
  expect(screen.getByText('FieldError')).toBeOnTheScreen();
  expect(screen.getByText('NAVIGASJON OG STRUKTUR')).toBeOnTheScreen();
  expect(screen.getByText('Hero')).toBeOnTheScreen();
  expect(screen.getByText('FEEDBACK')).toBeOnTheScreen();
  expect(screen.getByText('Loader')).toBeOnTheScreen();
  expect(screen.getByText('ErrorAlert')).toBeOnTheScreen();
  expect(screen.getByText('SIDEVISNINGER')).toBeOnTheScreen();
  expect(screen.getByText('PageStatus')).toBeOnTheScreen();
  // detail screens are mounted via mock as text fallbacks
  expect(screen.getByText('ButtonDetail')).toBeOnTheScreen();
  expect(screen.getByText('TextFieldDetail')).toBeOnTheScreen();
  expect(screen.getByText('FieldErrorDetail')).toBeOnTheScreen();
  expect(screen.getByText('AppShellDetail')).toBeOnTheScreen();
  expect(screen.getByText('HeroDetail')).toBeOnTheScreen();
  expect(screen.getByText('LoaderDetail')).toBeOnTheScreen();
  expect(screen.getByText('ErrorAlertDetail')).toBeOnTheScreen();
  expect(screen.getByText('PageStatusDetail')).toBeOnTheScreen();

  fireEvent(screen.getByLabelText('Mørk modus'), 'valueChange', true);
  expect(screen.getByLabelText('Mørk modus')).toBeOnTheScreen();
});
