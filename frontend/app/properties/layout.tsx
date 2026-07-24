'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

export default function PropertiesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    // /properties/[id] (public detail page) must be accessible to all users (tenants, unauthenticated users, landlords).
    // Landlord management routes (/properties, /properties/new, /properties/[id]/edit) are restricted to landlords.
    const isLandlordOnlyRoute =
        pathname === '/properties' ||
        pathname === '/properties/new' ||
        pathname?.endsWith('/edit');

    useEffect(() => {
        if (!loading && user && user.role !== 'landlord' && isLandlordOnlyRoute) {
            router.replace('/dashboard');
        }
    }, [user, loading, router, isLandlordOnlyRoute, pathname]);

    // Prevent rendering landlord management interface for non-landlords
    if (user && user.role !== 'landlord' && isLandlordOnlyRoute) {
        return null; // Return null to avoid flash of content on landlord management pages
    }

    return <>{children}</>;
}
