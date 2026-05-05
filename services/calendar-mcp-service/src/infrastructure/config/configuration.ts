export default () => ({
  port: Number(process.env['CALENDAR_MCP_PORT'] ?? 3013),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  google: {
    credentials: process.env['GOOGLE_CALENDAR_CREDENTIALS'] ?? '',
    calendarId: process.env['GOOGLE_CALENDAR_ID'] ?? 'primary',
    oauthClientId: process.env['GOOGLE_OAUTH_CLIENT_ID'] ?? '',
    oauthClientSecret: process.env['GOOGLE_OAUTH_CLIENT_SECRET'] ?? '',
    oauthRefreshToken: process.env['GOOGLE_OAUTH_REFRESH_TOKEN'] ?? '',
  },
});
