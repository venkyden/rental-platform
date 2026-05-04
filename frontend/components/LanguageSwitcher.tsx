'use client';

import { useLanguage } from '@/lib/LanguageContext';

export default function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();

    const toggleLanguage = () => {
        setLanguage(language === 'en' ? 'fr' : 'en');
    };

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-900/5 dark:border-white/5 bg-zinc-900/5 dark:bg-white/5 text-[10px] font-black tracking-widest text-zinc-900 dark:text-white hover:bg-zinc-900/10 dark:hover:bg-white/10 transition-all shadow-sm"
            title="Toggle Language"
        >
            <svg className="w-3.5 h-3.5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            <span>{language === 'fr' ? 'FR' : 'EN'}</span>
        </button>
    );
}
