import { createRef } from 'react';
import { AccessibilityInfo, Modal, Text, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '../AppThemeProvider';
import { Dialog } from '../Dialog';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: jest.fn((node) => node ? 12 : null),
}));

it('focuses its requested initial action when shown', () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  const initialFocusRef = createRef<View>();
  const onRequestClose = jest.fn();
  const view = render(<AppThemeProvider><Dialog visible initialFocusRef={initialFocusRef} onRequestClose={onRequestClose} title="Bekreft"><View ref={initialFocusRef} /></Dialog></AppThemeProvider>);

  expect(screen.getByRole('header', { name: 'Bekreft' })).toBeOnTheScreen();
  fireEvent(view.UNSAFE_getByType(Modal), 'show');
  expect(focus).toHaveBeenCalled();
  fireEvent(view.UNSAFE_getByType(Modal), 'requestClose');
  expect(onRequestClose).toHaveBeenCalled();
});

it('forwards a ref to its title for focus changes within an open dialog', () => {
  const titleRef = createRef<Text>();
  render(<AppThemeProvider><Dialog visible titleRef={titleRef} onRequestClose={() => {}} title="Bekreft"><View /></Dialog></AppThemeProvider>);
  expect(titleRef.current).not.toBeNull();
});
