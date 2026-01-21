'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import { apiClient } from '@/lib/api';
import QRCodeDisplay from '@/components/QRCodeDisplay';

type PropertyFormData = {
    // Basic Info
    title: string;
    property_type: string;
    description: string;

    // Location
    address_line1: string;
    address_line2: string;
    city: string;
    postal_code: string;
    country: string;
    latitude?: number;
    longitude?: number;

    // Details
    bedrooms: number;
    bathrooms: number;
    size_sqm: number;
    floor_number?: number;
    furnished: boolean;

    // French Compliance (Loi ALUR)
    dpe_rating: string;        // A-G energy rating (required)
    ges_rating: string;        // A-G greenhouse gas rating
    dpe_value?: number;        // kWh/m²/year
    ges_value?: number;        // kg CO2/m²/year
    surface_type: string;      // 'loi_carrez' or 'standard'
    construction_year?: number;

    // Pricing
    monthly_rent: number;
    deposit?: number;
    charges?: number;
    available_from?: string;

    // Features
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

export default function NewPropertyPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [enriching, setEnriching] = useState(false);
    const [propertyId, setPropertyId] = useState<string | null>(null);
    const [mediaSession, setMediaSession] = useState<any>(null);

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
        // French Compliance
        dpe_rating: '',
        ges_rating: '',
        surface_type: 'standard',
        // Pricing
        monthly_rent: 800,
        amenities: [],
        custom_amenities: [],
        public_transport: [],
        nearby_landmarks: [],
    });

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

            alert('Location enriched successfully! Public transport and landmarks detected.');
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
            // Create property
            const response = await apiClient.client.post('/properties', formData);
            const newPropertyId = response.data.id;
            setPropertyId(newPropertyId);

            // Generate media session
            const sessionResponse = await apiClient.client.post(
                `/properties/${newPropertyId}/media-session`
            );
            setMediaSession(sessionResponse.data);

            // Move to success step
            setCurrentStep(7);
        } catch (error: any) {
            console.error('Submit error:', error);
            alert(error.response?.data?.detail || 'Failed to create property');
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
                return true; // Amenities are optional
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

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
                <div className="max-w-4xl mx-auto px-4">
                    {/* Header */}
                    <div className="mb-8">
                        <button
                            onClick={() => router.push('/properties')}
                            className="text-blue-600 hover:text-blue-800 mb-4"
                        >
                            ← Back to Properties
                        </button>
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">Create New Property</h1>
                        <p className="text-gray-600">Fill in the details to list your property</p>
                    </div>

                    {/* Progress Bar */}
                    {currentStep < 7 && (
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
                    )}

                    {/* Form Steps */}
                    <div className="bg-white rounded-lg shadow-xl p-8">
                        {currentStep === 1 && (
                            <div>
                                <h2 className="text-2xl font-bold mb-6">Basic Information</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Property Title *</label>
                                        <input
                                            type="text"
                                            value={formData.title}
                                            onChange={(e) => updateFormData({ title: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g., Bright 2BR Apartment in Central Paris"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Property Type *</label>
                                        <select
                                            value={formData.property_type}
                                            onChange={(e) => updateFormData({ property_type: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        >
                                            {PROPERTY_TYPES.map(type => (
                                                <option key={type} value={type}>
                                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Description *</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => updateFormData({ description: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                            rows={4}
                                            placeholder="Describe your property..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div>
                                <h2 className="text-2xl font-bold mb-6">Location</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Address Line 1 *</label>
                                        <input
                                            type="text"
                                            value={formData.address_line1}
                                            onChange={(e) => updateFormData({ address_line1: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                            placeholder="Street address"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Address Line 2</label>
                                        <input
                                            type="text"
                                            value={formData.address_line2}
                                            onChange={(e) => updateFormData({ address_line2: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                            placeholder="Apartment, suite, etc. (optional)"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">City *</label>
                                            <input
                                                type="text"
                                                value={formData.city}
                                                onChange={(e) => updateFormData({ city: e.target.value })}
                                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Postal Code *</label>
                                            <input
                                                type="text"
                                                value={formData.postal_code}
                                                onChange={(e) => updateFormData({ postal_code: e.target.value })}
                                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Location Enrichment */}
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                                        <h3 className="font-semibold mb-2">🗺️ Auto-Detect Nearby Transport & Landmarks</h3>
                                        <p className="text-sm text-gray-600 mb-3">
                                            Automatically find nearby metro stations, bus stops, schools, supermarkets, and more!
                                        </p>
                                        <button
                                            onClick={handleEnrichLocation}
                                            disabled={enriching || !formData.address_line1 || !formData.city || !formData.postal_code}
                                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            {enriching ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                                    Detecting... (~3s)
                                                </>
                                            ) : (
                                                '🔍 Auto-Detect Location Data'
                                            )}
                                        </button>

                                        {formData.public_transport.length > 0 && (
                                            <div className="mt-4 text-sm">
                                                <p className="font-medium text-green-600">✅ {formData.public_transport.length} transport options found!</p>
                                                <p className="font-medium text-green-600">✅ {formData.nearby_landmarks.length} landmarks found!</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div>
                                <h2 className="text-2xl font-bold mb-6">Property Details</h2>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Bedrooms *</label>
                                            <input
                                                type="number"
                                                value={formData.bedrooms}
                                                onChange={(e) => updateFormData({ bedrooms: parseInt(e.target.value) })}
                                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Bathrooms *</label>
                                            <input
                                                type="number"
                                                step="0.5"
                                                value={formData.bathrooms}
                                                onChange={(e) => updateFormData({ bathrooms: parseFloat(e.target.value) })}
                                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Size (m²) *</label>
                                            <input
                                                type="number"
                                                value={formData.size_sqm}
                                                onChange={(e) => updateFormData({ size_sqm: parseFloat(e.target.value) })}
                                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                                min="1"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Floor Number (optional)</label>
                                        <input
                                            type="number"
                                            value={formData.floor_number || ''}
                                            onChange={(e) => updateFormData({ floor_number: e.target.value ? parseInt(e.target.value) : undefined })}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={formData.furnished}
                                            onChange={(e) => updateFormData({ furnished: e.target.checked })}
                                            className="w-5 h-5 text-blue-600"
                                        />
                                        <label className="ml-2 text-sm font-medium">Furnished</label>
                                    </div>

                                    {/* French Compliance - DPE/GES (Loi ALUR) */}
                                    <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                        <h3 className="font-semibold text-amber-800 mb-3">
                                            🇫🇷 French Energy Rating (Required by Law)
                                        </h3>
                                        <p className="text-sm text-amber-700 mb-4">
                                            DPE (Diagnostic de Performance Énergétique) is mandatory for all rental listings in France.
                                        </p>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-2">DPE Rating (A-G) *</label>
                                                <select
                                                    value={formData.dpe_rating}
                                                    onChange={(e) => updateFormData({ dpe_rating: e.target.value })}
                                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                                    required
                                                >
                                                    <option value="">Select rating</option>
                                                    <option value="A">A - Excellent (&lt;50 kWh/m²)</option>
                                                    <option value="B">B - Very Good (51-90)</option>
                                                    <option value="C">C - Good (91-150)</option>
                                                    <option value="D">D - Average (151-230)</option>
                                                    <option value="E">E - Below Average (231-330)</option>
                                                    <option value="F">F - Poor (331-450)</option>
                                                    <option value="G">G - Very Poor (&gt;450)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-2">GES Rating (A-G)</label>
                                                <select
                                                    value={formData.ges_rating}
                                                    onChange={(e) => updateFormData({ ges_rating: e.target.value })}
                                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="">Select rating</option>
                                                    <option value="A">A - Excellent (&lt;5 kg CO2)</option>
                                                    <option value="B">B - Very Good (6-10)</option>
                                                    <option value="C">C - Good (11-20)</option>
                                                    <option value="D">D - Average (21-35)</option>
                                                    <option value="E">E - Below Average (36-55)</option>
                                                    <option value="F">F - Poor (56-80)</option>
                                                    <option value="G">G - Very Poor (&gt;80)</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-2">Surface Type</label>
                                                <select
                                                    value={formData.surface_type}
                                                    onChange={(e) => updateFormData({ surface_type: e.target.value })}
                                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="standard">Standard</option>
                                                    <option value="loi_carrez">Loi Carrez (Copropriété)</option>
                                                </select>
                                                <p className="text-xs text-gray-500 mt-1">Loi Carrez is required for apartments in condos</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-2">Construction Year</label>
                                                <input
                                                    type="number"
                                                    value={formData.construction_year || ''}
                                                    onChange={(e) => updateFormData({ construction_year: e.target.value ? parseInt(e.target.value) : undefined })}
                                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                                    placeholder="e.g., 1985"
                                                    min="1800"
                                                    max="2026"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep === 4 && (
                            <div>
                                <h2 className="text-2xl font-bold mb-6">Pricing & Availability</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Monthly Rent (€) *</label>
                                        <input
                                            type="number"
                                            value={formData.monthly_rent}
                                            onChange={(e) => updateFormData({ monthly_rent: parseFloat(e.target.value) })}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                            min="0"
                                        />
                                        {/* Rent control warning for zones tendues */}
                                        {['75', '92', '93', '94', '69', '13', '59', '31', '33', '34', '06'].some(code => formData.postal_code.startsWith(code)) && (
                                            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                                                <span className="font-semibold text-blue-800">ℹ️ Zone Tendue:</span>
                                                <span className="text-blue-700 ml-1">
                                                    This area may have rent control (encadrement des loyers).
                                                    <a href="https://www.service-public.fr/particuliers/vosdroits/F1314" target="_blank" rel="noopener noreferrer" className="underline ml-1">
                                                        Check limits →
                                                    </a>
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">
                                            Deposit (€)
                                            <span className="text-gray-500 text-xs ml-2">
                                                Max: {formData.furnished ? '2 months' : '1 month'} rent by law
                                            </span>
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.deposit || ''}
                                            onChange={(e) => updateFormData({ deposit: e.target.value ? parseFloat(e.target.value) : undefined })}
                                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${formData.deposit && (
                                                    formData.furnished
                                                        ? formData.deposit > formData.monthly_rent * 2
                                                        : formData.deposit > formData.monthly_rent
                                                ) ? 'border-red-500 bg-red-50' : ''
                                                }`}
                                            min="0"
                                        />
                                        {/* Deposit validation warning */}
                                        {formData.deposit && (
                                            formData.furnished
                                                ? formData.deposit > formData.monthly_rent * 2
                                                : formData.deposit > formData.monthly_rent
                                        ) && (
                                                <p className="text-red-600 text-sm mt-1">
                                                    ⚠️ French law limits deposit to {formData.furnished ? '2 months' : '1 month'} rent
                                                    (max €{formData.furnished ? formData.monthly_rent * 2 : formData.monthly_rent})
                                                </p>
                                            )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Monthly Charges (€)</label>
                                        <input
                                            type="number"
                                            value={formData.charges || ''}
                                            onChange={(e) => updateFormData({ charges: e.target.value ? parseFloat(e.target.value) : undefined })}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Available From</label>
                                        <input
                                            type="date"
                                            value={formData.available_from || ''}
                                            onChange={(e) => updateFormData({ available_from: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep === 5 && (
                            <div>
                                <h2 className="text-2xl font-bold mb-6">Amenities & Features</h2>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium mb-3">Standard Amenities</label>
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
                                                    <span className="text-sm">{amenity}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2">Custom Amenities</label>
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
                                                        className="flex-1 px-4 py-2 border rounded-lg"
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

                                    {/* Display enriched data */}
                                    {formData.public_transport.length > 0 && (
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                            <h3 className="font-semibold mb-2">🚇 Public Transport ({formData.public_transport.length})</h3>
                                            <ul className="text-sm space-y-1">
                                                {formData.public_transport.slice(0, 5).map((t, i) => (
                                                    <li key={i} className="text-gray-700">{t}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {formData.nearby_landmarks.length > 0 && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <h3 className="font-semibold mb-2">📍 Nearby Landmarks ({formData.nearby_landmarks.length})</h3>
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
                                <h2 className="text-2xl font-bold mb-6">Review & Submit</h2>
                                <div className="space-y-4 text-sm">
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <h3 className="font-bold mb-2">{formData.title}</h3>
                                        <p className="text-gray-600">{formData.description}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <p className="font-medium">Type: {formData.property_type}</p>
                                            <p>Address: {formData.address_line1}, {formData.city}</p>
                                            <p>{formData.bedrooms} bed • {formData.bathrooms} bath • {formData.size_sqm}m²</p>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <p className="font-bold text-xl text-blue-600">€{formData.monthly_rent}/mo</p>
                                            {formData.deposit && <p>Deposit: €{formData.deposit}</p>}
                                            {formData.charges && <p>Charges: €{formData.charges}/mo</p>}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <p className="font-medium mb-2">Amenities:</p>
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

                        {currentStep === 7 && mediaSession && (
                            <div className="text-center">
                                <div className="text-6xl mb-4">🎉</div>
                                <h2 className="text-3xl font-bold text-green-600 mb-4">Property Created Successfully!</h2>
                                <QRCodeDisplay
                                    verificationCode={mediaSession.verification_code}
                                    captureUrl={mediaSession.capture_url}
                                    expiresAt={mediaSession.expires_at}
                                />
                                <div className="mt-8 flex gap-4 justify-center">
                                    <button
                                        onClick={() => router.push(`/properties/${propertyId}`)}
                                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        View Property
                                    </button>
                                    <button
                                        onClick={() => router.push('/properties')}
                                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                    >
                                        Back to Properties
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        {currentStep > 0 && currentStep < 7 && (
                            <div className="flex justify-between mt-8 pt-6 border-t">
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
                                            if (confirm('Are you sure you want to cancel?')) {
                                                router.push('/properties');
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
                                        {loading ? 'Creating...' : '✨ Create Property'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
