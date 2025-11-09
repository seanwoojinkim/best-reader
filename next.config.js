/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable webpack cache to avoid issues with epub.js
  webpack: (config, { isServer }) => {
    // Handle epub.js client-side only
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
