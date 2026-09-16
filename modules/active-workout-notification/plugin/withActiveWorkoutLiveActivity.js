const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  withDangerousMod,
  withXcodeProject,
} = require('@expo/config-plugins');

const TARGET_NAME = 'ActiveWorkoutLiveActivity';
const EXTENSION_DIRECTORY = TARGET_NAME;
const EXTENSION_FILES = [
  'ActiveWorkoutActivityAttributes.swift',
  'ActiveWorkoutLiveActivity.swift',
  'ActiveWorkoutLiveActivity-Info.plist',
];

function copyExtensionSources(platformProjectRoot, templateRoot) {
  const destination = path.join(platformProjectRoot, EXTENSION_DIRECTORY);
  fs.mkdirSync(destination, { recursive: true });
  for (const filename of EXTENSION_FILES) {
    fs.copyFileSync(path.join(templateRoot, filename), path.join(destination, filename));
  }
}

function findTarget(project, targetName) {
  const targets = project.pbxNativeTargetSection();
  for (const [uuid, target] of Object.entries(targets)) {
    if (uuid.endsWith('_comment')) continue;
    if (String(target.name).replaceAll('"', '') === targetName) return { uuid, target };
  }
  return null;
}

function configureXcodeProject(project, bundleIdentifier) {
  if (findTarget(project, TARGET_NAME)) return;

  const extensionBundleIdentifier = `${bundleIdentifier}.active-workout-live-activity`;
  const { uuid, pbxNativeTarget } = project.addTarget(
    TARGET_NAME,
    'app_extension',
    EXTENSION_DIRECTORY,
    extensionBundleIdentifier,
  );

  project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', uuid);
  project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', uuid);
  IOSConfig.XcodeUtils.ensureGroupRecursively(project, EXTENSION_DIRECTORY);
  for (const filename of EXTENSION_FILES.filter((file) => file.endsWith('.swift'))) {
    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath: `${EXTENSION_DIRECTORY}/${filename}`,
      groupName: EXTENSION_DIRECTORY,
      project,
      targetUuid: uuid,
    });
  }

  for (const [, configuration] of IOSConfig.XcodeUtils.getBuildConfigurationsForListId(
    project,
    pbxNativeTarget.buildConfigurationList,
  )) {
    Object.assign(configuration.buildSettings, {
      APPLICATION_EXTENSION_API_ONLY: 'YES',
      CODE_SIGN_STYLE: 'Automatic',
      CURRENT_PROJECT_VERSION: '1',
      GENERATE_INFOPLIST_FILE: 'NO',
      INFOPLIST_FILE: `"${EXTENSION_DIRECTORY}/ActiveWorkoutLiveActivity-Info.plist"`,
      IPHONEOS_DEPLOYMENT_TARGET: '16.1',
      MARKETING_VERSION: '1.0',
      PRODUCT_BUNDLE_IDENTIFIER: `"${extensionBundleIdentifier}"`,
      PRODUCT_NAME: `"${TARGET_NAME}"`,
      SDKROOT: 'iphoneos',
      SKIP_INSTALL: 'YES',
      SWIFT_VERSION: '5.0',
      TARGETED_DEVICE_FAMILY: '1',
    });
  }
}

function withActiveWorkoutLiveActivity(config) {
  config = withDangerousMod(config, ['ios', async (configWithFiles) => {
    copyExtensionSources(
      configWithFiles.modRequest.platformProjectRoot,
      path.join(__dirname, 'extension'),
    );
    return configWithFiles;
  }]);

  return withXcodeProject(config, (configWithProject) => {
    const bundleIdentifier = configWithProject.ios?.bundleIdentifier;
    if (!bundleIdentifier) throw new Error('An iOS bundleIdentifier is required for the Live Activity');
    configureXcodeProject(configWithProject.modResults, bundleIdentifier);
    return configWithProject;
  });
}

module.exports = {
  EXTENSION_DIRECTORY,
  EXTENSION_FILES,
  TARGET_NAME,
  configureXcodeProject,
  copyExtensionSources,
  withActiveWorkoutLiveActivity,
};
