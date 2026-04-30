'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useLanguage } from '@/lib/LanguageContext';
import { useToast } from '@/lib/ToastContext';
import { leaseApi, Lease } from '@/app/lib/api/lease';
import { disputeApi, DisputeCategory } from '@/app/lib/api/dispute';
import { apiClient } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ShieldAlert, ArrowLeft, UploadCloud, X, Loader2 } from 'lucide-react';

export default function NewDisputePage() {
    const { user } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();
    const toast = useToast();

    const [leases, setLeases] = useState<Lease[]>([]);
    const [loadingLeases, setLoadingLeases] = useState(true);
    
    // Form state
    const [leaseId, setLeaseId] = useState('');
    const [category, setCategory] = useState<DisputeCategory | ''>('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    
    // Upload state
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchLeases = async () => {
            try {
                // If the user is a tenant, we should fetch their leases
                const data = await leaseApi.list();
                setLeases(data);
                if (data.length === 1) {
                    setLeaseId(data[0].id);
                }
            } catch (error) {
                console.error("Failed to fetch leases", error);
                toast.error("Could not load your leases");
            } finally {
                setLoadingLeases(false);
            }
        };
        fetchLeases();
    }, [toast]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!leaseId) {
            toast.error(t('disputes.incident.selectLease', undefined, 'Please select a lease'));
            return;
        }
        if (!category) {
            toast.error(t('disputes.incident.selectCategory', undefined, 'Please select a category'));
            return;
        }

        setSubmitting(true);
        try {
            // Upload files first if any
            let evidenceUrls: string[] = [];
            if (files.length > 0) {
                setUploading(true);
                for (const file of files) {
                    const response = await apiClient.uploadMedia(file, "disputes");
                    if (response.url) evidenceUrls.push(response.url);
                }
                setUploading(false);
            }

            // Create dispute
            await disputeApi.create({
                lease_id: leaseId,
                category: category as DisputeCategory,
                title,
                description,
                evidence_urls: evidenceUrls
            });

            toast.success(t('disputes.incident.success', undefined, 'Incident reported successfully'));
            router.push('/disputes');
        } catch (error: any) {
            console.error("Error creating dispute:", error);
            toast.error(error.response?.data?.detail || t('disputes.incident.error', undefined, 'Failed to report incident'));
        } finally {
            setSubmitting(false);
            setUploading(false);
        }
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4 sm:px-6 lg:px-8 text-zinc-900 dark:text-zinc-100">
                <div className="max-w-3xl mx-auto">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white mb-6 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {t('disputes.back', undefined, 'Back to incidents')}
                    </button>

                    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <div className="px-6 py-8 border-b border-zinc-200 dark:border-zinc-800 bg-red-50/50 dark:bg-red-900/10">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-xl">
                                    <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                                        {t('disputes.report', undefined, 'Report an Incident')}
                                    </h1>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                                        {t('disputes.incident.desc', undefined, 'Provide details about the issue to notify your landlord and our facilitation team.')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Lease Selection */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    {t('disputes.incident.lease', undefined, 'Select Lease')}
                                </label>
                                {loadingLeases ? (
                                    <div className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse w-full"></div>
                                ) : leases.length === 0 ? (
                                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-xl text-sm border border-amber-200 dark:border-amber-900/50">
                                        {t('disputes.incident.noLease', undefined, 'You do not have any active leases to report an incident on.')}
                                    </div>
                                ) : (
                                    <select
                                        value={leaseId}
                                        onChange={(e) => setLeaseId(e.target.value)}
                                        required
                                        className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm focus:border-red-500 focus:ring-red-500 dark:focus:ring-red-500/20 outline-none"
                                    >
                                        <option value="" disabled>-- {t('disputes.incident.selectLease', undefined, 'Select your lease')} --</option>
                                        {leases.map(lease => (
                                            <option key={lease.id} value={lease.id}>
                                                Lease {lease.id.split('-')[0]} - {new Date(lease.start_date || lease.created_at || '').toLocaleDateString()}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    {t('disputes.incident.category', undefined, 'Category')}
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value as DisputeCategory)}
                                    required
                                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm focus:border-red-500 focus:ring-red-500 dark:focus:ring-red-500/20 outline-none"
                                >
                                    <option value="" disabled>-- {t('disputes.incident.selectCategory', undefined, 'Select a category')} --</option>
                                    <option value="damage">{t('disputes.incident.categories.damage', undefined, 'Property Damage')}</option>
                                    <option value="appliance_failure">{t('disputes.incident.categories.appliance', undefined, 'Appliance Failure')}</option>
                                    <option value="cleaning">{t('disputes.incident.categories.cleaning', undefined, 'Cleaning / Hygiene')}</option>
                                    <option value="shared_liability">{t('disputes.incident.categories.shared', undefined, 'Shared Space Issue')}</option>
                                    <option value="other">{t('disputes.incident.categories.other', undefined, 'Other')}</option>
                                </select>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    {t('disputes.incident.title', undefined, 'Issue Title')}
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                    placeholder={t('disputes.incident.titlePlaceholder', undefined, 'Brief description (e.g. Broken Heater)')}
                                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm focus:border-red-500 focus:ring-red-500 dark:focus:ring-red-500/20 outline-none"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    {t('disputes.incident.description', undefined, 'Detailed Description')}
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    required
                                    rows={5}
                                    placeholder={t('disputes.incident.descPlaceholder', undefined, 'Explain what happened in detail...')}
                                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm focus:border-red-500 focus:ring-red-500 dark:focus:ring-red-500/20 outline-none resize-none"
                                />
                            </div>

                            {/* Evidence Upload */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    {t('disputes.incident.evidence', undefined, 'Visual Evidence (Photos/Videos)')}
                                </label>
                                <div className="mt-2">
                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <UploadCloud className="w-8 h-8 text-zinc-400 mb-2" />
                                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                                <span className="font-semibold text-red-600 dark:text-red-400">Click to upload</span> or drag and drop
                                            </p>
                                        </div>
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            multiple 
                                            accept="image/*,video/*"
                                            onChange={handleFileChange}
                                        />
                                    </label>
                                </div>
                                
                                {files.length > 0 && (
                                    <ul className="mt-4 space-y-2">
                                        {files.map((file, index) => (
                                            <li key={index} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                                <span className="text-sm truncate text-zinc-700 dark:text-zinc-300">
                                                    {file.name}
                                                </span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeFile(index)}
                                                    className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {/* Submit */}
                            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                                <button
                                    type="submit"
                                    disabled={submitting || leases.length === 0}
                                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-500/20 disabled:opacity-50 transition-colors"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            {uploading ? t('disputes.incident.uploading', undefined, 'Uploading evidence...') : t('disputes.incident.submitting', undefined, 'Submitting...')}
                                        </>
                                    ) : (
                                        t('disputes.incident.submitBtn', undefined, 'Submit Incident Report')
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
