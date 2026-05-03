import { motion } from 'framer-motion';
import { ChevronRight, Shield, Zap, Globe, Mail, Building, Users, FileText } from 'lucide-react';
import { BRAND } from '@/lib/constants';
import { useLanguage } from '@/lib/LanguageContext';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

export default function HomePage() {
  const { t, language } = useLanguage();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="vibrancy-bg" />

      {/* ─── Navbar ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <Navbar />
      </div>

      {/* ─── Hero ─── */}
      <section className="relative pt-24 pb-32">
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-[1.05] mb-8 bg-clip-text text-transparent bg-gradient-to-b from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-500">
              {t('landing.hero.title', undefined, undefined).split(language === 'fr' ? 'foyer idéal' : 'perfect home').map((part, i) => (
                i === 0 ? (
                  <span key={i}>
                    {part}
                    <span className="text-teal-600 dark:text-teal-400">
                      {language === 'fr' ? 'foyer idéal' : 'perfect home'}
                    </span>
                  </span>
                ) : (
                  <span key={i}>{part}</span>
                )
              ))}
            </h1>

            <p className="text-xl sm:text-2xl text-zinc-500 dark:text-zinc-400 max-w-3xl mx-auto mb-12 leading-relaxed font-medium">
              {t('landing.subtitle', undefined, undefined)}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-20">
              <Link href="/auth/register" className="btn-primary flex items-center gap-2 group">
                {t('landing.getStarted', undefined, undefined)}
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/search" className="btn-secondary">
                {t('dashboard.quickActions.browse.title', undefined, undefined)}
              </Link>
            </div>
          </motion.div>

          {/* Premium Tech Badges */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-10"
          >
            {[
              { icon: <Shield className="w-5 h-5" />, label: t('landing.trustBadges.gdpr', undefined, 'GDPR Compliant') },
              { icon: <Globe className="w-5 h-5" />, label: t('landing.trustBadges.frenchLaw', undefined, 'French Law Compliant') },
              { icon: <Zap className="w-5 h-5" />, label: t('landing.trustBadges.stripe', undefined, 'Secured by Stripe') }
            ].map((badge, i) => (
              <div key={i} className="flex items-center gap-3 text-zinc-400 dark:text-zinc-500 font-bold text-sm tracking-widest uppercase">
                <span className="text-teal-500">{badge.icon}</span>
                {badge.label}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="text-4xl sm:text-5xl font-black mb-6">{t('landing.howItWorks.title', undefined, undefined)}</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-xl max-w-2xl mx-auto font-medium">{t('landing.howItWorks.subtitle', undefined, undefined)}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                step: '01',
                icon: <Users className="w-8 h-8" />,
                title: t('landing.howItWorks.steps.profile.title', undefined, undefined),
                description: t('landing.howItWorks.steps.profile.desc', undefined, undefined)
              },
              {
                step: '02',
                icon: <Zap className="w-8 h-8" />,
                title: t('landing.howItWorks.steps.matching.title', undefined, undefined),
                description: t('landing.howItWorks.steps.matching.desc', undefined, undefined)
              },
              {
                step: '03',
                icon: <FileText className="w-8 h-8" />,
                title: t('landing.howItWorks.steps.lease.title', undefined, undefined),
                description: t('landing.howItWorks.steps.lease.desc', undefined, undefined)
              }
            ].map((item) => (
              <motion.div 
                key={item.step}
                whileHover={{ y: -10 }}
                className="glass-card flex flex-col items-start"
              >
                <div className="text-sm font-black text-teal-600 dark:text-teal-400 mb-6 tracking-[0.2em]">{item.step}</div>
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center mb-8 shadow-2xl">
                  {item.icon}
                </div>
                <h3 className="text-2xl font-black mb-4">{item.title}</h3>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Dual CTA ─── */}
      <section className="py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="glass-card bg-teal-600 dark:bg-teal-700 text-white border-none p-12 overflow-hidden relative group"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-125 transition-transform duration-700" />
              <div className="relative z-10">
                <h3 className="text-4xl font-black mb-4">{t('landing.cta.tenant.title', undefined, undefined)}</h3>
                <p className="text-teal-50 text-xl mb-10 leading-relaxed font-medium">
                  {t('landing.cta.tenant.desc', undefined, undefined)}
                </p>
                <Link href="/auth/register?role=tenant" className="inline-flex items-center gap-3 px-8 py-4 bg-white text-teal-700 font-black rounded-2xl shadow-xl hover:shadow-2xl transition-all active:scale-95">
                  {t('landing.cta.tenant.button', undefined, undefined)} <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="glass-card bg-zinc-900 text-white border-none p-12 overflow-hidden relative group"
            >
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 group-hover:scale-125 transition-transform duration-700" />
              <div className="relative z-10">
                <h3 className="text-4xl font-black mb-4">{t('landing.cta.landlord.title', undefined, undefined)}</h3>
                <p className="text-zinc-400 text-xl mb-10 leading-relaxed font-medium">
                  {t('landing.cta.landlord.desc', undefined, undefined)}
                </p>
                <Link href="/auth/register?role=landlord" className="btn-primary !bg-white !text-zinc-900 inline-flex items-center gap-3 px-8 py-4 font-black rounded-2xl shadow-xl hover:shadow-2xl transition-all active:scale-95">
                  {t('landing.cta.landlord.button', undefined, undefined)} <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-black py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-20">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">R</div>
                <span className="text-2xl font-black tracking-tighter text-zinc-900 dark:text-white">Roomivo</span>
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed max-w-xs">
                {t('landing.footer.slogan', undefined, 'Rent securely in France')}
              </p>
            </div>
            
            {[
              { title: t('landing.footer.platform', undefined, 'Platform'), links: [
                { href: '/search', label: t('dashboard.quickActions.browse.title', undefined, undefined) },
                { href: '/properties', label: t('dashboard.stats.properties', undefined, undefined) },
                { href: '/auth/register', label: t('landing.getStarted', undefined, undefined) }
              ]},
              { title: t('landing.footer.legal', undefined, 'Legal'), links: [
                { href: '/legal/cgv', label: t('landing.footer.terms', undefined, 'Terms of Sale') },
                { href: '/legal/privacy', label: t('landing.footer.privacy', undefined, 'Privacy Policy') },
                { href: '/legal/mentions-legales', label: t('landing.footer.notices', undefined, 'Legal Notices') }
              ]},
              { title: t('landing.footer.support', undefined, 'Support'), links: [
                { href: '/support', label: t('landing.footer.help', undefined, 'Help') },
                { href: 'mailto:contact@roomivo.com', label: 'contact@roomivo.com' }
              ]}
            ].map((section, i) => (
              <div key={i}>
                <h4 className="font-black text-zinc-900 dark:text-white mb-6 uppercase tracking-widest text-xs">{section.title}</h4>
                <ul className="space-y-4">
                  {section.links.map((link, j) => (
                    <li key={j}>
                      <Link href={link.href} className="text-zinc-500 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 font-medium transition-colors">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-10 flex flex-col sm:flex-row items-center justify-between gap-6 text-zinc-400 dark:text-zinc-500 text-sm font-bold tracking-widest uppercase">
            <span>© {new Date().getFullYear()} Roomivo. {t('globalFooter.rights', undefined, 'All rights reserved.')}</span>
            <div className="flex gap-8">
              <Link href="/legal/terms" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Terms</Link>
              <Link href="/legal/privacy" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

