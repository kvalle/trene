const fs = require('fs');
const path = require('path');

describe('active workout iOS native implementation', () => {
  const moduleRoot = path.join(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(moduleRoot, relativePath), 'utf8');

  it('renders the exact privacy-preserving payload and deep link', () => {
    const widget = read('plugin/extension/ActiveWorkoutLiveActivity.swift');

    expect(widget.match(/Text\("Trening pågår"\)/g)).toHaveLength(4);
    expect(widget).toContain('trene-active-workout://notification-tap');
    expect(widget).not.toMatch(/timer|workoutId|elapsed/i);
  });

  it('keeps show idempotent and removes every matching activity', () => {
    const nativeModule = read('ios/ActiveWorkoutNotificationModule.swift');

    expect(nativeModule).toContain('Activity<ActiveWorkoutActivityAttributes>.activities.isEmpty');
    expect(nativeModule).toContain('for activity in Activity<ActiveWorkoutActivityAttributes>.activities');
    expect(nativeModule).toContain('dismissalPolicy: .immediate');
  });

  it('maps ActivityKit availability and authorization without requesting permission', () => {
    const nativeModule = read('ios/ActiveWorkoutNotificationModule.swift');

    expect(nativeModule).toContain('#available(iOS 16.1, *)');
    expect(nativeModule).toContain('ActivityAuthorizationInfo().areActivitiesEnabled');
    expect(nativeModule).toContain('["supported": false, "authorized": false, "canShow": false]');
    expect(nativeModule).not.toContain('requestAuthorization');
  });

  it('delivers matching warm and cold taps through the existing contract', () => {
    const nativeModule = read('ios/ActiveWorkoutNotificationModule.swift');
    const subscriber = read('ios/ActiveWorkoutNotificationAppDelegateSubscriber.swift');
    const tapStore = read('ios/ActiveWorkoutNotificationTapStore.swift');

    expect(nativeModule).toContain('sendEvent("notificationTap")');
    expect(nativeModule).toContain('AsyncFunction("getInitialTapAsync")');
    expect(nativeModule).toContain('OnStartObserving("notificationTap")');
    expect(subscriber).toContain('open url: URL');
    expect(tapStore).toContain('pendingTap = true');
    expect(tapStore).toContain('pendingTap = false');
  });
});
