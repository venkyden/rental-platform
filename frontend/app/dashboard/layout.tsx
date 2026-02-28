'use client';

import React from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                {children}
            </PremiumLayout>
        </ProtectedRoute>
    );
}

