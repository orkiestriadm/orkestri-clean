/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracing: false,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true }
};
module.exports = nextConfig;
