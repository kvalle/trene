const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  EXTENSION_FILES,
  configureXcodeProject,
  copyExtensionSources,
} = require('../plugin/withActiveWorkoutLiveActivity');

describe('active workout Live Activity extension generation', () => {
  it('resolves the Expo module and app delegate subscriber for iOS', () => {
    const workspaceRoot = path.join(__dirname, '..', '..', '..');
    const resolved = JSON.parse(execFileSync(
      process.execPath,
      [
        path.join(workspaceRoot, 'node_modules', 'expo-modules-autolinking', 'bin', 'expo-modules-autolinking'),
        'resolve',
        '--platform',
        'ios',
        '--json',
      ],
      { cwd: workspaceRoot, encoding: 'utf8' },
    ));
    const activeWorkoutModule = resolved.modules.find(
      (module) => module.packageName === 'active-workout-notification',
    );

    expect(activeWorkoutModule).toMatchObject({
      swiftModuleNames: ['ActiveWorkoutNotification'],
      modules: [{ class: 'ActiveWorkoutNotificationModule' }],
      appDelegateSubscribers: ['ActiveWorkoutNotificationAppDelegateSubscriber'],
    });
  });

  it('copies a complete extension into a generated iOS project repeatedly', () => {
    const artifactsRoot = path.join(__dirname, '..', '..', '..', '.artifacts', 'tests');
    fs.mkdirSync(artifactsRoot, { recursive: true });
    const projectRoot = fs.mkdtempSync(path.join(artifactsRoot, 'live-activity-'));
    const templateRoot = path.join(__dirname, '..', 'plugin', 'extension');

    copyExtensionSources(projectRoot, templateRoot);
    copyExtensionSources(projectRoot, templateRoot);

    expect(fs.readdirSync(path.join(projectRoot, 'ActiveWorkoutLiveActivity')).sort())
      .toEqual([...EXTENSION_FILES].sort());
    const infoPlist = fs.readFileSync(
      path.join(projectRoot, 'ActiveWorkoutLiveActivity', 'ActiveWorkoutLiveActivity-Info.plist'),
      'utf8',
    );
    expect(infoPlist).toContain('com.apple.widgetkit-extension');
  });

  it('creates source and framework phases before assigning extension files', () => {
    const target = { buildConfigurationList: 'configuration-list' };
    const project = {
      addTarget: jest.fn(() => ({ uuid: 'extension-target', pbxNativeTarget: target })),
      addBuildPhase: jest.fn(),
      pbxNativeTargetSection: jest.fn(() => ({})),
    };
    const ensureGroupRecursively = jest
      .spyOn(require('@expo/config-plugins').IOSConfig.XcodeUtils, 'ensureGroupRecursively')
      .mockImplementation(() => ({}));
    const addBuildSourceFileToGroup = jest
      .spyOn(require('@expo/config-plugins').IOSConfig.XcodeUtils, 'addBuildSourceFileToGroup')
      .mockImplementation(() => ({}));
    const getBuildConfigurationsForListId = jest
      .spyOn(require('@expo/config-plugins').IOSConfig.XcodeUtils, 'getBuildConfigurationsForListId')
      .mockReturnValue([['debug', { buildSettings: {} }]]);

    configureXcodeProject(project, 'com.example.app');

    expect(project.addBuildPhase).toHaveBeenNthCalledWith(
      1, [], 'PBXSourcesBuildPhase', 'Sources', 'extension-target',
    );
    expect(project.addBuildPhase).toHaveBeenNthCalledWith(
      2, [], 'PBXFrameworksBuildPhase', 'Frameworks', 'extension-target',
    );
    expect(addBuildSourceFileToGroup).toHaveBeenCalledWith(expect.objectContaining({
      targetUuid: 'extension-target',
    }));

    ensureGroupRecursively.mockRestore();
    addBuildSourceFileToGroup.mockRestore();
    getBuildConfigurationsForListId.mockRestore();
  });
});
