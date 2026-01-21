'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import VerificationUpload from '@/components/VerificationUpload';

export default function VerificationPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'identity' | 'employment'>('identity');
    const [refreshKey, setRefreshKey] = useState(0);

    if (!user) return null;

    const handleSuccess = () => {
        // Refresh the page to show updated status
        setRefreshKey(prev => prev + 1);
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 2000);
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-100">
                {/* Header */}
                <header className="bg-white shadow">
                    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                        <h1 className="text-3xl font-bold text-gray-900">Verification</h1>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="text-gray-600 hover:text-gray-900"
                        >
                            ← Back to Dashboard
                        </button>
                    </div>
                </header>

                {/* Main content */}
                <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
                    <div className="px-4 py-6 sm:px-0">
                        {/* Progress Overview */}
                        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Verification Progress</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="text-center p-4 bg-green-50 rounded-lg">
                                    <div className="text-3xl mb-2">✅</div>
                                    <div className="text-sm font-medium text-gray-700">Email</div>
                                    <div className="text-xs text-green-600">Verified</div>
                                </div>
                                <div className={`text-center p-4 rounded-lg ${user.identity_verified ? 'bg-green-50' : 'bg-yellow-50'}`}>
                                    <div className="text-3xl mb-2">{user.identity_verified ? '✅' : '⏳'}</div>
                                    <div className="text-sm font-medium text-gray-700">Identity</div>
                                    <div className={`text-xs ${user.identity_verified ? 'text-green-600' : 'text-yellow-600'}`}>
                                        {user.identity_verified ? 'Verified' : 'Pending'}
                                    </div>
                                </div>
                                <div className={`text-center p-4 rounded-lg ${user.employment_verified ? 'bg-green-50' : 'bg-yellow-50'}`}>
                                    <div className="text-3xl mb-2">{user.employment_verified ? '✅' : '⏳'}</div>
                                    <div className="text-sm font-medium text-gray-700">Employment</div>
                                    <div className={`text-xs ${user.employment_verified ? 'text-green-600' : 'text-yellow-600'}`}>
                                        {user.employment_verified ? 'Verified' : 'Pending'}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                                <div className="text-sm text-gray-700 mb-1">Trust Score</div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                                        <div
                                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
                                            style={{ width: `${user.trust_score}%` }}
                                        />
                                    </div>
                                    <div className="text-2xl font-bold text-blue-600">{user.trust_score}/100</div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="bg-white rounded-t-lg shadow-md">
                            <div className="flex border-b">
                                <button
                                    onClick={() => setActiveTab('identity')}
                                    className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${activeTab === 'identity'
                                        ? 'text-blue-600 border-b-2 border-blue-600'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    🆔 Identity Verification
                                </button>
                                <button
                                    onClick={() => setActiveTab('employment')}
                                    className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${activeTab === 'employment'
                                        ? 'text-blue-600 border-b-2 border-blue-600'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    💼 Employment Verification
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="bg-white rounded-b-lg shadow-md p-6">
                            {activeTab === 'identity' && !user.identity_verified && (
                                <VerificationUpload
                                    key={`identity-${refreshKey}`}
                                    verificationType="identity"
                                    onSuccess={handleSuccess}
                                />
                            )}
                            {activeTab === 'identity' && user.identity_verified && (
                                <div className="text-center py-12">
                                    <div className="text-6xl mb-4">✅</div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Identity Verified!</h3>
                                    <p className="text-gray-600">Your identity has been successfully verified.</p>
                                </div>
                            )}

                            {activeTab === 'employment' && !user.employment_verified && (
                                <VerificationUpload
                                    key={`employment-${refreshKey}`}
                                    verificationType="employment"
                                    onSuccess={handleSuccess}
                                />
                            )}
                            {activeTab === 'employment' && user.employment_verified && (
                                <div className="text-center py-12">
                                    <div className="text-6xl mb-4">✅</div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Employment Verified!</h3>
                                    <p className="text-gray-600">Your employment has been successfully verified.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </ProtectedRoute>
    );
}
