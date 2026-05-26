/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [
      {
        source: '/entenda-orkiestri.html',
        destination: '/entenda-orkiestri',
        permanent: true,
      },
    ]
  },
};
module.exports = nextConfig;
