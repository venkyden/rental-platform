'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

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
    const router = useRouter();

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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Create your account
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Already have an account?{' '}
                        <Link
                            href="/auth/login"
                            className="font-medium text-blue-600 hover:text-blue-500"
                        >
                            Sign in
                        </Link>
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="rounded-md bg-red-50 p-4">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}
                    <div className="space-y-4">
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
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading || !formData.gdprConsent}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creating account...' : 'Create account'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
