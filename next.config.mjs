/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable image optimization for Cloudflare Pages
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
