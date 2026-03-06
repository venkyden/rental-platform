'use client';

import { useRouter } from 'next/navigation';
import PremiumLayout from '@/components/PremiumLayout';
import NotificationPreferences from '@/components/NotificationPreferences';
import { ArrowLeft } from 'lucide-react';

export default function NotificationSettingsPage() {
    const router = useRouter();

    return (
        <PremiumLayout>
            <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </button>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                        Notification Settings
                    </h1>
                    <p className="text-gray-500 mt-2">Manage how you receive notifications and updates.</p>
                </div>
                <NotificationPreferences />
            </div>
        </PremiumLayout>
    );
}
