import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    // `remotePatterns` supersedes the deprecated `domains` list and supports
    // wildcards, so we cover Supabase storage buckets and any future CDN host.
    remotePatterns: [
      // Unsplash (existing images used in seed data / stories)
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      // Supabase Storage — project URL varies per environment, so match any
      // *.supabase.co storage subdomain.
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
      // Self-hosted / local Supabase (docker) on localhost
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '54321',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
      '@/components': path.resolve(__dirname, 'src/components'),
      '@/hooks': path.resolve(__dirname, 'src/hooks'),
      '@/services': path.resolve(__dirname, 'src/services'),
      '@/types': path.resolve(__dirname, 'src/types'),
      '@/lib': path.resolve(__dirname, 'src/lib'),
    };
    return config;
  },
};

export default nextConfig;
