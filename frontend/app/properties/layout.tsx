'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

export default function PropertiesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user && user.role !== 'landlord') {
            router.replace('/dashboard');
        }
    }, [user, loading, router]);

    // Prevent rendering properties interface for tenants
    if (user && user.role !== 'landlord') {
        return null; // Return null to avoid flash of content
    }

    return <>{children}</>;
}
