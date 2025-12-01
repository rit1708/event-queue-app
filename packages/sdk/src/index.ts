export * from './types';
export * from './config';
export * from './events';
export * from './queue';
export * from './admin';

// React components and hooks
export * from './react';

import { init, getBaseUrl, getConfig, setToken, getToken, loadTokenFromStorage, saveTokenToStorage, clearTokenFromStorage } from './config';
import * as events from './events';
import * as queue from './queue';
import * as admin from './admin';

export { init, getBaseUrl, getConfig, setToken, getToken, loadTokenFromStorage, saveTokenToStorage, clearTokenFromStorage };
export { events, queue, admin };

export default {
  init,
  getBaseUrl,
  getConfig,
  ...events,
  ...queue,
  ...admin,
};
