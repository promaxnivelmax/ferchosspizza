/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'asywerfhslaqgdkkizyn.supabase.co' },
    ],
  },
  async redirects() {
    return [
      { source: '/', destination: '/login', permanent: false },
    ];
  },
};

module.exports = nextConfig;
