'use client';

import { useLanguage } from '@/lib/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();

    return (
        <div className="flex items-center gap-1 p-1 bg-zinc-900/5 rounded-full border border-zinc-900/5 shadow-inner">
            {['en', 'fr'].map((lang) => (
                <button
                    key={lang}
                    onClick={() => setLanguage(lang as 'en' | 'fr')}
                    className={`relative px-6 py-2.5 rounded-full text-[10px] font-black tracking-[0.2em] uppercase transition-all duration-500 active:scale-95
                        ${language === lang ? 'text-zinc-900' : 'text-zinc-400 active:text-zinc-600'}`}
                >
                    {language === lang && (
                        <motion.div
                            layoutId="activeLang"
                            className="absolute inset-0 bg-white rounded-full shadow-sm z-0 border border-zinc-200/50"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                    )}
                    <span className="relative z-10">{lang}</span>
                </button>
            ))}
        </div>
    );
}
