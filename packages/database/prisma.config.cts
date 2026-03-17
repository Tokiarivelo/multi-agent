const { config } = require('dotenv');
const { resolve } = require('path');
const { defineConfig, env } = require('prisma/config');

// Load workspace root .env file
config({ path: resolve(__dirname, '../../.env') });

module.exports = defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});


