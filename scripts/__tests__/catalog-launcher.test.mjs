import assert from 'node:assert/strict';
import test from 'node:test';
import { getCatalogEnv, getExpoStartArgs, isCatalogEnabled, parseCatalogArgs } from '../catalog-launcher.mjs';

test('isCatalogEnabled only true for EXPO_PUBLIC_COMPONENT_CATALOG=1', () => {
  assert.equal(isCatalogEnabled({}), false);
  assert.equal(isCatalogEnabled({ EXPO_PUBLIC_COMPONENT_CATALOG: '0' }), false);
  assert.equal(isCatalogEnabled({ EXPO_PUBLIC_COMPONENT_CATALOG: '' }), false);
  assert.equal(isCatalogEnabled({ EXPO_PUBLIC_COMPONENT_CATALOG: '1' }), true);
  assert.equal(isCatalogEnabled({ EXPO_PUBLIC_COMPONENT_CATALOG: '1', OTHER: 'x' }), true);
});

test('parseCatalogArgs accepts --android and --ios', () => {
  assert.deepEqual(parseCatalogArgs(['--android']), { platform: 'android', extraArgs: [] });
  assert.deepEqual(parseCatalogArgs(['--ios']), { platform: 'ios', extraArgs: [] });
  assert.deepEqual(parseCatalogArgs(['--android', '--clear']), { platform: 'android', extraArgs: ['--clear'] });
  assert.deepEqual(parseCatalogArgs(['--ios', '--clear', '--port', '19000']), {
    platform: 'ios',
    extraArgs: ['--clear', '--port', '19000'],
  });
});

test('parseCatalogArgs returns help and throws on unknown', () => {
  assert.deepEqual(parseCatalogArgs(['--help']), { platform: 'help', extraArgs: [] });
  assert.throws(() => parseCatalogArgs(['--unknown']), /Unknown argument/);
  assert.throws(() => parseCatalogArgs(['--port']), /Missing value for --port/);
  assert.throws(() => parseCatalogArgs(['--clear', '--weird']), /Unknown argument/);
});

test('getExpoStartArgs builds correct Expo Go launch commands', () => {
  assert.deepEqual(getExpoStartArgs('android'), ['expo', 'start', '--lan', '--clear', '--android']);
  assert.deepEqual(getExpoStartArgs('ios'), ['expo', 'start', '--clear', '--ios']);
  assert.deepEqual(getExpoStartArgs('android', ['--clear']), ['expo', 'start', '--lan', '--clear', '--android', '--clear']);
  assert.deepEqual(getExpoStartArgs('ios', ['--port', '19000']), ['expo', 'start', '--clear', '--ios', '--port', '19000']);
  assert.throws(() => getExpoStartArgs('web'), /Unsupported platform/);
});

test('getCatalogEnv sets EXPO_PUBLIC_COMPONENT_CATALOG=1 without mutating base', () => {
  const base = { FOO: 'bar' };
  const env = getCatalogEnv(base);
  assert.equal(env.EXPO_PUBLIC_COMPONENT_CATALOG, '1');
  assert.equal(env.FOO, 'bar');
  assert.equal(base.EXPO_PUBLIC_COMPONENT_CATALOG, undefined);
});

test('catalog launcher does not require rebuilding Trene', () => {
  // Launcher uses Expo Go (expo start --android/--ios) not expo run:android/ios
  const androidArgs = getExpoStartArgs('android');
  const iosArgs = getExpoStartArgs('ios');
  assert.equal(androidArgs.includes('run:android'), false);
  assert.equal(iosArgs.includes('run:ios'), false);
  assert.equal(androidArgs.includes('--android'), true);
  assert.equal(iosArgs.includes('--ios'), true);
  // Expo Go bundle identifiers differ from Trene: implicit via Expo Go host
  // but launcher never invokes native build
  assert.equal(androidArgs.join(' ').includes('start'), true);
});
