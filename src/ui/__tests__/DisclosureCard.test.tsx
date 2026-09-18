import { AccessibilityInfo, Animated, Easing, LayoutAnimation, Text } from 'react-native';
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

function progressScale() {
  const style = screen.UNSAFE_getByProps({ testID: 'card-progress' }).props.style.flat(Infinity);
  return style.find((entry: { transform?: unknown }) => entry?.transform)?.transform[0].scaleX;
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

it('renders generic leading content and forwards the explicit accessible name', () => {
  render(
    <AppThemeProvider>
      <DisclosureCard
        accessibilityLabel="Eksempel, tilgjengelig status"
        expanded={false}
        leading={<Text testID="leading">Status</Text>}
        title="Detaljer"
        onPress={() => {}}
      />
    </AppThemeProvider>,
  );

  expect(screen.getByTestId('leading')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Eksempel, tilgjengelig status' })).toHaveProp(
    'accessibilityState',
    { expanded: false },
  );
});

it.each([
  [-1, 0],
  [0, 0],
  [0.75, 0.75],
  [1, 1],
  [2, 1],
  [Number.NaN, 0],
])('normalizes progress %s to %s', (progress, expected) => {
  render(
    <AppThemeProvider>
      <DisclosureCard expanded={false} progress={progress} testID="card" title="Detaljer" onPress={() => {}} />
    </AppThemeProvider>,
  );

  expect(progressScale()).toBeInstanceOf(Animated.Value);
  expect(progressScale()).toHaveProperty('_value', expected);
  expect(screen.UNSAFE_getByProps({ testID: 'card-progress' }).props).toEqual(expect.objectContaining({
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  }));
});

it('animates progress changes with restrained ease-out motion', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  const timing = jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  const { rerender } = render(
    <AppThemeProvider>
      <DisclosureCard expanded={false} progress={0.25} testID="card" title="Detaljer" onPress={() => {}} />
    </AppThemeProvider>,
  );
  await act(async () => { await Promise.resolve(); });
  timing.mockClear();

  rerender(
    <AppThemeProvider>
      <DisclosureCard expanded={false} progress={0.75} testID="card" title="Detaljer" onPress={() => {}} />
    </AppThemeProvider>,
  );

  const [, config] = timing.mock.calls[0];
  expect(config).toEqual(expect.objectContaining({ duration: 420, toValue: 0.75, useNativeDriver: true }));
  expect(config.easing?.(0.5)).toBe(Easing.out(Easing.cubic)(0.5));
});

it('updates progress without animation when reduced motion is enabled', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  const timing = jest.spyOn(Animated, 'timing');
  const { rerender } = render(
    <AppThemeProvider>
      <DisclosureCard expanded={false} progress={0.25} testID="card" title="Detaljer" onPress={() => {}} />
    </AppThemeProvider>,
  );
  await act(async () => { await Promise.resolve(); });
  timing.mockClear();

  rerender(
    <AppThemeProvider>
      <DisclosureCard expanded={false} progress={0.75} testID="card" title="Detaljer" onPress={() => {}} />
    </AppThemeProvider>,
  );

  expect(timing).not.toHaveBeenCalled();
  expect(progressScale()).toHaveProperty('_value', 0.75);
});

it('keeps the newest motion preference and stops progress work on unmount', async () => {
  let resolveInitial: (enabled: boolean) => void = () => undefined;
  let onChange: (enabled: boolean) => void = () => undefined;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise((resolve) => { resolveInitial = resolve; }));
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((eventName: string, listener: (enabled: boolean) => void) => {
    expect(eventName).toBe('reduceMotionChanged');
    onChange = listener;
    return { remove: jest.fn() };
  }) as unknown as typeof AccessibilityInfo.addEventListener);
  const timing = jest.spyOn(Animated, 'timing');
  const stopAnimation = jest.spyOn(Animated.Value.prototype, 'stopAnimation');
  const rendered = render(
    <AppThemeProvider>
      <DisclosureCard expanded={false} progress={0.25} testID="card" title="Detaljer" onPress={() => {}} />
    </AppThemeProvider>,
  );

  act(() => onChange(false));
  await act(async () => resolveInitial(true));
  timing.mockClear();
  rendered.rerender(
    <AppThemeProvider>
      <DisclosureCard expanded={false} progress={0.75} testID="card" title="Detaljer" onPress={() => {}} />
    </AppThemeProvider>,
  );
  expect(timing).toHaveBeenCalled();

  rendered.unmount();
  expect(stopAnimation).toHaveBeenCalled();
});
