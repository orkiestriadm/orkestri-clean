/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: { cpus: 1 },
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  async redirects() {
    return [
      {
        source: '/entenda-orkiestri.html',
        destination: '/entenda-orkiestri',
        permanent: true,
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost/api/:path*',
      },
    ]
  },
};
module.exports = nextConfig;
