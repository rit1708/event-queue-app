export * from './types';
export * from './config';
export * from './events';
export * from './queue';
export * from './admin';

import { init, getBaseUrl, getConfig } from './config';
import * as events from './events';
import * as queue from './queue';
import * as admin from './admin';

export { init, getBaseUrl, getConfig };
export { events, queue, admin };

export default {
  init,
  getBaseUrl,
  getConfig,
  ...events,
  ...queue,
  ...admin,
};
