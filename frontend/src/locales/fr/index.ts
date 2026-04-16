import { workflows } from './workflows';
import { apiKeys } from './apiKeys';
import { models } from './models';
import { docs } from './docs';
import { common } from './common';
import { dashboard } from './dashboard';
import { agents } from './agents';

export const fr = {
  ...workflows,
  ...apiKeys,
  ...models,
  ...docs,
  ...common,
  ...dashboard,
  ...agents,
};
