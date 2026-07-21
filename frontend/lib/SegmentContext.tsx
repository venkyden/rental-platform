'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useLanguage } from '@/lib/LanguageContext';

import { useAuth } from '@/lib/useAuth';

interface QuickAction {
    id: string;
    label: string;
    icon: string;
    path: string;
}

interface VerificationStatus {
    id_verified: boolean;
    email_verified: boolean;
    employment_verified: boolean;
    onboarding_completed: boolean;
}

interface SegmentConfig {
    segment: string;
    segment_name: string;
    segment_type: 'demand' | 'supply';
    dashboard_path: string;
    // Feature sets
    common_features: string[];
    segment_features: string[];
    all_features: string[];
    // UI config
    quick_actions: QuickAction[];
    settings: {
        show_verification_prompt?: boolean; // Legacy, kept for compatibility
        show_onboarding_tips?: boolean;
        show_premium_badge?: boolean;
        show_analytics?: boolean;
        show_enterprise_features?: boolean;
        // v3 Settings
        verification_flow?: 'guarantor' | 'income' | 'identity';
        default_filter_mode?: 'budget' | 'location' | 'term';
        analytics_enabled?: boolean;
        enterprise_mode?: boolean;
    };
    // User status
    verification_status: VerificationStatus;
}

interface SegmentContextType {
    config: SegmentConfig | null;
    loading: boolean;
    hasFeature: (feature: string) => boolean;
    isCommonFeature: (feature: string) => boolean;
    verificationStatus: VerificationStatus | null;
    refreshConfig: () => Promise<void>;
}

const SegmentContext = createContext<SegmentContextType>({
    config: null,
    loading: true,
    hasFeature: () => false,
    isCommonFeature: () => false,
    verificationStatus: null,
    refreshConfig: async () => { },
});

export function SegmentProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<SegmentConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const fetchConfig = async () => {
        try {
            const response = await apiClient.client.get('/auth/me/segment-config');
            setConfig(response.data);
        } catch (error: any) {
            // Silently handle 401s as the user might be a guest or session expired
            if (error?.response?.status !== 401) {
                console.error('Failed to fetch segment config:', error);
            }
            setConfig(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchConfig();
        } else {
            setConfig(null);
            setLoading(false);
        }
    }, [user]);

    // Check if user has access to a feature (common OR segment-specific)
    const hasFeature = (feature: string): boolean => {
        if (!config) return false;
        return config.all_features.includes(feature);
    };

    // Check if a feature is a common platform feature
    const isCommonFeature = (feature: string): boolean => {
        return config?.common_features.includes(feature) ?? false;
    };

    return (
        <SegmentContext.Provider value={{
            config,
            loading,
            hasFeature,
            isCommonFeature,
            verificationStatus: config?.verification_status ?? null,
            refreshConfig: fetchConfig
        }}>
            {children}
        </SegmentContext.Provider>
    );
}

export function useSegment() {
    return useContext(SegmentContext);
}

// Feature gate component - only renders children if user has the feature
export function FeatureGate({
    feature,
    children,
    fallback = null
}: {
    feature: string;
    children: ReactNode;
    fallback?: ReactNode;
}) {
    const { hasFeature, loading } = useSegment();

    if (loading) return null;

    return hasFeature(feature) ? <>{children}</> : <>{fallback}</>;
}

// Common feature gate - specifically for common platform features
export function CommonFeatureGate({
    feature,
    requiresVerification = false,
    children,
    fallback = null
}: {
    feature: string;
    requiresVerification?: boolean;
    children: ReactNode;
    fallback?: ReactNode;
}) {
    const { isCommonFeature, verificationStatus, loading } = useSegment();

    if (loading) return null;

    // Check if it's a common feature
    if (!isCommonFeature(feature)) return <>{fallback}</>;

    // If verification required, check status
    if (requiresVerification && !verificationStatus?.id_verified) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

// Quick actions component - renders segment-specific actions
export function QuickActions({ className = '' }: { className?: string }) {
    const { config, loading } = useSegment();
    const { t } = useLanguage();
    
    if (loading || !config) return null;

    // Helper to translate backend labels if a translation exists
    const translateLabel = (label: string) => {
        const key = `dashboard.quickActions.${label.toLowerCase().replace(/\s+/g, '_')}`;
        return t(key, undefined, label);
    };

    return (
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
            {config.quick_actions.map((action) => (
                <Link
                    key={action.id}
                    href={action.path}
                    className="flex flex-col items-center p-6 bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-white/50 hover:shadow-md transition-shadow group"
                >
                    <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">{action.icon}</span>
                    <span className="text-sm text-center font-semibold text-zinc-700 group-hover:text-zinc-950 transition-colors">
                        {translateLabel(action.label)}
                    </span>
                </Link>
            ))}
        </div>
    );
}

// Common actions bar - shows platform-wide actions (verification, profile, etc.)
export function CommonActionsBar({ className = '' }: { className?: string }) {
    const { verificationStatus, loading } = useSegment();
    const { t } = useLanguage();

    if (loading) return null;

    const commonActions = [
        {
            id: 'profile',
            label: t('common.actions.profile', undefined, 'My Profile'),
            icon: '',
            path: '/profile',
            always: true
        },
        {
            id: 'id_verification',
            label: t('common.actions.verification', undefined, 'ID Verification'),
            icon: verificationStatus?.id_verified ? '' : '🆔',
            path: '/verify/identity',
            badge: !verificationStatus?.id_verified ? t('common.actions.toComplete', undefined, 'To complete') : undefined
        },
        {
            id: 'documents',
            label: t('common.actions.documents', undefined, 'Documents'),
            icon: '',
            path: '/documents',
            always: true
        },
        {
            id: 'support',
            label: t('common.actions.help', undefined, 'Help'),
            icon: '',
            path: '/support',
            always: true
        },
    ];

    return (
        <div className={`flex gap-2 ${className}`}>
            {commonActions.map((action) => (
                <Link
                    key={action.id}
                    href={action.path}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-100/50 backdrop-blur-md hover:bg-zinc-100 rounded-lg transition-colors border border-white/20"
                >
                    <span>{action.icon}</span>
                    <span className="font-medium text-zinc-700">{action.label}</span>
                    {action.badge && (
                        <span className="px-1.5 py-0.5 text-xs bg-zinc-900 text-white rounded font-bold uppercase tracking-widest">
                            {action.badge}
                        </span>
                    )}
                </Link>
            ))}
        </div>
    );
}

// Segment badge component
export function SegmentBadge() {
    const { config, loading } = useSegment();

    if (loading || !config) return null;

    const badgeColor = config.segment_type === 'demand'
        ? 'bg-zinc-950 text-white'
        : 'bg-zinc-900 text-zinc-100';

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${badgeColor} border border-white/10`}>
            {config.segment_name}
            {config?.settings?.show_premium_badge && ' (PREMIUM)'}
        </span>
    );
}

// Verification progress component - shows what's completed
export function VerificationProgress() {
    const { verificationStatus, loading } = useSegment();
    const { t } = useLanguage();

    if (loading || !verificationStatus) return null;

    const steps = [
        { key: 'email_verified', label: t('common.verification.email', undefined, 'Email'), done: verificationStatus.email_verified },
        { key: 'onboarding_completed', label: t('common.verification.questionnaire', undefined, 'Questionnaire'), done: verificationStatus.onboarding_completed },
        { key: 'id_verified', label: t('common.verification.identity', undefined, 'Identity'), done: verificationStatus.id_verified },
        { key: 'employment_verified', label: t('common.verification.employment', undefined, 'Employment'), done: verificationStatus.employment_verified },
    ];

    const completed = steps.filter(s => s.done).length;
    const percentage = Math.round((completed / steps.length) * 100);

    return (
        <div className="glass-card !p-6 rounded-[2rem] shadow-xl border-zinc-100">
            <div className="flex justify-between items-center mb-4">
                <span className="font-black text-zinc-950 uppercase text-xs tracking-widest">
                    {t('common.verification.title', undefined, 'Profile Verification')}
                </span>
                <span className="text-xs font-black text-zinc-900">{percentage}%</span>
            </div>
            <div className="w-full bg-zinc-100 rounded-full h-2 mb-4 overflow-hidden border border-zinc-200">
                <div
                    className="bg-zinc-900 h-full rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <div className="grid grid-cols-4 gap-2">
                {steps.map((step) => (
                    <div key={step.key} className="text-center">
                        <div className={`text-lg font-bold mb-1 ${step.done ? 'text-zinc-950' : 'text-zinc-300'}`}>
                            {step.done ? '✓' : '○'}
                        </div>
                        <div className="text-xs font-black text-zinc-400 uppercase tracking-widest">{step.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
