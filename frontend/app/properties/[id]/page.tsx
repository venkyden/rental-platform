'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import { apiClient } from '@/lib/api';
import { PropertyDetailSkeleton } from '@/components/SkeletonLoaders';
import { useToast } from '@/lib/ToastContext';
import VisitScheduler from '@/components/VisitScheduler';
import VisitBookingWizard from '@/components/VisitBookingWizard';
import LeaseManager from '@/components/LeaseManager';

interface Property {
    id: string;
    landlord_id: string;
    title: string;
    description: string;
    property_type: string;
    address_line1: string;
    address_line2?: string;
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
    available_from?: string;
    amenities: any;
    custom_amenities: any;
    public_transport: any;
    nearby_landmarks: any;
    photos: any;
    status: string;
    views_count: number;
    created_at: string;
    updated_at?: string;
    published_at?: string;
    utilities_included?: string[]; // New
    is_caf_eligible?: boolean; // New
}

export default function PropertyDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const toast = useToast();
    const [property, setProperty] = useState<Property | null>(null);
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);
    const propertyId = params?.id as string;

    useEffect(() => {
        if (propertyId) {
            loadProperty();
        }
    }, [propertyId]);

    const loadProperty = async () => {
        try {
            const response = await apiClient.client.get(`/properties/${propertyId}`);
            setProperty(response.data);
        } catch (error: any) {
            console.error('Error loading property:', error);
            if (error.response?.status === 404) {
                toast.error('Property not found');
                router.push('/properties');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this property?')) return;

        try {
            await apiClient.client.delete(`/properties/${propertyId}`);
            toast.success('Property deleted successfully');
            router.push('/properties');
        } catch (error) {
            toast.error('Error deleting property');
        }
    };

    const handlePublish = async () => {
        setPublishing(true);
        try {
            await apiClient.client.post(`/properties/${propertyId}/publish`);
            toast.success('Property published successfully!');
            loadProperty();
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Error publishing property');
        } finally {
            setPublishing(false);
        }
    };

    if (loading) {
        return <PropertyDetailSkeleton />;
    }

    if (!property) {
        return null;
    }

    const isOwner = user?.id === property.landlord_id;
    const fullAddress = [
        property.address_line1,
        property.address_line2,
        property.postal_code,
        property.city,
        property.country
    ].filter(Boolean).join(', ');

    // Parse amenities and features
    const amenities = property.amenities?.standard || [];
    const customAmenities = property.custom_amenities?.items || [];
    const publicTransport = property.public_transport?.items || [];
    const nearbyLandmarks = property.nearby_landmarks?.items || [];
    const photos = property.photos?.urls || [];

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
                {/* Header */}
                <header className="bg-white shadow">
                    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                        <button
                            onClick={() => router.push('/properties')}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                            ← Back to Properties
                        </button>
                        {isOwner && (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => router.push(`/properties/${propertyId}/edit`)}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                                >
                                    ✏️ Edit
                                </button>
                                {property.status === 'draft' && (
                                    <button
                                        onClick={handlePublish}
                                        disabled={publishing}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                                    >
                                        {publishing ? 'Publishing...' : '📢 Publish'}
                                    </button>
                                )}
                                <button
                                    onClick={handleDelete}
                                    className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 font-medium"
                                >
                                    🗑️ Delete
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                    {/* Status Badge */}
                    <div className="mb-4">
                        <span className={`inline-block px-4 py-1 rounded-full text-sm font-semibold ${property.status === 'active' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'}`}>
                            {property.status === 'active' ? '✅ Published' : '📝 Draft'}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column - Photos & Info */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Photo Gallery */}
                            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                                {photos && photos.length > 0 ? (
                                    <div className="relative h-96">
                                        <img
                                            src={photos[0]}
                                            alt={property.title}
                                            className="w-full h-full object-cover"
                                        />
                                        {photos.length > 1 && (
                                            <div className="absolute bottom-4 right-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-sm">
                                                1 / {photos.length}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-96 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                                        <span className="text-8xl">🏠</span>
                                    </div>
                                )}
                            </div>

                            {/* Title & Description */}
                            <div className="bg-white rounded-xl shadow-lg p-6">
                                <h1 className="text-3xl font-bold text-gray-900 mb-3">{property.title}</h1>
                                <div className="flex items-center gap-4 text-gray-600 mb-4">
                                    <span className="flex items-center gap-1">
                                        📍 {property.city}
                                    </span>
                                    <span>•</span>
                                    <span className="capitalize">{property.property_type}</span>
                                </div>
                                <p className="text-gray-700 leading-relaxed">{property.description}</p>
                            </div>

                            {/* Property Details */}
                            <div className="bg-white rounded-xl shadow-lg p-6">
                                <h2 className="text-xl font-bold mb-4">Property Details</h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">🛏️</span>
                                        <div>
                                            <div className="text-sm text-gray-600">Bedrooms</div>
                                            <div className="font-semibold">{property.bedrooms}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">🚿</span>
                                        <div>
                                            <div className="text-sm text-gray-600">Bathrooms</div>
                                            <div className="font-semibold">{property.bathrooms}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">📏</span>
                                        <div>
                                            <div className="text-sm text-gray-600">Size</div>
                                            <div className="font-semibold">{property.size_sqm}m²</div>
                                        </div>
                                    </div>
                                    {property.floor_number !== null && property.floor_number !== undefined && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">🏢</span>
                                            <div>
                                                <div className="text-sm text-gray-600">Floor</div>
                                                <div className="font-semibold">{property.floor_number}</div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">🛋️</span>
                                        <div>
                                            <div className="text-sm text-gray-600">Furnished</div>
                                            <div className="font-semibold">{property.furnished ? 'Yes' : 'No'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Utilities & CAF Eligibility (New Section) */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h2 className="text-xl font-bold mb-4">💡 Utilities & Eligibility</h2>

                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">Included in Rent:</h3>
                                <div className="flex gap-4">
                                    <div className={`text-center p-2 rounded-lg ${property.utilities_included?.includes('electricity') ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50 text-gray-400 opacity-50'}`}>
                                        <div className="text-2xl">⚡</div>
                                        <div className="text-xs font-medium">Elec</div>
                                    </div>
                                    <div className={`text-center p-2 rounded-lg ${property.utilities_included?.includes('gas') ? 'bg-orange-50 text-orange-700' : 'bg-gray-50 text-gray-400 opacity-50'}`}>
                                        <div className="text-2xl">🔥</div>
                                        <div className="text-xs font-medium">Gas</div>
                                    </div>
                                    <div className={`text-center p-2 rounded-lg ${property.utilities_included?.includes('water') ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-400 opacity-50'}`}>
                                        <div className="text-2xl">💧</div>
                                        <div className="text-xs font-medium">Water</div>
                                    </div>
                                    <div className={`text-center p-2 rounded-lg ${property.utilities_included?.includes('internet') ? 'bg-purple-50 text-purple-700' : 'bg-gray-50 text-gray-400 opacity-50'}`}>
                                        <div className="text-2xl">📶</div>
                                        <div className="text-xs font-medium">Wifi</div>
                                    </div>
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                    {property.utilities_included?.length ? 'Highlighted items are included.' : 'Tenant handles all utility contracts.'}
                                </div>
                            </div>

                            <div className="pt-4 border-t">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">🇫🇷</span>
                                        <div>
                                            <div className="font-semibold text-gray-900">CAF / APL Eligible</div>
                                            <div className="text-xs text-gray-500">Housing allowance supported</div>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${property.is_caf_eligible ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                        {property.is_caf_eligible ? 'YES ✅' : 'NO ❌'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Amenities */}
                    {(amenities.length > 0 || customAmenities.length > 0) && (
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold mb-4">Amenities</h2>
                            <div className="flex flex-wrap gap-2">
                                {[...amenities, ...customAmenities].map((amenity, idx) => (
                                    <span
                                        key={idx}
                                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                                    >
                                        {amenity}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Location & Transport */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h2 className="text-xl font-bold mb-4">📍 Location</h2>
                        <p className="text-gray-700 mb-4">{fullAddress}</p>

                        {/* Public Transport */}
                        {publicTransport.length > 0 && (
                            <div className="mb-4">
                                <h3 className="font-semibold text-gray-900 mb-2">🚇 Public Transport</h3>
                                <ul className="space-y-1">
                                    {publicTransport.slice(0, 10).map((transport: string, idx: number) => (
                                        <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                            <span className="text-green-600 mt-0.5">→</span>
                                            <span>{transport}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Nearby Landmarks */}
                        {nearbyLandmarks.length > 0 && (
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-2">🏪 Nearby Landmarks</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                                    {nearbyLandmarks.slice(0, 12).map((landmark: string, idx: number) => (
                                        <div key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                            <span className="text-blue-600 mt-0.5">•</span>
                                            <span>{landmark}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
            </div>

            {/* Right Column - Price & Contact */}
            <div className="lg:col-span-1 space-y-6">
                {/* Pricing Card */}
                <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
                    <div className="text-center mb-6">
                        <div className="text-4xl font-bold text-blue-600 mb-1">
                            €{property.monthly_rent}
                        </div>
                        <div className="text-gray-600">per month</div>
                    </div>

                    <div className="space-y-3 mb-6 text-sm">
                        {property.deposit && (
                            <div className="flex justify-between">
                                <span className="text-gray-600">Deposit:</span>
                                <span className="font-semibold">€{property.deposit}</span>
                            </div>
                        )}
                        {property.charges && (
                            <div className="flex justify-between">
                                <span className="text-gray-600">Charges:</span>
                                <span className="font-semibold">€{property.charges}/mo</span>
                            </div>
                        )}
                        {property.available_from && (
                            <div className="flex justify-between">
                                <span className="text-gray-600">Available:</span>
                                <span className="font-semibold">
                                    {new Date(property.available_from).toLocaleDateString()}
                                </span>
                            </div>
                        )}
                    </div>

                    {!isOwner && (
                        <button className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg hover:shadow-lg transition-all">
                            📧 Contact Landlord
                        </button>
                    )}

                    {isOwner && property.status === 'draft' && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p className="text-sm text-yellow-800 mb-2">
                                ⚠️ This property is not published yet. Click "Publish" to make it visible to tenants.
                            </p>
                        </div>
                    )}
                </div>

                {/* Visit Scheduler / Booking */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    {isOwner ? (
                        <>
                            <VisitScheduler propertyId={property.id} />
                            <LeaseManager
                                propertyId={property.id}
                                monthlyRent={property.monthly_rent}
                            />
                        </>
                    ) : (
                        <VisitBookingWizard propertyId={property.id} />
                    )}
                </div>

                {/* Stats */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Property Stats</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Views:</span>
                            <span className="font-semibold">{property.views_count}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Listed:</span>
                            <span className="font-semibold">
                                {new Date(property.created_at).toLocaleDateString()}
                            </span>
                        </div>
                        {property.published_at && (
                            <div className="flex justify-between">
                                <span className="text-gray-600">Published:</span>
                                <span className="font-semibold">
                                    {new Date(property.published_at).toLocaleDateString()}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
                </main >
            </div >
        </ProtectedRoute >
    );
}
