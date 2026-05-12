import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  EMAIL_MCP_PORT: Joi.number().default(3012),
  SMTP_HOST: Joi.string().default('smtp.gmail.com'),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().optional().allow(''),
  SMTP_PASS: Joi.string().optional().allow(''),
  SMTP_FROM: Joi.string().optional().allow(''),
  IMAP_HOST: Joi.string().default('imap.gmail.com'),
  IMAP_PORT: Joi.number().default(993),
  IMAP_USER: Joi.string().optional().allow(''),
  IMAP_PASS: Joi.string().optional().allow(''),
  GMAIL_CLIENT_ID: Joi.string().optional().allow(''),
  GMAIL_CLIENT_SECRET: Joi.string().optional().allow(''),
  TOOL_SERVICE_URL: Joi.string().default('http://localhost:3030'),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
});
