export function isCatalogEnabled(env = process.env) {
  return env.EXPO_PUBLIC_COMPONENT_CATALOG === '1';
}

export function parseCatalogArgs(args) {
  let platform = null;
  const extraArgs = [];
  let expectPortValue = false;

  for (const arg of args) {
    if (expectPortValue) {
      extraArgs.push(arg);
      expectPortValue = false;
      continue;
    }
    if (arg === '--android') platform = 'android';
    else if (arg === '--ios') platform = 'ios';
    else if (arg === '--clear') extraArgs.push(arg);
    else if (arg === '--port') {
      extraArgs.push(arg);
      expectPortValue = true;
    } else if (arg === '--help' || arg === '-h') {
      return { platform: 'help', extraArgs: [] };
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (expectPortValue) throw new Error('Missing value for --port');

  return { platform, extraArgs };
}

export function getExpoStartArgs(platform, extraArgs = []) {
  if (platform === 'android') return ['expo', 'start', '--lan', '--clear', '--android', ...extraArgs];
  if (platform === 'ios') return ['expo', 'start', '--clear', '--ios', ...extraArgs];
  throw new Error(`Unsupported platform: ${platform}`);
}

export function getCatalogEnv(baseEnv = process.env) {
  return { ...baseEnv, EXPO_PUBLIC_COMPONENT_CATALOG: '1' };
}
