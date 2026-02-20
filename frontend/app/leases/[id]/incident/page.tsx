"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { disputeApi, DisputeCategory } from '@/app/lib/api/dispute';
import { Camera, AlertTriangle, Home, Wrench, ShieldAlert } from 'lucide-react';

export default function IncidentReportPage() {
    const params = useParams();
    const leaseId = params.id as string;
    const router = useRouter();

    const [category, setCategory] = useState<DisputeCategory | null>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);

    const [captureFile, setCaptureFile] = useState<File | null>(null);
    const [leaseData, setLeaseData] = useState<any>(null); // Ideally use Lease type

    useEffect(() => {
        // Fetch lease to get property location
        const { leaseApi } = require('@/app/lib/api/lease');
        leaseApi.get(leaseId).then(setLeaseData).catch(console.error);
    }, [leaseId]);

    const handleSubmit = async () => {
        if (!category || !title || !description) return;

        setLoading(true);
        try {
            let photoUrl = "";
            if (captureFile) {
                // Geo-Fencing Check (Reusable Logic potentially? keeping inline for speed)
                if (leaseData?.property_location) {
                    try {
                        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
                        });

                        const { calculateDistance } = await import('@/app/lib/utils/geo');
                        const distance = calculateDistance(
                            position.coords.latitude,
                            position.coords.longitude,
                            leaseData.property_location.lat,
                            leaseData.property_location.lng
                        );

                        // 500m threshold
                        if (distance > 500) {
                            const proceeded = window.confirm(`⚠️ Location Warning\n\nYou seem to be ${distance.toFixed(0)}m away from the property.\n\nAre you sure you want to submit this report?`);
                            if (!proceeded) {
                                setLoading(false);
                                return;
                            }
                        }
                    } catch (geoError) {
                        console.warn("Geolocation check failed or skipped", geoError);
                    }
                }

                const { mediaApi } = await import('@/app/lib/api/media');
                photoUrl = await mediaApi.upload(captureFile, 'disputes');
            }

            await disputeApi.create({
                lease_id: leaseId,
                category,
                title,
                description: description + (photoUrl ? `\n\n[Evidence](${photoUrl})` : "") // Append evidence link to desc for MVP
            });
            router.push(`/dashboard?success=incident_reported`);
        } catch (err) {
            console.error(err);
            alert("Failed to report incident");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto p-4 pb-24">
            <header className="mb-8">
                <h1 className="text-2xl font-bold">Report an Incident</h1>
                <p className="text-gray-500">Create a timestamped record for protection.</p>
            </header>

            <div className="space-y-6">
                {/* Category Selection */}
                <section>
                    <label className="block text-sm font-medium mb-3">What happened?</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setCategory('appliance_failure')}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${category === 'appliance_failure' ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                            <div className="bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center mb-2 text-blue-600">
                                <Wrench size={20} />
                            </div>
                            <div className="font-semibold">Appliance Failure</div>
                            <div className="text-xs text-gray-500 mt-1">Fridge, Washer, Heater...</div>
                        </button>

                        <button
                            onClick={() => setCategory('damage')}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${category === 'damage' ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                            <div className="bg-red-100 w-10 h-10 rounded-full flex items-center justify-center mb-2 text-red-600">
                                <AlertTriangle size={20} />
                            </div>
                            <div className="font-semibold">Accidental Damage</div>
                            <div className="text-xs text-gray-500 mt-1">Spills, Breakage, Scratches...</div>
                        </button>

                        <button
                            onClick={() => setCategory('shared_liability')}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${category === 'shared_liability' ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                            <div className="bg-purple-100 w-10 h-10 rounded-full flex items-center justify-center mb-2 text-purple-600">
                                <Home size={20} />
                            </div>
                            <div className="font-semibold">Common Area</div>
                            <div className="text-xs text-gray-500 mt-1">Shared space issues</div>
                        </button>

                        <button
                            onClick={() => setCategory('other')}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${category === 'other' ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                            <div className="bg-gray-100 w-10 h-10 rounded-full flex items-center justify-center mb-2 text-gray-600">
                                <ShieldAlert size={20} />
                            </div>
                            <div className="font-semibold">Other</div>
                            <div className="text-xs text-gray-500 mt-1">Noise, Neighbors, etc.</div>
                        </button>
                    </div>
                </section>

                {/* Dynamic Advice */}
                {category === 'appliance_failure' && (
                    <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 border border-blue-200 flex gap-2">
                        <Wrench size={16} className="shrink-0 mt-0.5" />
                        <div>
                            <strong>Landlord Responsibility:</strong> Report this ASAP. If you continue using a broken appliance and cause leaks/damage, you may become liable.
                        </div>
                    </div>
                )}

                {category === 'damage' && (
                    <div className="bg-yellow-50 p-4 rounded-lg text-sm text-yellow-800 border border-yellow-200 flex gap-2">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <div>
                            <strong>Tenant Responsibility:</strong> Reporting this now prevents "Mystery Math" at move-out. Honesty preserves your reputation.
                        </div>
                    </div>
                )}

                {/* Details */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Title</label>
                        <input
                            className="w-full p-3 border rounded-lg"
                            placeholder="e.g. Washing machine making loud noise"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <textarea
                            className="w-full p-3 border rounded-lg h-32"
                            placeholder="Describe what happened, when, and specific symptoms..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>
                </div>

                {/* Evidence */}
                <div className="bg-gray-50 p-4 rounded-xl border border-dashed border-gray-300 text-center relative">
                    <div className="mb-2 font-medium text-gray-900">Add Live Photo</div>
                    <p className="text-xs text-gray-500 mb-4">Camera only. Previous gallery photos not accepted.</p>

                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={e => setCaptureFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />

                    <button className="flex items-center justify-center gap-2 bg-white border px-6 py-3 rounded-lg mx-auto shadow-sm text-blue-600 font-medium">
                        <Camera size={20} />
                        {captureFile ? "Photo Captured" : "Take Photo"}
                    </button>
                    {/* Note: In real impl, use same <input type="file" capture> logic as Inventory */}
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={!category || !title || loading}
                    className="w-full py-4 bg-black text-white rounded-xl font-bold shadow-lg disabled:opacity-50"
                >
                    {loading ? "Submitting..." : "Submit Report"}
                </button>
            </div>
        </div>
    );
}
