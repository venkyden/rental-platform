'use client';

import { useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { useLanguage } from '@/lib/LanguageContext';

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
    const { t } = useLanguage();
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
                return '/verify/identity';
            case 'email':
                return '/verify/email';
            case 'income':
                return '/verify/income';
            case 'employment':
                return '/verify/identity';
            case 'property_docs':
                return '/verify/identity';
            default:
                return '/verify/identity';
        }
    };

    const getModalContent = () => {
        const base = userType === 'landlord' ? 'gate.modal.landlord' : 'gate.modal.tenant';
        const key = `${base}.${requires}`;
        const fallback = `${base}.default`;

        const title = t(`${key}.title`, undefined, t(`${fallback}.title`, undefined, 'Verification Required'));
        const description = t(`${key}.description`, undefined, t(`${fallback}.description`, undefined, 'Complete verification to continue.'));
        const cta = t(`${key}.cta`, undefined, t(`${fallback}.cta`, undefined, 'Verify Now'));

        const benefits: string[] = [];
        for (let i = 1; i <= 3; i++) {
            const benefit = t(`${key}.benefit${i}`, undefined, '');
            if (benefit) benefits.push(benefit);
        }

        return { title, description, benefits, buttonText: cta };
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
                    <div className="bg-white rounded-2xl shadow-sm max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <ShieldCheck className="w-8 h-8 text-white" strokeWidth={1.5} />
                            </div>
                            <h2 className="text-2xl font-bold text-zinc-900 mb-2">
                                {content.title}
                            </h2>
                            <p className="text-zinc-600">
                                {content.description}
                            </p>
                        </div>

                        {content.benefits.length > 0 && (
                            <div className="bg-zinc-50 rounded-xl p-4 mb-6">
                                <ul className="space-y-2">
                                    {content.benefits.map((benefit, idx) => (
                                        <li key={idx} className="text-sm text-zinc-700 flex items-start gap-2">
                                            <span className="text-zinc-900 font-semibold">•</span>
                                            <span>{benefit}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-3 text-zinc-500 hover:bg-zinc-50 rounded-xl font-medium transition-colors"
                            >
                                {t('gate.modal.later', undefined, 'Later')}
                            </button>
                            <button
                                onClick={handleVerifyNow}
                                className="flex-1 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:shadow-sm transition-all"
                            >
                                {content.buttonText}
                            </button>
                        </div>

                        <p className="text-xs text-gray-400 text-center mt-4">
                                {t('gate.modal.footerNote', undefined, 'Your data is encrypted and never shared without consent')}
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
