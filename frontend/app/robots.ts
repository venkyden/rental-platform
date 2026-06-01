import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/constants';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Keep private / transactional / per-user surfaces out of the index.
      disallow: [
        '/admin/',
        '/dashboard/',
        '/inbox/',
        '/settings/',
        '/profile/',
        '/auth/',
        '/verify/',
        '/verify-capture/',
        '/capture/',
        '/onboarding/',
        '/api/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
