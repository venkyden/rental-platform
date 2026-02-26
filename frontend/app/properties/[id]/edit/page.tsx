'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import { apiClient } from '@/lib/api';
import AddressAutocomplete from '@/components/AddressAutocomplete';

type PropertyFormData = {
    title: string;
    property_type: string;
    description: string;
    address_line1: string;
    address_line2: string;
    city: string;
    postal_code: string;
    country: string;
    latitude?: number;
    longitude?: number;
    bedrooms: number;
    bathrooms: number;
    size_sqm: number;
    floor_number?: number;
    furnished: boolean;
    monthly_rent: number;
    deposit?: number;
    charges?: number;
    charges_included: boolean;
    charges_description?: string;
    available_from?: string;
    guarantor_required: boolean;
    accepted_guarantor_types: string[];
    amenities: string[];
    custom_amenities: string[];
    public_transport: string[];
    nearby_landmarks: string[];
};

const PROPERTY_TYPES = ['apartment', 'house', 'studio', 'room'];
const STANDARD_AMENITIES = [
    'Elevator', 'Balcony', 'Parking', 'Garden', 'Terrace',
    'Cellar', 'Pool', 'Gym', 'Security'
];

export default function EditPropertyPage() {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const propertyId = params?.id as string;

    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [enriching, setEnriching] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    const [formData, setFormData] = useState<PropertyFormData>({
        title: '',
        property_type: 'apartment',
        description: '',
        address_line1: '',
        address_line2: '',
        city: '',
        postal_code: '',
        country: 'France',
        bedrooms: 1,
        bathrooms: 1,
        size_sqm: 30,
        furnished: false,
        monthly_rent: 800,
        charges_included: false,
        guarantor_required: false,
        accepted_guarantor_types: [],
        amenities: [],
        custom_amenities: [],
        public_transport: [],
        nearby_landmarks: [],
    });

    // Fetch existing property data
    useEffect(() => {
        const fetchProperty = async () => {
            try {
                const response = await apiClient.client.get(`/properties/${propertyId}`);
                const property = response.data;

                // Parse amenities from the database format
                const standardAmenities: string[] = [];
                const customAmenities: string[] = [];

                if (property.amenities?.standard) {
                    standardAmenities.push(...property.amenities.standard);
                }
                if (property.custom_amenities?.items) {
                    customAmenities.push(...property.custom_amenities.items);
                }

                // Parse transport and landmarks
                const publicTransport = property.public_transport?.items || [];
                const nearbyLandmarks = property.nearby_landmarks?.items || [];

                setFormData({
                    title: property.title || '',
                    property_type: property.property_type || 'apartment',
                    description: property.description || '',
                    address_line1: property.address_line1 || '',
                    address_line2: property.address_line2 || '',
                    city: property.city || '',
                    postal_code: property.postal_code || '',
                    country: property.country || 'France',
                    latitude: property.latitude ? parseFloat(property.latitude) : undefined,
                    longitude: property.longitude ? parseFloat(property.longitude) : undefined,
                    bedrooms: property.bedrooms || 1,
                    bathrooms: property.bathrooms ? parseFloat(property.bathrooms) : 1,
                    size_sqm: property.size_sqm ? parseFloat(property.size_sqm) : 30,
                    floor_number: property.floor_number,
                    furnished: property.furnished || false,
                    monthly_rent: property.monthly_rent ? parseFloat(property.monthly_rent) : 800,
                    deposit: property.deposit ? parseFloat(property.deposit) : undefined,
                    charges: property.charges ? parseFloat(property.charges) : undefined,
                    charges_included: property.charges_included ?? false,
                    charges_description: property.charges_description || undefined,
                    available_from: property.available_from || undefined,
                    guarantor_required: property.guarantor_required ?? false,
                    accepted_guarantor_types: Array.isArray(property.accepted_guarantor_types) ? property.accepted_guarantor_types : [],
                    amenities: standardAmenities,
                    custom_amenities: customAmenities,
                    public_transport: publicTransport,
                    nearby_landmarks: nearbyLandmarks,
                });
            } catch (error: any) {
                console.error('Failed to fetch property:', error);
                alert('Failed to load property data');
                router.push('/properties');
            } finally {
                setInitialLoading(false);
            }
        };

        if (propertyId) {
            fetchProperty();
        }
    }, [propertyId, router]);

    const updateFormData = (updates: Partial<PropertyFormData>) => {
        setFormData(prev => ({ ...prev, ...updates }));
    };

    const handleEnrichLocation = async () => {
        setEnriching(true);
        try {
            const response = await apiClient.client.post('/location/enrich', {
                address: formData.address_line1,
                city: formData.city,
                postal_code: formData.postal_code,
                country: formData.country
            });

            updateFormData({
                latitude: response.data.latitude,
                longitude: response.data.longitude,
                public_transport: response.data.public_transport || [],
                nearby_landmarks: response.data.nearby_landmarks || []
            });

            alert('Location enriched successfully!');
        } catch (error) {
            console.error('Enrichment error:', error);
            alert('Failed to enrich location. Please try again.');
        } finally {
            setEnriching(false);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            await apiClient.client.put(`/properties/${propertyId}`, formData);
            alert('Property updated successfully!');
            router.push(`/properties/${propertyId}`);
        } catch (error: any) {
            console.error('Update error:', error);
            alert(error.response?.data?.detail || 'Failed to update property');
        } finally {
            setLoading(false);
        }
    };

    const validateStep = (step: number): boolean => {
        switch (step) {
            case 1:
                return !!(formData.title && formData.property_type && formData.description);
            case 2:
                return !!(formData.address_line1 && formData.city && formData.postal_code);
            case 3:
                return formData.bedrooms > 0 && formData.bathrooms > 0 && formData.size_sqm > 0;
            case 4:
                return formData.monthly_rent > 0;
            case 5:
                return true;
            default:
                return true;
        }
    };

    const nextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => prev + 1);
        } else {
            alert('Please fill in all required fields');
        }
    };

    const prevStep = () => setCurrentStep(prev => Math.max(1, prev - 1));

    const progress = (currentStep / 6) * 100;

    if (initialLoading) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4" />
                        <p className="text-gray-600">Loading property data...</p>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
                <div className="max-w-4xl mx-auto px-4">
                    {/* Header */}
                    <div className="mb-8">
                        <button
                            onClick={() => router.push(`/properties/${propertyId}`)}
                            className="text-blue-600 hover:text-blue-800 mb-4"
                        >
                            ← Back to Property
                        </button>
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">Edit Property</h1>
                        <p className="text-gray-600">Update your property details</p>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-8 bg-white rounded-lg p-6 shadow-md">
                        <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Step {currentStep} of 6</span>
                            <span className="text-sm font-medium text-blue-600">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-3 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Form Steps */}
                    <div className="bg-white rounded-lg shadow-xl p-8">
                        {currentStep === 1 && (
                            <div>
                                <h2 className="text-2xl font-bold mb-6 text-gray-900">Basic Information</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700">Property Title *</label>
                                        <input
                                            type="text"
                                            value={formData.title}
                                            onChange={(e) => updateFormData({ title: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                            placeholder="e.g., Bright 2BR Apartment in Central Paris"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700">Property Type *</label>
                                        <select
                                            value={formData.property_type}
                                            onChange={(e) => updateFormData({ property_type: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                        >
                                            {PROPERTY_TYPES.map(type => (
                                                <option key={type} value={type}>
                                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700">Description *</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => updateFormData({ description: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                            rows={4}
                                            placeholder="Describe your property..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div>
                                <h2 className="text-2xl font-bold mb-6 text-gray-900">Location</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700">Address *</label>
                                        <AddressAutocomplete
                                            onSelectAction={(result) => {
                                                updateFormData({
                                                    address_line1: result.address,
                                                    city: result.city,
                                                    postal_code: result.postal_code,
                                                    latitude: result.lat,
                                                    longitude: result.lng,
                                                });
                                            }}
                                            restrictToCities={['nantes', 'paris']}
                                            initialValue={formData.address_line1}
                                            placeholder="Start typing an address in Nantes or Paris…"
                                            variant="form"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700">Address Line 2</label>
                                        <input
                                            type="text"
                                            value={formData.address_line2}
                                            onChange={(e) => updateFormData({ address_line2: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                            placeholder="Apartment, suite, etc. (optional)"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-gray-700">City *</label>
                                            <input
                                                type="text"
                                                value={formData.city}
                                                onChange={(e) => updateFormData({ city: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-gray-700">Postal Code *</label>
                                            <input
                                                type="text"
                                                value={formData.postal_code}
                                                onChange={(e) => updateFormData({ postal_code: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                                        <h3 className="font-semibold mb-2 text-gray-900">🗺️ Update Location Data</h3>
                                        <p className="text-sm text-gray-600 mb-3">
                                            Re-detect nearby transport & landmarks if address changed
                                        </p>
                                        <button
                                            onClick={handleEnrichLocation}
                                            disabled={enriching || !formData.address_line1}
                                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            {enriching ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                                    Detecting...
                                                </>
                                            ) : (
                                                '🔍 Re-Enrich Location Data'
                                            )}
                                        </button>

                                        {formData.public_transport.length > 0 && (
                                            <div className="mt-4 text-sm">
                                                <p className="font-medium text-green-600">✅ {formData.public_transport.length} transport options</p>
                                                <p className="font-medium text-green-600">✅ {formData.nearby_landmarks.length} landmarks</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div>
                                <h2 className="text-2xl font-bold mb-6 text-gray-900">Property Details</h2>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-gray-700">Bedrooms *</label>
                                            <input
                                                type="number"
                                                value={formData.bedrooms}
                                                onChange={(e) => updateFormData({ bedrooms: parseInt(e.target.value) })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-gray-700">Bathrooms *</label>
                                            <input
                                                type="number"
                                                step="0.5"
                                                value={formData.bathrooms}
                                                onChange={(e) => updateFormData({ bathrooms: parseFloat(e.target.value) })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-gray-700">Size (m²) *</label>
                                            <input
                                                type="number"
                                                value={formData.size_sqm}
                                                onChange={(e) => updateFormData({ size_sqm: parseFloat(e.target.value) })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                                min="1"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700">Floor Number (optional)</label>
                                        <input
                                            type="number"
                                            value={formData.floor_number || ''}
                                            onChange={(e) => updateFormData({ floor_number: e.target.value ? parseInt(e.target.value) : undefined })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                        />
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={formData.furnished}
                                            onChange={(e) => updateFormData({ furnished: e.target.checked })}
                                            className="w-5 h-5 text-blue-600"
                                        />
                                        <label className="ml-2 text-sm font-medium text-gray-700">Furnished</label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep === 4 && (
                            <div>
                                <h2 className="text-2xl font-bold mb-6 text-gray-900">Pricing & Availability</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700">Monthly Rent (€) *</label>
                                        <input
                                            type="number"
                                            value={formData.monthly_rent}
                                            onChange={(e) => updateFormData({ monthly_rent: parseFloat(e.target.value) })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700">Deposit (€)</label>
                                        <input
                                            type="number"
                                            value={formData.deposit || ''}
                                            onChange={(e) => updateFormData({ deposit: e.target.value ? parseFloat(e.target.value) : undefined })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700">Charges mensuelles (€)</label>
                                        <input
                                            type="number"
                                            value={formData.charges || ''}
                                            onChange={(e) => updateFormData({ charges: e.target.value ? parseFloat(e.target.value) : undefined })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                            min="0"
                                        />
                                    </div>

                                    {/* CC / HC Toggle */}
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium mb-2 text-gray-700">Type de loyer</label>
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => updateFormData({ charges_included: true })}
                                                className={`flex-1 py-3 rounded-lg border-2 text-center font-medium transition-all ${formData.charges_included
                                                    ? 'border-green-500 bg-green-50 text-green-700'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                <div className="text-lg">CC</div>
                                                <div className="text-xs text-gray-500">Charges Comprises</div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => updateFormData({ charges_included: false })}
                                                className={`flex-1 py-3 rounded-lg border-2 text-center font-medium transition-all ${!formData.charges_included
                                                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                <div className="text-lg">HC</div>
                                                <div className="text-xs text-gray-500">Hors Charges</div>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Charges Description */}
                                    {formData.charges && Number(formData.charges) > 0 && (
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium mb-2 text-gray-700">Détail des charges</label>
                                            <textarea
                                                value={formData.charges_description || ''}
                                                onChange={(e) => updateFormData({ charges_description: e.target.value })}
                                                placeholder="Ex: Eau froide, entretien parties communes, ordures ménagères..."
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder:text-gray-400 bg-white"
                                                rows={2}
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700">Disponible à partir du</label>
                                        <input
                                            type="date"
                                            value={formData.available_from || ''}
                                            onChange={(e) => updateFormData({ available_from: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                        />
                                    </div>
                                </div>

                                {/* Guarantor Preferences */}
                                <div className="mt-6 pt-6 border-t border-gray-200">
                                    <h3 className="text-lg font-bold mb-4 text-gray-900">🛡️ Garantie locative</h3>
                                    <div className="flex items-center gap-3 mb-4">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.guarantor_required}
                                                onChange={(e) => {
                                                    const required = e.target.checked;
                                                    updateFormData({
                                                        guarantor_required: required,
                                                        accepted_guarantor_types: required ? ['visale'] : []
                                                    });
                                                }}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                        <span className="font-medium text-gray-900">Garant requis</span>
                                    </div>

                                    {formData.guarantor_required && (
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <p className="text-sm font-medium text-gray-700 mb-3">Types de garant acceptés:</p>
                                            <div className="space-y-2">
                                                {[
                                                    { value: 'visale', label: '🏛️ Visale (Action Logement)', forced: true },
                                                    { value: 'physical', label: '🧑 Personne physique (parent, proche)' },
                                                    { value: 'garantme', label: '🔐 GarantMe' },
                                                    { value: 'organisation', label: '🏢 Organisme / employeur' },
                                                ].map(opt => (
                                                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.accepted_guarantor_types.includes(opt.value)}
                                                            disabled={opt.forced}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    updateFormData({ accepted_guarantor_types: [...formData.accepted_guarantor_types, opt.value] });
                                                                } else {
                                                                    updateFormData({ accepted_guarantor_types: formData.accepted_guarantor_types.filter(t => t !== opt.value) });
                                                                }
                                                            }}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <span className="text-sm text-gray-700">{opt.label}</span>
                                                        {opt.forced && <span className="text-xs text-green-600 italic">(obligatoire par la loi)</span>}
                                                    </label>
                                                ))}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-3">⚖️ Loi ELAN: Visale ne peut pas être refusé.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {currentStep === 5 && (
                            <div>
                                <h2 className="text-2xl font-bold mb-6 text-gray-900">Amenities & Features</h2>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium mb-3 text-gray-700">Standard Amenities</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {STANDARD_AMENITIES.map(amenity => (
                                                <label key={amenity} className="flex items-center space-x-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.amenities.includes(amenity)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                updateFormData({ amenities: [...formData.amenities, amenity] });
                                                            } else {
                                                                updateFormData({ amenities: formData.amenities.filter(a => a !== amenity) });
                                                            }
                                                        }}
                                                        className="w-4 h-4 text-blue-600"
                                                    />
                                                    <span className="text-sm text-gray-700">{amenity}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700">Custom Amenities</label>
                                        <div className="space-y-2">
                                            {formData.custom_amenities.map((amenity, idx) => (
                                                <div key={idx} className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={amenity}
                                                        onChange={(e) => {
                                                            const newCustom = [...formData.custom_amenities];
                                                            newCustom[idx] = e.target.value;
                                                            updateFormData({ custom_amenities: newCustom });
                                                        }}
                                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            updateFormData({
                                                                custom_amenities: formData.custom_amenities.filter((_, i) => i !== idx)
                                                            });
                                                        }}
                                                        className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                onClick={() => updateFormData({ custom_amenities: [...formData.custom_amenities, ''] })}
                                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                            >
                                                + Add Custom Amenity
                                            </button>
                                        </div>
                                    </div>

                                    {formData.public_transport.length > 0 && (
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                            <h3 className="font-semibold mb-2 text-gray-900">🚇 Public Transport ({formData.public_transport.length})</h3>
                                            <ul className="text-sm space-y-1">
                                                {formData.public_transport.slice(0, 5).map((t, i) => (
                                                    <li key={i} className="text-gray-700">{t}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {formData.nearby_landmarks.length > 0 && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <h3 className="font-semibold mb-2 text-gray-900">📍 Nearby Landmarks ({formData.nearby_landmarks.length})</h3>
                                            <ul className="text-sm space-y-1 grid grid-cols-2 gap-1">
                                                {formData.nearby_landmarks.slice(0, 8).map((l, i) => (
                                                    <li key={i} className="text-gray-700">{l}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {currentStep === 6 && (
                            <div>
                                <h2 className="text-2xl font-bold mb-6 text-gray-900">Review Changes</h2>
                                <div className="space-y-4 text-sm">
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <h3 className="font-bold mb-2 text-gray-900">{formData.title}</h3>
                                        <p className="text-gray-600">{formData.description}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <p className="font-medium text-gray-900">Type: {formData.property_type}</p>
                                            <p>Address: {formData.address_line1}, {formData.city}</p>
                                            <p>{formData.bedrooms} bed • {formData.bathrooms} bath • {formData.size_sqm}m²</p>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <p className="font-bold text-xl text-blue-600">€{formData.monthly_rent}/mo <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${formData.charges_included ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{formData.charges_included ? 'CC' : 'HC'}</span></p>
                                            {formData.deposit && <p>Dépôt: €{formData.deposit}</p>}
                                            {formData.charges && <p>Charges: €{formData.charges}/mo {formData.charges_included ? '(incluses)' : '(en sus)'}</p>}
                                            {formData.guarantor_required && <p>🛡️ Garant requis ({formData.accepted_guarantor_types.join(', ')})</p>}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <p className="font-medium mb-2 text-gray-900">Amenities:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {[...formData.amenities, ...formData.custom_amenities].map((a, i) => (
                                                <span key={i} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                                                    {a}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                            {currentStep > 1 ? (
                                <button
                                    onClick={prevStep}
                                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                    ← Back
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (confirm('Discard changes?')) {
                                            router.push(`/properties/${propertyId}`);
                                        }
                                    }}
                                    className="px-6 py-2 text-red-600 hover:text-red-800"
                                >
                                    Cancel
                                </button>
                            )}

                            {currentStep < 6 ? (
                                <button
                                    onClick={nextStep}
                                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg"
                                >
                                    Next →
                                </button>
                            ) : (
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg hover:shadow-lg disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : '💾 Save Changes'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
