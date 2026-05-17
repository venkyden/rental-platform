'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

export default function ProtectedRoute({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
            router.push(`/auth/login?returnUrl=${returnUrl}`);
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white relative overflow-hidden">
                {/* Mesh Gradient Background */}
                <div className="absolute inset-0 z-0 overflow-hidden">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-900/5 blur-[120px] animate-pulse" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-900/5 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
                </div>
                
                <div className="relative z-10 text-center">
                    <div className="relative w-16 h-16 mx-auto mb-6">
                        <div className="absolute inset-0 rounded-full border-[3px] border-zinc-100" />
                        <div className="absolute inset-0 rounded-full border-[3px] border-t-zinc-900 animate-spin" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Securing Session...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return <>{children}</>;
}
