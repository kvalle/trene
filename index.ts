import { registerRootComponent } from 'expo';

import App from './src/App';
import ComponentCatalog from './src/catalog/ComponentCatalog';

registerRootComponent(process.env.EXPO_PUBLIC_COMPONENT_CATALOG === '1' ? ComponentCatalog : App);
