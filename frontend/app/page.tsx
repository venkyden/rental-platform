import { Metadata } from 'next';
import { BRAND } from '@/lib/constants';
import Navbar from '@/components/Navbar';
import SearchHero from '@/components/landing/SearchHero';
import ValuePropSection from '@/components/landing/ValuePropSection';
import HowItWorks from '@/components/landing/HowItWorks';
import DualCTA from '@/components/landing/DualCTA';
import LandingFooter from '@/components/landing/LandingFooter';

export const metadata: Metadata = {
  title: `${BRAND.title} - Smart Rental Platform`,
  description: BRAND.description,
  keywords: ['rentals', 'france', 'apartments', 'roomivo', 'landlord', 'tenant', 'verified rentals'],
  openGraph: {
    title: BRAND.title,
    description: BRAND.description,
    type: 'website',
    url: 'https://roomivo.com',
    images: [
      {
        url: 'https://roomivo.com/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Roomivo - Smart Rental Platform'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND.title,
    description: BRAND.description,
    images: ['https://roomivo.com/og-image.png'],
  }
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Roomivo',
  url: 'https://roomivo.com',
  logo: 'https://roomivo.com/logo.png',
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

        {/* ─── Dual CTA ─── */}
        <DualCTA />
      </main>

      {/* ─── Footer ─── */}
      <LandingFooter />
    </div>
  );
}
