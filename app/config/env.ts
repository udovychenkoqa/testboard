import { cleanEnv, str, num, bool } from 'envalid';

export const env = cleanEnv(process.env, {
  API_TOKEN: str({ desc: 'API token for authorization', default: undefined }),
  UI_AUTH_EXPIRE_HOURS: str({ desc: 'How much hours are allowed to keep auth session valid', default: '2' }),
  AUTH_SECRET: str({ desc: 'Secret for JWT', default: undefined }),
  // Google OAuth for human UI sign-in — enabled only when BOTH id and secret
  // are set. Coexists with API_TOKEN (which stays for CI/programmatic use).
  AUTH_GOOGLE_ID: str({ desc: 'Google OAuth client id', default: undefined }),
  AUTH_GOOGLE_SECRET: str({ desc: 'Google OAuth client secret', default: undefined }),
  // Comma-separated domains allowed to sign in via Google (e.g. "example.com").
  // Users from an allowed domain get the viewer role; anyone else is rejected.
  AUTH_ALLOWED_DOMAINS: str({ desc: 'Comma-separated email domains allowed to sign in', default: '' }),
  // Comma-separated exact emails granted the admin role (Settings, deletes,
  // triggers). Always allowed to sign in regardless of domain.
  AUTH_ADMIN_EMAILS: str({ desc: 'Comma-separated admin emails', default: '' }),
  DATA_STORAGE: str({ desc: 'Where to store data', default: 'fs' }),
  USE_SERVER_CACHE: bool({ desc: 'Use server side indexed cache for backend queries', default: false }),
  S3_ENDPOINT: str({ desc: 'S3 endpoint', default: undefined }),
  S3_ACCESS_KEY: str({ desc: 'S3 access key', default: undefined }),
  S3_SECRET_KEY: str({ desc: 'S3 secret key', default: undefined }),
  S3_PORT: num({ desc: 'S3 port', default: undefined }),
  S3_REGION: str({ desc: 'S3 region', default: undefined }),
  S3_BUCKET: str({ desc: 'S3 bucket', default: 'playwright-reports-server' }),
  S3_USE_SSL: bool({ desc: 'Use SSL for S3 connections', default: true }),
  S3_BATCH_SIZE: num({ desc: 'S3 batch size', default: 10 }),
  AZURE_ACCOUNT_NAME: str({ desc: 'Azure Storage account name', default: undefined }),
  AZURE_ACCOUNT_KEY: str({ desc: 'Azure Storage account key', default: undefined }),
  AZURE_CONTAINER: str({ desc: 'Azure Storage container name', default: 'playwright-reports-server' }),
  AZURE_BATCH_SIZE: num({ desc: 'Azure batch size', default: 10 }),
  RESULT_EXPIRE_DAYS: num({ desc: 'How much days to keep results', default: undefined }),
  RESULT_EXPIRE_CRON_SCHEDULE: str({ desc: 'Cron schedule for results cleanup', default: '33 3 * * *' }),
  REPORT_EXPIRE_DAYS: num({ desc: 'How much days to keep reports', default: undefined }),
  REPORT_EXPIRE_CRON_SCHEDULE: str({ desc: 'Cron schedule for reports cleanup', default: '44 4 * * *' }),
  API_BASE_PATH: str({ desc: 'Base path for the API', default: '' }),
  // AI report summary: feature is off by default (undefined) — set to enable.
  ANTHROPIC_API_KEY: str({ desc: 'Anthropic API key for AI report failure summary', default: undefined }),
  ANTHROPIC_MODEL: str({ desc: 'Anthropic model id for AI report summary', default: 'claude-sonnet-5' }),
  // Absolute public URL of this server — used for links in Slack/webhook
  // notifications (Slack rejects relative URLs in buttons).
  BASE_URL: str({ desc: 'Public base URL of this server', default: undefined }),
  // Run autotests from the UI through GitLab pipelines: off unless URL, token and project are set.
  GITLAB_URL: str({ desc: 'GitLab base URL, e.g. https://gitlab.com', default: undefined }),
  GITLAB_TOKEN: str({ desc: 'GitLab access token with api scope (server-side only)', default: undefined }),
  GITLAB_AUTOTESTS_PROJECT: str({ desc: 'Autotests project path (group/name) or numeric id', default: undefined }),
  GITLAB_REF: str({ desc: 'Branch the autotests pipeline runs on', default: 'main' }),
});
