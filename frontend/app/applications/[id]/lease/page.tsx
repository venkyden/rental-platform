'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import { apiClient } from '@/lib/api';

// Compact GLI Widget for Lease Generation
function GLILeaseWidget({ monthlyRent, propertyId }: { monthlyRent: number; propertyId: string }) {
    const [loading, setLoading] = useState(false);
    const [quote, setQuote] = useState<any>(null);
    const [applied, setApplied] = useState(false);

    const getQuote = async () => {
        setLoading(true);
        try {
            const response = await apiClient.client.post('/verification/gli/quote', {
                monthly_rent: monthlyRent,
                tenant_monthly_income: monthlyRent * 3.5, // Assume eligible tenant
                tenant_employment_type: 'cdi',
                tenant_employment_verified: true,
                tenant_identity_verified: true
            });
            setQuote(response.data);
        } catch (error) {
            console.error('GLI quote error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async () => {
        setLoading(true);
        try {
            await apiClient.client.post(`/verification/gli/apply?property_id=${propertyId}`, {
                monthly_rent: monthlyRent,
                tenant_monthly_income: monthlyRent * 3.5,
                tenant_employment_type: 'cdi',
                tenant_employment_verified: true,
                tenant_identity_verified: true
            });
            setApplied(true);
        } catch (error) {
            console.error('GLI apply error:', error);
        } finally {
            setLoading(false);
        }
    };

    if (applied) {
        return (
            <div className="flex items-center gap-2 text-green-700 font-medium">
                <span className="text-xl">✅</span>
                GLI souscrite! Vous serez contacté sous 24h.
            </div>
        );
    }

    if (!quote) {
        return (
            <button
                onClick={getQuote}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
            >
                {loading ? '⏳ Calcul...' : '📊 Obtenir un devis GLI'}
            </button>
        );
    }

    if (!quote.eligible) {
        return (
            <div className="text-yellow-700 text-sm">
                ⚠️ Non éligible: {quote.eligibility_reason}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-4">
            <div className="text-sm">
                <span className="font-bold text-green-700">{quote.monthly_premium}€/mois</span>
                <span className="text-gray-500"> ({quote.premium_rate}% du loyer)</span>
            </div>
            <button
                onClick={handleApply}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
            >
                {loading ? '⏳' : '✅ Souscrire'}
            </button>
        </div>
    );
}


interface Application {
    id: string;
    tenant_id: string;
    property_id: string;
    status: string;
    tenant?: {
        full_name: string;
        email: string;
    };
    property?: {
        title: string;
        address_line1: string;
        city: string;
        monthly_rent: number;
        charges: number;
    };
}

export default function LeaseGeneratorPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [application, setApplication] = useState<Application | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);

    // Form state
    const [leaseType, setLeaseType] = useState('meuble');
    const [startDate, setStartDate] = useState('');
    const [durationMonths, setDurationMonths] = useState(12);
    const [guarantorName, setGuarantorName] = useState('');

    useEffect(() => {
        loadApplication();
    }, [id]);

    const loadApplication = async () => {
        try {
            const response = await apiClient.client.get(`/applications/${id}`);
            setApplication(response.data);

            // Default start date to 1st of next month
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            nextMonth.setDate(1);
            setStartDate(nextMonth.toISOString().split('T')[0]);
        } catch (error) {
            console.error('Error loading application:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePreview = async () => {
        if (!application) return;
        setGenerating(true);

        try {
            const response = await apiClient.client.post('/leases/generate', {
                application_id: application.id,
                lease_type: leaseType,
                start_date: startDate,
                duration_months: durationMonths,
                guarantor_name: guarantorName || undefined
            }, {
                responseType: 'text'
            });
            setPreviewHtml(response.data);
        } catch (error) {
            console.error('Error generating preview:', error);
            alert('Failed to generate lease preview');
        } finally {
            setGenerating(false);
        }
    };

    const handleCreateLease = async () => {
        if (!application) return;
        setGenerating(true);

        try {
            await apiClient.client.post('/leases/create', {
                application_id: application.id,
                lease_type: leaseType,
                start_date: startDate,
                duration_months: durationMonths,
                guarantor_name: guarantorName || undefined
            });

            alert('Bail créé avec succès!');
            router.push('/dashboard');
        } catch (error) {
            console.error('Error creating lease:', error);
            alert('Failed to create lease');
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                    <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
            </ProtectedRoute>
        );
    }

    if (!application || application.status !== 'approved') {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                    <div className="bg-white p-8 rounded-xl shadow-lg text-center">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Application non valide</h2>
                        <p className="text-gray-600 mb-4">Seules les candidatures approuvées peuvent générer un bail.</p>
                        <button
                            onClick={() => router.back()}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            Retour
                        </button>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-100">
                <header className="bg-white shadow">
                    <div className="max-w-7xl mx-auto py-6 px-4 flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">📄 Génération du Bail</h1>
                            <p className="text-gray-600">
                                Pour: {application.tenant?.full_name || 'Locataire'}
                            </p>
                        </div>
                        <button
                            onClick={() => router.back()}
                            className="text-gray-600 hover:text-gray-900"
                        >
                            ← Retour
                        </button>
                    </div>
                </header>

                <main className="max-w-7xl mx-auto py-8 px-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Configuration Form */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-6">⚙️ Configuration du Bail</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Type de Bail
                                    </label>
                                    <select
                                        value={leaseType}
                                        onChange={(e) => setLeaseType(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="meuble">Location Meublée (Loi 89)</option>
                                        <option value="colocation">Colocation Meublée</option>
                                        <option value="code_civil">Bail Code Civil</option>
                                        <option value="simple">Contrat Simple</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Date de Début
                                    </label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Durée (mois)
                                    </label>
                                    <select
                                        value={durationMonths}
                                        onChange={(e) => setDurationMonths(parseInt(e.target.value))}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value={9}>9 mois (Étudiant)</option>
                                        <option value={12}>12 mois (Standard)</option>
                                        <option value={24}>24 mois</option>
                                        <option value={36}>36 mois</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Garant (optionnel)
                                    </label>
                                    <input
                                        type="text"
                                        value={guarantorName}
                                        onChange={(e) => setGuarantorName(e.target.value)}
                                        placeholder="Guarantor name"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Property Summary */}
                            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                                <h3 className="text-sm font-medium text-gray-700 mb-2">Summary</h3>
                                <div className="text-sm text-gray-600 space-y-1">
                                    <p><strong>Property:</strong> {application.property?.title}</p>
                                    <p><strong>Address:</strong> {application.property?.address_line1}, {application.property?.city}</p>
                                    <p><strong>Rent:</strong> {application.property?.monthly_rent}€ + {application.property?.charges || 0}€ charges</p>
                                </div>
                            </div>

                            {/* GLI Insurance Section */}
                            <div className="mt-6">
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center text-white text-xl">
                                            🛡️
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-900">Rent Guarantee Insurance (GLI)</h3>
                                            <p className="text-sm text-gray-600 mt-1 mb-3">
                                                Protégez vos revenus locatifs. En cas d'impayé, vous êtes couvert jusqu'à 24 mois de loyer.
                                            </p>
                                            <GLILeaseWidget
                                                monthlyRent={application.property?.monthly_rent || 0}
                                                propertyId={application.property_id}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="mt-6 flex gap-4">
                                <button
                                    onClick={handlePreview}
                                    disabled={generating}
                                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50"
                                >
                                    {generating ? '⏳ Génération...' : '👁️ Aperçu'}
                                </button>
                                <button
                                    onClick={handleCreateLease}
                                    disabled={generating}
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 font-medium disabled:opacity-50"
                                >
                                    {generating ? '⏳ Création...' : '✅ Créer le Bail'}
                                </button>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">📄 Aperçu du Bail</h2>

                            {previewHtml ? (
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <iframe
                                        srcDoc={previewHtml}
                                        className="w-full h-[600px]"
                                        title="Lease Preview"
                                    />
                                </div>
                            ) : (
                                <div className="h-[600px] bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                                    <div className="text-center">
                                        <div className="text-6xl mb-4">📄</div>
                                        <p>Cliquez sur "Aperçu" pour voir le bail</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </ProtectedRoute>
    );
}
