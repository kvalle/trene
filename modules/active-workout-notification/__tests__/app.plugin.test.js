const {
  addNotificationPermission,
  configureIosInfoPlist,
  LIVE_ACTIVITY_URL_SCHEME,
  POST_NOTIFICATIONS,
} = require('../app.plugin');

describe('active workout notification config plugin', () => {
  it('adds the Android 13 notification permission idempotently', () => {
    const manifest = { manifest: {} };

    addNotificationPermission(manifest);
    addNotificationPermission(manifest);

    expect(manifest.manifest['uses-permission']).toEqual([
      { $: { 'android:name': POST_NOTIFICATIONS } },
    ]);
  });

  it('enables Live Activities and registers their tap URL idempotently', () => {
    const infoPlist = {};

    configureIosInfoPlist(infoPlist);
    configureIosInfoPlist(infoPlist);

    expect(infoPlist.NSSupportsLiveActivities).toBe(true);
    expect(infoPlist.CFBundleURLTypes).toEqual([{
      CFBundleURLName: 'Active workout Live Activity',
      CFBundleURLSchemes: [LIVE_ACTIVITY_URL_SCHEME],
    }]);
  });
});
