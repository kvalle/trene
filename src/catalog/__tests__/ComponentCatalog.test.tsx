import { fireEvent, render, screen } from '@testing-library/react-native';
import ComponentCatalog, { CompactActionDetailScreen, NumericFieldDetailScreen } from '../ComponentCatalog';
import { AppThemeProvider } from '../../ui/AppThemeProvider';

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
  expect(screen.getByText('CompactAction')).toBeOnTheScreen();
  expect(screen.getByText('Dialog')).toBeOnTheScreen();
  expect(screen.getByText('SKJEMA')).toBeOnTheScreen();
  expect(screen.getByText('TextField')).toBeOnTheScreen();
  expect(screen.getByText('FieldError')).toBeOnTheScreen();
  expect(screen.getByText('FormSection')).toBeOnTheScreen();
  expect(screen.getByText('NumericField')).toBeOnTheScreen();
  expect(screen.getByText('NAVIGASJON OG STRUKTUR')).toBeOnTheScreen();
  expect(screen.getByText('Hero')).toBeOnTheScreen();
  expect(screen.getByText('ListContainer')).toBeOnTheScreen();
  expect(screen.getByText('NavigationRow')).toBeOnTheScreen();
  expect(screen.getByText('SearchField')).toBeOnTheScreen();
  expect(screen.getByText('FEEDBACK')).toBeOnTheScreen();
  expect(screen.getByText('Loader')).toBeOnTheScreen();
  expect(screen.getByText('Notice')).toBeOnTheScreen();
  expect(screen.getByText('ErrorAlert')).toBeOnTheScreen();
  expect(screen.getByText('SIDEVISNINGER')).toBeOnTheScreen();
  expect(screen.getByText('LISTER OG BEHOLDERE')).toBeOnTheScreen();
  expect(screen.getByText('Card')).toBeOnTheScreen();
  expect(screen.getByText('DataRow')).toBeOnTheScreen();
  expect(screen.getByText('DisclosureCard')).toBeOnTheScreen();
  expect(screen.getByText('PageStatus')).toBeOnTheScreen();
  // detail screens are mounted via mock as text fallbacks
  expect(screen.getByText('ButtonDetail')).toBeOnTheScreen();
  expect(screen.getByText('CompactActionDetail')).toBeOnTheScreen();
  expect(screen.getByText('CardDetail')).toBeOnTheScreen();
  expect(screen.getByText('DataRowDetail')).toBeOnTheScreen();
  expect(screen.getByText('DisclosureCardDetail')).toBeOnTheScreen();
  expect(screen.getByText('DialogDetail')).toBeOnTheScreen();
  expect(screen.getByText('TextFieldDetail')).toBeOnTheScreen();
  expect(screen.getByText('FieldErrorDetail')).toBeOnTheScreen();
  expect(screen.getByText('FormSectionDetail')).toBeOnTheScreen();
  expect(screen.getByText('NumericFieldDetail')).toBeOnTheScreen();
  expect(screen.getByText('AppShellDetail')).toBeOnTheScreen();
  expect(screen.getByText('HeroDetail')).toBeOnTheScreen();
  expect(screen.getByText('LoaderDetail')).toBeOnTheScreen();
  expect(screen.getByText('NoticeDetail')).toBeOnTheScreen();
  expect(screen.getByText('ErrorAlertDetail')).toBeOnTheScreen();
  expect(screen.getByText('PageStatusDetail')).toBeOnTheScreen();
  expect(screen.getByText('ListContainerDetail')).toBeOnTheScreen();
  expect(screen.getByText('NavigationRowDetail')).toBeOnTheScreen();
  expect(screen.getByText('SearchFieldDetail')).toBeOnTheScreen();

  fireEvent(screen.getByLabelText('Mørk modus'), 'valueChange', true);
  expect(screen.getByLabelText('Mørk modus')).toBeOnTheScreen();
});

it('shows every CompactAction state', () => {
  render(<AppThemeProvider><CompactActionDetailScreen /></AppThemeProvider>);
  expect(screen.getByTestId('catalog-compactaction-normal')).toBeEnabled();
  expect(screen.getByTestId('catalog-compactaction-add')).toBeEnabled();
  expect(screen.getByTestId('catalog-compactaction-remove')).toBeEnabled();
  expect(screen.getByTestId('catalog-compactaction-disabled')).toBeDisabled();
  expect(screen.getByTestId('catalog-compactaction-busy')).toHaveProp('accessibilityState', { busy: true, disabled: true });
});

it('shows every NumericField state and keyboard kind', () => {
  render(<AppThemeProvider><NumericFieldDetailScreen /></AppThemeProvider>);
  expect(screen.getByTestId('catalog-numericfield-decimal')).toHaveProp('keyboardType', 'decimal-pad');
  expect(screen.getByTestId('catalog-numericfield-integer')).toHaveProp('keyboardType', 'number-pad');
  expect(screen.getByTestId('catalog-numericfield-error-error')).toBeOnTheScreen();
  expect(screen.getByTestId('catalog-numericfield-disabled')).toHaveProp('editable', false);
  expect(screen.getByTestId('catalog-numericfield-focus')).toHaveProp('autoFocus', true);
});
