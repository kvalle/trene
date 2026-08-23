import { getRootComponent, isCatalogEnabled } from '../entrypoint';
import App from '../App';
import ComponentCatalog from '../catalog/ComponentCatalog';

describe('entrypoint', () => {
  it('routes to production App by default', () => {
    expect(isCatalogEnabled({})).toBe(false);
    expect(getRootComponent({})).toBe(App);
    expect(getRootComponent({ EXPO_PUBLIC_COMPONENT_CATALOG: undefined })).toBe(App);
    expect(getRootComponent({ EXPO_PUBLIC_COMPONENT_CATALOG: '0' })).toBe(App);
    expect(getRootComponent({ EXPO_PUBLIC_COMPONENT_CATALOG: '' })).toBe(App);
  });

  it('routes to ComponentCatalog when EXPO_PUBLIC_COMPONENT_CATALOG=1', () => {
    expect(isCatalogEnabled({ EXPO_PUBLIC_COMPONENT_CATALOG: '1' })).toBe(true);
    expect(getRootComponent({ EXPO_PUBLIC_COMPONENT_CATALOG: '1' })).toBe(ComponentCatalog);
  });

  it('preserves production entrypoint without env mutation', () => {
    // Production entrypoint is App; catalog is only selected via explicit env
    const env: Record<string, string | undefined> = {};
    expect(getRootComponent(env)).toBe(App);
    env.EXPO_PUBLIC_COMPONENT_CATALOG = '1';
    expect(getRootComponent(env)).toBe(ComponentCatalog);
    delete env.EXPO_PUBLIC_COMPONENT_CATALOG;
    expect(getRootComponent(env)).toBe(App);
  });
});
