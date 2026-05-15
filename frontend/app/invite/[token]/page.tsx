'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import PremiumLayout from '@/components/PremiumLayout';
import { motion } from 'framer-motion';
import { Mail, CheckCircle2, AlertCircle, Clock, Info, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';

interface InviteInfo {
    email: string;
    name: string;
    status: string;
    landlord_name: string;
    permission_level: string;
    property_count: number;
    expired: boolean;
}

const PERMISSION_LABELS: Record<string, string> = {
    view_only: 'View Only',
    manage_visits: 'Manage Visits',
    full_access: 'Full Access'
};

export default function InviteAcceptPage() {
    const router = useRouter();
    const params = useParams();
    const { user, loading: authLoading } = useAuth();
    const token = params?.token as string;

    const [invite, setInvite] = useState<InviteInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (token) {
            loadInvite();
        }
    }, [token]);

    const loadInvite = async () => {
        try {
            const response = await apiClient.client.get(`/team/invite/${token}`);
            setInvite(response.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Invalid invitation link');
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        if (!user) {
            // Redirect to login with return URL
            router.push(`/auth/login?returnUrl=/invite/${token}`);
            return;
        }

        setAccepting(true);
        setError(null);

        try {
            await apiClient.client.post(`/team/invite/accept/${token}`);
            setSuccess(true);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Error accepting invitation');
        } finally {
            setAccepting(false);
        }
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center font-black uppercase tracking-[0.4em] text-zinc-400 animate-pulse">
                <Loader2 className="w-12 h-12 text-zinc-900 animate-spin mb-6" />
            </div>
        );
    }

    if (error && !invite) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-4">
                <div className="glass-card !p-12 max-w-md w-full text-center shadow-2xl rounded-[3rem]">
                    <div className="w-20 h-20 bg-zinc-900 text-white rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-xl">
                        <AlertCircle className="w-10 h-10" />
                    </div>
                    <h1 className="text-3xl font-black text-zinc-900 mb-4 tracking-tighter uppercase">
                        Invalid Invitation
                    </h1>
                    <p className="text-zinc-500 font-bold mb-10">{error}</p>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full py-5 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl active:scale-95 transition-transform"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-4">
                <div className="glass-card !p-12 max-w-md w-full text-center shadow-2xl rounded-[3rem]">
                    <div className="w-24 h-24 bg-zinc-900 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl">
                        <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <h1 className="text-4xl font-black text-zinc-900 mb-4 tracking-tighter uppercase leading-none">Accepted!</h1>
                    <p className="text-zinc-500 font-bold mb-12">
                        You now have access to {invite?.landlord_name}'s properties
                    </p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="w-full py-5 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl active:scale-95 transition-transform"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (invite?.expired) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-4">
                <div className="glass-card !p-12 max-w-md w-full text-center shadow-2xl rounded-[3rem]">
                    <div className="w-20 h-20 bg-zinc-900 text-white rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-xl">
                        <Clock className="w-10 h-10" />
                    </div>
                    <h1 className="text-3xl font-black text-zinc-900 mb-4 tracking-tighter uppercase">
                        Expired
                    </h1>
                    <p className="text-zinc-500 font-bold mb-10">
                        This invitation has expired. Ask {invite.landlord_name} to send you a new one.
                    </p>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full py-5 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl active:scale-95 transition-transform"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <PremiumLayout withNavbar={true}>
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-zinc-900/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-zinc-900/5 rounded-full blur-[100px]" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03]" />
            </div>

            <div className="max-w-4xl mx-auto px-6 py-20 relative z-10 flex items-center justify-center">
                <motion.div 
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card !p-0 max-w-md w-full overflow-hidden shadow-[0_80px_160px_-40px_rgba(0,0,0,0.4)] rounded-[3.5rem] border-zinc-100"
                >
                    {/* Header */}
                    <div className="bg-zinc-900 text-white p-12 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10" />
                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-xl border border-white/20">
                            <Mail className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter relative z-10 leading-none">
                            You're Invited!
                        </h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mt-4 relative z-10">Roomivo Enterprise</p>
                    </div>

                    {/* Content */}
                    <div className="p-10">
                        <div className="text-center mb-10">
                            <p className="text-lg font-bold text-zinc-900">
                                <strong>{invite?.landlord_name}</strong>
                            </p>
                            <p className="text-sm text-zinc-500 font-bold uppercase tracking-widest mt-1">invites you to join their team</p>
                        </div>

                        {/* Invite Details */}
                        <div className="bg-zinc-50 rounded-[2rem] p-8 mb-10 space-y-4 border border-zinc-100 shadow-inner">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Name</span>
                                <span className="text-sm font-black text-zinc-900 uppercase tracking-tighter">{invite?.name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Email</span>
                                <span className="text-sm font-black text-zinc-900 tracking-tighter">{invite?.email}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Permission</span>
                                <div className="px-3 py-1 bg-zinc-900 text-white text-[9px] font-black rounded-full uppercase tracking-widest">
                                    {PERMISSION_LABELS[invite?.permission_level || ''] || invite?.permission_level}
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Access</span>
                                <span className="text-sm font-black text-zinc-900 uppercase tracking-tighter">{invite?.property_count} {invite?.property_count === 1 ? 'property' : 'properties'}</span>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-zinc-900 text-white p-5 rounded-2xl mb-8 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl text-center">
                                {error}
                            </div>
                        )}

                        {/* Action */}
                        {user ? (
                            <div className="space-y-6">
                                <p className="text-[10px] font-black text-zinc-400 text-center uppercase tracking-widest">
                                    Authenticated as <span className="text-zinc-900">{user.email}</span>
                                </p>
                                {user.email.toLowerCase() !== invite?.email.toLowerCase() && (
                                    <div className="bg-zinc-900 text-white p-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl text-center flex items-center gap-3">
                                        <Info className="w-4 h-4 shrink-0" />
                                        <span>Invitation is for {invite?.email}.</span>
                                    </div>
                                )}
                                <button
                                    onClick={handleAccept}
                                    disabled={accepting || user.email.toLowerCase() !== invite?.email.toLowerCase()}
                                    className="w-full py-6 bg-zinc-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-3"
                                >
                                    {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Accept Invitation'}
                                    {!accepting && <ArrowRight className="w-4 h-4" />}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <button
                                    onClick={() => router.push(`/auth/login?returnUrl=/invite/${token}`)}
                                    className="w-full py-6 bg-zinc-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    Log in to Accept <ArrowRight className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => router.push(`/auth/register?returnUrl=/invite/${token}&email=${invite?.email}`)}
                                    className="w-full py-6 bg-white text-zinc-900 border-2 border-zinc-900 rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] hover:bg-zinc-50 active:scale-95 transition-all"
                                >
                                    Create Account
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </PremiumLayout>
    );
}
