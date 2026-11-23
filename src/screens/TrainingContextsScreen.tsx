import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useDatabase } from '../database/DatabaseContext';
import { listTrainingContexts, type TrainingContextListItem } from '../database/trainingContexts';
import { formatWorkoutCount } from '../locale';
import { typography } from '../theme';
import { useAppTheme } from '../ui/AppThemeProvider';
import { Button } from '../ui/Button';
import { ListContainer } from '../ui/ListContainer';
import { NavigationRow } from '../ui/NavigationRow';
import { PageStatus } from '../ui/PageStatus';
import { PositiveStatus } from '../ui/PositiveStatus';

type Props = NativeStackScreenProps<RootStackParamList, 'TrainingContexts'>;
type LoadState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; trainingContexts: TrainingContextListItem[] };

export function TrainingContextsScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { colors } = useAppTheme();
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [created, setCreated] = useState(false);
  const retryRef = useRef<View>(null);
  const rowRefs = useRef(new Map<number, View>());
  const createdId = route.params?.createdTrainingContextId;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setState((current) => current.status === 'ready' ? current : { status: 'loading' });
      listTrainingContexts(database).then(
        (trainingContexts) => active && setState({ status: 'ready', trainingContexts }),
        () => active && setState({ status: 'failed' }),
      );
      return () => { active = false; };
    }, [database, reload]),
  );
  useFocusEffect(useCallback(() => () => setCreated(false), []));

  useEffect(() => {
    if (createdId === undefined) return;
    setCreated(true);
  }, [createdId]);

  useEffect(() => {
    if (state.status !== 'ready' || createdId === undefined) return;
    const handle = findNodeHandle(rowRefs.current.get(createdId) ?? null);
    if (!handle) return;
    AccessibilityInfo.setAccessibilityFocus(handle);
    navigation.setParams({ createdTrainingContextId: undefined });
  }, [createdId, navigation, state]);

  useEffect(() => {
    if (state.status !== 'failed') return;
    AccessibilityInfo.announceForAccessibility('Kunne ikke laste inn. Prøv igjen.');
    const handle = findNodeHandle(retryRef.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [state.status]);

  if (state.status === 'loading') {
    return <PageStatus variant="loading" loaderLabel="Laster kontekster" />;
  }
  if (state.status === 'failed') {
    return (
      <PageStatus
        variant="error"
        title="Kunne ikke laste inn"
        actionRef={retryRef}
        actionTitle="Prøv igjen"
        onAction={() => setReload((value) => value + 1)}
      />
    );
  }

  const { trainingContexts } = state;
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {trainingContexts.length === 1 && (
          <Text style={[typography.body, { color: colors.text }]}>
            Trener du på flere måter, for eksempel med fysioøvelser hjemme og styrke på
            treningssenteret? Lag en kontekst for hver, så husker appen øvelsene hver for seg.
          </Text>
        )}
        <ListContainer>
          {trainingContexts.map((trainingContext, index) => (
            <NavigationRow
              accessibilityHint="Åpner detaljer for konteksten"
              key={trainingContext.id}
              onPress={() => navigation.navigate('TrainingContextDetail', { trainingContextId: trainingContext.id })}
              ref={(node) => {
                if (node) rowRefs.current.set(trainingContext.id, node);
                else rowRefs.current.delete(trainingContext.id);
              }}
              showSeparator={index < trainingContexts.length - 1}
              title={trainingContext.name}
              metadata={formatWorkoutCount(trainingContext.workoutCount)}
            />
          ))}
        </ListContainer>
        <Button
          title="Ny kontekst"
          variant="secondary"
          onPress={() => { setCreated(false); navigation.navigate('CreateTrainingContext'); }}
          testID="training-contexts-create"
        />
      </ScrollView>
      {created && (
        <PositiveStatus
          message="Konteksten er opprettet."
          onDismiss={() => setCreated(false)}
          testID="training-context-created-status"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flexGrow: 1, gap: 20, padding: 20 },
});
