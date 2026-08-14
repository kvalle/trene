import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';

import { DataScreen } from '../DataScreen';
import { DatabaseProvider } from '../../database/DatabaseContext';
import { DatabaseRuntime } from '../../database/DatabaseRuntime';
import { createAndShareBackup } from '../../backup/createBackup';

jest.mock('../../backup/createBackup', () => ({ createAndShareBackup: jest.fn() }));
jest.mock('../../backup/nativeBackupPlatform', () => ({ createNativeBackupPlatform: jest.fn(() => ({})) }));

const mockedCreateBackup = jest.mocked(createAndShareBackup);

test('discloses backup sensitivity and does not claim sharing saved it', async () => {
  mockedCreateBackup.mockResolvedValue({} as never);
  renderScreen();

  expect(screen.getByText('Sikkerhetskopien er ikke kryptert av Trene. Oppbevar og del den på en trygg måte.')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Lag sikkerhetskopi' }));
  await act(async () => undefined);

  expect(mockedCreateBackup).toHaveBeenCalled();
  expect(screen.queryByText(/lagret/i)).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Lag sikkerhetskopi' })).toBeEnabled();
});

test('reports failure without implying live data changed', async () => {
  mockedCreateBackup.mockRejectedValue(new Error('share failed'));
  renderScreen();

  fireEvent.press(screen.getByRole('button', { name: 'Lag sikkerhetskopi' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/Dataene dine er ikke endret/);
});

function renderScreen() {
  const runtime = new DatabaseRuntime(jest.fn());
  return render(
    <DatabaseProvider database={runtime}>
      <NavigationContainer><DataScreen /></NavigationContainer>
    </DatabaseProvider>,
  );
}
