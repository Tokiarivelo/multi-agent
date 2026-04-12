import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  TRELLO_API_KEY: Joi.string().required(),
  TRELLO_TOKEN: Joi.string().required(),
  TRELLO_MCP_PORT: Joi.number().default(3011),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
});
