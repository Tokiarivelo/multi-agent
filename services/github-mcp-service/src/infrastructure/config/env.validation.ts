import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  GITHUB_APP_ID: Joi.number().required(),
  GITHUB_APP_PRIVATE_KEY: Joi.string().optional(),
  GITHUB_APP_PRIVATE_KEY_PATH: Joi.string().optional(),
  GITHUB_APP_INSTALLATION_ID: Joi.number().required(),
  GITHUB_MCP_PORT: Joi.number().default(3010),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  // GitHub OAuth App credentials (optional — enables the /github/authorize endpoint)
  GITHUB_OAUTH_CLIENT_ID: Joi.string().optional(),
  GITHUB_OAUTH_CLIENT_SECRET: Joi.string().optional(),
  GITHUB_OAUTH_CALLBACK_URL: Joi.string().uri().optional(),
}).or('GITHUB_APP_PRIVATE_KEY', 'GITHUB_APP_PRIVATE_KEY_PATH');
