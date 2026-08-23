import App from './App';
import ComponentCatalog from './catalog/ComponentCatalog';

export function isCatalogEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.EXPO_PUBLIC_COMPONENT_CATALOG === '1';
}

export function getRootComponent(env: Record<string, string | undefined> = process.env): typeof App | typeof ComponentCatalog {
  return isCatalogEnabled(env) ? ComponentCatalog : App;
}
