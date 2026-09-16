import { requireOptionalNativeModule } from 'expo';

type EventSubscription = {
  remove(): void;
};

export type NotificationCapability = {
  supported: boolean;
  authorized: boolean;
  canShow: boolean;
};

export type NotificationTapError = {
  message: string;
};

type ActiveWorkoutNotificationEvents = {
  notificationTap: () => void;
  notificationTapError: (error: NotificationTapError) => void;
};

type ActiveWorkoutNotificationNativeModule = {
  inspectAuthorizationAsync(): Promise<NotificationCapability>;
  showAsync(): Promise<void>;
  removeAsync(): Promise<void>;
  openSettingsAsync(): Promise<void>;
  getInitialTapAsync(): Promise<boolean>;
  addListener<EventName extends keyof ActiveWorkoutNotificationEvents>(
    eventName: EventName,
    listener: ActiveWorkoutNotificationEvents[EventName]
  ): EventSubscription;
};

const nativeModule =
  requireOptionalNativeModule<ActiveWorkoutNotificationNativeModule>('ActiveWorkoutNotification');

export const inspectAuthorizationAsync = () => nativeModule?.inspectAuthorizationAsync()
  ?? Promise.resolve({ supported: false, authorized: false, canShow: false });
export const showAsync = () => nativeModule?.showAsync() ?? Promise.resolve();
export const removeAsync = () => nativeModule?.removeAsync() ?? Promise.resolve();
export const openSettingsAsync = () => nativeModule?.openSettingsAsync() ?? Promise.resolve();
export const getInitialTapAsync = () => nativeModule?.getInitialTapAsync() ?? Promise.resolve(false);

export const addNotificationTapListener = (
  listener: ActiveWorkoutNotificationEvents['notificationTap']
) => nativeModule?.addListener('notificationTap', listener) ?? { remove() {} };

export const addNotificationTapErrorListener = (
  listener: ActiveWorkoutNotificationEvents['notificationTapError']
) => nativeModule?.addListener('notificationTapError', listener) ?? { remove() {} };
