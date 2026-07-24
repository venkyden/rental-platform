'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuthContext } from '@/lib/AuthContext';
import Link from 'next/link';

interface Document {
    id: string;
    document_type: string;
    file_name: string;
    file_url: string;
    created_at: string;
}

const getRequiredDocs = (t: any, user: any) => {
    const role = user?.role || 'tenant';
    const prefs = user?.preferences?.[role] || {};
    const docs = [];

    if (role === 'tenant') {
        docs.push({
            category: t('dossier.category.identity', undefined, 'Identity (Legifrance Category 1)'),
            items: [
                { type: "identity", label: t('dossier.item.identity', undefined, 'ID Document (ID Card, Passport)'), kyc_route: '/verify/identity', verified: user?.identity_verified },
            ]
        });

        docs.push({
            category: t('dossier.category.address', undefined, 'Address (Legifrance Category 2)'),
            items: [
                { type: "proof_of_address", label: t('dossier.item.proof_of_address', undefined, 'Proof of Address (< 3 months)') },
            ]
        });

        const activityItems = [];
        const resourcesItems = [];

        if (prefs.situation === 'student') {
            activityItems.push({ type: "student_card", label: t('dossier.item.student_card', undefined, 'Student Card / School Certificate') });
            resourcesItems.push({ type: "scholarship_proof", label: t('dossier.item.scholarship_proof', undefined, 'Scholarship Notice (If applicable)') });
        } else if (prefs.situation === 'young_professional' || prefs.situation === 'employee' || prefs.contract_type === 'cdi' || prefs.contract_type === 'cdd') {
            activityItems.push({ type: "employer_certificate", label: t('dossier.item.employer_certificate', undefined, 'Employer Certificate / Contract') });
            resourcesItems.push({ type: "pays_slip", label: t('dossier.item.pays_slip', undefined, 'Last 3 Pay Slips') });
            resourcesItems.push({ type: "tax_notice", label: t('dossier.item.tax_notice', undefined, 'Latest Tax Notice'), kyc_route: '/verify/income', verified: user?.employment_verified });
        } else if (prefs.situation === 'self_employed') {
            activityItems.push({ type: "kbis", label: t('dossier.item.kbis', undefined, 'K-bis / SIRENE extract (< 3 months)') });
            resourcesItems.push({ type: "tax_notice", label: t('dossier.item.tax_notice', undefined, 'Latest Tax Notice'), kyc_route: '/verify/income', verified: user?.employment_verified });
            resourcesItems.push({ type: "accounting_balance", label: t('dossier.item.accounting_balance', undefined, 'Accounting Balance') });
        } else if (prefs.situation === 'retired') {
            resourcesItems.push({ type: "pension_proof", label: t('dossier.item.pension', undefined, 'Pension Proof') });
            resourcesItems.push({ type: "tax_notice", label: t('dossier.item.tax_notice', undefined, 'Latest Tax Notice'), kyc_route: '/verify/income', verified: user?.employment_verified });
        } else {
            // Default generic fallback
            activityItems.push({ type: "activity_proof", label: t('dossier.item.activity', undefined, 'Proof of Activity') });
            resourcesItems.push({ type: "income_proof", label: t('dossier.item.income', undefined, 'Proof of Income / Resources') });
        }

        docs.push({
            category: t('dossier.category.status', undefined, 'Professional Activity (Legifrance Category 3)'),
            items: activityItems
        });
        
        docs.push({
            category: t('dossier.category.income', undefined, 'Resources (Legifrance Category 4)'),
            items: resourcesItems
        });

        const guarantorTypes = prefs.guarantor_type || [];
        if (guarantorTypes.length > 0 && !guarantorTypes.includes('none')) {
            const guarantorItems = [];
            if (guarantorTypes.includes('visale')) {
                guarantorItems.push({ type: "visale_certificate", label: t('dossier.item.visale', undefined, 'Visale Certificate'), kyc_route: '/verify/guarantor', verified: false });
            }
            if (guarantorTypes.includes('garantme')) {
                guarantorItems.push({ type: "garantme_certificate", label: t('dossier.item.garantme', undefined, 'Garantme Certificate') });
            }
            if (guarantorTypes.includes('parents') || guarantorTypes.includes('bank')) {
                guarantorItems.push({ type: "guarantor_identity", label: t('dossier.item.guarantor_identity', undefined, 'Guarantor ID Document') });
                guarantorItems.push({ type: "guarantor_proof_address", label: t('dossier.item.guarantor_proof_address', undefined, 'Guarantor Proof of Address') });
                guarantorItems.push({ type: "guarantor_activity", label: t('dossier.item.guarantor_activity', undefined, 'Guarantor Employment Proof') });
                guarantorItems.push({ type: "guarantor_income", label: t('dossier.item.guarantor_income', undefined, 'Guarantor Income Proof') });
            }
            if (guarantorItems.length > 0) {
                docs.push({
                    category: t('dossier.category.guarantor', undefined, 'Guarantor (If applicable)'),
                    items: guarantorItems
                });
            }
        }
    } else if (role === 'landlord') {
        docs.push({
            category: t('dossier.category.identity', undefined, 'Identity'),
            items: [
                { type: "identity", label: t('dossier.item.identity', undefined, 'ID Document (ID Card, Passport)'), kyc_route: '/verify/identity', verified: user?.identity_verified },
            ]
        });
        docs.push({
            category: t('dossier.category.property', undefined, 'Property Ownership'),
            items: [
                { type: "taxe_fonciere", label: t('dossier.item.taxe_fonciere', undefined, 'Taxe Foncière or Property Deed'), kyc_route: '/verification', verified: user?.ownership_verified },
            ]
        });
        docs.push({
            category: t('dossier.category.financial', undefined, 'Financial'),
            items: [
                { type: "rib", label: t('dossier.item.rib', undefined, 'Bank Details (RIB)') },
            ]
        });
    } else if (role === 'property_manager') {
        docs.push({
            category: t('dossier.category.identity', undefined, 'Identity (Legal Representative)'),
            items: [
                { type: "identity", label: t('dossier.item.identity', undefined, 'ID Document (ID Card, Passport)'), kyc_route: '/verify/identity', verified: user?.identity_verified },
            ]
        });
        docs.push({
            category: t('dossier.category.company', undefined, 'Company Details'),
            items: [
                { type: "kbis", label: t('dossier.item.kbis', undefined, 'K-bis (< 3 months)') },
                { type: "carte_pro", label: t('dossier.item.carte_pro', undefined, 'Professional License (Carte G/Pro)') },
            ]
        });
        docs.push({
            category: t('dossier.category.financial', undefined, 'Financial'),
            items: [
                { type: "financial_guarantee", label: t('dossier.item.financial_guarantee', undefined, 'Financial Guarantee Attestation') },
                { type: "rib", label: t('dossier.item.rib', undefined, 'Bank Details (RIB)') },
            ]
        });
    }

    return docs;
};

export default function RentalDossier() {
    const toast = useToast();
    const { t } = useLanguage();
    const { user } = useAuthContext();
    const REQUIRED_DOCS = getRequiredDocs(t, user);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState<string | null>(null);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            const res = await apiClient.client.get('/documents');
            setDocuments(res.data);
        } catch (error) {
            console.error(error);
            toast.error(t('dossier.error.loading', undefined, 'Error loading documents'));
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (file: File, docType: string) => {
        setUploading(docType);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_type', docType);

        try {
            await apiClient.client.post('/documents/upload', formData);
            toast.success(t('dossier.success.upload', undefined, 'Document added!'));
            fetchDocuments();
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.detail || t('dossier.error.upload', undefined, 'Upload failed'));
        } finally {
            setUploading(null);
        }
    };

    const getDocsByType = (type: string) => documents.filter(d => d.document_type === type);

    if (loading) return <div className="p-4 bg-gray-50 rounded animate-pulse">{t('dossier.loading', undefined, 'Loading dossier...')}</div>;

    return (
        <div className="bg-white rounded-xl shadow-lg border border-zinc-100 overflow-hidden mb-8">
            <div className="p-8 bg-zinc-900 text-white">
                <h2 className="text-2xl font-black uppercase tracking-widest"> {t('dossier.title', undefined, 'My Rental Application File')}</h2>
                <p className="text-xs font-bold text-zinc-400 mt-2 leading-relaxed max-w-lg">
                    {t('dossier.subtitle', undefined, 'Compliant with housing regulations. A complete file increases your chances by 80%.')}
                </p>
            </div>

            <div className="p-6 space-y-8">
                {REQUIRED_DOCS.map((cat) => (
                    <div key={cat.category}>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-4 flex items-center gap-2">
                            {cat.category === t('dossier.category.guarantor', undefined, 'Guarantor (If applicable)') ? '🛡️' : ''} {cat.category}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {cat.items.map((item: any) => {
                                const existingDocs = getDocsByType(item.type);
                                const isVerified = item.verified === true;
                                const hasDocs = existingDocs.length > 0;
                                const isSatisfied = isVerified || hasDocs;

                                return (
                                    <div key={item.type} className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-white transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <label className="font-medium text-gray-700 text-sm block cursor-pointer">
                                                {item.label}
                                            </label>
                                            {isSatisfied ? (
                                                <span className="bg-green-600 text-white text-xs px-3 py-1 rounded-full font-black uppercase tracking-widest">
                                                     {isVerified ? t('dossier.status.verified', undefined, 'Verified') : t('dossier.status.received', undefined, 'Received')}
                                                </span>
                                            ) : (
                                                <span className="bg-zinc-100 text-zinc-400 text-xs px-3 py-1 rounded-full font-black uppercase tracking-widest">
                                                    {t('dossier.status.missing', undefined, 'Missing')}
                                                </span>
                                            )}
                                        </div>

                                        {existingDocs.map(doc => (
                                            <div key={doc.id} className="flex items-center gap-2 text-xs font-bold text-zinc-600 mb-2 bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                                                <span>📄 {doc.file_name}</span>
                                            </div>
                                        ))}

                                        <div className="mt-3">
                                            {item.kyc_route && !isVerified ? (
                                                 <Link href={item.kyc_route} className={`
                                                    cursor-pointer flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-solid
                                                    transition-all text-xs font-black uppercase tracking-widest
                                                    border-blue-600 text-white bg-blue-600 hover:bg-blue-700
                                                `}>
                                                    {t('dossier.action.verify', undefined, 'Verify Now')}
                                                </Link>
                                            ) : (
                                                <label className={`
                                                    cursor-pointer flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed
                                                    transition-all text-xs font-black uppercase tracking-widest
                                                    ${uploading === item.type ? 'bg-zinc-50 border-zinc-200 text-zinc-400' : 'border-zinc-200 text-zinc-900 hover:bg-zinc-900 hover:text-white hover:border-zinc-900'}
                                                `}>
                                                    {uploading === item.type ? (
                                                        <span>{t('dossier.action.uploading', undefined, 'Uploading...')} ⏳</span>
                                                    ) : (
                                                        <>
                                                            <span>➕ {t('dossier.action.add', undefined, 'Add')}</span>
                                                            <input
                                                                type="file"
                                                                className="hidden"
                                                                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], item.type)}
                                                                accept=".pdf,.jpg,.png,.jpeg"
                                                            />
                                                        </>
                                                    )}
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                <div className="bg-zinc-900 text-white rounded-2xl p-6 mt-8">
                    <p className="font-black uppercase tracking-widest text-xs mb-4 text-white/50"> {t('dossier.prohibited.title', undefined, 'Prohibited Documents (Never submit):')}</p>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <li className="text-xs font-bold text-zinc-400 flex items-center gap-2 bg-white/5 p-3 rounded-xl">
                            <span className="w-1 h-1 bg-white/20 rounded-full" />
                            {t('dossier.prohibited.item1', undefined, 'Social Security Card')}
                        </li>
                        <li className="text-xs font-bold text-zinc-400 flex items-center gap-2 bg-white/5 p-3 rounded-xl">
                            <span className="w-1 h-1 bg-white/20 rounded-full" />
                            {t('dossier.prohibited.item2', undefined, 'Bank Account Statements')}
                        </li>
                        <li className="text-xs font-bold text-zinc-400 flex items-center gap-2 bg-white/5 p-3 rounded-xl">
                            <span className="w-1 h-1 bg-white/20 rounded-full" />
                            {t('dossier.prohibited.item3', undefined, 'Direct Debit Authorization (before lease signing)')}
                        </li>
                        <li className="text-xs font-bold text-zinc-400 flex items-center gap-2 bg-white/5 p-3 rounded-xl">
                            <span className="w-1 h-1 bg-white/20 rounded-full" />
                            {t('dossier.prohibited.item4', undefined, 'Medical Records / Criminal Record')}
                        </li>
                        <li className="text-xs font-bold text-zinc-400 flex items-center gap-2 bg-white/5 p-3 rounded-xl">
                            <span className="w-1 h-1 bg-white/20 rounded-full" />
                            {t('dossier.prohibited.item5', undefined, 'Reservation Check')}
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
