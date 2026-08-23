import { registerRootComponent } from 'expo';

import { getRootComponent } from './src/entrypoint';

registerRootComponent(getRootComponent());
