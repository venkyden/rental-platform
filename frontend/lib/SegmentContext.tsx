'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '@/lib/api';

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

    const fetchConfig = async () => {
        try {
            const response = await apiClient.client.get('/auth/me/segment-config');
            setConfig(response.data);
        } catch (error) {
            console.error('Failed to fetch segment config:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (token) {
            fetchConfig();
        } else {
            setLoading(false);
        }
    }, []);

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

    if (loading || !config) return null;

    return (
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
            {config.quick_actions.map((action) => (
                <a
                    key={action.id}
                    href={action.path}
                    className="flex flex-col items-center p-4 bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow"
                >
                    <span className="text-2xl mb-2">{action.icon}</span>
                    <span className="text-sm text-center font-medium text-gray-700">
                        {action.label}
                    </span>
                </a>
            ))}
        </div>
    );
}

// Common actions bar - shows platform-wide actions (verification, profile, etc.)
export function CommonActionsBar({ className = '' }: { className?: string }) {
    const { verificationStatus, loading } = useSegment();

    if (loading) return null;

    const commonActions = [
        {
            id: 'profile',
            label: 'My Profile',
            icon: '👤',
            path: '/profile',
            always: true
        },
        {
            id: 'id_verification',
            label: 'ID Verification',
            icon: verificationStatus?.id_verified ? '✅' : '🆔',
            path: '/verify/identity',
            badge: !verificationStatus?.id_verified ? 'To complete' : undefined
        },
        {
            id: 'documents',
            label: 'Documents',
            icon: '📄',
            path: '/documents',
            always: true
        },
        {
            id: 'support',
            label: 'Help',
            icon: '❓',
            path: '/support',
            always: true
        },
    ];

    return (
        <div className={`flex gap-2 ${className}`}>
            {commonActions.map((action) => (
                <a
                    key={action.id}
                    href={action.path}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                    <span>{action.icon}</span>
                    <span>{action.label}</span>
                    {action.badge && (
                        <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                            {action.badge}
                        </span>
                    )}
                </a>
            ))}
        </div>
    );
}

// Segment badge component
export function SegmentBadge() {
    const { config, loading } = useSegment();

    if (loading || !config) return null;

    const bgColor = config.segment_type === 'demand'
        ? 'bg-blue-100 text-blue-800'
        : 'bg-green-100 text-green-800';

    return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${bgColor}`}>
            {config.segment_name}
            {config.settings.show_premium_badge && ' ⭐'}
        </span>
    );
}

// Verification progress component - shows what's completed
export function VerificationProgress() {
    const { verificationStatus, loading } = useSegment();

    if (loading || !verificationStatus) return null;

    const steps = [
        { key: 'email_verified', label: 'Email', done: verificationStatus.email_verified },
        { key: 'onboarding_completed', label: 'Questionnaire', done: verificationStatus.onboarding_completed },
        { key: 'id_verified', label: 'Identity', done: verificationStatus.id_verified },
        { key: 'employment_verified', label: 'Employment', done: verificationStatus.employment_verified },
    ];

    const completed = steps.filter(s => s.done).length;
    const percentage = Math.round((completed / steps.length) * 100);

    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-900">Profile Verification</span>
                <span className="text-sm text-gray-500">{percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <div className="grid grid-cols-4 gap-2">
                {steps.map((step) => (
                    <div key={step.key} className="text-center">
                        <div className={`text-lg ${step.done ? 'text-green-500' : 'text-gray-300'}`}>
                            {step.done ? '✓' : '○'}
                        </div>
                        <div className="text-xs text-gray-500">{step.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
