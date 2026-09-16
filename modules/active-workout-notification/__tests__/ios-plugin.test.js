const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  EXTENSION_FILES,
  configureXcodeProject,
  copyExtensionSources,
} = require('../plugin/withActiveWorkoutLiveActivity');

describe('active workout Live Activity extension generation', () => {
  it('copies a complete extension into a generated iOS project repeatedly', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'trene-live-activity-'));
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
