const {
  AndroidConfig,
  withAndroidManifest,
  withInfoPlist,
} = require('@expo/config-plugins');
const { withActiveWorkoutLiveActivity } = require('./plugin/withActiveWorkoutLiveActivity');

const POST_NOTIFICATIONS = 'android.permission.POST_NOTIFICATIONS';
const LIVE_ACTIVITY_URL_SCHEME = 'trene-active-workout';

function addNotificationPermission(manifest) {
  AndroidConfig.Permissions.ensurePermission(manifest, POST_NOTIFICATIONS);
}

function configureIosInfoPlist(infoPlist) {
  infoPlist.NSSupportsLiveActivities = true;
  const urlTypes = infoPlist.CFBundleURLTypes ?? [];
  const alreadyRegistered = urlTypes.some((urlType) =>
    urlType.CFBundleURLSchemes?.includes(LIVE_ACTIVITY_URL_SCHEME));
  if (!alreadyRegistered) {
    urlTypes.push({
      CFBundleURLName: 'Active workout Live Activity',
      CFBundleURLSchemes: [LIVE_ACTIVITY_URL_SCHEME],
    });
  }
  infoPlist.CFBundleURLTypes = urlTypes;
}

function withActiveWorkoutNotification(config) {
  config = withAndroidManifest(config, (configWithManifest) => {
    addNotificationPermission(configWithManifest.modResults);
    return configWithManifest;
  });
  config = withInfoPlist(config, (configWithInfoPlist) => {
    configureIosInfoPlist(configWithInfoPlist.modResults);
    return configWithInfoPlist;
  });
  return withActiveWorkoutLiveActivity(config);
}

module.exports = withActiveWorkoutNotification;
module.exports.addNotificationPermission = addNotificationPermission;
module.exports.configureIosInfoPlist = configureIosInfoPlist;
module.exports.POST_NOTIFICATIONS = POST_NOTIFICATIONS;
module.exports.LIVE_ACTIVITY_URL_SCHEME = LIVE_ACTIVITY_URL_SCHEME;
