import React from 'react';
import Navbar from './Navbar';

interface PremiumLayoutProps {
    children: React.ReactNode;
    withNavbar?: boolean;
}

export default function PremiumLayout({ children, withNavbar = false }: PremiumLayoutProps) {
    return (
        <div className="min-h-screen flex flex-col p-4 relative overflow-hidden bg-slate-50 dark:bg-zinc-950">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none fixed">
                <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50/50 via-slate-50 to-white dark:from-teal-900/20 dark:via-zinc-950 dark:to-zinc-950"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-400/10 dark:bg-teal-500/5 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen pointer-events-none"></div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col min-h-full">
                {withNavbar && <Navbar />}
                <main className={`flex-grow w-full ${withNavbar ? 'pb-8' : ''}`}>
                    {children}
                </main>
            </div>
        </div>
    );
}
