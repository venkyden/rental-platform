"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { disputeApi, DisputeCategory } from '@/app/lib/api/dispute';
import { leaseApi, Lease } from '@/app/lib/api/lease';
import { mediaApi } from '@/app/lib/api/media';
import { calculateDistance } from '@/app/lib/utils/geo';
import { 
    Camera, 
    AlertTriangle, 
    Home, 
    Wrench, 
    ShieldAlert, 
    Trash2, 
    CheckCircle2, 
    Info, 
    X,
    Sparkles,
    ChevronLeft,
    Clock,
    Euro
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function IncidentReportPage() {
    const params = useParams();
    const leaseId = params.id as string;
    const router = useRouter();

    const [category, setCategory] = useState<DisputeCategory | null>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [amountClaimed, setAmountClaimed] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [leaseData, setLeaseData] = useState<Lease | null>(null);
    const [fetchingLease, setFetchingLease] = useState(true);

    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const loadLease = async () => {
            try {
                const data = await leaseApi.get(leaseId);
                setLeaseData(data);
            } catch (err) {
                console.error("Failed to load lease:", err);
                toast.error("Could not load lease details");
            } finally {
                setFetchingLease(false);
            }
        };
        loadLease();
    }, [leaseId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (files.length + selectedFiles.length > 5) {
            toast.error("Maximum 5 photos allowed");
            return;
        }

        const newFiles = [...files, ...selectedFiles];
        setFiles(newFiles);

        // Generate previews
        const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
        setPreviews([...previews, ...newPreviews]);
        
        // Reset input so same file can be picked again if removed
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeFile = (index: number) => {
        const newFiles = [...files];
        newFiles.splice(index, 1);
        setFiles(newFiles);

        const newPreviews = [...previews];
        URL.revokeObjectURL(newPreviews[index]);
        newPreviews.splice(index, 1);
        setPreviews(newPreviews);
    };

    const handleSubmit = async () => {
        if (!category || !title || !description) {
            toast.error("Please fill in all required fields");
            return;
        }

        setLoading(true);
        try {
            let locationVerified = "unverified";
            let distanceMeters = 0;

            // Geo-Fencing Check (Advisory only)
            if (leaseData?.property_location) {
                try {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { 
                            enableHighAccuracy: true, 
                            timeout: 5000 
                        });
                    });

                    distanceMeters = calculateDistance(
                        position.coords.latitude,
                        position.coords.longitude,
                        leaseData.property_location.lat,
                        leaseData.property_location.lng
                    );

                    locationVerified = distanceMeters <= 500 ? "verified" : "unverified";
                } catch (geoError) {
                    console.warn("Geolocation check failed", geoError);
                    locationVerified = "denied";
                }
            }

            // Upload photos sequentially
            const evidenceUrls: string[] = [];
            for (const file of files) {
                const url = await mediaApi.upload(file, 'disputes');
                evidenceUrls.push(url);
            }

            await disputeApi.create({
                lease_id: leaseId,
                category,
                title,
                description,
                evidence_urls: evidenceUrls,
                amount_claimed: amountClaimed ? parseFloat(amountClaimed) : undefined,
                location_verified: locationVerified,
                report_distance_meters: distanceMeters > 0 ? distanceMeters : undefined
            });

            toast.success("Incident reported successfully");
            router.push(`/disputes?success=true`);
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.detail || "Failed to report incident");
        } finally {
            setLoading(false);
        }
    };

    if (fetchingLease) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 pb-24">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button 
                        onClick={() => router.back()}
                        className="p-2 -ml-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-lg font-bold tracking-tight">Report an Incident</h1>
                    <div className="w-10"></div> {/* Spacer */}
                </div>
            </div>

            <main className="max-w-2xl mx-auto px-4 pt-8 space-y-10">
                {/* Intro & Legal Duty */}
                <section>
                    <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-3xl p-6 flex gap-4">
                        <div className="w-12 h-12 shrink-0 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="font-bold text-indigo-900 dark:text-indigo-100">Tenant Duty of Care</h2>
                            <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1 leading-relaxed">
                                Under French law, you have an obligation to report any damage or issues occurring in the property. 
                                This timestamped report serves as evidence of your diligence.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Category Selection */}
                <section>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4 px-1">
                        1. What happened?
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { id: 'appliance_failure', label: 'Appliance', icon: Wrench, color: 'blue', desc: 'Fridge, Heater, etc.' },
                            { id: 'damage', label: 'Damage', icon: AlertTriangle, color: 'red', desc: 'Spills, Scratches, etc.' },
                            { id: 'cleaning', label: 'Cleaning', icon: Sparkles, color: 'teal', desc: 'Hygiene, Mold, etc.' },
                            { id: 'shared_liability', label: 'Common Area', icon: Home, color: 'purple', desc: 'Hallway, Elevator' },
                            { id: 'other', label: 'Other', icon: Info, color: 'zinc', desc: 'Noise, Neighbors' }
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setCategory(item.id as DisputeCategory)}
                                className={`group p-4 rounded-3xl border-2 text-left transition-all duration-300 relative overflow-hidden ${
                                    category === item.id 
                                    ? 'border-zinc-900 dark:border-white bg-white dark:bg-zinc-900 shadow-xl scale-[1.02]' 
                                    : 'border-transparent bg-white/50 dark:bg-zinc-900/50 hover:bg-white dark:hover:bg-zinc-900 hover:shadow-md'
                                }`}
                            >
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 transition-colors ${
                                    category === item.id 
                                    ? `bg-${item.color}-600 text-white` 
                                    : `bg-${item.color}-100 dark:bg-${item.color}-900/30 text-${item.color}-600 dark:text-${item.color}-400 group-hover:scale-110`
                                }`}>
                                    <item.icon className="w-5 h-5" />
                                </div>
                                <div className="font-bold">{item.label}</div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{item.desc}</div>
                                {category === item.id && (
                                    <div className="absolute top-3 right-3">
                                        <CheckCircle2 className="w-5 h-5 text-zinc-900 dark:text-white" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Details Form */}
                <section className="space-y-6">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4 px-1">
                        2. Describe the issue
                    </h3>
                    <div className="space-y-4">
                        <div className="relative group">
                            <label className="absolute -top-2.5 left-4 px-1 bg-zinc-50 dark:bg-black text-[10px] font-bold uppercase tracking-tighter text-zinc-400 group-focus-within:text-teal-500 transition-colors">
                                Incident Title
                            </label>
                            <input
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-teal-500 dark:focus:border-teal-500 outline-none rounded-2xl p-4 transition-all"
                                placeholder="e.g. Broken heater in main bedroom"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                            />
                        </div>

                        <div className="relative group">
                            <label className="absolute -top-2.5 left-4 px-1 bg-zinc-50 dark:bg-black text-[10px] font-bold uppercase tracking-tighter text-zinc-400 group-focus-within:text-teal-500 transition-colors">
                                Detailed Description
                            </label>
                            <textarea
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-teal-500 dark:focus:border-teal-500 outline-none rounded-2xl p-4 min-h-[120px] transition-all"
                                placeholder="When did it happen? What are the symptoms? Any immediate steps taken?"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>

                        <div className="relative group max-w-xs">
                            <label className="absolute -top-2.5 left-4 px-1 bg-zinc-50 dark:bg-black text-[10px] font-bold uppercase tracking-tighter text-zinc-400 group-focus-within:text-teal-500 transition-colors">
                                Estimated Cost (Optional)
                            </label>
                            <div className="relative">
                                <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                <input
                                    type="number"
                                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-teal-500 dark:focus:border-teal-500 outline-none rounded-2xl p-4 pl-10 transition-all"
                                    placeholder="0.00"
                                    value={amountClaimed}
                                    onChange={e => setAmountClaimed(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Evidence - Live Camera */}
                <section>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4 px-1 flex items-center justify-between">
                        <span>3. Visual Evidence</span>
                        <span className="text-[10px] opacity-60">{files.length}/5 photos</span>
                    </h3>
                    
                    <div className="grid grid-cols-3 gap-3">
                        {previews.map((preview, index) => (
                            <div key={index} className="relative aspect-square rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 group shadow-sm">
                                <img src={preview} alt="Evidence" className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => removeFile(index)}
                                    className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur-md text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        
                        {files.length < 5 && (
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="aspect-square rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-2 hover:bg-white dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Camera className="w-5 h-5 text-zinc-500" />
                                </div>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Take Photo</span>
                            </button>
                        )}
                    </div>
                    
                    <input 
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    
                    <div className="mt-4 p-4 bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl flex gap-3 items-start">
                        <Clock className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                            <strong>Live capture only.</strong> Gallery photos are not accepted to ensure the integrity of the timestamp and location metadata.
                        </p>
                    </div>
                </section>

                {/* Submit Action */}
                <section className="pt-4">
                    <button
                        onClick={handleSubmit}
                        disabled={!category || !title || !description || loading}
                        className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold shadow-xl shadow-zinc-900/10 dark:shadow-white/5 disabled:opacity-50 disabled:shadow-none hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                                <span>Reporting...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-5 h-5" />
                                <span>Submit Incident Report</span>
                            </>
                        )}
                    </button>
                    <p className="text-center text-[10px] text-zinc-400 mt-4 uppercase tracking-tighter">
                        This report will be shared with the landlord and Roomivo admin immediately.
                    </p>
                </section>
            </main>
        </div>
    );
}
