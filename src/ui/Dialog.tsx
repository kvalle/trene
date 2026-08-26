import { AccessibilityInfo, findNodeHandle, Modal, StyleSheet, Text, View, type ModalProps, type Text as TextType, type View as ViewType } from 'react-native';

import { radii, typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';

type DialogProps = Omit<ModalProps, 'children' | 'onShow'> & {
  title: string;
  children: React.ReactNode;
  initialFocusRef?: React.RefObject<ViewType | TextType | null>;
  titleRef?: React.RefObject<TextType | null>;
  testID?: string;
};

export function Dialog({ title, children, initialFocusRef, titleRef, testID, ...modalProps }: DialogProps) {
  const { colors } = useAppTheme();

  function handleShow() {
    if (initialFocusRef) {
      const handle = findNodeHandle(initialFocusRef.current);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }
  }

  return (
    <Modal {...modalProps} animationType="none" transparent onShow={handleShow}>
      <View accessibilityViewIsModal style={styles.backdrop}>
        <View testID={testID} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Text ref={titleRef} accessibilityRole="header" style={[typography.sectionTitle, { color: colors.text }]}>{title}</Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.55)', flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: radii.container, gap: 16, maxWidth: 440, padding: 24, width: '100%' },
});
