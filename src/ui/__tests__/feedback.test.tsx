import { createRef } from 'react';
import { Text, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { ErrorAlert } from '../ErrorAlert';
import { Hero } from '../Hero';
import { Loader } from '../Loader';
import { Notice } from '../Notice';
import { PageStatus } from '../PageStatus';
import { AppThemeProvider } from '../AppThemeProvider';

function renderWithTheme(ui: React.ReactElement) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

describe('Loader', () => {
  it('renders large and compact with label and testID', () => {
    renderWithTheme(<Loader label="Laster aktiv økt" size="large" testID="loader-large" />);
    expect(screen.getByTestId('loader-large')).toBeOnTheScreen();
    expect(screen.getByLabelText('Laster aktiv økt')).toBeOnTheScreen();

    renderWithTheme(<Loader label="Lagrer" size="compact" testID="loader-compact" />);
    expect(screen.getByTestId('loader-compact')).toBeOnTheScreen();
    expect(screen.getByLabelText('Lagrer')).toBeOnTheScreen();
  });

  it('exposes progressbar role and live region', () => {
    renderWithTheme(<Loader label="Starter Trene" testID="startup-loader" />);
    const el = screen.getByTestId('startup-loader');
    expect(el.props.accessibilityRole).toBe('progressbar');
    expect(el.props.accessibilityLiveRegion).toBe('polite');
  });
});

describe('ErrorAlert', () => {
  it('forwards ref, testID, alert role and live region', () => {
    const ref = createRef<View>();
    renderWithTheme(<ErrorAlert ref={ref} message="Kunne ikke laste inn" testID="err" />);
    const el = screen.getByTestId('err');
    expect(el).toBeOnTheScreen();
    expect(el.props.accessibilityRole).toBe('alert');
    expect(el.props.accessibilityLiveRegion).toBe('assertive');
    expect(ref.current).not.toBeNull();
    expect(screen.getByText('Kunne ikke laste inn')).toBeOnTheScreen();
  });

  it('renders title, secondary message and secondary action', () => {
    renderWithTheme(
      <ErrorAlert
        title="Kunne ikke lagre"
        message="Endringene er ikke lagret"
        secondaryMessage="Prøv igjen senere"
        actionTitle="Prøv igjen"
        onAction={() => {}}
        actionTestID="retry"
        testID="err2"
      />,
    );
    expect(screen.getByText('Kunne ikke lagre')).toBeOnTheScreen();
    expect(screen.getByText('Endringene er ikke lagret')).toBeOnTheScreen();
    expect(screen.getByText('Prøv igjen senere')).toBeOnTheScreen();
    expect(screen.getByTestId('retry')).toBeOnTheScreen();
    // action inside ErrorAlert should be secondary variant (checked via rendered)
    expect(screen.getByRole('button', { name: 'Prøv igjen' })).toBeOnTheScreen();
  });
});

describe('Notice', () => {
  it('renders contextual information without an error role', () => {
    renderWithTheme(<Notice title="Viktig informasjon" message="Les dette før du fortsetter." testID="notice" />);
    expect(screen.getByTestId('notice')).toBeOnTheScreen();
    expect(screen.getByText('Viktig informasjon')).toBeOnTheScreen();
    expect(screen.getByText('Les dette før du fortsetter.')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });
});

describe('PageStatus', () => {
  it('renders loading with Loader and polite live region', () => {
    renderWithTheme(<PageStatus variant="loading" loaderLabel="Starter Trene" testID="ps-loading" />);
    expect(screen.getByTestId('ps-loading')).toBeOnTheScreen();
    expect(screen.getByLabelText('Starter Trene')).toBeOnTheScreen();
    expect(screen.getByTestId('ps-loading').props.accessibilityLiveRegion).toBe('polite');
  });

  it('renders error with header, messages and primary retry', () => {
    const ref = createRef<View>();
    renderWithTheme(
      <PageStatus
        ref={ref}
        variant="error"
        title="Trene kunne ikke starte"
        message="Dataene dine er ikke endret."
        secondaryMessage="Hvis problemet fortsetter"
        actionTitle="Prøv igjen"
        onAction={() => {}}
        actionTestID="ps-retry"
        testID="ps-error"
      />,
    );
    const el = screen.getByTestId('ps-error');
    expect(el).toBeOnTheScreen();
    expect(el.props.accessibilityLiveRegion).toBe('assertive');
    expect(screen.getByRole('header', { name: 'Trene kunne ikke starte' })).toBeOnTheScreen();
    expect(screen.getByText('Dataene dine er ikke endret.')).toBeOnTheScreen();
    expect(screen.getByText('Dataene dine er ikke endret.')).toHaveProp('accessibilityRole', 'alert');
    expect(screen.getByText('Hvis problemet fortsetter')).toBeOnTheScreen();
    expect(screen.getByTestId('ps-retry')).toBeOnTheScreen();
    expect(ref.current).not.toBeNull();
  });

  it('renders safe-stop without action', () => {
    renderWithTheme(
      <PageStatus
        variant="safe-stop"
        title="Trene kan ikke åpne dataene trygt"
        message="Gjenopprettingen ble avbrutt"
        secondaryMessage="Ikke slett"
        actionTitle="Prøv igjen"
        onAction={() => {}}
        testID="ps-safestop"
      />,
    );
    expect(screen.getByText('Trene kan ikke åpne dataene trygt')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Prøv igjen' })).not.toBeOnTheScreen();
  });

  it('forwards actionRef to primary button for focus', () => {
    const actionRef = createRef<View>();
    renderWithTheme(
      <PageStatus
        variant="error"
        title="T"
        message="M"
        actionTitle="Prøv igjen"
        onAction={() => {}}
        actionRef={actionRef}
        testID="ps-focus"
      />,
    );
    expect(actionRef.current).not.toBeNull();
  });
});

describe('Hero', () => {
  it('renders title, description and actions', () => {
    renderWithTheme(
      <Hero title="Klar for en økt?" description="Registrer øvelser" testID="hero">
        <Text>Action</Text>
      </Hero>,
    );
    expect(screen.getByTestId('hero')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Klar for en økt?' })).toBeOnTheScreen();
    expect(screen.getByText('Registrer øvelser')).toBeOnTheScreen();
    expect(screen.getByText('Action')).toBeOnTheScreen();
  });
});
