import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  CALENDAR_MCP_PORT: Joi.number().default(3013),
  GOOGLE_CALENDAR_CREDENTIALS: Joi.string().optional().allow(''),
  GOOGLE_CALENDAR_ID: Joi.string().default('primary'),
  GOOGLE_OAUTH_CLIENT_ID: Joi.string().optional().allow(''),
  GOOGLE_OAUTH_CLIENT_SECRET: Joi.string().optional().allow(''),
  GOOGLE_OAUTH_REFRESH_TOKEN: Joi.string().optional().allow(''),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
});
