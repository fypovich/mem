/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8000',
        pathname: '/static/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/static/**',
      },
      // Оставьте это для github аватарок (если было)
      {
        protocol: 'https',
        hostname: 'github.com',
      },
      {
          protocol: 'https',
          hostname: 'media.giphy.com',
      }
    ],
  },
};

export default nextConfig;