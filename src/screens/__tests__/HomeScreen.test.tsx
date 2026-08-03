import { fireEvent, render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';

import { HomeScreen } from '../HomeScreen';

test('shows the empty Home actions and opens them hierarchically', async () => {
  const navigate = jest.fn();
  await render(
    <NavigationContainer>
      <HomeScreen navigation={{ navigate } as never} route={{} as never} />
    </NavigationContainer>,
  );

  expect(screen.getByRole('button', { name: 'Start økt' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Tidligere økter' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Øvelser' })).toBeOnTheScreen();

  fireEvent.press(screen.getByRole('button', { name: 'Tidligere økter' }));
  expect(navigate).toHaveBeenCalledWith('History');
});
