import type { NextConfig } from "next";
import path from "path";

const isProd = process.env.NODE_ENV === 'production';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// Extract hostname from API_URL safely (for CSP connect-src)
function getApiHostname(url: string): string {
  try { return new URL(url).hostname; } catch { return '127.0.0.1'; }
}
const apiHostname = getApiHostname(API_URL);
// A plain-http API target means a local/CI backend (real prod uses https).
// In that case the CSP must allow http to it and must NOT upgrade-insecure-requests.
const httpApi = API_URL.startsWith('http://');

// Content Security Policy
// - script-src: allow Next.js inline scripts (nonce not yet wired), Google GSI script, and self
// - connect-src: allow API and Google token endpoints
// - frame-src: allow Google Sign-In and accounts popup
// - style-src: allow inline styles required by Tailwind/framer-motion
// - img-src: allow blob/data URIs for image previews
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"} https://accounts.google.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com http://localhost:* http://127.0.0.1:*${isProd ? ' https:' : ''}`,
  `font-src 'self' data:`,
  `connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://*.googleapis.com${isProd && !httpApi ? ` https://${apiHostname}` : ` http://localhost:* http://127.0.0.1:*`}`,
  `frame-src https://accounts.google.com`,
  `frame-ancestors 'none'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  ...(isProd && !httpApi ? ['upgrade-insecure-requests'] : []),
].filter(Boolean).join('; ');

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
            key: 'Content-Security-Policy',
            value: csp,
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
      // Dev-only: allow loading images over http from localhost
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
      },
      // Production: allow https from the configured API hostname
      ...(isProd ? [{
        protocol: 'https' as const,
        hostname: apiHostname,
      }] : []),
    ],
  },
};

export default nextConfig;
