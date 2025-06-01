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
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: 'AIzaSyDuMk3K8cJZKEaPA-G3PCKVdkrTLkL-WQk',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'electric-magnitudes-analizer.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'electric-magnitudes-analizer',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'electric-magnitudes-analizer.firebasestorage.app',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '192714984768',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:192714984768:web:e9362f4e16f58a27a73ea5',
  },
};

export default nextConfig;
