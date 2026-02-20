"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { inventoryApi, Inventory, InventoryItem } from '@/app/lib/api/inventory';
// import { SignaturePad } from '@/components/inventory/SignaturePad'; // Removed
import { Loader2, Camera, CheckCircle, FileText } from 'lucide-react';

export default function InventoryPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();

    const [inventory, setInventory] = useState<Inventory | null>(null);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState<'items' | 'sign'>('items');

    // Signature State
    const [tenantSig, setTenantSig] = useState<any>(null);
    const [landlordSig, setLandlordSig] = useState<any>(null);

    // New Item State
    const [newItemName, setNewItemName] = useState("");
    const [newItemCondition, setNewItemCondition] = useState<InventoryItem['condition']>('good');
    const [captureFile, setCaptureFile] = useState<File | null>(null);

    useEffect(() => {
        loadInventory();
    }, [id]);

    const loadInventory = async () => {
        try {
            const data = await inventoryApi.get(id);
            setInventory(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const [uploading, setUploading] = useState(false);

    const addItem = async () => {
        if (!newItemName) return;

        setUploading(true);
        try {
            let photoUrl = "";
            if (captureFile) {
                // Real Upload
                // Geo-Fencing Check
                if (inventory?.property_location) {
                    try {
                        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
                        });

                        const { calculateDistance } = await import('@/app/lib/utils/geo');
                        const distance = calculateDistance(
                            position.coords.latitude,
                            position.coords.longitude,
                            inventory.property_location.lat,
                            inventory.property_location.lng
                        );

                        console.log(`Device at ${distance.toFixed(0)}m from property`);

                        // 500m threshold (generous for GPS drift)
                        if (distance > 500) {
                            const proceeded = window.confirm(`⚠️ Location Warning\n\nYou seem to be ${distance.toFixed(0)}m away from the property.\n\nAre you sure you want to upload this photo?`);
                            if (!proceeded) {
                                setLoading(false);
                                setUploading(false);
                                return;
                            }
                        }
                    } catch (geoError) {
                        console.warn("Geolocation skipped:", geoError);
                        // Optional: Warn if location is required but failed
                    }
                }

                const { mediaApi } = await import('@/app/lib/api/media');
                photoUrl = await mediaApi.upload(captureFile, 'inventory');
            }

            await inventoryApi.addItems(id, [{
                name: newItemName,
                category: "General",
                condition: newItemCondition,
                photos: photoUrl ? [photoUrl] : [],
                notes: ""
            }]);

            setNewItemName("");
            setCaptureFile(null);
            setNewItemCondition('good'); // Reset default
            loadInventory();
        } catch (e) {
            console.error(e);
            alert("Failed to add item");
        } finally {
            setUploading(false);
        }
    };

    const handleSign = async () => {
        if (!tenantSig || !landlordSig) return;
        await inventoryApi.sign(id, {
            signature_tenant: tenantSig,
            signature_landlord: landlordSig
        });
        router.push('/dashboard?success=inventory_signed');
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>;
    if (!inventory) return <div className="p-10 text-center">Inventory Not Found</div>;

    return (
        <div className="max-w-2xl mx-auto p-4 pb-24">
            <header className="mb-6">
                <h1 className="text-2xl font-bold">
                    {inventory.type === 'move_in' ? 'Move-In' : 'Move-Out'} Inspection
                </h1>
                <p className="text-gray-500 text-sm">Create the undeniable truth.</p>
            </header>

            {step === 'items' && (
                <div className="space-y-6">
                    {/* List Existing */}
                    <div className="space-y-3">
                        {inventory.items.map(item => (
                            <div key={item.id} className="flex items-center gap-3 p-3 bg-white border rounded-lg shadow-sm">
                                <div className={`w-3 h-3 rounded-full ${item.condition === 'good' ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="font-medium">{item.name}</span>
                                <span className="text-xs text-gray-500 ml-auto capitalize">{item.condition}</span>
                            </div>
                        ))}
                    </div>

                    {/* Add New */}
                    <div className="p-4 bg-gray-50 rounded-xl border-dashed border-2 border-gray-200">
                        <h3 className="font-medium mb-3">Add Room/Item</h3>
                        <div className="space-y-3">
                            <input
                                className="w-full p-2 border rounded"
                                placeholder="e.g. Kitchen Sink"
                                value={newItemName}
                                onChange={e => setNewItemName(e.target.value)}
                            />

                            <div className="flex gap-2">
                                {['new', 'good', 'fair', 'damaged'].map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setNewItemCondition(c as any)}
                                        className={`px-3 py-1 rounded text-sm capitalize ${newItemCondition === c ? 'bg-black text-white' : 'bg-white border'}`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>

                            <div className="relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment" // Force camera on mobile
                                    onChange={e => setCaptureFile(e.target.files?.[0] || null)}
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                />
                                <button className="w-full py-3 flex items-center justify-center gap-2 bg-white border rounded-lg text-blue-600 font-medium">
                                    <Camera size={20} />
                                    {captureFile ? "Photo Captured" : "Take Live Photo"}
                                </button>
                            </div>

                            <button
                                onClick={addItem}
                                disabled={!newItemName}
                                className="w-full py-3 bg-black text-white rounded-lg font-bold disabled:opacity-50"
                            >
                                Add Item
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={() => setStep('sign')}
                        className="w-full py-4 bg-green-600 text-white rounded-xl font-bold shadow-lg mt-8"
                    >
                        Finish & Sign
                    </button>
                </div>
            )}

            {step === 'sign' && (
                <div className="space-y-8">
                    <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 border border-blue-200">
                        ℹ️ Use the checkboxes below to confirm the inventory status. Both parties must be present.
                    </div>

                    <div className="space-y-6 bg-white p-6 rounded-xl border shadow-sm">
                        <h3 className="font-bold border-b pb-2">1. Tenant Confirmation</h3>
                        <label className="flex items-start gap-4 cursor-pointer">
                            <input
                                type="checkbox"
                                className="w-6 h-6 mt-1 accent-black"
                                checked={!!tenantSig}
                                onChange={(e) => setTenantSig(e.target.checked ? { agreed: true, date: new Date().toISOString() } : null)}
                            />
                            <div className="text-sm text-gray-700">
                                <span className="font-semibold block text-black">I agree to the condition of the property as recorded.</span>
                                <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-gray-600">
                                    <li>I certify that the photos accurately represent the state of the property.</li>
                                    <li><strong>Duty to Report:</strong> I agree to report any future damage immediately via the App.</li>
                                    <li><strong>Shared Liability:</strong> For shared leases, I understand that unreported damage in common areas will be split among all tenants at move-out.</li>
                                </ul>
                            </div>
                        </label>
                    </div>

                    <div className="space-y-6 bg-white p-6 rounded-xl border shadow-sm">
                        <h3 className="font-bold border-b pb-2">2. Landlord Confirmation</h3>
                        <label className="flex items-start gap-4 cursor-pointer">
                            <input
                                type="checkbox"
                                className="w-6 h-6 mt-1 accent-black"
                                checked={!!landlordSig}
                                onChange={(e) => setLandlordSig(e.target.checked ? { agreed: true, date: new Date().toISOString() } : null)}
                            />
                            <div className="text-sm text-gray-700">
                                <span className="font-semibold block text-black">I accept this inventory as the official baseline.</span>
                                I confirm that the Tenant has been given the opportunity to inspect all items.
                            </div>
                        </label>
                    </div>

                    <button
                        onClick={handleSign}
                        disabled={!tenantSig || !landlordSig}
                        className="w-full py-4 bg-black text-white rounded-xl font-bold shadow-lg disabled:opacity-50 hover:bg-gray-800 transition-colors"
                    >
                        Confirm & Submit Inventory
                    </button>
                </div>
            )}
        </div >
    );
}
