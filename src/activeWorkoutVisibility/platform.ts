import {
  addNotificationTapListener,
  getInitialTapAsync,
  inspectAuthorizationAsync,
  openSettingsAsync,
  removeAsync,
  showAsync,
  type NotificationCapability,
} from 'active-workout-notification';
import { PermissionsAndroid, Platform } from 'react-native';

export type ActiveWorkoutVisibilityPlatform = {
  inspectCapability: () => Promise<NotificationCapability>;
  show: () => Promise<void>;
  remove: () => Promise<void>;
  openSettings: () => Promise<void>;
  getInitialTap: () => Promise<boolean>;
  subscribeToTaps: (listener: () => void) => { remove(): void };
};

export const activeWorkoutVisibilityPlatform: ActiveWorkoutVisibilityPlatform = {
  inspectCapability: inspectAuthorizationAsync,
  async show() {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
      if (!await PermissionsAndroid.check(permission)) {
        const result = await PermissionsAndroid.request(permission);
        if (result !== PermissionsAndroid.RESULTS.GRANTED) return;
      }
    }
    await showAsync();
  },
  remove: removeAsync,
  openSettings: openSettingsAsync,
  getInitialTap: getInitialTapAsync,
  subscribeToTaps: addNotificationTapListener,
};
