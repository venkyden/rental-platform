"use client";

import Link from 'next/link';
import RoomivoBrand from './RoomivoBrand';
import { useLanguage } from '@/lib/LanguageContext';
import { usePathname } from 'next/navigation';

export default function GlobalFooter() {
    const { t } = useLanguage();
    const pathname = usePathname();
    const currentYear = new Date().getFullYear();

    // Hide on landing as it has its own hero-driven navigation/footer
    if (pathname === '/' || pathname === '/fr' || pathname === '/en') return null;

    return (
        <footer className="relative z-10 bg-white/50 backdrop-blur-md border-t border-zinc-100 mt-32">
            <div className="max-w-7xl mx-auto py-16 px-6 lg:px-12">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-12">
                    <div className="space-y-6">
                        <RoomivoBrand variant="wordmark" size="sm" />
                        <p className="text-sm text-zinc-400 font-medium max-w-xs leading-relaxed uppercase tracking-widest">
                            {t('landing.footer.slogan', undefined, 'Rent securely in France')}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 lg:gap-16">
                        <div className="space-y-6">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-900">{t('landing.footer.legal')}</h4>
                            <ul className="space-y-4">
                                <li>
                                    <Link href="/legal/terms" className="text-xs font-bold text-zinc-400 hover:text-zinc-900 transition-colors uppercase tracking-widest">
                                        {t('legal.terms.title')}
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/legal/privacy" className="text-xs font-bold text-zinc-400 hover:text-zinc-900 transition-colors uppercase tracking-widest">
                                        {t('legal.privacy.title')}
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/legal/mentions-legales" className="text-xs font-bold text-zinc-400 hover:text-zinc-900 transition-colors uppercase tracking-widest">
                                        {t('legal.notice.title')}
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        <div className="space-y-6">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-900">{t('landing.footer.support')}</h4>
                            <ul className="space-y-4">
                                <li>
                                    <Link href="/support" className="text-xs font-bold text-zinc-400 hover:text-zinc-900 transition-colors uppercase tracking-widest">
                                        {t('globalFooter.help')}
                                    </Link>
                                </li>
                                <li>
                                    <button 
                                        onClick={() => window.dispatchEvent(new CustomEvent('open-cookie-settings'))}
                                        className="text-xs font-bold text-zinc-400 hover:text-zinc-900 transition-colors uppercase tracking-widest cursor-pointer text-left"
                                    >
                                        {t('cookies.actions.customize')}
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="mt-16 pt-8 border-t border-zinc-100 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">
                        &copy; {currentYear} Roomivo SAS • {t('globalFooter.rights')}
                    </p>
                    <div className="flex items-center gap-4">
                        <div className="w-2 h-2 rounded-full bg-zinc-900 animate-pulse" />
                        <span className="text-[10px] font-black text-zinc-900 uppercase tracking-[0.3em]">{t('globalFooter.status', undefined, 'System Operational')}</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
