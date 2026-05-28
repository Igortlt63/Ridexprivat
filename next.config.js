/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_YANDEX_MAPS_KEY: process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY,
  },
}

module.exports = nextConfig
