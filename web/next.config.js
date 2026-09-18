/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Lets a second server (e.g. the API test server) run beside `npm run dev` without sharing .next
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  env: {
    // The backend now lives in this app (src/app/api), so the API origin is the app itself.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  },
  experimental: {
    // Runs src/instrumentation.ts on server start (starts the email scheduler).
    instrumentationHook: true,
    // Server-only libraries that must be required at runtime rather than bundled.
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth', 'nodemailer', 'openai'],
  },
};

module.exports = nextConfig;
