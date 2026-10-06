import { Metadata } from 'next';
import { BRAND } from '@/lib/constants';
import Navbar from '@/components/Navbar';
import CredentialLayerSection from '@/components/landing/CredentialLayerSection';

export const metadata: Metadata = {
  title: `How we check | ${BRAND.name}`,
  alternates: { canonical: '/trust' },
};

/** How Roomivo checks, what it keeps, and the verify-by-code box (moved off the home page). */
export default function TrustPage() {
  return (
    <div className="min-h-screen bg-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <Navbar />
      </div>
      <main className="pt-16">
        <CredentialLayerSection />
      </main>
    </div>
  );
}
