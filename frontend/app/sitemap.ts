import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/constants';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// Revalidate the sitemap hourly so new listings get discovered without a redeploy.
export const revalidate = 3600;

// Public, indexable static routes (auth/dashboard/settings stay out — see robots.ts).
const STATIC_ROUTES: Array<{ path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }> = [
  { path: '', changeFrequency: 'daily', priority: 1 },
  { path: '/search', changeFrequency: 'hourly', priority: 0.9 },
  { path: '/support', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/legal/terms', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/privacy', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/cgv', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/cookies', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/gdpr', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/mentions-legales', changeFrequency: 'monthly', priority: 0.3 },
];

// Safe YYYY-MM-DD; invalid/missing dates fall back to today so one bad record
// can't throw and empty the whole property sitemap.
const toIsoDate = (value?: string): string => {
  const d = value ? new Date(value) : new Date();
  return (Number.isNaN(d.getTime()) ? new Date() : d).toISOString().split('T')[0];
};

async function getPropertyEntries(): Promise<MetadataRoute.Sitemap> {
  // Best-effort: a sitemap must never fail the build/route if the API is down.
  try {
    const res = await fetch(`${API_URL}/properties?limit=1000`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = Array.isArray(data) ? data : data?.data ?? [];
    return items
      .filter((p) => p?.id)
      .map((p) => ({
        url: `${SITE_URL}/properties/${p.id}`,
        lastModified: toIsoDate(p.updated_at),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString().split('T')[0];
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const propertyEntries = await getPropertyEntries();
  return [...staticEntries, ...propertyEntries];
}
