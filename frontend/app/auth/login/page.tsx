'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import RoomivoBrand from '@/components/RoomivoBrand';

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: any) => void;
                    renderButton: (element: HTMLElement, config: any) => void;
                };
            };
        };
    }
}

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const router = useRouter();

    const handleGoogleResponse = useCallback(async (response: any) => {
        setError('');
        setGoogleLoading(true);
        try {
            const result = await apiClient.googleLogin(response.credential);
            const redirectPath = result.redirect_path || '/dashboard';
            router.push(redirectPath);
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            if (typeof detail === 'string') {
                setError(detail);
            } else {
                setError('Google sign-in failed. Please try again.');
            }
        } finally {
            setGoogleLoading(false);
        }
    }, [router]);

    useEffect(() => {
        // Load Google Identity Services script
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
            if (clientId && window.google) {
                window.google.accounts.id.initialize({
                    client_id: clientId,
                    callback: handleGoogleResponse,
                });
                const buttonDiv = document.getElementById('google-signin-btn');
                if (buttonDiv) {
                    window.google.accounts.id.renderButton(buttonDiv, {
                        theme: 'outline',
                        size: 'large',
                        width: '100%',
                        text: 'signin_with',
                        shape: 'pill',
                    });
                }
            }
        };
        document.body.appendChild(script);
        return () => {
            document.body.removeChild(script);
        };
    }, [handleGoogleResponse]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await apiClient.login(email, password);
            const redirectPath = response.redirect_path || '/dashboard';
            router.push(redirectPath);
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            let errorMessage = 'Login failed. Please try again.';
            if (typeof detail === 'string') {
                errorMessage = detail;
            } else if (Array.isArray(detail)) {
                errorMessage = detail.map(d => d.msg || d.message || JSON.stringify(d)).join(', ');
            } else if (detail && typeof detail === 'object') {
                errorMessage = detail.msg || detail.message || JSON.stringify(detail);
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--background)] py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full animate-fade-in-up">
                {/* Brand */}
                <div className="mb-8">
                    <RoomivoBrand variant="full" size="md" />
                </div>

                {/* Card */}
                <div className="glass-card p-8 space-y-6">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-[var(--foreground)]">
                            Sign in to your account
                        </h2>
                        <p className="mt-2 text-sm text-[var(--gray-500)]">
                            Or{' '}
                            <Link href="/auth/register" className="font-medium text-[var(--primary-500)] hover:text-[var(--primary-600)]">
                                create a new account
                            </Link>
                        </p>
                    </div>

                    {error && (
                        <div className="rounded-xl bg-red-50 border border-red-200 p-4 animate-shake">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    {/* Google Sign-In */}
                    <div>
                        <div id="google-signin-btn" className="flex justify-center" />
                        {googleLoading && (
                            <p className="text-center text-sm text-[var(--gray-500)] mt-2">
                                Signing in with Google...
                            </p>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-[var(--card-border)]" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-[var(--card-bg)] text-[var(--gray-500)]">
                                or continue with email
                            </span>
                        </div>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                                Email address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="input-premium"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className="input-premium"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center justify-end">
                            <Link
                                href="/auth/forgot-password"
                                className="text-sm font-medium text-[var(--primary-500)] hover:text-[var(--primary-600)]"
                            >
                                Forgot your password?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary btn-shine w-full py-3"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Signing in...
                                </span>
                            ) : (
                                'Sign in'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
