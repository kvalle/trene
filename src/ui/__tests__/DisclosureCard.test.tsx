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

it('exposes contextual actions on the interactive header', () => {
  const onAccessibilityAction = jest.fn();
  render(
    <AppThemeProvider>
      <DisclosureCard
        accessibilityActions={[{ name: 'moveUp', label: 'Flytt opp' }]}
        expanded={false}
        onAccessibilityAction={onAccessibilityAction}
        title="Detaljer"
        onPress={() => {}}
      />
    </AppThemeProvider>,
  );

  const header = screen.getByRole('button', { name: 'Detaljer' });
  expect(header).toHaveProp('accessibilityActions', [{ name: 'moveUp', label: 'Flytt opp' }]);
  fireEvent(header, 'accessibilityAction', { nativeEvent: { actionName: 'moveUp' } });
  expect(onAccessibilityAction).toHaveBeenCalledWith(expect.objectContaining({
    nativeEvent: expect.objectContaining({ actionName: 'moveUp' }),
  }));
});

it('starts reorder on long press, forwards movement and drop, and suppresses the release press', () => {
  jest.useFakeTimers();
  const onPress = jest.fn();
  const onReorderStart = jest.fn();
  const onReorderMove = jest.fn();
  const onReorderEnd = jest.fn();
  render(
    <AppThemeProvider>
      <DisclosureCard
        expanded={false}
        onPress={onPress}
        onReorderEnd={onReorderEnd}
        onReorderMove={onReorderMove}
        onReorderStart={onReorderStart}
        reorderEnabled
        title="Detaljer"
      />
    </AppThemeProvider>,
  );
  const header = screen.getByRole('button', { name: 'Detaljer' });

  fireEvent(header, 'longPress');
  fireEvent(header, 'touchMove', { nativeEvent: { pageY: 240 } });
  fireEvent(header, 'touchEnd');
  fireEvent.press(header);

  expect(onReorderStart).toHaveBeenCalledTimes(1);
  expect(onReorderMove).toHaveBeenCalledWith(240);
  expect(onReorderEnd).toHaveBeenCalledTimes(1);
  expect(onPress).not.toHaveBeenCalled();

  act(() => jest.runAllTimers());
  fireEvent.press(header);
  expect(onPress).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});

it('forwards reorder cancellation and does not start while disabled', () => {
  const onReorderStart = jest.fn();
  const onReorderCancel = jest.fn();
  const rendered = render(
    <AppThemeProvider>
      <DisclosureCard expanded={false} onPress={() => {}} onReorderCancel={onReorderCancel} onReorderStart={onReorderStart} reorderEnabled title="Detaljer" />
    </AppThemeProvider>,
  );
  fireEvent(screen.getByRole('button', { name: 'Detaljer' }), 'longPress');
  fireEvent(screen.getByRole('button', { name: 'Detaljer' }), 'touchCancel');
  expect(onReorderCancel).toHaveBeenCalledTimes(1);

  rendered.rerender(
    <AppThemeProvider>
      <DisclosureCard expanded={false} onPress={() => {}} onReorderStart={onReorderStart} reorderEnabled={false} title="Detaljer" />
    </AppThemeProvider>,
  );
  fireEvent(screen.getByRole('button', { name: 'Detaljer' }), 'longPress');
  expect(onReorderStart).toHaveBeenCalledTimes(1);
});

it('keeps the next ordinary press when the reorder start is rejected', () => {
  const onPress = jest.fn();
  render(
    <AppThemeProvider>
      <DisclosureCard expanded={false} onPress={onPress} onReorderStart={() => false} reorderEnabled title="Detaljer" />
    </AppThemeProvider>,
  );
  const header = screen.getByRole('button', { name: 'Detaljer' });

  fireEvent(header, 'longPress');
  fireEvent(header, 'touchEnd');
  fireEvent.press(header);

  expect(onPress).toHaveBeenCalledTimes(1);
});

it('renders the generic reordering and emphasized-summary states', () => {
  render(
    <AppThemeProvider>
      <DisclosureCard expanded={false} onPress={() => {}} reordering summary="Flytt til #2" summaryEmphasized testID="card" title="Detaljer" />
    </AppThemeProvider>,
  );

  expect(screen.getByTestId('card')).toHaveStyle({ borderLeftWidth: 4 });
  expect(screen.getByText('Flytt til #2')).toHaveStyle({ fontStyle: 'italic' });
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
