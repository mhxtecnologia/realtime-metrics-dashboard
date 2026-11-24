import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Saída standalone: a imagem Docker leva só o servidor e as dependências rastreadas.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@realtime-metrics/protocol'],
  poweredByHeader: false,
  reactStrictMode: true,
  // O lint roda como etapa própria no CI; não precisa repetir no build.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
