import type {NextConfig} from 'next';

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
};

export default nextConfig;
