'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

interface User {
    id: string;
    email: string;
    full_name: string;
    role: string;
    email_verified: boolean;
    identity_verified: boolean;
    employment_verified: boolean;
    trust_score: number;
    onboarding_completed?: boolean;
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        checkAuth();
    }, []);

    async function checkAuth() {
        try {
            const userData = await apiClient.getMe();
            setUser(userData);
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }

    async function login(email: string, password: string) {
        await apiClient.login(email, password);
        await checkAuth();
        router.push('/dashboard');
    }

    async function register(data: {
        email: string;
        password: string;
        full_name: string;
        role: 'tenant' | 'landlord' | 'property_manager';
    }) {
        await apiClient.register(data);
        // After registration, automatically log in
        await login(data.email, data.password);
    }

    function logout() {
        apiClient.logout();
        setUser(null);
        router.push('/auth/login');
    }

    return {
        user,
        loading,
        login,
        register,
        logout,
    };
}
