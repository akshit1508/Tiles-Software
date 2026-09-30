/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    if (dev) {
      config.output = config.output || {};
      config.output.chunkLoadTimeout = 300000; // 5 minutes to prevent timeout on cold compilation
    }
    return config;
  },
};

export default nextConfig;
