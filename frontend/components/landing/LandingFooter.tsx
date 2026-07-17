'use client';

import { useLanguage } from '@/lib/LanguageContext';
import Link from 'next/link';
import Image from 'next/image';
import RoomivoBrand from '../RoomivoBrand';
import { ShieldCheck, Globe, Lock } from 'lucide-react';

export default function LandingFooter() {
  const { t } = useLanguage();

  const sections = [
    { 
      title: t('landing.footer.platform', undefined, 'Platform'), 
      links: [
        { href: '/search', label: t('dashboard.quickActions.browse.title', undefined, 'Browse') },
        { href: '/properties', label: t('dashboard.stats.properties', undefined, 'Properties') },
        { href: '/auth/register', label: t('landing.getStarted', undefined, 'Get Started') }
      ]
    },
    { 
      title: t('landing.footer.legal', undefined, 'Legal'), 
      links: [
        { href: '/legal/terms', label: t('landing.footer.terms', undefined, 'Terms of Sale') },
        { href: '/legal/privacy', label: t('landing.footer.privacy', undefined, 'Privacy Policy') },
        { href: '/legal/gdpr', label: t('globalFooter.gdpr', undefined, 'GDPR Rights') },
        { href: '/legal/mentions-legales', label: t('landing.footer.notices', undefined, 'Legal Notices') }
      ]
    },
    { 
      title: t('landing.footer.support', undefined, 'Support'), 
      links: [
        { href: '/support', label: t('landing.footer.help', undefined, 'Help Center') },
        { href: '/guide', label: t('dashboard.quickActions.help', undefined, 'Guides') },
        { href: 'mailto:contact@roomivo.eu', label: 'contact@roomivo.eu' }
      ]
    }
  ];

  return (
    <footer className="bg-white pt-20 sm:pt-32 pb-12 sm:pb-16 relative z-10 border-t border-zinc-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-12 mb-24">
          <div className="col-span-2 lg:col-span-3">
            <div className="mb-10">
              <RoomivoBrand variant="wordmark" size="md" animate={false} />
            </div>
            <p className="text-zinc-500 font-medium leading-relaxed max-w-sm mb-12 text-lg">
              {t('landing.footer.slogan', undefined, 'The next generation of rental transparency in France.')}
            </p>
            
            {/* ─── Trust Markers ─── */}
            <div className="flex flex-wrap gap-8">
              <div className="flex items-center gap-3 text-zinc-400">
                <ShieldCheck className="w-5 h-5 text-zinc-900" />
                <span className="text-[10px] font-black uppercase tracking-widest">{t('landing.footer.secureConnection', undefined, 'Secure Connection')}</span>
              </div>
              <div className="flex items-center gap-3 text-zinc-400">
                <Lock className="w-5 h-5 text-zinc-900" />
                <span className="text-[10px] font-black uppercase tracking-widest">{t('landing.footer.aesEncrypted', undefined, 'AES-256 Encrypted')}</span>
              </div>
              <div className="flex items-center gap-3 text-zinc-400">
                <Globe className="w-5 h-5 text-zinc-900" />
                <span className="text-[10px] font-black uppercase tracking-widest">{t('landing.footer.gdprCompliant', undefined, 'GDPR Compliant')}</span>
              </div>
            </div>

            {/* ─── Institutional endorsement (PÉPITE / SNEE / Ministère ESR) ─── */}
            <div className="mt-12">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4">
                {t('landing.footer.backedBy', undefined, 'Soutenu par')}
              </p>
              <div className="flex flex-wrap items-center gap-8">
                <Image
                  src="/images/ministere-esr.png"
                  alt="Ministère de l'Enseignement supérieur et de la Recherche"
                  width={220}
                  height={154}
                  className="h-20 sm:h-24 w-auto object-contain"
                />
                <Image
                  src="/images/pepite-snee.jpg"
                  alt="PÉPITE France — Statut National Étudiant-Entrepreneur (SNEE)"
                  width={280}
                  height={158}
                  className="h-20 sm:h-24 w-auto object-contain"
                />
              </div>
            </div>
          </div>
          
          {sections.map((section, i) => (
            <div key={i} className="col-span-1 lg:col-span-1">
              <h4 className="font-black text-zinc-900 mb-8 uppercase tracking-[0.2em] text-[10px]">{section.title}</h4>
              <ul className="space-y-5">
                {section.links.map((link, j) => (
                  <li key={j}>
                    {link.href.startsWith('mailto:') ? (
                      <a
                        href={link.href}
                        className="text-zinc-500 hover:text-zinc-900 font-medium transition-all duration-300 flex items-center group"
                      >
                        <span className="w-0 group-hover:w-2 h-px bg-zinc-900 mr-0 group-hover:mr-2 transition-all duration-300"></span>
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="text-zinc-500 hover:text-zinc-900 font-medium transition-all duration-300 flex items-center group">
                        <span className="w-0 group-hover:w-2 h-px bg-zinc-900 mr-0 group-hover:mr-2 transition-all duration-300"></span>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        <div className="border-t border-zinc-100 pt-12 flex flex-col md:flex-row items-center justify-between gap-8 text-zinc-400 text-[10px] font-black tracking-[0.2em] uppercase">
          <span>© {new Date().getFullYear()} Roomivo Platform. {t('globalFooter.rights', undefined, 'All rights reserved.')}</span>
          <div className="flex gap-8">
            <Link href="/legal/terms" className="hover:text-zinc-900 transition-colors">{t('landing.footer.termsLink', undefined, 'Terms')}</Link>
            <Link href="/legal/privacy" className="hover:text-zinc-900 transition-colors">{t('landing.footer.privacyLink', undefined, 'Privacy')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
