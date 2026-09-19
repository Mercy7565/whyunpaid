/**
 * Where this deployment lives.
 *
 * Vercel sets VERCEL_PROJECT_PRODUCTION_URL on every build, so canonical links,
 * the sitemap and the Open Graph card are correct on a preview and on
 * production without anyone setting an environment variable by hand.
 */
const fromVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  : fromVercel
    ? `https://${fromVercel}`
    : 'http://localhost:3000';
