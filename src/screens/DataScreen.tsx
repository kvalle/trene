import Constants from 'expo-constants';
import { useTheme } from '@react-navigation/native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { createAndShareBackup } from '../backup/createBackup';
import { createNativeBackupPlatform } from '../backup/nativeBackupPlatform';
import { useDatabaseRuntime } from '../database/DatabaseContext';

export function DataScreen() {
  const runtime = useDatabaseRuntime();
  const { colors } = useTheme();
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);

  async function createBackup() {
    setCreating(true);
    setFailed(false);
    try {
      await createAndShareBackup(runtime, createNativeBackupPlatform(), {
        appVersion: Constants.expoConfig?.version ?? 'unknown',
      });
    } catch {
      setFailed(true);
    } finally {
      setCreating(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Dine data</Text>
      <Text style={[styles.body, { color: colors.text }]}>Lag en fil med alle øvelser og treningsøkter i Trene.</Text>
      <View style={[styles.notice, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.noticeTitle, { color: colors.text }]}>Filen inneholder treningsdata</Text>
        <Text style={[styles.noticeText, { color: colors.text }]}>Sikkerhetskopien er ikke kryptert av Trene. Oppbevar og del den på en trygg måte.</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: creating, busy: creating }}
        disabled={creating}
        onPress={() => void createBackup()}
        style={({ pressed }) => [styles.action, { backgroundColor: colors.primary }, pressed && styles.pressed, creating && styles.disabled]}
      >
        {creating && <ActivityIndicator color={colors.background} />}
        <Text style={[styles.actionText, { color: colors.background }]}>{creating ? 'Lager sikkerhetskopi' : 'Lag sikkerhetskopi'}</Text>
      </Pressable>
      {failed && <Text accessibilityRole="alert" style={[styles.error, { color: colors.notification }]}>Kunne ikke lage sikkerhetskopien. Dataene dine er ikke endret.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24 },
  heading: { fontSize: 30, fontWeight: '700' },
  body: { fontSize: 18, lineHeight: 27, marginTop: 12 },
  notice: { borderRadius: 14, borderWidth: 1, marginTop: 28, padding: 18 },
  noticeTitle: { fontSize: 17, fontWeight: '700' },
  noticeText: { fontSize: 16, lineHeight: 24, marginTop: 8 },
  action: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 24, minHeight: 54, paddingHorizontal: 20 },
  actionText: { fontSize: 18, fontWeight: '700' },
  error: { fontSize: 16, lineHeight: 24, marginTop: 16 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.7 },
});
