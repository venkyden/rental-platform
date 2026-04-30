'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/useAuth';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import Link from 'next/link';

export default function PrivacySettingsPage() {
    const router = useRouter();
    const { logout } = useAuth();
    const { success, error: showError } = useToast();

    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');

    const handleDeleteAccount = async () => {
        if (deleteConfirmation !== 'DELETE') {
            showError('Please type DELETE to confirm.');
            return;
        }

        setIsDeleting(true);
        try {
            await apiClient.client.delete('/gdpr/delete');
            success('Account successfully deleted.');
            logout();
        } catch (error) {
            console.error('Failed to delete account:', error);
            showError('Failed to delete account. Please try again or contact support.');
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50 flex flex-col">
                <header className="bg-white shadow sticky top-0 z-10">
                    <div className="max-w-3xl mx-auto py-4 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900 transition-colors">
                                ← Back
                            </button>
                            <h1 className="text-xl font-bold text-gray-900">Privacy & GDPR</h1>
                        </div>
                    </div>
                </header>

                <main className="flex-grow max-w-3xl w-full mx-auto py-8 px-4 space-y-8">
                    {/* General Privacy Information */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-2xl">️</span>
                            <h2 className="text-lg font-bold text-gray-900">Data & Privacy</h2>
                        </div>
                        <p className="text-gray-600 mb-4 leading-relaxed">
                            We take your privacy seriously. Your data is handled in accordance with the General Data Protection Regulation (GDPR).
                            You have the right to access, rectify, or erase your personal data at any time.
                        </p>
                        <ul className="space-y-3 text-sm text-gray-600">
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5"></span>
                                <div><strong>Right to Access:</strong> You can request a copy of your data at any time.</div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5"></span>
                                <div><strong>Right to Portability:</strong> We provide your data in a machine-readable format.</div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5"></span>
                                <div><strong>Right to be Forgotten:</strong> You can permanently delete your account and anonymize your data.</div>
                            </li>
                        </ul>
                    </div>

                    {/* Danger Zone */}
                    <div className="bg-red-50 rounded-2xl border border-red-100 p-6 mt-8">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-2xl">️</span>
                            <h2 className="text-lg font-bold text-red-700">Danger Zone</h2>
                        </div>
                        <p className="text-red-600/80 mb-6 text-sm">
                            Permanently delete your account. This action is irreversible. Your profile, properties, preferences, and personal information will be completely anonymized or removed, and you will immediately lose access to the platform.
                        </p>

                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="bg-red-600 text-white font-medium px-6 py-3 rounded-xl hover:bg-red-700 transition-colors shadow-sm w-full md:w-auto"
                        >
                            Delete Account
                        </button>
                    </div>
                </main>

                {/* Delete Confirmation Modal */}
                {showDeleteModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl max-w-md w-full shadow-sm p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Account?</h3>
                            <p className="text-gray-600 mb-6 text-sm">
                                This action cannot be undone. All your personal data will be anonymized per GDPR Article 17.
                                <br /><br />
                                Please type <strong className="text-red-600 select-none">DELETE</strong> to confirm.
                            </p>

                            <input
                                type="text"
                                value={deleteConfirmation}
                                onChange={(e) => setDeleteConfirmation(e.target.value)}
                                placeholder="Type DELETE"
                                className="w-full px-4 py-3 border-2 border-red-100 focus:border-red-500 bg-red-50/50 rounded-xl outline-none transition-all mb-6 text-center font-bold"
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowDeleteModal(false);
                                        setDeleteConfirmation('');
                                    }}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-3 font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteAccount}
                                    disabled={deleteConfirmation !== 'DELETE' || isDeleting}
                                    className={`flex-1 px-4 py-3 font-medium text-white rounded-xl transition-colors flex items-center justify-center gap-2
                                        ${deleteConfirmation === 'DELETE' && !isDeleting
                                            ? 'bg-red-600 hover:bg-red-700 shadow-md '
                                            : 'bg-red-300 cursor-not-allowed'
                                        }`}
                                >
                                    {isDeleting ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Deleting...
                                        </>
                                    ) : (
                                        'Delete Forever'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
