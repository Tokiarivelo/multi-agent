export default () => ({
  port: Number(process.env['EMAIL_MCP_PORT'] ?? 3012),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  smtp: {
    host: process.env['SMTP_HOST'] ?? 'smtp.gmail.com',
    port: Number(process.env['SMTP_PORT'] ?? 587),
    user: process.env['SMTP_USER'] ?? '',
    pass: process.env['SMTP_PASS'] ?? '',
    from: process.env['SMTP_FROM'] ?? '',
  },
  imap: {
    host: process.env['IMAP_HOST'] ?? 'imap.gmail.com',
    port: Number(process.env['IMAP_PORT'] ?? 993),
    user: process.env['IMAP_USER'] ?? process.env['SMTP_USER'] ?? '',
    pass: process.env['IMAP_PASS'] ?? process.env['SMTP_PASS'] ?? '',
  },
  toolServiceUrl: process.env['TOOL_SERVICE_URL'] ?? 'http://localhost:3030',
});
