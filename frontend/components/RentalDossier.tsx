'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { useLanguage } from '@/lib/LanguageContext';

interface Document {
    id: string;
    document_type: string;
    file_name: string;
    file_url: string;
    created_at: string;
}

const getRequiredDocs = (t: any) => [
    {
        category: t('dossier.category.identity', 'Identity'),
        items: [
            { type: "identity", label: t('dossier.item.identity', 'ID Document (ID Card, Passport)') },
        ]
    },
    {
        category: t('dossier.category.address', 'Address'),
        items: [
            { type: "proof_of_address", label: t('dossier.item.proof_of_address', 'Proof of Address (< 3 months)') },
        ]
    },
    {
        category: t('dossier.category.status', 'Status'),
        items: [
            { type: "student_card", label: t('dossier.item.student_card', 'Student Card / Enrollment Certificate') },
            { type: "employer_certificate", label: t('dossier.item.employer_certificate', 'Employer Certificate / Contract') },
        ]
    },
    {
        category: t('dossier.category.income', 'Income'),
        items: [
            { type: "pays_slip", label: t('dossier.item.pays_slip', 'Last 3 Pay Slips') },
            { type: "scholarship_proof", label: t('dossier.item.scholarship_proof', 'Scholarship Notice') },
            { type: "tax_notice", label: t('dossier.item.tax_notice', 'Latest Tax Notice') },
        ]
    },
    {
        category: t('dossier.category.guarantor', 'Guarantor (If applicable)'),
        items: [
            { type: "guarantor_identity", label: t('dossier.item.guarantor_identity', 'Guarantor ID Document') },
            { type: "guarantor_proof_address", label: t('dossier.item.guarantor_proof_address', 'Guarantor Proof of Address') },
            { type: "guarantor_activity", label: t('dossier.item.guarantor_activity', 'Guarantor Employment Proof') },
            { type: "guarantor_income", label: t('dossier.item.guarantor_income', 'Guarantor Income Proof (> 3x rent)') },
        ]
    }
];

export default function RentalDossier() {
    const toast = useToast();
    const { t } = useLanguage();
    const REQUIRED_DOCS = getRequiredDocs(t);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState<string | null>(null);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            const res = await apiClient.client.get('/documents/me');
            setDocuments(res.data);
        } catch (error) {
            console.error(error);
            toast.error(t('dossier.error.loading', 'Error loading documents'));
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
            await apiClient.client.post('/documents/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success(t('dossier.success.upload', 'Document added!'));
            fetchDocuments();
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.detail || t('dossier.error.upload', 'Upload failed'));
        } finally {
            setUploading(null);
        }
    };

    const getDocsByType = (type: string) => documents.filter(d => d.document_type === type);

    if (loading) return <div className="p-4 bg-gray-50 rounded animate-pulse">{t('dossier.loading', 'Loading dossier...')}</div>;

    return (
        <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-blue-50">
                <h2 className="text-xl font-bold text-gray-900"> {t('dossier.title', 'My Rental Application File')}</h2>
                <p className="text-sm text-gray-600 mt-1">
                    {t('dossier.subtitle', 'Compliant with housing regulations. A complete file increases your chances by 80%.')}
                </p>
            </div>

            <div className="p-6 space-y-8">
                {REQUIRED_DOCS.map((cat) => (
                    <div key={cat.category}>
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            {cat.category === t('dossier.category.guarantor', 'Guarantor (If applicable)') ? '️' : ''} {cat.category}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {cat.items.map((item) => {
                                const existingDocs = getDocsByType(item.type);
                                return (
                                    <div key={item.type} className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-white transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <label className="font-medium text-gray-700 text-sm block cursor-pointer">
                                                {item.label}
                                            </label>
                                            {existingDocs.length > 0 ? (
                                                <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">
                                                     {t('dossier.status.received', 'Received')}
                                                </span>
                                            ) : (
                                                <span className="bg-gray-200 text-gray-500 text-xs px-2 py-1 rounded-full">
                                                    {t('dossier.status.missing', 'Missing')}
                                                </span>
                                            )}
                                        </div>

                                        {existingDocs.map(doc => (
                                            <div key={doc.id} className="flex items-center gap-2 text-xs text-blue-600 mb-2 bg-blue-50 p-1 rounded">
                                                <span> {doc.file_name}</span>
                                            </div>
                                        ))}

                                        <div className="mt-3">
                                            <label className={`
                                                cursor-pointer flex items-center justify-center gap-2 w-full py-2 rounded-lg border-2 border-dashed
                                                transition-all text-sm font-medium
                                                ${uploading === item.type ? 'bg-gray-100 border-gray-300 text-gray-400' : 'border-blue-200 text-blue-600 hover:bg-blue-50'}
                                            `}>
                                                {uploading === item.type ? (
                                                    <span>{t('dossier.action.uploading', 'Uploading...')} ⏳</span>
                                                ) : (
                                                    <>
                                                        <span> {t('dossier.action.add', 'Add')}</span>
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], item.type)}
                                                            accept=".pdf,.jpg,.png,.jpeg"
                                                        />
                                                    </>
                                                )}
                                            </label>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-sm text-red-700 mt-6">
                    <p className="font-bold mb-1"> {t('dossier.prohibited.title', 'Prohibited Documents (Never submit):')}</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>{t('dossier.prohibited.item1', 'Social Security Card')}</li>
                        <li>{t('dossier.prohibited.item2', 'Bank Account Statements')}</li>
                        <li>{t('dossier.prohibited.item3', 'Direct Debit Authorization (before lease signing)')}</li>
                        <li>{t('dossier.prohibited.item4', 'Medical Records / Criminal Record')}</li>
                        <li>{t('dossier.prohibited.item5', 'Reservation Check')}</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
