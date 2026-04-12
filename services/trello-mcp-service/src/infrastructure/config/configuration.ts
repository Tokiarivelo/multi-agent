export default () => ({
  trello: {
    apiKey: process.env['TRELLO_API_KEY'] ?? '',
    token: process.env['TRELLO_TOKEN'] ?? '',
  },
  port: Number(process.env['TRELLO_MCP_PORT'] ?? 3011),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
});
