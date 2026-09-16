import type { DatabaseSource } from '../database/types';
import { getActiveWorkoutId } from '../database/workouts';
import type { ActiveWorkoutVisibilityPreferenceStore } from '../preferences/activeWorkoutVisibilityPreference';
import type { ActiveWorkoutVisibilityPlatform } from './platform';

export type ActiveWorkoutVisibilityState = {
  activeWorkoutId: number | null;
  enabled: boolean;
};

export async function readActiveWorkoutVisibilityState(
  database: DatabaseSource,
  preferenceStore: ActiveWorkoutVisibilityPreferenceStore,
): Promise<ActiveWorkoutVisibilityState> {
  const [activeWorkoutId, preference] = await Promise.all([
    getActiveWorkoutId(database),
    preferenceStore.read(),
  ]);
  return { activeWorkoutId, enabled: preference === 'enabled' };
}

export async function synchronizeActiveWorkoutVisibility(
  database: DatabaseSource,
  preferenceStore: ActiveWorkoutVisibilityPreferenceStore,
  platform: ActiveWorkoutVisibilityPlatform,
): Promise<ActiveWorkoutVisibilityState> {
  const state = await readActiveWorkoutVisibilityState(database, preferenceStore);
  try {
    if (state.activeWorkoutId !== null && state.enabled) await platform.show();
    else await platform.remove();
  } catch (error) {
    console.warn('Active workout system visibility synchronization failed', error);
  }
  return state;
}

export async function resolveActiveWorkoutVisibilityNavigationIntent(
  database: DatabaseSource,
): Promise<'Workout' | 'Home'> {
  return await getActiveWorkoutId(database) === null ? 'Home' : 'Workout';
}
