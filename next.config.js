const API_BASE_PATH = process.env.API_BASE_PATH || '';
const ASSETS_BASE_PATH = process.env.ASSETS_BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A second dev server (the e2e suite) must not share .next with the first.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
    // Native module — load it from node_modules at runtime instead of bundling.
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  // basePath: API_BASE_PATH,
  assetPrefix: ASSETS_BASE_PATH,
  env: {
    API_BASE_PATH,
  },
};

const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

module.exports = withNextIntl(nextConfig);
