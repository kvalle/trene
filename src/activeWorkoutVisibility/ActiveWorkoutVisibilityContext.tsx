import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useDatabase } from '../database/DatabaseContext';
import {
  activeWorkoutVisibilityPreferenceStore,
  type ActiveWorkoutVisibilityPreference,
  type ActiveWorkoutVisibilityPreferenceStore,
} from '../preferences/activeWorkoutVisibilityPreference';
import { activeWorkoutVisibilityPlatform, type ActiveWorkoutVisibilityPlatform } from './platform';
import {
  resolveActiveWorkoutVisibilityNavigationIntent,
  synchronizeActiveWorkoutVisibility,
} from './synchronize';

type Capability = { supported: boolean; authorized: boolean; canShow: boolean };
type NavigationIntent = 'Workout' | 'Home';

type ActiveWorkoutVisibilityContextValue = {
  preference: ActiveWorkoutVisibilityPreference | undefined;
  changingPreference: boolean;
  capability: Capability | undefined;
  setPreference: (preference: ActiveWorkoutVisibilityPreference) => Promise<boolean>;
  reconcile: () => Promise<void>;
  openSystemSettings: () => Promise<boolean>;
  navigationIntent: NavigationIntent | null;
  consumeNavigationIntent: () => void;
};

const defaultValue: ActiveWorkoutVisibilityContextValue = {
  preference: 'enabled',
  changingPreference: false,
  capability: undefined,
  setPreference: async () => true,
  reconcile: async () => undefined,
  openSystemSettings: async () => false,
  navigationIntent: null,
  consumeNavigationIntent: () => undefined,
};

const ActiveWorkoutVisibilityContext = createContext<ActiveWorkoutVisibilityContextValue>(defaultValue);

export function ActiveWorkoutVisibilityProvider({
  children,
  platform = activeWorkoutVisibilityPlatform,
  preferenceStore = activeWorkoutVisibilityPreferenceStore,
}: PropsWithChildren<{
  platform?: ActiveWorkoutVisibilityPlatform;
  preferenceStore?: ActiveWorkoutVisibilityPreferenceStore;
}>) {
  const database = useDatabase();
  const [preference, setPreferenceState] = useState<ActiveWorkoutVisibilityPreference>();
  const [changingPreference, setChangingPreference] = useState(false);
  const [capability, setCapability] = useState<Capability>();
  const [navigationIntent, setNavigationIntent] = useState<NavigationIntent | null>(null);
  const reconciliation = useRef(Promise.resolve());

  const inspectCapability = useCallback(async () => {
    try {
      setCapability(await platform.inspectCapability());
    } catch (error) {
      console.warn('Active workout system visibility capability inspection failed', error);
      setCapability({ supported: false, authorized: false, canShow: false });
    }
  }, [platform]);

  const reconcile = useCallback(async () => {
    reconciliation.current = reconciliation.current.then(async () => {
      try {
        const state = await synchronizeActiveWorkoutVisibility(database, preferenceStore, platform);
        setPreferenceState(state.enabled ? 'enabled' : 'disabled');
        await inspectCapability();
      } catch (error) {
        console.warn('Active workout system visibility reconciliation failed', error);
      }
    });
    await reconciliation.current;
  }, [database, inspectCapability, platform, preferenceStore]);

  const handleTap = useCallback(async () => {
    try {
      const intent = await resolveActiveWorkoutVisibilityNavigationIntent(database);
      if (intent === 'Home') {
        try {
          await platform.remove();
        } catch (error) {
          console.warn('Stale active workout notification removal failed', error);
        }
      }
      setNavigationIntent(intent);
    } catch (error) {
      console.warn('Active workout notification navigation failed', error);
      setNavigationIntent('Home');
    }
  }, [database, platform]);

  useEffect(() => {
    void reconcile();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reconcile();
    });
    const tapSubscription = platform.subscribeToTaps(() => { void handleTap(); });
    void platform.getInitialTap().then((tapped) => { if (tapped) void handleTap(); }).catch((error) => {
      console.warn('Active workout initial notification tap failed', error);
    });
    return () => {
      appStateSubscription.remove();
      tapSubscription.remove();
    };
  }, [handleTap, platform, reconcile]);

  async function setPreference(nextPreference: ActiveWorkoutVisibilityPreference): Promise<boolean> {
    if (changingPreference || nextPreference === preference) return true;
    setChangingPreference(true);
    try {
      await preferenceStore.write(nextPreference);
      setPreferenceState(nextPreference);
      await reconcile();
      return true;
    } catch {
      return false;
    } finally {
      setChangingPreference(false);
    }
  }

  async function openSystemSettings(): Promise<boolean> {
    try {
      await platform.openSettings();
      return true;
    } catch {
      return false;
    }
  }

  const consumeNavigationIntent = useCallback(() => setNavigationIntent(null), []);

  return (
    <ActiveWorkoutVisibilityContext.Provider value={{
      preference,
      changingPreference,
      capability,
      setPreference,
      reconcile,
      openSystemSettings,
      navigationIntent,
      consumeNavigationIntent,
    }}>
      {children}
    </ActiveWorkoutVisibilityContext.Provider>
  );
}

export function useActiveWorkoutVisibility() {
  return useContext(ActiveWorkoutVisibilityContext);
}
