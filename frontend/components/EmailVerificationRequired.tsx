'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { apiClient } from '@/lib/api';
import { useLanguage } from '@/lib/LanguageContext';
import { Check, Mail, ShieldAlert, ArrowLeft } from 'lucide-react';

interface EmailVerificationRequiredProps {
    children: React.ReactNode;
}

/**
 * Helper to determine if a route is a high-trust sensitive route
 * requiring a hard email verification block.
 */
const isSensitiveRoute = (pathname: string | null): boolean => {
    if (!pathname) return false;
    const cleanPath = pathname.replace(/^\/[a-z]{2}(\/|$)/, '/');
    const sensitiveRoutes = [
        /^\/properties\/new$/,
        /^\/properties\/[^/]+\/edit/,
        /^\/applications/,
        /^\/leases/,
        /^\/inventory/,
        /^\/disputes/,
        /^\/verify/,
    ];
    return sensitiveRoutes.some(r => r.test(cleanPath));
};

export default function EmailVerificationRequired({ children }: EmailVerificationRequiredProps) {
    const { t } = useLanguage();
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [resending, setResending] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);

    const handleResendVerification = async () => {
        try {
            setResending(true);
            await apiClient.client.post('/auth/resend-verification');
            setResendSuccess(true);
            setTimeout(() => setResendSuccess(false), 5000);
        } catch (error) {
            console.error('Failed to resend verification:', error);
        } finally {
            setResending(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 relative overflow-hidden">
                <div className="absolute inset-0 z-0 overflow-hidden">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-900/5 blur-[120px] animate-pulse" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-900/5 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
                </div>
                
                <div className="relative z-10 text-center">
                    <div className="relative w-12 h-12 mx-auto mb-4">
                        <div className="absolute inset-0 rounded-full border-2 border-zinc-200" />
                        <div className="absolute inset-0 rounded-full border-2 border-t-zinc-950 animate-spin" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                        {t('emailVerification.loading', undefined, 'Loading...')}
                    </p>
                </div>
            </div>
        );
    }

    // User is logged in but has not verified their email
    if (user && !user.email_verified) {
        const sensitive = isSensitiveRoute(pathname);

        if (sensitive) {
            // Hard Gate: Full-Screen Block
            return (
                <div className="min-h-screen flex items-center justify-center bg-zinc-50 relative overflow-hidden px-4">
                    {/* Background glows */}
                    <div className="absolute inset-0 z-0 overflow-hidden">
                        <div className="absolute top-[20%] left-[10%] w-[50%] h-[50%] rounded-full bg-amber-500/[0.03] blur-[150px] animate-pulse" />
                        <div className="absolute bottom-[20%] right-[10%] w-[50%] h-[50%] rounded-full bg-amber-500/[0.02] blur-[150px]" style={{ animationDelay: '3s' }} />
                    </div>

                    <div className="relative z-10 w-full max-w-md bg-white border border-zinc-200/80 rounded-3xl p-8 shadow-xl shadow-zinc-100/50 text-center">
                        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-amber-50 border border-amber-200/50 flex items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 to-transparent" />
                            <Mail className="w-6 h-6 text-amber-600 relative z-10 animate-bounce" />
                        </div>
                        
                        <h2 className="text-xl font-extrabold text-zinc-900 tracking-tight mb-2">
                            {t('emailVerification.title', undefined, 'Verify Your Email')}
                        </h2>
                        
                        <p className="text-sm text-zinc-500 leading-relaxed mb-8">
                            {t('emailVerification.sentMessage1', undefined, "We've sent a verification link to")}{' '}
                            <span className="font-semibold text-zinc-950 block my-1 truncate bg-zinc-50 py-1.5 px-3 rounded-lg border border-zinc-100 text-xs select-all">
                                {user.email}
                            </span>
                            {t('emailVerification.sentMessage2', undefined, 'Please check your inbox and click the link to continue.')}
                        </p>

                        <div className="space-y-3">
                            {resendSuccess ? (
                                <div className="py-3 px-4 bg-green-50/80 border border-green-200 text-green-700 text-xs font-semibold rounded-2xl flex items-center justify-center gap-2">
                                    <Check className="w-4 h-4 text-green-600" /> {t('emailVerification.success', undefined, 'Verification email sent!')}
                                </div>
                            ) : (
                                <button
                                    onClick={handleResendVerification}
                                    disabled={resending}
                                    className="w-full py-3.5 px-4 bg-zinc-950 text-white hover:bg-zinc-900 font-bold text-sm rounded-2xl transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
                                >
                                    {resending ? t('emailVerification.sending', undefined, 'Sending...') : t('emailVerification.resendButton', undefined, 'Resend Verification Email')}
                                </button>
                            )}

                            <button
                                onClick={() => window.location.reload()}
                                className="w-full py-3.5 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-sm rounded-2xl transition-all active:scale-[0.99]"
                            >
                                {t('emailVerification.alreadyVerified', undefined, "I've verified my email →")}
                            </button>

                            <button
                                onClick={() => router.push('/auth/login')}
                                className="w-full py-2.5 text-xs text-zinc-400 hover:text-zinc-600 transition-colors flex items-center justify-center gap-1.5"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                {t('emailVerification.differentAccount', undefined, 'Sign in with a different account')}
                            </button>
                        </div>

                        <p className="mt-8 text-xs text-zinc-400 leading-normal border-t border-zinc-100 pt-6">
                            {t('emailVerification.spamFolder', undefined, "Can't find the email? Check your spam folder or request a new one.")}
                        </p>
                    </div>
                </div>
            );
        } else {
            // Soft Gate: Persistent Banner + Allow Page Render
            return (
                <div className="flex flex-col min-h-screen">
                    <div className="bg-zinc-950 text-zinc-100 py-3 px-4 shadow-md sticky top-0 z-[100] flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-zinc-800 text-sm select-none">
                        <div className="flex items-center gap-3">
                            <span className="flex h-2.5 w-2.5 relative flex-shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                            </span>
                            <p className="text-xs md:text-sm font-medium leading-tight text-zinc-300">
                                {t('emailVerification.bannerText', undefined, 'Verify your email to secure your account. Link sent to')}{' '}
                                <span className="font-bold text-white underline decoration-amber-500/50 decoration-2 select-all">{user.email}</span>.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            {resendSuccess ? (
                                <span className="text-[11px] font-bold text-green-400 flex items-center gap-1 py-1 px-3 bg-green-950/30 border border-green-800/50 rounded-full">
                                    <Check className="w-3.5 h-3.5" /> {t('emailVerification.bannerSuccess', undefined, 'Sent!')}
                                </span>
                            ) : (
                                <button
                                    onClick={handleResendVerification}
                                    disabled={resending}
                                    className="text-[11px] font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 py-1.5 px-3 rounded-full transition-all disabled:opacity-50"
                                >
                                    {resending ? t('emailVerification.bannerSending', undefined, 'Sending...') : t('emailVerification.bannerResend', undefined, 'Resend Link')}
                                </button>
                            )}
                            <button
                                onClick={() => window.location.reload()}
                                className="text-[11px] font-extrabold text-zinc-950 bg-amber-400 hover:bg-amber-300 py-1.5 px-3.5 rounded-full transition-all flex items-center gap-1 hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                            >
                                <ShieldAlert className="w-3.5 h-3.5 text-zinc-900" />
                                {t('emailVerification.bannerVerified', undefined, 'Refresh')}
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col">
                        {children}
                    </div>
                </div>
            );
        }
    }

    return <>{children}</>;
}
