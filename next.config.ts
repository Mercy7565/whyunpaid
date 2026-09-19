import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a verification build write somewhere other than the directory the dev
  // server is watching; writing to .next under a running `next dev` corrupts it.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  devIndicators: false,
  outputFileTracingRoot: import.meta.dirname,
  // pdf.js ships its own worker; we serve it from /public and never bundle it.
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = { ...(config.resolve.alias ?? {}), canvas: false };
    return config;
  },
};

export default nextConfig;
