import Link from 'next/link';
import RoomivoBrand from './RoomivoBrand';

export default function GlobalFooter() {
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
                            Terms of Service
                        </Link>
                        <Link href="/legal/privacy" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                            Privacy & CNIL
                        </Link>
                        <Link href="/legal/cookies" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                            Cookie Policy
                        </Link>
                        <Link href="/legal/gdpr" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                            GDPR Rights
                        </Link>
                        <Link href="/support" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                            Help Center
                        </Link>
                    </div>
                </div>

                <div className="mt-8 border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
                    <p>
                        &copy; {currentYear} Roomivo SAS. All rights reserved.
                    </p>
                    <p className="mt-2 md:mt-0">
                        Made with <span className="text-red-500">♥</span> in France
                    </p>
                </div>
            </div>
        </footer>
    );
}
