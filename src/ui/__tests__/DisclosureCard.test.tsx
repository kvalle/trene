import { AccessibilityInfo, LayoutAnimation, Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AppThemeProvider } from '../AppThemeProvider';
import { DisclosureCard } from '../DisclosureCard';

jest.mock('../Icon', () => ({
  Icon: ({ name }: { name: string }) => {
    const { Text: MockText } = jest.requireActual('react-native');
    return <MockText testID="disclosure-icon">{name}</MockText>;
  },
}));

function renderCard(onPress: () => void) {
  return render(
    <AppThemeProvider>
      <DisclosureCard expanded={false} title="Detaljer" onPress={onPress}>
        <Text>Innhold</Text>
      </DisclosureCard>
    </AppThemeProvider>,
  );
}

it('animates disclosure changes when reduced motion is disabled', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  const animate = jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => {});
  const onPress = jest.fn();
  renderCard(onPress);
  await act(async () => { await Promise.resolve(); });

  fireEvent.press(screen.getByRole('button', { name: 'Detaljer' }));

  expect(animate).toHaveBeenCalled();
  expect(onPress).toHaveBeenCalled();
});

it('changes disclosure immediately when reduced motion is enabled', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  const animate = jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => {});
  const onPress = jest.fn();
  renderCard(onPress);
  await act(async () => { await Promise.resolve(); });
  animate.mockClear();

  fireEvent.press(screen.getByRole('button', { name: 'Detaljer' }));

  expect(animate).not.toHaveBeenCalled();
  expect(onPress).toHaveBeenCalled();
});

it.each([
  ['chevron-down', false],
  ['chevron-up', true],
] as const)('shows %s when expanded is %s', (icon, expanded) => {
  render(
    <AppThemeProvider>
      <DisclosureCard expanded={expanded} title="Detaljer" onPress={() => {}} />
    </AppThemeProvider>,
  );

  expect(screen.getByTestId('disclosure-icon')).toHaveTextContent(icon);
});
