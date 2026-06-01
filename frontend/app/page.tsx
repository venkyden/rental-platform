import { Metadata } from 'next';
import { BRAND, SITE_URL } from '@/lib/constants';
import Navbar from '@/components/Navbar';
import SearchHero from '@/components/landing/SearchHero';
import ValuePropSection from '@/components/landing/ValuePropSection';
import HowItWorks from '@/components/landing/HowItWorks';
import DualCTA from '@/components/landing/DualCTA';
import FrenchComplianceSection from '@/components/landing/FrenchComplianceSection';
import FeaturedListings from '@/components/landing/FeaturedListings';
import LandingFooter from '@/components/landing/LandingFooter';

export const metadata: Metadata = {
  title: `${BRAND.title} - Smart Rental Platform`,
  description: BRAND.description,
  keywords: ['rentals', 'france', 'apartments', 'roomivo', 'landlord', 'tenant', 'verified rentals'],
  alternates: { canonical: '/' },
  openGraph: {
    title: BRAND.title,
    description: BRAND.description,
    type: 'website',
    url: SITE_URL,
    siteName: BRAND.name,
    // OG/Twitter images are supplied automatically by app/opengraph-image.tsx
    // (next/og generated). No hand-maintained /og-image.png asset needed.
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND.title,
    description: BRAND.description,
  }
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: BRAND.name,
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon-512.png`,
  description: BRAND.description,
  sameAs: [
    'https://twitter.com/roomivo',
    'https://linkedin.com/company/roomivo'
  ]
};

export default function HomePage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="vibrancy-bg" />

      {/* ─── Navbar ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <Navbar />
      </div>

      <main>
        {/* ─── Hero Section with Search ─── */}
        <SearchHero />

        {/* ─── Core Value Proposition ─── */}
        <ValuePropSection />

        {/* ─── How It Works ─── */}
        <HowItWorks />

        {/* ─── Featured Listings Carousel ─── */}
        <FeaturedListings />

        {/* ─── French Compliance Section ─── */}
        <FrenchComplianceSection />

        {/* ─── Dual CTA ─── */}
        <DualCTA />
      </main>

      {/* ─── Footer ─── */}
      <LandingFooter />
    </div>
  );
}
