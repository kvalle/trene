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
    Screen: ({ children, name }: { children?: (props: object) => React.ReactNode; name: string }) => (
      name === 'Catalog'
        ? children?.({ navigation: { navigate: jest.fn() }, route: { key: 'Catalog', name: 'Catalog' } })
        : require('react').createElement(require('react-native').Text, null, name)
    ),
  }),
}));

it('renders production theme contexts and switches theme', () => {
  render(<ComponentCatalog />);

  expect(screen.getByRole('header', { name: 'Runtime-katalog' })).toBeOnTheScreen();
  expect(screen.getByText(/Aktuell systemskala:/)).toBeOnTheScreen();
  expect(screen.getByText('StackExample')).toBeOnTheScreen();
  expect(screen.getByText('ModalExample')).toBeOnTheScreen();

  fireEvent(screen.getByLabelText('Mørk modus'), 'valueChange', true);
  expect(screen.getByLabelText('Mørk modus')).toBeOnTheScreen();
});
