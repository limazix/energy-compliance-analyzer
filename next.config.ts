import withBundleAnalyzer from '@next/bundle-analyzer';

import type { NextConfig } from 'next/types';

const withBundleAnalyzerConfig = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    allowedDevOrigins: [
      'https://9000-firebase-studio-1748710031191.cluster-ve345ymguzcd6qqzuko2qbxtfe.cloudworkstations.dev',
      'https://6000-firebase-studio-1748710031191.cluster-ve345ymguzcd6qqzuko2qbxtfe.cloudworkstations.dev',
    ],
  },
  env: {
    // NEXT_PUBLIC_FIREBASE_CONFIG is automatically available if set in .env or build environment
    // We only need to explicitly list other non-NEXT_PUBLIC_ variables here if we want to expose them,
    // or if we are renaming/aliasing NEXT_PUBLIC_ variables.
    // Since NEXT_PUBLIC_GEMINI_API_KEY is already prefixed, it's also automatically available.
    // This block can be used if you need to pass other specific env vars.
    NEXT_PUBLIC_GEMINI_API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
  },
};

export default withBundleAnalyzerConfig(nextConfig);
