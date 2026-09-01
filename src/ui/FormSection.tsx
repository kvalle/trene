import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';

type FormSectionProps = ViewProps & { title: string; detail?: string };

export function FormSection({ title, detail, children, style, ...rest }: FormSectionProps) {
  const { colors } = useAppTheme();
  return (
    <View {...rest} style={[styles.section, style]}>
      <View style={styles.heading}>
        <Text style={[typography.control, { color: colors.text }]}>{title}</Text>
        {detail ? <Text style={[typography.metadata, { color: colors.muted }]}>{detail}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ section: { gap: 12 }, heading: { gap: 2 } });
