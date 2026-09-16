const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

const POST_NOTIFICATIONS = 'android.permission.POST_NOTIFICATIONS';

function addNotificationPermission(manifest) {
  AndroidConfig.Permissions.ensurePermission(manifest, POST_NOTIFICATIONS);
}

function withActiveWorkoutNotification(config) {
  return withAndroidManifest(config, (configWithManifest) => {
    addNotificationPermission(configWithManifest.modResults);
    return configWithManifest;
  });
}

module.exports = withActiveWorkoutNotification;
module.exports.addNotificationPermission = addNotificationPermission;
module.exports.POST_NOTIFICATIONS = POST_NOTIFICATIONS;
