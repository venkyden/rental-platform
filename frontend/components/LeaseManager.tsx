'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';

interface LeaseManagerProps {
    propertyId: string;
    monthlyRent: number;
    deposit?: number;
    charges?: number;
}

interface LeaseTypeInfo {
    name: string;
    description: string;
    duration: string;
    tenantNotice: string;
    landlordNotice: string;
    depositInfo: string;
}

const LEASE_TYPES: Record<string, LeaseTypeInfo> = {
    meuble: {
        name: 'Location Meublée',
        description: 'Bail standard pour logement meublé',
        duration: '1 an (reconductible)',
        tenantNotice: '1 mois',
        landlordNotice: '3 mois',
        depositInfo: '2 mois max'
    },
    vide: {
        name: 'Location Vide',
        description: 'Bail pour logement non meublé',
        duration: '3 ans (reconductible)',
        tenantNotice: '3 mois',
        landlordNotice: '6 mois',
        depositInfo: '1 mois max'
    },
    mobilite: {
        name: 'Bail Mobilité',
        description: 'Court terme (étudiants, stagiaires, mutation)',
        duration: '1-10 mois (non reconductible)',
        tenantNotice: '1 mois',
        landlordNotice: 'Non applicable',
        depositInfo: 'Interdit'
    },
    etudiant: {
        name: 'Bail Étudiant',
        description: 'Spécifique aux étudiants',
        duration: '9 mois (non reconductible)',
        tenantNotice: '1 mois',
        landlordNotice: 'Non applicable',
        depositInfo: '2 mois max'
    }
};

export default function LeaseManager({ propertyId, monthlyRent, deposit, charges }: LeaseManagerProps) {
    const [tenantEmail, setTenantEmail] = useState('');
    const [startDate, setStartDate] = useState('');
    const [leaseType, setLeaseType] = useState('meuble');
    const [durationMonths, setDurationMonths] = useState<number>(10);
    const [customDeposit, setCustomDeposit] = useState<number | undefined>(deposit);
    const [customCharges, setCustomCharges] = useState<number | undefined>(charges);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ downloadUrl?: string; leaseType?: string } | null>(null);
    const [error, setError] = useState('');

    const selectedType = LEASE_TYPES[leaseType];

    const handleGenerate = async () => {
        if (!tenantEmail || !startDate) {
            setError('Veuillez remplir tous les champs obligatoires');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await apiClient.client.post(`/visits/leases/generate?property_id=${propertyId}`, {
                tenant_email: tenantEmail,
                rent_amount: monthlyRent,
                start_date: startDate,
                lease_type: leaseType,
                deposit_amount: leaseType === 'mobilite' ? 0 : customDeposit,
                charges_amount: customCharges,
                duration_months: leaseType === 'mobilite' ? durationMonths : undefined
            });

            setResult({
                downloadUrl: response.data.download_url,
                leaseType: response.data.lease_type
            });
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erreur lors de la génération du contrat');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-6 border-t pt-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                📄 Générer un Bail
            </h3>

            {/* Lease Type Selection */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type de bail *
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {Object.entries(LEASE_TYPES).map(([key, info]) => (
                        <button
                            key={key}
                            onClick={() => setLeaseType(key)}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${leaseType === key
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <div className="font-semibold text-sm">{info.name}</div>
                            <div className="text-xs text-gray-500">{info.duration}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Selected Lease Info */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
                <div className="font-semibold text-gray-900 mb-2">{selectedType.name}</div>
                <div className="grid grid-cols-2 gap-2 text-gray-600">
                    <div>
                        <span className="font-medium">Durée:</span> {selectedType.duration}
                    </div>
                    <div>
                        <span className="font-medium">Dépôt:</span> {selectedType.depositInfo}
                    </div>
                    <div>
                        <span className="font-medium">Préavis locataire:</span> {selectedType.tenantNotice}
                    </div>
                    <div>
                        <span className="font-medium">Préavis bailleur:</span> {selectedType.landlordNotice}
                    </div>
                </div>
            </div>

            {/* Duration for Bail Mobilité */}
            {leaseType === 'mobilite' && (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Durée (1-10 mois) *
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="10"
                        value={durationMonths}
                        onChange={(e) => setDurationMonths(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            )}

            {/* Tenant Email */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email du locataire *
                </label>
                <input
                    type="email"
                    value={tenantEmail}
                    onChange={(e) => setTenantEmail(e.target.value)}
                    placeholder="locataire@email.com"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Start Date */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de début du bail *
                </label>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Financial Details */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm font-medium text-blue-900 mb-2">Conditions financières</div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-blue-700 mb-1">Loyer mensuel</label>
                        <div className="font-bold text-blue-900">{monthlyRent} €</div>
                    </div>
                    <div>
                        <label className="block text-xs text-blue-700 mb-1">Charges</label>
                        <input
                            type="number"
                            value={customCharges || ''}
                            onChange={(e) => setCustomCharges(parseFloat(e.target.value) || undefined)}
                            placeholder="0"
                            className="w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    {leaseType !== 'mobilite' && (
                        <div className="col-span-2">
                            <label className="block text-xs text-blue-700 mb-1">
                                Dépôt de garantie ({selectedType.depositInfo})
                            </label>
                            <input
                                type="number"
                                value={customDeposit || ''}
                                onChange={(e) => setCustomDeposit(parseFloat(e.target.value) || undefined)}
                                placeholder={`${monthlyRent * 2}`}
                                className="w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                </div>
            )}

            <button
                onClick={handleGenerate}
                disabled={loading || !tenantEmail || !startDate}
                className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Génération en cours...
                    </span>
                ) : (
                    '📝 Générer le Contrat de Bail'
                )}
            </button>

            {result?.downloadUrl && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
                        ✅ Bail {LEASE_TYPES[result.leaseType || 'meuble'].name} généré!
                    </div>
                    <p className="text-sm text-green-700 mb-3">
                        Le contrat inclut tous les clauses légales françaises: préavis, fin de bail,
                        dépôt de garantie, obligations des parties, état des lieux, et clause résolutoire.
                    </p>
                    <a
                        href={result.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        📥 Télécharger le PDF
                    </a>
                </div>
            )}
        </div>
    );
}
