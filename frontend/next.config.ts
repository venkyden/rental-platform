import type { NextConfig } from "next";
import path from "path";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Security headers for production
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(self)',
          },
          {
            /* 
              Cross-Origin-Opener-Policy: 'same-origin-allow-popups' is used to ensure compatibility with 
              Google Identity Services (GSI) / Google Sign-In popups. Without this, modern browsers 
              will isolate cross-origin popups, blocking window.postMessage communication.
              
              Note: Errors like 'FrameDoesNotExistError' or 'runtime.lastError' in the console 
              are typically caused by browser extensions (e.g. Grammarly, Loom) and are not 
              related to the application code.
            */
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin',
          },
          ...(isProd ? [{
            // HSTS only in production — browsers ignore it over plain HTTP
            // but we avoid accidentally pinning HTTPS on dev tunnels.
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          }] : []),
        ],
      },
    ];
  },
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
      },
    ],
  },
  outputFileTracingRoot: path.join(__dirname, "../"),
};

export default nextConfig;
