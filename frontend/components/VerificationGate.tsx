'use client';

import { useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

interface VerificationGateProps {
    children: ReactNode;
    requires: 'identity' | 'email' | 'income' | 'employment' | 'property_docs';
    onVerified?: () => void;
    userType?: 'tenant' | 'landlord';
    className?: string;
}

/**
 * VerificationGate - Gates an action behind verification
 * 
 * Usage:
 * <VerificationGate requires="identity" userType="tenant">
 *   <button onClick={handleApply}>Apply Now</button>
 * </VerificationGate>
 * 
 * If user is verified: renders children normally
 * If not verified: shows verification prompt modal
 */
export default function VerificationGate({
    children,
    requires,
    onVerified,
    userType = 'tenant',
    className
}: VerificationGateProps) {
    const { user } = useAuth();
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);

    // Check verification status based on requirement
    const isVerified = (): boolean => {
        if (!user) return false;

        switch (requires) {
            case 'identity':
                return user.identity_verified === true;
            case 'email':
                return user.email_verified === true;
            case 'income':
                return (user as any).income_verified === true;
            case 'employment':
                return user.employment_verified === true;
            case 'property_docs':
                return (user as any).property_docs_verified === true;
            default:
                return false;
        }
    };

    const getVerificationPath = (): string => {
        switch (requires) {
            case 'identity':
                return '/verification/identity';
            case 'email':
                return '/verification/email';
            case 'income':
                return '/verification/income';
            case 'employment':
                return '/verification/employment';
            case 'property_docs':
                return '/verification/documents';
            default:
                return '/verification';
        }
    };

    const getModalContent = () => {
        if (userType === 'tenant') {
            switch (requires) {
                case 'identity':
                    return {
                        title: '🔐 Verify Your Identity to Apply',
                        description: 'Landlords trust verified tenants. Complete ID verification to submit your application.',
                        benefits: [
                            '✓ Stand out with a verified badge',
                            '✓ Landlords respond 3x faster to verified applicants',
                            '✓ Takes only 2 minutes with your ID'
                        ],
                        buttonText: 'Verify Now'
                    };
                case 'income':
                    return {
                        title: '💼 Verify Your Income',
                        description: 'Show landlords you can afford this property.',
                        benefits: [
                            '✓ Secure bank connection or pay stub upload',
                            '✓ Your data is encrypted and private',
                            '✓ Increases approval chances significantly'
                        ],
                        buttonText: 'Verify Income'
                    };
                default:
                    return {
                        title: '🔐 Verification Required',
                        description: 'Complete verification to continue.',
                        benefits: [],
                        buttonText: 'Verify Now'
                    };
            }
        } else {
            // Landlord
            switch (requires) {
                case 'identity':
                    return {
                        title: '🔐 Verify Your Identity',
                        description: 'Tenants only share their verified profiles with verified landlords.',
                        benefits: [
                            '✓ Access full tenant profiles and documents',
                            '✓ Get a "Verified Landlord" badge on your listings',
                            '✓ Build trust with prospective tenants'
                        ],
                        buttonText: 'Verify Now'
                    };
                case 'property_docs':
                    return {
                        title: '📄 Verify Property Ownership',
                        description: 'Upload proof of ownership to accept applications.',
                        benefits: [
                            '✓ Title deed or property certificate',
                            '✓ Required before signing leases',
                            '✓ Protects both you and tenants'
                        ],
                        buttonText: 'Upload Documents'
                    };
                default:
                    return {
                        title: '🔐 Verification Required',
                        description: 'Complete verification to continue.',
                        benefits: [],
                        buttonText: 'Verify Now'
                    };
            }
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        if (isVerified()) {
            // User is verified, let the action proceed
            if (onVerified) {
                e.preventDefault();
                onVerified();
            }
            // If no onVerified callback, let the original onClick work
        } else {
            // User is not verified, show modal
            e.preventDefault();
            e.stopPropagation();
            setShowModal(true);
        }
    };

    const handleVerifyNow = () => {
        // Store return URL for after verification
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('verification_return_url', window.location.pathname);
        }
        router.push(getVerificationPath());
    };

    const content = getModalContent();

    return (
        <>
            <div onClick={handleClick} className={className}>
                {children}
            </div>

            {/* Verification Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                                🔐
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                {content.title}
                            </h2>
                            <p className="text-gray-600">
                                {content.description}
                            </p>
                        </div>

                        {content.benefits.length > 0 && (
                            <div className="bg-gray-50 rounded-xl p-4 mb-6">
                                <ul className="space-y-2">
                                    {content.benefits.map((benefit, idx) => (
                                        <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                            <span className="text-green-600">{benefit.split(' ')[0]}</span>
                                            <span>{benefit.split(' ').slice(1).join(' ')}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-3 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                            >
                                Later
                            </button>
                            <button
                                onClick={handleVerifyNow}
                                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                            >
                                {content.buttonText}
                            </button>
                        </div>

                        <p className="text-xs text-gray-400 text-center mt-4">
                            🔒 Your data is encrypted and never shared without consent
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
