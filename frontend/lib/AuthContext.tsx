'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from './api';

interface User {
    id: string;
    email: string;
    full_name: string;
    role: string;
    email_verified: boolean;
    identity_verified: boolean;
    employment_verified: boolean;
    ownership_verified: boolean;
    kbis_verified?: boolean;
    carte_g_verified?: boolean;
    trust_score: number;
    onboarding_completed?: boolean;
    available_roles?: string[];
    onboarding_status?: Record<string, boolean>;
    preferences?: Record<string, any>;
    bio?: string;
    profile_picture_url?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (data: any) => Promise<void>;
    logout: () => void;
    checkAuth: () => Promise<void>;
    switchRole: (targetRole: string) => Promise<any>;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const checkAuth = async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
        if (!token) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            const userData = await apiClient.getMe();
            setUser(userData);
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    const login = async (email: string, password: string) => {
        setLoading(true);
        try {
            const response = await apiClient.login(email, password);
            await checkAuth();
            router.push(response.redirect_path || '/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const register = async (data: any) => {
        setLoading(true);
        try {
            await apiClient.register(data);
            const response = await apiClient.login(data.email, data.password);
            await checkAuth();
            router.push(response.redirect_path || '/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await apiClient.logout();
        } finally {
            setUser(null);
            // router.push is usually redundant if apiClient.logout does window.location.href
            // but we keep it as a fallback
            router.push('/auth/login');
        }
    };

    const switchRole = async (targetRole: string) => {
        setLoading(true);
        try {
            console.log(`[Auth] Switching to role: ${targetRole}`);
            const data = await apiClient.switchRole(targetRole);
            
            // Refresh user data to get new role and available roles
            await checkAuth();
            
            if (data.redirect_path) {
                router.push(data.redirect_path);
            }
            return data;
        } catch (error) {
            console.error('[Auth] Role switch failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };


    return (
        <AuthContext.Provider value={{
            user,
            loading,
            login,
            register,
            logout,
            checkAuth,
            switchRole,
            isAuthenticated: !!user
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuthContext() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuthContext must be used within an AuthProvider');
    }
    return context;
}
