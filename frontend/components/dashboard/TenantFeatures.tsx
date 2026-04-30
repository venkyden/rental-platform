'use client';

import { useRouter } from 'next/navigation';
import { FeatureGate } from '@/lib/SegmentContext';

export default function TenantFeatures() {
    const router = useRouter();

    return (
        <div className="space-y-8 mt-8">
            {/* Stats for experienced tenants */}
            <FeatureGate feature="history">
                <section>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 pl-2 tracking-tight">My Activity</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center group hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                            <div className="text-4xl font-extrabold text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">0</div>
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">Applications</div>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center group hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                            <div className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">0</div>
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">Scheduled Visits</div>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center group hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                            <div className="text-4xl font-extrabold text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">0</div>
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">Favorites</div>
                        </div>
                        <div 
                            onClick={() => router.push('/disputes')}
                            className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center group hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                            <div className="text-4xl font-extrabold text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">0</div>
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">Active Disputes</div>
                        </div>
                    </div>
                </section>
            </FeatureGate>

            {/* Premium badge for D3 */}
            <FeatureGate feature="relocation">
                <section>
                    <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 rounded-3xl p-8 sm:p-10 text-white shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
                        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
                            <div>
                                <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                                    <span className="text-3xl filter drop-shadow-md">🚀</span>
                                    <h2 className="text-2xl font-extrabold tracking-tight">Premium Services</h2>
                                </div>
                                <p className="text-purple-100 font-medium">
                                    Take advantage of our relocation services for your professional mobility
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/relocation')}
                                className="w-full sm:w-auto px-8 py-3.5 bg-white text-purple-700 hover:bg-purple-50 font-bold rounded-xl transition-all shadow-md hover:shadow-sm focus:ring-4 focus:ring-white/30 active:scale-95 whitespace-nowrap"
                            >
                                Discover
                            </button>
                        </div>
                    </div>
                </section>
            </FeatureGate>

            {/* Recent searches */}
            <section>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 pl-2 tracking-tight">Recent Searches</h2>
                <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8 text-center py-12 flex flex-col items-center justify-center">
                    <div className="text-4xl mb-3 opacity-50">🔍</div>
                    <p className="text-base font-medium text-zinc-500 dark:text-zinc-400 mb-4">You haven't made any searches yet.</p>
                    <button
                        onClick={() => router.push('/search')}
                        className="px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-colors shadow-sm focus:ring-4 focus:ring-teal-500/20 active:scale-95"
                    >
                        Search for a property
                    </button>
                </div>
            </section>
        </div>
    );
}
