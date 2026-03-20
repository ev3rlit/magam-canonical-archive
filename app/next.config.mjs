/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep lint as an explicit separate step so production builds don't re-lint the whole app tree.
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
