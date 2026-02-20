"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function NewInventoryPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const startDemo = async () => {
        setLoading(true);
        // In real app: POST /api/v1/inventory/ { lease_id: ... } -> returns ID
        // Demo: Navigate to existing demo page
        setTimeout(() => {
            router.push('/inventory/demo-inventory-id');
        }, 800);
    };

    return (
        <div className="max-w-xl mx-auto p-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="bg-white p-8 rounded-2xl shadow-sm border w-full">
                <h1 className="text-2xl font-bold mb-2">New Inspection</h1>
                <p className="text-gray-500 mb-8">Select a property to start the Move-In/Out process.</p>

                <div className="space-y-3">
                    <button
                        onClick={startDemo}
                        disabled={loading}
                        className="w-full flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 group transition-all"
                    >
                        <div className="text-left">
                            <div className="font-semibold">Demo Apartment 404</div>
                            <div className="text-xs text-gray-500">123 Tech Street, Paris</div>
                        </div>
                        {loading ? <Loader2 className="animate-spin text-gray-400" /> : <span className="text-gray-300 group-hover:text-black">→</span>}
                    </button>

                    <div className="text-xs text-gray-400 mt-4">
                        * In production, this list would populate from your active leases.
                    </div>
                </div>
            </div>
        </div>
    );
}
