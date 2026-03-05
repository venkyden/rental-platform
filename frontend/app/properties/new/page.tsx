'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import WizardProgress from '@/components/WizardProgress';
import { apiClient } from '@/lib/api';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { motion, Variants } from 'framer-motion';

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08
        }
    }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

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

    // Detailed Layout
    accommodation_capacity: number;
    rooms_count: number;
    living_room_type: 'Private' | 'Common' | 'None';
    kitchen_type: 'Private' | 'Municipality' | 'None';
    room_details: Array<{
        surface: number;
        capacity: number;
        description: string;
        bedding: string;
        custom_amenities: string[];
    }>;

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
    charges_included: boolean;
    charges_description?: string;
    available_from?: string;

    // Guarantor Preferences
    guarantor_required: boolean;
    accepted_guarantor_types: string[];

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

const ROOM_AMENITY_SUGGESTIONS = [
    'Cupboard', 'Chair', 'Desk', 'Private Bathroom', 'Balcony',
    'Air Conditioning', 'Wardrobe', 'Bookshelf', 'TV', 'Mini Fridge',
    'Mirror', 'Curtains', 'Blinds', 'Lamp', 'Nightstand',
    'Socket near bed', 'Ethernet port', 'Window', 'Skylight'
];

export default function NewPropertyPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [enriching, setEnriching] = useState(false);
    const [propertyId, setPropertyId] = useState<string | null>(null);
    const [mediaSession, setMediaSession] = useState<any>(null);
    const [mediaVerified, setMediaVerified] = useState(false);
    const [mediaCount, setMediaCount] = useState(0);
    const [publishing, setPublishing] = useState(false);
    const [published, setPublished] = useState(false);
    const [roomAmenityInputs, setRoomAmenityInputs] = useState<Record<number, string>>({});
    const [selectedMediaRoom, setSelectedMediaRoom] = useState<number>(0);
    const [roomMediaSessions, setRoomMediaSessions] = useState<Record<number, any>>({});
    const [roomMediaCounts, setRoomMediaCounts] = useState<Record<number, number>>({});

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
        // Detailed Layout
        accommodation_capacity: 1,
        rooms_count: 1,
        living_room_type: 'None',
        kitchen_type: 'None',
        room_details: [],

        // French Compliance
        dpe_rating: '',
        ges_rating: '',
        surface_type: 'standard',
        // Pricing
        monthly_rent: 800,
        charges_included: false,
        // Guarantor
        guarantor_required: false,
        accepted_guarantor_types: [],
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
            // Create property as draft
            const response = await apiClient.client.post('/properties', formData);
            const newPropertyId = response.data.id;
            setPropertyId(newPropertyId);

            // Create ONE media session for the entire property
            // Room selection happens on the capture page
            const sessionRes = await apiClient.client.post(
                `/properties/${newPropertyId}/media-session`
            );
            setMediaSession(sessionRes.data);

            // Move to media capture step (step 8)
            setCurrentStep(8);
        } catch (error: any) {
            console.error('Submit error:', error);
            alert(error.response?.data?.detail || 'Failed to create property');
        } finally {
            setLoading(false);
        }
    };

    // Check if media has been uploaded for this property
    const checkMediaStatus = async () => {
        if (!propertyId) return;
        try {
            const response = await apiClient.client.get(`/properties/${propertyId}`);
            const property = response.data;
            const photos = property.photos || [];
            setMediaCount(photos.length);

            // Track per-room media counts
            const roomCounts: Record<number, number> = {};
            photos.forEach((p: any) => {
                if (p.room_index !== null && p.room_index !== undefined) {
                    roomCounts[p.room_index] = (roomCounts[p.room_index] || 0) + 1;
                }
            });
            setRoomMediaCounts(roomCounts);

            // Check if ALL rooms have media
            const rooms = formData.room_details;
            if (rooms.length > 0) {
                const allRoomsHaveMedia = rooms.every((_, i) => (roomCounts[i] || 0) > 0);
                setMediaVerified(allRoomsHaveMedia);
            } else {
                setMediaVerified(photos.length > 0);
            }
        } catch (error) {
            console.error('Media check error:', error);
        }
    };

    // Publish the property (only possible after media upload)
    const handlePublish = async () => {
        if (!propertyId) return;
        setPublishing(true);
        try {
            await apiClient.client.post(`/properties/${propertyId}/publish`);
            setPublished(true);
        } catch (error: any) {
            console.error('Publish error:', error);
            alert(error.response?.data?.detail || 'Failed to publish. Make sure all rooms have at least 1 photo or video.');
        } finally {
            setPublishing(false);
        }
    };

    const validateStep = (step: number): boolean => {
        switch (step) {
            case 1:
                return !!(formData.title && formData.property_type && formData.description);
            case 2:
                return !!(formData.address_line1 && formData.city && formData.postal_code);
            case 3:
                return formData.bedrooms >= 0 && formData.bathrooms > 0 && formData.size_sqm > 0;
            case 4:
                return formData.accommodation_capacity > 0 && formData.rooms_count > 0 && formData.room_details.length === formData.bedrooms;
            case 5:
                return formData.monthly_rent > 0;
            case 6:
                return true; // Amenities are optional
            default:
                return true;
        }
    };

    const nextStep = () => {
        if (currentStep === 3) {
            // Auto-sync room_details length with number of bedrooms
            if (formData.room_details.length !== formData.bedrooms) {
                const newRoomDetails = Array(formData.bedrooms).fill({}).map((_, i) => formData.room_details[i] || {
                    surface: 10,
                    capacity: 1,
                    description: '',
                    bedding: 'Double',
                    custom_amenities: [],
                });
                updateFormData({ room_details: newRoomDetails });
            }
        }

        if (validateStep(currentStep)) {
            setCurrentStep(prev => prev + 1);
        } else {
            alert('Please fill in all required fields');
        }
    };

    const prevStep = () => setCurrentStep(prev => Math.max(1, prev - 1));

    const progress = (currentStep / 7) * 100;

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar>
                <div className="max-w-4xl mx-auto py-8">
                    {/* Header */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="mb-8"
                    >
                        <button
                            onClick={() => router.push('/properties')}
                            className="text-teal-600 hover:text-teal-500 mb-4 font-medium transition-colors"
                        >
                            ← Back to Properties
                        </button>
                        <h1 className="text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight mb-2">Create New Property</h1>
                        <p className="text-zinc-500 dark:text-zinc-400">Fill in the details to list your property</p>
                    </motion.div>

                    {/* Progress Bar */}
                    {currentStep < 8 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="mb-10 mt-6 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl p-8 pb-10 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-white/10"
                        >
                            <WizardProgress
                                steps={[
                                    'Basic Info',
                                    'Location',
                                    'Details',
                                    'Rooms & Layout',
                                    'Pricing',
                                    'Features',
                                    'Review'
                                ]}
                                currentStep={currentStep}
                            />
                        </motion.div>
                    )}

                    {/* Form Steps */}
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-white/10 p-8 sm:p-10"
                    >
                        {currentStep === 1 && (
                            <motion.div variants={itemVariants}>
                                <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-white">Basic Information</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5 text-zinc-800 dark:text-zinc-300">Property Title *</label>
                                        <input
                                            type="text"
                                            value={formData.title}
                                            onChange={(e) => updateFormData({ title: e.target.value })}
                                            className="block w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white placeholder-zinc-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                                            placeholder="e.g., Bright 2BR Apartment in Central Paris"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5 text-zinc-800 dark:text-zinc-300">Property Type *</label>
                                        <select
                                            value={formData.property_type}
                                            onChange={(e) => updateFormData({ property_type: e.target.value })}
                                            className="block w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                                        >
                                            {PROPERTY_TYPES.map(type => (
                                                <option key={type} value={type}>
                                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5 text-zinc-800 dark:text-zinc-300">Description *</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => updateFormData({ description: e.target.value })}
                                            className="block w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white placeholder-zinc-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                                            rows={4}
                                            placeholder="Describe your property..."
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 2 && (
                            <div>
                                <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-white">Location</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Address *</label>
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
                                            countryCode="fr"
                                            initialValue={formData.address_line1}
                                            placeholder="Start typing an address in France…"
                                            variant="form"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Address Line 2</label>
                                        <input
                                            type="text"
                                            value={formData.address_line2}
                                            onChange={(e) => updateFormData({ address_line2: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white placeholder:text-zinc-400 bg-white"
                                            placeholder="Apartment, suite, etc. (optional)"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">City *</label>
                                            <input
                                                type="text"
                                                value={formData.city}
                                                onChange={(e) => updateFormData({ city: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Postal Code *</label>
                                            <input
                                                type="text"
                                                value={formData.postal_code}
                                                onChange={(e) => updateFormData({ postal_code: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white bg-white"
                                            />
                                        </div>
                                    </div>

                                    {/* Location Enrichment */}
                                    <div className="bg-teal-50/50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800 rounded-xl p-4 mt-6">
                                        <h3 className="font-semibold mb-2 text-zinc-900 dark:text-white">🗺️ Auto-Detect Nearby Transport & Landmarks</h3>
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                                            Automatically find nearby metro stations, bus stops, schools, supermarkets, and more!
                                        </p>
                                        <button
                                            onClick={handleEnrichLocation}
                                            disabled={enriching || !formData.address_line1 || !formData.city || !formData.postal_code}
                                            className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
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
                                                <p className="font-medium text-emerald-600 dark:text-emerald-400">✅ {formData.public_transport.length} transport options found!</p>
                                                <p className="font-medium text-emerald-600 dark:text-emerald-400">✅ {formData.nearby_landmarks.length} landmarks found!</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div>
                                <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-white">Property Details</h2>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Bedrooms *</label>
                                            <input
                                                type="number"
                                                value={formData.bedrooms}
                                                onChange={(e) => updateFormData({ bedrooms: parseInt(e.target.value) })}
                                                className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white bg-white"
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Bathrooms *</label>
                                            <input
                                                type="number"
                                                step="0.5"
                                                value={formData.bathrooms}
                                                onChange={(e) => updateFormData({ bathrooms: parseFloat(e.target.value) })}
                                                className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white bg-white"
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Size (m²) *</label>
                                            <input
                                                type="number"
                                                value={formData.size_sqm}
                                                onChange={(e) => updateFormData({ size_sqm: parseFloat(e.target.value) })}
                                                className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white bg-white"
                                                min="1"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Floor Number (optional)</label>
                                        <input
                                            type="number"
                                            value={formData.floor_number || ''}
                                            onChange={(e) => updateFormData({ floor_number: e.target.value ? parseInt(e.target.value) : undefined })}
                                            className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white bg-white"
                                        />
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={formData.furnished}
                                            onChange={(e) => updateFormData({ furnished: e.target.checked })}
                                            className="w-5 h-5 text-teal-600 dark:text-teal-400"
                                        />
                                        <label className="ml-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Furnished</label>
                                    </div>

                                    {/* French Compliance - DPE/GES (Loi ALUR) */}
                                    <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                        <h3 className="font-semibold text-amber-800 mb-3">
                                            🇫🇷 French Energy Rating (Required by Law)
                                        </h3>
                                        <p className="text-sm text-amber-700 mb-4">
                                            DPE (Diagnostic de Performance Énergétique) is mandatory for all rental listings in France.
                                        </p>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">DPE Rating (A-G) *</label>
                                                <select
                                                    value={formData.dpe_rating}
                                                    onChange={(e) => updateFormData({ dpe_rating: e.target.value })}
                                                    className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white bg-white"
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
                                                <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">GES Rating (A-G)</label>
                                                <select
                                                    value={formData.ges_rating}
                                                    onChange={(e) => updateFormData({ ges_rating: e.target.value })}
                                                    className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white bg-white"
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
                                                <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Surface Type</label>
                                                <select
                                                    value={formData.surface_type}
                                                    onChange={(e) => updateFormData({ surface_type: e.target.value })}
                                                    className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white bg-white"
                                                >
                                                    <option value="standard">Standard</option>
                                                    <option value="loi_carrez">Loi Carrez (Copropriété)</option>
                                                </select>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Loi Carrez is required for apartments in condos</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Construction Year</label>
                                                <input
                                                    type="number"
                                                    value={formData.construction_year || ''}
                                                    onChange={(e) => updateFormData({ construction_year: e.target.value ? parseInt(e.target.value) : undefined })}
                                                    className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white placeholder:text-zinc-400 bg-white"
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
                                <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-white">Rooms & Layout</h2>

                                <div className="space-y-8">
                                    {/* Global Accommodation Details */}
                                    <div className="bg-white/60 dark:bg-zinc-800/60 backdrop-blur-md p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                        <h3 className="text-lg font-semibold mb-4 text-zinc-800 dark:text-zinc-200">Global Details</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Accommodation capacity *</label>
                                                <input
                                                    type="number"
                                                    value={formData.accommodation_capacity}
                                                    onChange={(e) => updateFormData({ accommodation_capacity: parseInt(e.target.value) })}
                                                    className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white bg-white"
                                                    min="1"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Number of pieces *</label>
                                                <input
                                                    type="number"
                                                    value={formData.rooms_count}
                                                    onChange={(e) => updateFormData({ rooms_count: parseInt(e.target.value) })}
                                                    className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white bg-white"
                                                    min="1"
                                                />
                                            </div>
                                        </div>

                                        {formData.property_type === 'studio' && (
                                            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                                                <strong>ℹ️ Decency Standards:</strong> According to the decree of January 30, 2002 on decency standards, a decent dwelling must have a minimum living area of at least 9m².
                                            </div>
                                        )}
                                    </div>

                                    {/* Shared / Private configuration */}
                                    <div className="bg-white/60 dark:bg-zinc-800/60 backdrop-blur-md p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                        <h3 className="text-lg font-semibold mb-4 text-zinc-800 dark:text-zinc-200">Common Areas</h3>
                                        <div className="grid grid-cols-2 gap-8">
                                            {/* Living Room */}
                                            <div>
                                                <label className="block text-sm font-bold mb-3 text-zinc-700 dark:text-zinc-300">Living room</label>
                                                <div className="space-y-2">
                                                    {['Private', 'Common', 'None'].map(type => (
                                                        <label key={`lr-${type}`} className="flex items-center space-x-2">
                                                            <input
                                                                type="radio"
                                                                name="living_room_type"
                                                                value={type}
                                                                checked={formData.living_room_type === type}
                                                                onChange={() => updateFormData({ living_room_type: type as any })}
                                                                className="w-4 h-4 text-teal-600 dark:text-teal-400 focus:ring-teal-500/10 focus:border-teal-500"
                                                            />
                                                            <span className="text-sm text-zinc-700 dark:text-zinc-300">{type}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Kitchen */}
                                            <div>
                                                <label className="block text-sm font-bold mb-3 text-zinc-700 dark:text-zinc-300">Kitchen</label>
                                                <div className="space-y-2">
                                                    {['Private', 'Municipality', 'None'].map(type => (
                                                        <label key={`k-${type}`} className="flex items-center space-x-2">
                                                            <input
                                                                type="radio"
                                                                name="kitchen_type"
                                                                value={type}
                                                                checked={formData.kitchen_type === type}
                                                                onChange={() => updateFormData({ kitchen_type: type as any })}
                                                                className="w-4 h-4 text-teal-600 dark:text-teal-400 focus:ring-teal-500/10 focus:border-teal-500"
                                                            />
                                                            <span className="text-sm text-zinc-700 dark:text-zinc-300">{type}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bedroom Deep Dive */}
                                    <div className="space-y-4">
                                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white border-b pb-2">Bedrooms Details</h3>
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Please detail the features for the {formData.bedrooms} bedrooms you indicated.</p>

                                        {formData.room_details.map((room, index) => (
                                            <div key={`room-${index}`} className="bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                                                <h4 className="font-semibold text-lg text-teal-700 dark:text-teal-300 mb-4">Bedroom {index + 1}</h4>

                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Surface (m²) *</label>
                                                        <input
                                                            type="number"
                                                            value={room.surface}
                                                            onChange={(e) => {
                                                                const newDetails = [...formData.room_details];
                                                                newDetails[index].surface = parseFloat(e.target.value);
                                                                updateFormData({ room_details: newDetails });
                                                            }}
                                                            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white"
                                                            min="1"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Accommodation capacity *</label>
                                                        <input
                                                            type="number"
                                                            value={room.capacity}
                                                            onChange={(e) => {
                                                                const newDetails = [...formData.room_details];
                                                                newDetails[index].capacity = parseInt(e.target.value);
                                                                updateFormData({ room_details: newDetails });
                                                            }}
                                                            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white"
                                                            min="1"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="mb-4">
                                                    <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Describe this room</label>
                                                    <input
                                                        type="text"
                                                        value={room.description}
                                                        onChange={(e) => {
                                                            const newDetails = [...formData.room_details];
                                                            newDetails[index].description = e.target.value;
                                                            updateFormData({ room_details: newDetails });
                                                        }}
                                                        placeholder="e.g. Master suite with large window"
                                                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white"
                                                    />
                                                </div>

                                                <h5 className="font-medium text-sm text-zinc-800 dark:text-zinc-200 mb-3 border-b pb-1">Room amenities</h5>

                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-xs font-semibold mb-1 text-zinc-500 dark:text-zinc-400 uppercase">Bedding</label>
                                                        <select
                                                            value={room.bedding}
                                                            onChange={(e) => {
                                                                const newDetails = [...formData.room_details];
                                                                newDetails[index].bedding = e.target.value;
                                                                updateFormData({ room_details: newDetails });
                                                            }}
                                                            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-1 focus:ring-teal-500/10 focus:border-teal-500 text-sm text-zinc-900 dark:text-white"
                                                        >
                                                            <option value="Single">Single</option>
                                                            <option value="Double">Double</option>
                                                            <option value="Queen">Queen</option>
                                                            <option value="King">King</option>
                                                            <option value="Bunk Bed">Bunk Bed</option>
                                                            <option value="Sofa Bed">Sofa Bed</option>
                                                            <option value="None">None</option>
                                                        </select>
                                                    </div>

                                                    {/* Custom Amenities Tags */}
                                                    <div>
                                                        <label className="block text-xs font-semibold mb-2 text-zinc-500 dark:text-zinc-400 uppercase">Amenities</label>

                                                        {/* Current amenity tags */}
                                                        <div className="flex flex-wrap gap-2 mb-3">
                                                            {(room.custom_amenities || []).map((amenity: string, ai: number) => (
                                                                <span
                                                                    key={`${index}-amenity-${ai}`}
                                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-full text-xs font-medium"
                                                                >
                                                                    {amenity}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newDetails = [...formData.room_details];
                                                                            newDetails[index].custom_amenities = newDetails[index].custom_amenities.filter((_: string, j: number) => j !== ai);
                                                                            updateFormData({ room_details: newDetails });
                                                                        }}
                                                                        className="ml-0.5 text-teal-500 hover:text-red-500 transition-colors"
                                                                    >
                                                                        ×
                                                                    </button>
                                                                </span>
                                                            ))}
                                                        </div>

                                                        {/* Suggestion chips */}
                                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                                            {ROOM_AMENITY_SUGGESTIONS
                                                                .filter(s => !(room.custom_amenities || []).includes(s))
                                                                .map(suggestion => (
                                                                    <button
                                                                        key={`suggest-${index}-${suggestion}`}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newDetails = [...formData.room_details];
                                                                            newDetails[index].custom_amenities = [...(newDetails[index].custom_amenities || []), suggestion];
                                                                            updateFormData({ room_details: newDetails });
                                                                        }}
                                                                        className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-full text-xs hover:bg-teal-100 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-300 transition-colors border border-transparent hover:border-teal-200 dark:hover:border-teal-800"
                                                                    >
                                                                        + {suggestion}
                                                                    </button>
                                                                ))}
                                                        </div>

                                                        {/* Custom amenity input */}
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={roomAmenityInputs[index] || ''}
                                                                onChange={(e) => setRoomAmenityInputs(prev => ({ ...prev, [index]: e.target.value }))}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' && roomAmenityInputs[index]?.trim()) {
                                                                        e.preventDefault();
                                                                        const val = roomAmenityInputs[index].trim();
                                                                        if (!(room.custom_amenities || []).includes(val)) {
                                                                            const newDetails = [...formData.room_details];
                                                                            newDetails[index].custom_amenities = [...(newDetails[index].custom_amenities || []), val];
                                                                            updateFormData({ room_details: newDetails });
                                                                        }
                                                                        setRoomAmenityInputs(prev => ({ ...prev, [index]: '' }));
                                                                    }
                                                                }}
                                                                placeholder="Add custom amenity..."
                                                                className="flex-1 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-1 focus:ring-teal-500/10 focus:border-teal-500 text-sm text-zinc-900 dark:text-white bg-white dark:bg-zinc-800"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const val = (roomAmenityInputs[index] || '').trim();
                                                                    if (val && !(room.custom_amenities || []).includes(val)) {
                                                                        const newDetails = [...formData.room_details];
                                                                        newDetails[index].custom_amenities = [...(newDetails[index].custom_amenities || []), val];
                                                                        updateFormData({ room_details: newDetails });
                                                                        setRoomAmenityInputs(prev => ({ ...prev, [index]: '' }));
                                                                    }
                                                                }}
                                                                className="px-3 py-1.5 bg-teal-600 text-white rounded-xl text-sm hover:bg-teal-700 transition-colors"
                                                            >
                                                                Add
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep === 5 && (
                            <div>
                                <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-white">Pricing & Availability</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Monthly Rent (€) *</label>
                                        <input
                                            type="number"
                                            value={formData.monthly_rent}
                                            onChange={(e) => updateFormData({ monthly_rent: parseFloat(e.target.value) })}
                                            className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white bg-white"
                                            min="0"
                                        />
                                        {/* Rent control warning for zones tendues */}
                                        {['75', '92', '93', '94', '69', '13', '59', '31', '33', '34', '06'].some(code => formData.postal_code.startsWith(code)) && (
                                            <div className="mt-2 p-3 bg-teal-50/50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800 rounded text-sm">
                                                <span className="font-semibold text-teal-700 dark:text-teal-300">ℹ️ Zone Tendue:</span>
                                                <span className="text-teal-700 ml-1">
                                                    This area may have rent control (encadrement des loyers).
                                                    <a href="https://www.service-public.fr/particuliers/vosdroits/F1314" target="_blank" rel="noopener noreferrer" className="underline ml-1">
                                                        Check limits →
                                                    </a>
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                                            Deposit (€)
                                            <span className="text-zinc-500 dark:text-zinc-400 text-xs ml-2">
                                                Max: {formData.furnished ? '2 months' : '1 month'} rent by law
                                            </span>
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.deposit || ''}
                                            onChange={(e) => updateFormData({ deposit: e.target.value ? parseFloat(e.target.value) : undefined })}
                                            className={`w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white bg-white ${formData.deposit && (
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
                                        <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Charges mensuelles (€)</label>
                                        <input
                                            type="number"
                                            value={formData.charges || ''}
                                            onChange={(e) => updateFormData({ charges: e.target.value ? parseFloat(e.target.value) : undefined })}
                                            className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white bg-white"
                                            min="0"
                                        />
                                    </div>

                                    {/* CC / HC Toggle */}
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Type de loyer</label>
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => updateFormData({ charges_included: true })}
                                                className={`flex-1 py-3 rounded-xl border-2 text-center font-medium transition-all ${formData.charges_included
                                                    ? 'border-green-500 bg-green-50 text-green-700'
                                                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-200 dark:border-zinc-700'
                                                    }`}
                                            >
                                                <div className="text-lg">CC</div>
                                                <div className="text-xs text-zinc-500 dark:text-zinc-400">Charges Comprises</div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => updateFormData({ charges_included: false })}
                                                className={`flex-1 py-3 rounded-xl border-2 text-center font-medium transition-all ${!formData.charges_included
                                                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                                                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-200 dark:border-zinc-700'
                                                    }`}
                                            >
                                                <div className="text-lg">HC</div>
                                                <div className="text-xs text-zinc-500 dark:text-zinc-400">Hors Charges</div>
                                            </button>
                                        </div>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                            {formData.charges_included
                                                ? 'Le loyer affiché inclut les charges (eau, entretien, etc.)'
                                                : 'Les charges s\'ajoutent au loyer mensuel'
                                            }
                                        </p>
                                    </div>

                                    {/* Charges Description */}
                                    {formData.charges && Number(formData.charges) > 0 && (
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Détail des charges</label>
                                            <textarea
                                                value={formData.charges_description || ''}
                                                onChange={(e) => updateFormData({ charges_description: e.target.value })}
                                                placeholder="Ex: Eau froide, entretien parties communes, ordures ménagères, assurance immeuble..."
                                                className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 bg-white"
                                                rows={2}
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Disponible à partir du</label>
                                        <input
                                            type="date"
                                            value={formData.available_from || ''}
                                            onChange={(e) => updateFormData({ available_from: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-zinc-900 dark:text-white bg-white"
                                        />
                                    </div>
                                </div>

                                {/* Guarantor Preferences */}
                                <div className="mt-6 pt-6 border-t">
                                    <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-white">🛡️ Garantie locative</h3>
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
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-200 dark:border-zinc-700 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                        <span className="font-medium text-zinc-900 dark:text-white">Garant requis</span>
                                    </div>

                                    {formData.guarantor_required && (
                                        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Types de garant acceptés:</p>
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
                                                            className="rounded border-zinc-200 dark:border-zinc-700 text-teal-600 dark:text-teal-400 focus:ring-teal-500/10 focus:border-teal-500"
                                                        />
                                                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{opt.label}</span>
                                                        {opt.forced && <span className="text-xs text-emerald-600 dark:text-emerald-400 italic">(obligatoire par la loi)</span>}
                                                    </label>
                                                ))}
                                            </div>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">⚖️ Loi ELAN: Visale ne peut pas être refusé.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {currentStep === 6 && (
                            <div>
                                <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-white">Amenities & Features</h2>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium mb-3 text-zinc-700 dark:text-zinc-300">Standard Amenities</label>
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
                                                        className="w-4 h-4 text-teal-600 dark:text-teal-400"
                                                    />
                                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{amenity}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Custom Amenities</label>
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
                                                        className="flex-1 px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white bg-white"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            updateFormData({
                                                                custom_amenities: formData.custom_amenities.filter((_, i) => i !== idx)
                                                            });
                                                        }}
                                                        className="px-3 py-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                onClick={() => updateFormData({ custom_amenities: [...formData.custom_amenities, ''] })}
                                                className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                            >
                                                + Add Custom Amenity
                                            </button>
                                        </div>
                                    </div>

                                    {/* Display enriched data */}
                                    {formData.public_transport.length > 0 && (
                                        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                                            <h3 className="font-semibold mb-2 text-zinc-900 dark:text-white">🚇 Public Transport ({formData.public_transport.length})</h3>
                                            <ul className="text-sm space-y-1">
                                                {formData.public_transport.slice(0, 5).map((t, i) => (
                                                    <li key={i} className="text-zinc-700 dark:text-zinc-300">{t}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {formData.nearby_landmarks.length > 0 && (
                                        <div className="bg-teal-50/50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800 rounded-xl p-4">
                                            <h3 className="font-semibold mb-2 text-zinc-900 dark:text-white">📍 Nearby Landmarks ({formData.nearby_landmarks.length})</h3>
                                            <ul className="text-sm space-y-1 grid grid-cols-2 gap-1">
                                                {formData.nearby_landmarks.slice(0, 8).map((l, i) => (
                                                    <li key={i} className="text-zinc-700 dark:text-zinc-300">{l}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {currentStep === 7 && (
                            <div>
                                <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-white">Review & Submit</h2>
                                <div className="space-y-4 text-sm">
                                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl">
                                        <h3 className="font-bold mb-2 text-zinc-900 dark:text-white">{formData.title}</h3>
                                        <p className="text-zinc-600 dark:text-zinc-400">{formData.description}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl">
                                            <p className="font-medium text-zinc-900 dark:text-white">Type: {formData.property_type}</p>
                                            <p>Address: {formData.address_line1}, {formData.city}</p>
                                            <p>{formData.bedrooms} bed • {formData.bathrooms} bath • {formData.size_sqm}m²</p>
                                        </div>
                                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl">
                                            <p className="font-bold text-xl text-teal-600 dark:text-teal-400">€{formData.monthly_rent}/mo</p>
                                            {formData.deposit && <p>Deposit: €{formData.deposit}</p>}
                                            {formData.charges && <p>Charges: €{formData.charges}/mo</p>}
                                        </div>
                                    </div>
                                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl">
                                        <p className="font-medium mb-2 text-zinc-900 dark:text-white">Amenities:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {[...formData.amenities, ...formData.custom_amenities].map((a, i) => (
                                                <span key={i} className="px-3 py-1 bg-teal-50 dark:bg-teal-900/20 text-teal-700 rounded-full text-xs">
                                                    {a}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep === 8 && mediaSession && (
                            <div className="text-center">
                                <div className="text-6xl mb-4">📸</div>
                                <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Property Saved as Draft</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 mb-6">Upload photos & videos for each room using the QR codes below to publish your listing.</p>

                                {/* Per-Room Media Progress */}
                                {formData.room_details.length > 0 && (
                                    <div className="mb-6">
                                        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 uppercase tracking-wider">Room Media Progress</h3>
                                        <div className="flex flex-wrap gap-2 justify-center mb-4">
                                            {formData.room_details.map((_, i) => {
                                                const count = roomMediaCounts[i] || 0;
                                                return (
                                                    <div
                                                        key={`room-tab-${i}`}
                                                        className={`px-4 py-2 rounded-xl text-sm font-medium border ${count > 0
                                                            ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                                            }`}
                                                    >
                                                        {count > 0 ? '✅' : '⚠️'} Bedroom {i + 1}
                                                        <span className="ml-1.5 text-xs opacity-75">({count} files)</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Media Status Banner */}
                                <div className={`mb-6 p-4 rounded-xl border text-left ${published
                                    ? 'bg-green-50 border-green-200'
                                    : mediaVerified
                                        ? 'bg-teal-50/50 dark:bg-teal-900/10 border-teal-200 dark:border-teal-800'
                                        : 'bg-amber-50 border-amber-200'
                                    }`}>
                                    {published ? (
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">✅</span>
                                            <div>
                                                <p className="font-bold text-green-800">Property Published!</p>
                                                <p className="text-sm text-green-700">Your listing is now live and visible to tenants.</p>
                                            </div>
                                        </div>
                                    ) : mediaVerified ? (
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">📷</span>
                                            <div>
                                                <p className="font-bold text-teal-700 dark:text-teal-300">{mediaCount} media file{mediaCount !== 1 ? 's' : ''} uploaded</p>
                                                <p className="text-sm text-teal-700">All rooms have media — ready to publish!</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">⚠️</span>
                                            <div>
                                                <p className="font-bold text-amber-800">
                                                    {formData.room_details.length > 0
                                                        ? `${formData.room_details.filter((_, i) => (roomMediaCounts[i] || 0) === 0).length} room(s) still need media`
                                                        : 'No media uploaded yet'}
                                                </p>
                                                <p className="text-sm text-amber-700">
                                                    Scan the QR code with your phone. You can select which room to photograph on your phone.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Single QR Code for media capture */}
                                {!published && mediaSession && (
                                    <div>
                                        <QRCodeDisplay
                                            verificationCode={mediaSession.verification_code}
                                            captureUrl={mediaSession.capture_url}
                                            expiresAt={mediaSession.expires_at}
                                        />
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                                    {!published && (
                                        <>
                                            <button
                                                onClick={checkMediaStatus}
                                                className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 font-medium transition-all"
                                            >
                                                🔄 Check for Uploaded Media
                                            </button>
                                            <button
                                                onClick={handlePublish}
                                                disabled={!mediaVerified || publishing}
                                                className={`px-8 py-3 font-bold rounded-xl transition-all ${mediaVerified && !publishing
                                                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:shadow-lg cursor-pointer'
                                                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 cursor-not-allowed'
                                                    }`}
                                                title={!mediaVerified ? 'Upload media for all rooms to publish' : ''}
                                            >
                                                {publishing ? 'Publishing...' : '🚀 Publish Property'}
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => router.push(`/properties/${propertyId}`)}
                                        className="px-6 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl hover:shadow-lg hover:shadow-teal-500/25 font-medium transition-all"
                                    >
                                        View Property
                                    </button>
                                    <button
                                        onClick={() => router.push('/properties')}
                                        className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 font-medium transition-all"
                                    >
                                        Back to Properties
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        {currentStep > 0 && currentStep < 7 && (
                            <div className="flex justify-between mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                                {currentStep > 1 ? (
                                    <button
                                        onClick={prevStep}
                                        className="px-6 py-2.5 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium transition-all"
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
                                        className="px-6 py-2.5 text-red-600 hover:text-red-700 font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                )}

                                {currentStep < 6 ? (
                                    <button
                                        onClick={nextStep}
                                        className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl hover:shadow-lg hover:shadow-teal-500/25 font-semibold transform hover:-translate-y-0.5 transition-all"
                                    >
                                        Next →
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={loading}
                                        className="px-8 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-teal-500/25 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 transition-all"
                                    >
                                        {loading ? (
                                            <span className="flex items-center gap-2">
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Creating...
                                            </span>
                                        ) : (
                                            '✨ Create Property'
                                        )}
                                    </button>
                                )}
                            </div>
                        )}
                    </motion.div>
                </div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
