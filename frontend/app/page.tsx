'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/LanguageContext';

export default function HomePage() {
  const { t, language } = useLanguage();

  return (
    <div className="min-h-screen bg-[#fafbfc] text-gray-900" style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>

      {/* ─── Navbar ─── */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 flex items-center justify-center shadow-sm"
              style={{ borderRadius: 8, background: 'linear-gradient(135deg, #3DD6D0, #22B8B8)' }}
            >
              <svg width={22} height={22} viewBox="0 0 64 64" fill="none" aria-label="Roomivo logo">
                <path d="M32 10L8 30H14V52H50V30H56L32 10Z" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <circle cx="25" cy="32" r="4.5" fill="white" />
                <path d="M18 28L25 25L32 28L25 31Z" fill="white" />
                <path d="M20 52C20 45 21 40 25 40C29 40 30 45 30 52" fill="white" fillOpacity="0.9" />
                <circle cx="39" cy="34" r="4" fill="white" fillOpacity="0.85" />
                <path d="M34 52C34 46 35 42 39 42C43 42 44 46 44 52" fill="white" fillOpacity="0.75" />
              </svg>
            </div>
            <span className="text-xl font-bold" style={{ color: '#22B8B8' }}>Roomivo</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              {t('landing.signIn')}
            </Link>
            <Link
              href="/auth/register"
              className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md hover:shadow-sm transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #3DD6D0, #22B8B8)' }}
            >
              {t('landing.getStarted')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #3DD6D0, transparent 70%)' }} />
        <div className="absolute top-60 -left-32 w-72 h-72 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #22B8B8, transparent 70%)' }} />

        <div className="max-w-7xl mx-auto px-6 pt-24 pb-20 text-center relative">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6">
            {t('landing.hero.title').split(language === 'fr' ? 'foyer idéal' : 'perfect home').map((part, i) => (
              i === 0 ? (
                <span key={i}>
                  {part}
                  <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #3DD6D0, #22B8B8)' }}>
                    {language === 'fr' ? 'foyer idéal' : 'perfect home'}
                  </span>
                </span>
              ) : (
                <span key={i}>{part}</span>
              )
            ))}
          </h1>

          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('landing.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/auth/register"
              className="group px-8 py-4 text-base font-semibold text-white rounded-2xl shadow-sm hover:shadow-sm transition-all hover:-translate-y-0.5 flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #3DD6D0, #1CA8A8)' }}
            >
              {t('landing.getStarted')}
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link
              href="/search"
              className="px-8 py-4 text-base font-semibold text-gray-700 bg-white border-2 border-gray-200 rounded-2xl hover:border-gray-300 hover:shadow-md transition-all"
            >
              {t('dashboard.quickActions.browse.title')}
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-gray-400 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              GDPR Compliant
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              French Law Compliant
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              Secured by Stripe
            </div>
          </div>
        </div>
      </section>



      {/* ─── How It Works ─── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">{t('landing.howItWorks.title')}</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">{t('landing.howItWorks.subtitle')}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                ),
                title: t('landing.howItWorks.steps.profile.title'),
                description: t('landing.howItWorks.steps.profile.desc')
              },
              {
                step: '02',
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                ),
                title: t('landing.howItWorks.steps.matching.title'),
                description: t('landing.howItWorks.steps.matching.desc')
              },
              {
                step: '03',
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                ),
                title: t('landing.howItWorks.steps.lease.title'),
                description: t('landing.howItWorks.steps.lease.desc')
              }
            ].map((item) => (
              <div key={item.step} className="relative group">
                <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-sm hover:-translate-y-1 transition-all duration-300">
                  <div className="text-xs font-bold tracking-widest text-gray-300 mb-4">{item.step}</div>
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 text-white" style={{ background: 'linear-gradient(135deg, #3DD6D0, #22B8B8)' }}>
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-gray-500 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Dual CTA ─── */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Tenant CTA */}
            <div className="relative rounded-3xl p-10 text-white overflow-hidden" style={{ background: 'linear-gradient(135deg, #3DD6D0, #1CA8A8)' }}>
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <div className="text-4xl mb-4"></div>
                <h3 className="text-2xl font-bold mb-3">{t('landing.cta.tenant.title')}</h3>
                <p className="text-white/80 mb-6 leading-relaxed">
                  {t('landing.cta.tenant.desc')}
                </p>
                <Link
                  href="/auth/register?role=tenant"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 font-semibold rounded-xl hover:shadow-sm transition-all"
                >
                  {t('landing.cta.tenant.button')} →
                </Link>
              </div>
            </div>

            {/* Landlord CTA */}
            <div className="relative rounded-3xl p-10 bg-gray-900 text-white overflow-hidden">
              <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />
              <div className="relative">
                <div className="text-4xl mb-4"></div>
                <h3 className="text-2xl font-bold mb-3">{t('landing.cta.landlord.title')}</h3>
                <p className="text-gray-400 mb-6 leading-relaxed">
                  {t('landing.cta.landlord.desc')}
                </p>
                <Link
                  href="/auth/register?role=landlord"
                  className="inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-xl hover:shadow-sm transition-all"
                  style={{ background: 'linear-gradient(135deg, #3DD6D0, #22B8B8)', color: 'white' }}
                >
                  {t('landing.cta.landlord.button')} →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-gray-100 bg-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-8 h-8 flex items-center justify-center shadow-sm"
                  style={{ borderRadius: 7, background: 'linear-gradient(135deg, #3DD6D0, #22B8B8)' }}
                >
                  <svg width={18} height={18} viewBox="0 0 64 64" fill="none">
                    <path d="M32 10L8 30H14V52H50V30H56L32 10Z" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <circle cx="25" cy="32" r="4.5" fill="white" />
                    <path d="M18 28L25 25L32 28L25 31Z" fill="white" />
                    <path d="M20 52C20 45 21 40 25 40C29 40 30 45 30 52" fill="white" fillOpacity="0.9" />
                    <circle cx="39" cy="34" r="4" fill="white" fillOpacity="0.85" />
                    <path d="M34 52C34 46 35 42 39 42C43 42 44 46 44 52" fill="white" fillOpacity="0.75" />
                  </svg>
                </div>
                <span className="font-bold" style={{ color: '#22B8B8' }}>Roomivo</span>
              </div>
              <p className="text-sm text-gray-400">Rent securely in France</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Platform</h4>
              <div className="space-y-2 text-sm text-gray-500">
                <Link href="/search" className="block hover:text-gray-900 transition-colors">{t('dashboard.quickActions.browse.title')}</Link>
                <Link href="/properties" className="block hover:text-gray-900 transition-colors">{t('dashboard.stats.properties')}</Link>
                <Link href="/auth/register" className="block hover:text-gray-900 transition-colors">{t('landing.getStarted')}</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Legal</h4>
              <div className="space-y-2 text-sm text-gray-500">
                <Link href="/legal/cgv" className="block hover:text-gray-900 transition-colors">Terms of Sale</Link>
                <Link href="/legal/privacy" className="block hover:text-gray-900 transition-colors">Privacy Policy</Link>
                <Link href="/legal/mentions-legales" className="block hover:text-gray-900 transition-colors">Legal Notices</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Support</h4>
              <div className="space-y-2 text-sm text-gray-500">
                <Link href="/support" className="block hover:text-gray-900 transition-colors">Help</Link>
                <a href="mailto:contact@roomivo.com" className="block hover:text-gray-900 transition-colors">contact@roomivo.com</a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
            <span>© {new Date().getFullYear()} Roomivo. All rights reserved.</span>
            <span>Made with ️ in France</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

