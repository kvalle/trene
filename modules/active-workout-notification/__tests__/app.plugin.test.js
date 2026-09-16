const {
  addNotificationPermission,
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
});
