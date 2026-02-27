'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api';
import RoomivoBrand from '@/components/RoomivoBrand';

export default function LogoutPage() {
    const router = useRouter();
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        // Start simulated progress bar for the animation
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                return prev + 5;
            });
        }, 50);

        // Perform actual logout logic
        const performLogout = async () => {
            try {
                await apiClient.logout();
                // Clear any local storage/state overrides here if needed
            } catch (error) {
                console.error('Logout error:', error);
            }

            // Redirect smoothly once animation completes (approx 1.2s)
            setTimeout(() => {
                router.push('/auth/login');
            }, 1200);
        };

        performLogout();

        return () => clearInterval(interval);
    }, [router]);

    return (
        <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-full max-w-sm bg-white rounded-2xl shadow-xl shadow-zinc-200/50 p-8 text-center border border-zinc-100 relative overflow-hidden"
            >
                {/* Decorative background glow */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-teal-50 rounded-full blur-3xl opacity-60" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-teal-50 rounded-full blur-3xl opacity-60" />

                <div className="relative z-10">
                    <motion.div
                        animate={{
                            y: [0, -8, 0],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="flex justify-center mb-8"
                    >
                        <RoomivoBrand variant="icon" size="lg" animate={false} />
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-2xl font-bold text-zinc-900 mb-2 tracking-tight"
                    >
                        Signing you out
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-zinc-500 text-sm mb-8"
                    >
                        Securely clearing your session...
                    </motion.p>

                    {/* Premium Progress Bar */}
                    <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-teal-500 rounded-full"
                            initial={{ width: "0%" }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.1 }}
                        />
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
