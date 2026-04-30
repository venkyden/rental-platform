"use client";

import Link from 'next/link';
import RoomivoBrand from './RoomivoBrand';
import { useLanguage } from '@/lib/LanguageContext';

export default function GlobalFooter() {
    const { t } = useLanguage();
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-white border-t border-gray-200 mt-auto">
            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="md:flex md:items-center md:justify-between">
                    <div className="flex justify-center md:justify-start mb-6 md:mb-0">
                        <RoomivoBrand variant="wordmark" size="sm" />
                    </div>

                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-4 md:justify-end">
                        <Link href="/legal/terms" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                            {t('globalFooter.terms', undefined, 'Terms of Service')}
                        </Link>
                        <Link href="/legal/privacy" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                            {t('globalFooter.privacy', undefined, 'Privacy & CNIL')}
                        </Link>
                        <Link href="/legal/cookies" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                            {t('globalFooter.cookies', undefined, 'Cookie Policy')}
                        </Link>
                        <Link href="/legal/gdpr" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                            {t('globalFooter.gdpr', undefined, 'GDPR Rights')}
                        </Link>
                        <Link href="/support" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                            {t('globalFooter.help', undefined, 'Help Center')}
                        </Link>
                    </div>
                </div>

                <div className="mt-8 border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
                    <p>
                        &copy; {currentYear} Roomivo SAS. {t('globalFooter.rights', undefined, 'All rights reserved.')}
                    </p>
                </div>
            </div>
        </footer>
    );
}
