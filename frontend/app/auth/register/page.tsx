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

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        role: 'tenant' as 'tenant' | 'landlord' | 'property_manager',
        gdprConsent: false,
        marketingConsent: false,
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState({ valid: false, message: '' });
    const [googleLoading, setGoogleLoading] = useState(false);
    const router = useRouter();

    const handleGoogleResponse = useCallback(async (response: any) => {
        if (!formData.role) return;
        setError('');
        setGoogleLoading(true);
        try {
            const result = await apiClient.googleLogin(response.credential, formData.role);
            const redirectPath = result.redirect_path || '/onboarding';
            router.push(redirectPath);
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            if (typeof detail === 'string') {
                setError(detail);
            } else {
                setError('Google sign-up failed. Please try again.');
            }
        } finally {
            setGoogleLoading(false);
        }
    }, [formData.role, router]);

    useEffect(() => {
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
                const buttonDiv = document.getElementById('google-signup-btn');
                if (buttonDiv) {
                    window.google.accounts.id.renderButton(buttonDiv, {
                        theme: 'outline',
                        size: 'large',
                        width: '100%',
                        text: 'signup_with',
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

    function handleChange(
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) {
        const target = e.target;
        const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
        const name = target.name;

        setFormData({
            ...formData,
            [name]: value,
        });

        // Validate password on change
        if (name === 'password') {
            validatePassword(value as string);
        }
    }

    function validatePassword(password: string) {
        const checks = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
        };

        const allValid = Object.values(checks).every(Boolean);
        const messages = [];
        if (!checks.length) messages.push('8+ characters');
        if (!checks.uppercase) messages.push('uppercase letter');
        if (!checks.lowercase) messages.push('lowercase letter');
        if (!checks.number) messages.push('number');
        if (!checks.special) messages.push('special character');

        setPasswordStrength({
            valid: allValid,
            message: allValid ? 'Strong password ✓' : `Missing: ${messages.join(', ')}`,
        });

        return allValid;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        // Validation
        if (!formData.gdprConsent) {
            setError('You must accept the Privacy Policy to create an account');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (!validatePassword(formData.password)) {
            setError('Password does not meet security requirements');
            return;
        }

        setLoading(true);

        try {
            // Register
            await apiClient.register({
                email: formData.email,
                password: formData.password,
                full_name: formData.full_name,
                role: formData.role,
                marketing_consent: formData.marketingConsent,
            });

            // Login automatically after registration
            await apiClient.login(formData.email, formData.password);

            // Redirect to onboarding questionnaire
            router.push('/onboarding');
        } catch (err: any) {
            // Handle both string and object error formats from the API
            const detail = err.response?.data?.detail;
            let errorMessage = 'Registration failed. Please try again.';
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
                <div className="mb-8">
                    <RoomivoBrand variant="full" size="md" />
                </div>

                <div className="glass-card p-8 space-y-6">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-[var(--foreground)]">
                            Create your account
                        </h2>
                        <p className="mt-2 text-sm text-[var(--gray-500)]">
                            Already have an account?{' '}
                            <Link href="/auth/login" className="font-medium text-[var(--primary-500)] hover:text-[var(--primary-600)]">
                                Sign in
                            </Link>
                        </p>
                    </div>

                    {error && (
                        <div className="rounded-xl bg-red-50 border border-red-200 p-4 animate-shake">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    {/* Google Sign-Up */}
                    <div>
                        <div id="google-signup-btn" className="flex justify-center" />
                        {googleLoading && (
                            <p className="text-center text-sm text-[var(--gray-500)] mt-2">
                                Creating account with Google...
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
                                or register with email
                            </span>
                        </div>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <div>
                            <label
                                htmlFor="full_name"
                                className="block text-sm font-medium text-gray-700"
                            >
                                Full Name
                            </label>
                            <input
                                id="full_name"
                                name="full_name"
                                type="text"
                                required
                                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="John Doe"
                                value={formData.full_name}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-gray-700"
                            >
                                Email address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="role"
                                className="block text-sm font-medium text-gray-700"
                            >
                                I am a
                            </label>
                            <select
                                id="role"
                                name="role"
                                required
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                value={formData.role}
                                onChange={handleChange}
                            >
                                <option value="tenant">Tenant (looking for property)</option>
                                <option value="landlord">Landlord (listing property)</option>
                                <option value="property_manager">Property Manager (managing properties)</option>
                            </select>
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-gray-700"
                            >
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="Min. 8 characters with uppercase, number & special char"
                                value={formData.password}
                                onChange={handleChange}
                            />
                            {formData.password && (
                                <p className={`mt-1 text-xs ${passwordStrength.valid ? 'text-green-600' : 'text-amber-600'}`}>
                                    {passwordStrength.message}
                                </p>
                            )}
                        </div>

                        <div>
                            <label
                                htmlFor="confirmPassword"
                                className="block text-sm font-medium text-gray-700"
                            >
                                Confirm Password
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                required
                                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="Re-type password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                            />
                        </div>

                        {/* GDPR Consent - Required for France */}
                        <div className="space-y-3 pt-4 border-t border-gray-200">
                            <div className="flex items-start">
                                <div className="flex items-center h-5">
                                    <input
                                        id="gdprConsent"
                                        name="gdprConsent"
                                        type="checkbox"
                                        required
                                        checked={formData.gdprConsent}
                                        onChange={handleChange}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                </div>
                                <div className="ml-3 text-sm">
                                    <label htmlFor="gdprConsent" className="font-medium text-gray-700">
                                        I accept the{' '}
                                        <Link href="/privacy" className="text-blue-600 hover:text-blue-500 underline">
                                            Privacy Policy
                                        </Link>
                                        {' '}and{' '}
                                        <Link href="/terms" className="text-blue-600 hover:text-blue-500 underline">
                                            Terms of Service
                                        </Link>
                                        {' '}<span className="text-red-500">*</span>
                                    </label>
                                    <p className="text-gray-500 text-xs mt-1">
                                        Your data is processed in accordance with GDPR regulations.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start">
                                <div className="flex items-center h-5">
                                    <input
                                        id="marketingConsent"
                                        name="marketingConsent"
                                        type="checkbox"
                                        checked={formData.marketingConsent}
                                        onChange={handleChange}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                </div>
                                <div className="ml-3 text-sm">
                                    <label htmlFor="marketingConsent" className="text-gray-700">
                                        I agree to receive promotional emails (optional)
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading || !formData.gdprConsent}
                                className="btn-primary btn-shine w-full py-3"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Creating account...
                                    </span>
                                ) : (
                                    'Create account'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
