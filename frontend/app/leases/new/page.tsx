'use client';

import { useState, useEffect } from 'react';
import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import WizardProgress from '@/components/WizardProgress';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import SignatureCanvas from 'react-signature-canvas';

interface Property {
    id: string;
    title: string;
    address_line1: string;
    city: string;
    monthly_rent: number;
    charges?: number;
    deposit?: number;
}

interface Application {
    id: string;
    property_id: string;
    tenant_id: string;
    status: string;
    tenant?: {
        full_name: string;
        email: string;
    };
}


export default function LeaseWizard() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const toast = useToast();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    // Data Lists
    const [properties, setProperties] = useState<Property[]>([]);
    const [applications, setApplications] = useState<Application[]>([]);

    // Form State
    const [selectedPropertyId, setSelectedPropertyId] = useState('');
    const [selectedApplicationId, setSelectedApplicationId] = useState('');
    const [leaseType, setLeaseType] = useState('meuble');
    const [startDate, setStartDate] = useState('');
    const [durationMonths, setDurationMonths] = useState(12);
    const [rentAmount, setRentAmount] = useState<number>(0);
    const [chargesAmount, setChargesAmount] = useState<number>(0);
    const [depositAmount, setDepositAmount] = useState<number>(0);
    const [guarantorName, setGuarantorName] = useState('');

    const sigCanvas = useRef<any>(null);
    const [landlordSignature, setLandlordSignature] = useState<string | null>(null);

    // Result
    const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
    const [createdLeaseId, setCreatedLeaseId] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && user) {
            if (user.role !== 'landlord') {
                router.push('/dashboard');
                return;
            }
            fetchInitialData();
        }
    }, [user, authLoading]);

    const fetchInitialData = async () => {
        try {
            // Fetch Properties and Applications concurrently
            const [propsRes, appsRes] = await Promise.all([
                apiClient.client.get('/properties', { params: { landlord_only: true } }),
                apiClient.client.get('/applications/received')
            ]);

            setProperties(propsRes.data);
            setApplications(appsRes.data);

            setLoading(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load properties');
            setLoading(false);
        }
    };

    const handlePropertySelect = (propId: string) => {
        setSelectedPropertyId(propId);
        setSelectedApplicationId(''); // Reset application when property changes
        const prop = properties.find(p => p.id === propId);
        if (prop) {
            setRentAmount(prop.monthly_rent);
            setChargesAmount(prop.charges || 0);
            setDepositAmount(prop.deposit || (prop.monthly_rent * 2));
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        let sigData = null;
        if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
            sigData = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
            setLandlordSignature(sigData);
        }

        try {
            const response = await apiClient.client.post(`/leases/generate`, {
                application_id: selectedApplicationId,
                start_date: startDate,
                rent_override: rentAmount,
                charges_override: chargesAmount,
                deposit_override: depositAmount,
                lease_type: leaseType,
                duration_months: durationMonths,
                guarantor_name: guarantorName,
                landlord_signature: sigData
            });

            setGeneratedHtml(response.data);
            setStep(3); // Preview
            toast.success('Bail généré avec succès !');
        } catch (error: any) {
            console.error('Generation error:', error);
            toast.error(error.response?.data?.detail || 'Erreur lors de la génération');
        } finally {
            setGenerating(false);
        }
    };

    const handleCreateLease = async () => {
        setGenerating(true);
        try {
            const response = await apiClient.client.post('/leases/create', {
                application_id: selectedApplicationId,
                start_date: startDate,
                rent_override: rentAmount,
                charges_override: chargesAmount,
                deposit_override: depositAmount,
                lease_type: leaseType,
                duration_months: durationMonths,
                guarantor_name: guarantorName,
                landlord_signature: landlordSignature
            });
            toast.success('Bail enregistré avec succès !');
            router.push('/dashboard/leases'); // Redirect somewhere after creation
        } catch (error: any) {
            console.error('Creation error:', error);
            toast.error(error.response?.data?.detail || 'Erreur lors de l’enregistrement');
        } finally {
            setGenerating(false);
        }
    };

    const printLease = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow && generatedHtml) {
            printWindow.document.write(generatedHtml);
            printWindow.document.close();
            // Wait for resources to load then print
            setTimeout(() => {
                printWindow.print();
            }, 500);
        }
    };

    if (authLoading || loading) {
        return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-gray-900">Nouveau Bail Numérique ✍️</h1>
                    <p className="mt-2 text-gray-600">Générez un contrat de location conforme en quelques clics.</p>
                </div>

                {/* Stepper */}
                <div className="mb-10 bg-white rounded-2xl p-8 pb-10 shadow-sm border border-gray-100">
                    <WizardProgress
                        steps={['Détails', 'Finances', 'Aperçu', 'Signature']}
                        currentStep={step}
                    />
                </div>

                {/* Helper for filtering applications */}
                {(() => {
                    const availableApps = applications.filter(a => a.property_id === selectedPropertyId && a.status === 'approved');

                    return (
                        <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
                            {/* Step 1: Property & Tenant */}
                            {step === 1 && (
                                <div className="p-8">
                                    <h2 className="text-xl font-semibold mb-6">Informations Générales</h2>
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Choisir un bien</label>
                                            <select
                                                value={selectedPropertyId}
                                                onChange={(e) => handlePropertySelect(e.target.value)}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="">-- Sélectionner un bien --</option>
                                                {properties.map(p => (
                                                    <option key={p.id} value={p.id}>{p.title} - {p.city}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Sélectionner un Candidat Approuvé</label>
                                            <select
                                                value={selectedApplicationId}
                                                onChange={(e) => setSelectedApplicationId(e.target.value)}
                                                disabled={!selectedPropertyId || availableApps.length === 0}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                            >
                                                <option value="">
                                                    {!selectedPropertyId
                                                        ? "-- Sélectionnez d'abord un bien --"
                                                        : availableApps.length === 0
                                                            ? "Aucune candidature approuvée pour ce bien"
                                                            : "-- Sélectionner un candidat --"}
                                                </option>
                                                {availableApps.map(app => (
                                                    <option key={app.id} value={app.id}>
                                                        {app.tenant?.full_name || 'Candidat Anonyme'} ({app.tenant?.email || 'Email non disponible'})
                                                    </option>
                                                ))}
                                            </select>
                                            {selectedPropertyId && availableApps.length === 0 && (
                                                <p className="text-xs text-amber-600 mt-2 font-medium">
                                                    ⚠️ Avant de créer un bail, les candidats doivent soumettre une candidature et vous devez l'approuver.
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Type de Contrat</label>
                                            <select
                                                value={leaseType}
                                                onChange={(e) => setLeaseType(e.target.value)}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="meuble">Meublé Standard (Loi 1989)</option>
                                                <option value="colocation">Colocation (Sans solidarité)</option>
                                                <option value="code_civil">Bail Code Civil (Résidence secondaire)</option>
                                                <option value="simple">Contrat Simple</option>
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Date d'effet</label>
                                                <input
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Durée (mois)</label>
                                                <input
                                                    type="number"
                                                    value={durationMonths}
                                                    onChange={(e) => setDurationMonths(parseInt(e.target.value))}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-8 flex justify-end">
                                        <button
                                            onClick={() => setStep(2)}
                                            disabled={!selectedPropertyId || !selectedApplicationId || !startDate}
                                            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            Suivant →
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Financials & Garant */}
                            {step === 2 && (
                                <div className="p-8">
                                    <h2 className="text-xl font-semibold mb-6">Conditions Financières</h2>
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Loyer Hors Charges (€)</label>
                                                <input
                                                    type="number"
                                                    value={rentAmount}
                                                    onChange={(e) => setRentAmount(parseFloat(e.target.value))}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Charges (€)</label>
                                                <input
                                                    type="number"
                                                    value={chargesAmount}
                                                    onChange={(e) => setChargesAmount(parseFloat(e.target.value))}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Dépôt Garantie (€)</label>
                                                <input
                                                    type="number"
                                                    value={depositAmount}
                                                    onChange={(e) => setDepositAmount(parseFloat(e.target.value))}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                                            <h3 className="font-bold text-amber-800 mb-2">Garant / Caution Solidaire</h3>
                                            <input
                                                type="text"
                                                value={guarantorName}
                                                onChange={(e) => setGuarantorName(e.target.value)}
                                                placeholder="Guarantor full name (Optional)"
                                                className="w-full px-4 py-3 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                                            />
                                            <p className="text-xs text-amber-700 mt-1">Laissez vide si pas de garant.</p>
                                        </div>

                                        <div className="bg-white border border-gray-300 p-4 rounded-lg shadow-sm">
                                            <h3 className="font-bold text-gray-800 mb-2">Signature du Bailleur</h3>
                                            <p className="text-xs text-gray-500 mb-3">Veuillez signer dans le cadre ci-dessous pour valider électroniquement votre identité sur le contrat.</p>
                                            <div className="border-2 border-dashed border-gray-300 rounded bg-gray-50 mb-2">
                                                <SignatureCanvas
                                                    ref={sigCanvas}
                                                    penColor="black"
                                                    canvasProps={{ width: 500, height: 150, className: 'sigCanvas max-w-full' }}
                                                />
                                            </div>
                                            <button
                                                onClick={() => sigCanvas.current?.clear()}
                                                className="text-sm text-gray-600 hover:text-red-600 underline"
                                            >
                                                Effacer la signature
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-8 flex justify-between">
                                        <button
                                            onClick={() => setStep(1)}
                                            className="px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                                        >
                                            ← Retour
                                        </button>
                                        <button
                                            onClick={handleGenerate}
                                            disabled={generating}
                                            className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {generating ? 'Génération...' : 'Générer le Bail ✨'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Preview */}
                            {step === 3 && generatedHtml && (
                                <div className="p-0">
                                    <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
                                        <h3 className="font-bold">Aperçu du Bail</h3>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setStep(2)}
                                                className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded"
                                            >
                                                Modifier
                                            </button>
                                            <button
                                                onClick={printLease}
                                                className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-500 rounded font-bold"
                                            >
                                                Imprimer 🖨️
                                            </button>
                                            <button
                                                onClick={handleCreateLease}
                                                disabled={generating}
                                                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded font-bold ml-2"
                                            >
                                                {generating ? 'En cours...' : 'Confirmer & Sauvegarder ✅'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="h-[600px] w-full bg-gray-100 overflow-hidden relative">
                                        <iframe
                                            srcDoc={generatedHtml}
                                            className="w-full h-full border-0"
                                            title="Lease Preview"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
