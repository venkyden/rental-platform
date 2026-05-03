'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PremiumLayout from '@/components/PremiumLayout';
import { apiClient } from '@/lib/api';
import GLIQuoteWidget from '@/components/GLIQuoteWidget';
import { Building, ShieldCheck, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function GLIPage() {
    const [properties, setProperties] = useState<any[]>([]);
    const [selectedProperty, setSelectedProperty] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { t } = useLanguage();

    useEffect(() => {
        const fetchProperties = async () => {
            try {
                const response = await apiClient.client.get('/properties');
                setProperties(response.data.filter((p: any) => p.status === 'active'));
            } catch (err) {
                console.error('Failed to fetch properties:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchProperties();
    }, []);

    return (
        <PremiumLayout>
            <div className="max-w-4xl mx-auto py-12 px-4">
                <div className="flex items-center gap-4 mb-12">
                    <div className="w-16 h-16 rounded-2xl bg-teal-500/10 flex items-center justify-center">
                        <ShieldCheck className="w-8 h-8 text-teal-600" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
                            {t('dashboard.sections.gli', undefined, 'Rent Guarantee Insurance')}
                        </h1>
                        <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                            {t('gli.subtitle', undefined, 'Protect your rental income against unpaid rent and property damage.')}
                        </p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Property Selection */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4">
                            {t('gli.selectProperty', undefined, 'Select a Property')}
                        </h3>
                        {loading ? (
                            <div className="animate-pulse space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-20 bg-zinc-100 dark:bg-zinc-800 rounded-2xl" />
                                ))}
                            </div>
                        ) : properties.length === 0 ? (
                            <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                                <Building className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                                <p className="text-zinc-500 font-medium">No active properties found.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {properties.map(property => (
                                    <button
                                        key={property.id}
                                        onClick={() => setSelectedProperty(property)}
                                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between group ${
                                            selectedProperty?.id === property.id
                                                ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-900/10'
                                                : 'border-zinc-100 dark:border-zinc-800 hover:border-teal-200 dark:hover:border-teal-800 bg-white dark:bg-zinc-900'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                                                {property.media?.[0] ? (
                                                    <img src={property.media[0]} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <Building className="w-6 h-6 text-zinc-400" />
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-zinc-900 dark:text-white truncate max-w-[150px]">
                                                    {property.title}
                                                </h4>
                                                <p className="text-xs text-zinc-500 font-medium">
                                                    {property.monthly_rent}€ / month
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight className={`w-5 h-5 transition-transform ${
                                            selectedProperty?.id === property.id ? 'translate-x-1 text-teal-600' : 'text-zinc-300'
                                        }`} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quote Widget */}
                    <div>
                        {selectedProperty ? (
                            <GLIQuoteWidget 
                                propertyId={selectedProperty.id} 
                                monthlyRent={selectedProperty.monthly_rent} 
                            />
                        ) : (
                            <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                                <ShieldCheck className="w-16 h-16 text-zinc-200 dark:text-zinc-800 mb-6" />
                                <h3 className="text-xl font-bold text-zinc-400 dark:text-zinc-600 mb-2">
                                    Instant GLI Quote
                                </h3>
                                <p className="text-zinc-400 dark:text-zinc-500 max-w-xs mx-auto">
                                    Select a property on the left to calculate your personalized rent guarantee quote.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Partners Section */}
                <div className="mt-16 pt-8 border-t border-zinc-100 dark:border-zinc-800">
                    <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-8">
                        Our Insurance Partners
                    </p>
                    <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                        <div className="text-2xl font-black italic text-zinc-900 dark:text-white">AXA</div>
                        <div className="text-2xl font-black italic text-zinc-900 dark:text-white">Allianz</div>
                        <div className="text-2xl font-black italic text-zinc-900 dark:text-white">Générali</div>
                        <div className="text-2xl font-black italic text-zinc-900 dark:text-white">Euler Hermes</div>
                    </div>
                </div>
            </div>
        </PremiumLayout>
    );
}
