import * as fs from 'fs';

export default () => {
  const privateKeyInline = process.env['GITHUB_APP_PRIVATE_KEY'];
  const privateKeyPath = process.env['GITHUB_APP_PRIVATE_KEY_PATH'];

  let privateKey: string;
  if (privateKeyPath) {
    privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  } else if (privateKeyInline) {
    privateKey = privateKeyInline.replace(/\\n/g, '\n');
  } else {
    throw new Error('GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_PATH must be set');
  }

  return {
    github: {
      appId: Number(process.env['GITHUB_APP_ID']),
      privateKey,
      installationId: Number(process.env['GITHUB_APP_INSTALLATION_ID']),
    },
    githubOAuth: {
      clientId: process.env['GITHUB_OAUTH_CLIENT_ID'] ?? '',
      clientSecret: process.env['GITHUB_OAUTH_CLIENT_SECRET'] ?? '',
      callbackUrl:
        process.env['GITHUB_OAUTH_CALLBACK_URL'] ?? 'http://localhost:3001/api/github/callback',
    },
    port: Number(process.env['GITHUB_MCP_PORT'] ?? 3010),
    nodeEnv: process.env['NODE_ENV'] ?? 'development',
  };
};
