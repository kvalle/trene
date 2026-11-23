import { useRef, useState } from 'react';
import { AccessibilityInfo, Text, TextInput } from 'react-native';

import { useDatabase } from '../database/DatabaseContext';
import {
  DuplicateTrainingContextNameError,
  DUPLICATE_TRAINING_CONTEXT_NAME,
  listTrainingContextChoices,
  type TrainingContextChoice,
} from '../database/trainingContexts';
import { createTrainingContextAndStartWorkout, startWorkout } from '../database/workouts';
import { validateExerciseName } from '../domain/exerciseName';
import { decideWorkoutStart } from '../domain/trainingContextStart';
import { typography } from '../theme';
import { useAppTheme } from '../ui/AppThemeProvider';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ListContainer } from '../ui/ListContainer';
import { NavigationRow } from '../ui/NavigationRow';
import { TextField } from '../ui/TextField';

type Step =
  | { kind: 'closed' }
  | { kind: 'choose'; trainingContexts: TrainingContextChoice[] }
  | { kind: 'create' };

interface WorkoutStartOptions {
  /** Called after a treningsøkt has been started, before `starting` is reset. */
  onStarted: () => void;
  /** Called when listing kontekster or starting the treningsøkt fails. */
  onFailed: () => void;
}

/**
 * Starts a treningsøkt in a kontekst. With one active kontekst it starts
 * directly; with several it shows the "Hva skal du trene?" dialog, which the
 * screen renders through `dialog`.
 */
export function useWorkoutStart({ onStarted, onFailed }: WorkoutStartOptions) {
  const database = useDatabase();
  const [step, setStep] = useState<Step>({ kind: 'closed' });
  const [starting, setStarting] = useState(false);

  async function start() {
    setStarting(true);
    try {
      const decision = decideWorkoutStart(await listTrainingContextChoices(database));
      if (decision.kind === 'choose') {
        setStep({ kind: 'choose', trainingContexts: decision.trainingContexts });
        return;
      }
      await startWorkout(database, decision.trainingContext.id);
      onStarted();
    } catch {
      onFailed();
    } finally {
      setStarting(false);
    }
  }

  async function startIn(trainingContextId: number) {
    setStarting(true);
    try {
      await startWorkout(database, trainingContextId);
      setStep({ kind: 'closed' });
      onStarted();
    } catch {
      setStep({ kind: 'closed' });
      onFailed();
    } finally {
      setStarting(false);
    }
  }

  const dialog = (
    <WorkoutStartDialog
      busy={starting}
      onCancel={() => setStep({ kind: 'closed' })}
      onChoose={(id) => void startIn(id)}
      onCreate={async (name, key) => {
        setStarting(true);
        try {
          await createTrainingContextAndStartWorkout(database, name, key);
          setStep({ kind: 'closed' });
          onStarted();
        } finally {
          setStarting(false);
        }
      }}
      onNew={() => setStep({ kind: 'create' })}
      step={step}
    />
  );

  return { start, starting, dialog };
}

function WorkoutStartDialog({ busy, onCancel, onChoose, onCreate, onNew, step }: {
  busy: boolean;
  onCancel: () => void;
  onChoose: (trainingContextId: number) => void;
  onCreate: (name: string, key: string) => Promise<void>;
  onNew: () => void;
  step: Step;
}) {
  const titleRef = useRef<Text>(null);
  const cancel = () => { if (!busy) onCancel(); };
  return (
    <Dialog
      initialFocusRef={titleRef}
      onRequestClose={cancel}
      testID="workout-start-dialog"
      title={step.kind === 'create' ? 'Ny kontekst' : 'Hva skal du trene?'}
      titleRef={titleRef}
      visible={step.kind !== 'closed'}
    >
      {step.kind === 'create' ? (
        <NewTrainingContextForm busy={busy} onCancel={cancel} onCreate={onCreate} />
      ) : (
        <>
          <ListContainer>
            {step.kind === 'choose' && step.trainingContexts.map((trainingContext) => (
              <NavigationRow
                accessibilityHint="Starter en trening i konteksten"
                disabled={busy}
                key={trainingContext.id}
                onPress={() => onChoose(trainingContext.id)}
                showSeparator
                testID={`workout-start-training-context-${trainingContext.id}`}
                title={trainingContext.name}
              />
            ))}
            <NavigationRow
              accessibilityHint="Oppretter en ny kontekst og starter en trening i den"
              disabled={busy}
              onPress={onNew}
              testID="workout-start-new-training-context"
              title="+ Ny kontekst…"
            />
          </ListContainer>
          <Button
            disabled={busy}
            onPress={cancel}
            testID="workout-start-cancel"
            title="Avbryt"
            variant="secondary"
          />
        </>
      )}
    </Dialog>
  );
}

function NewTrainingContextForm({ busy, onCancel, onCreate }: {
  busy: boolean;
  onCancel: () => void;
  onCreate: (name: string, key: string) => Promise<void>;
}) {
  const { colors } = useAppTheme();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string>();
  const inputRef = useRef<TextInput>(null);

  function showError(message: string) {
    setError(message);
    AccessibilityInfo.announceForAccessibility(message);
    inputRef.current?.focus();
  }

  async function submit() {
    if (busy) return;
    const validation = validateExerciseName(draft);
    if ('error' in validation) {
      showError(validation.error);
      return;
    }
    try {
      await onCreate(validation.name, validation.key);
    } catch (createError) {
      showError(createError instanceof DuplicateTrainingContextNameError
        ? DUPLICATE_TRAINING_CONTEXT_NAME
        : 'Kunne ikke opprette konteksten. Prøv igjen.');
    }
  }

  return (
    <>
      <Text style={[typography.body, { color: colors.text }]}>
        Treningen starter uten øvelser. Det du gjør nå, fylles ut automatisk neste gang du velger konteksten.
      </Text>
      <TextField
        autoCapitalize="sentences"
        autoFocus
        editable={!busy}
        error={error}
        label="Navn"
        onChangeText={(value) => {
          setDraft(value);
          setError(undefined);
        }}
        onSubmitEditing={() => void submit()}
        ref={inputRef}
        returnKeyType="done"
        testID="workout-start-training-context-name-input"
        value={draft}
      />
      <Button
        busy={busy}
        disabled={busy}
        onPress={() => void submit()}
        testID="workout-start-create-submit"
        title={busy ? 'Starter trening' : 'Opprett og start'}
      />
      <Button
        disabled={busy}
        onPress={onCancel}
        testID="workout-start-create-cancel"
        title="Avbryt"
        variant="text"
      />
    </>
  );
}
