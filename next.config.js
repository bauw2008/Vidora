/** @type {import('next').NextConfig} */
/* eslint-disable @typescript-eslint/no-var-requires */

const nextConfig = {
  ...(process.env.NODE_ENV === 'production' ? { output: 'standalone' } : {}),

  reactStrictMode: true,
  reactCompiler: true,

  // Next.js 16 使用 Turbopack，配置 SVG 加载
  turbopack: {
    root: __dirname,
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },

  // Uncoment to add domain whitelist
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;
