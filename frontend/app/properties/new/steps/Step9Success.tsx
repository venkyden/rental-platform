'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Shield, Camera, RefreshCw } from 'lucide-react';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import { apiClient } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { PropertyFormData, TFn, DpeWarning } from './types';

interface CapturedPhoto {
    url: string;
    room_label?: string;
    captured_at?: string;
}

interface Props {
    formData: PropertyFormData;
    t: TFn;
    language: string;
    propertyId: string | null;
    mediaSession: { verification_code: string; id: string; expires_at: string } | null;
    publishing: boolean;
    onPublish: () => void;
    onReturn: () => void;
}

export default function Step9Success({ formData, t, language, propertyId, mediaSession, publishing, onPublish, onReturn }: Props) {
    const [dpeAcknowledged, setDpeAcknowledged] = useState(false);
    const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
    const [isPolling, setIsPolling] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchPhotos = async () => {
        if (!propertyId) return;
        try {
            const res = await apiClient.client.get(`/properties/${propertyId}`);
            const photos = Array.isArray(res.data.photos)
                ? res.data.photos
                : res.data.photos?.urls?.map((url: string) => ({ url })) ?? [];
            setCapturedPhotos(photos);
            setLastRefreshed(new Date());
        } catch {
            // silent — polling will retry
        }
    };

    // Start polling when component mounts and stop when publishing
    useEffect(() => {
        if (!propertyId) return;
        setIsPolling(true);
        fetchPhotos();
        pollIntervalRef.current = setInterval(fetchPhotos, 5000);
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, [propertyId]);

    // Stop polling once publishing starts
    useEffect(() => {
        if (publishing && pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            setIsPolling(false);
        }
    }, [publishing]);

    const isDepositLimitExceeded =
        formData.deposit !== undefined &&
        formData.monthly_rent > 0 &&
        formData.deposit > formData.monthly_rent * (formData.furnished ? 2 : 1);
    const isDpeGBanned = formData.dpe_rating === 'G';
    const isSizeTooSmall = formData.size_sqm < 9;
    const hasHardComplianceErrors = isDpeGBanned || isSizeTooSmall || isDepositLimitExceeded;

    return (
        <div className="text-center space-y-12">
            <div className="w-32 h-32 bg-zinc-900 rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl shadow-zinc-900/20">
                <CheckCircle2 className="w-16 h-16 text-white" />
            </div>
            <div className="space-y-6">
                <h2 className="text-5xl font-black tracking-tighter uppercase">
                    {t('properties.new.steps.success.title')}
                </h2>
                <p className="text-xl text-zinc-500 font-medium max-w-md mx-auto">
                    {t('properties.new.steps.success.description')}
                </p>
            </div>

            <div className="glass-card !p-12 rounded-[4rem] inline-block shadow-2xl">
                <QRCodeDisplay
                    verificationCode={mediaSession?.verification_code || ''}
                    captureUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/capture/${mediaSession?.id}`}
                    expiresAt={mediaSession?.expires_at || new Date().toISOString()}
                />
            </div>

            {/* Live photo feed */}
            <div className="w-full max-w-md mx-auto">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Camera className="w-4 h-4 text-zinc-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                            Captured Media
                        </span>
                        {capturedPhotos.length > 0 && (
                            <span className="px-3 py-1 bg-zinc-900 text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                                {capturedPhotos.length}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {isPolling && (
                            <RefreshCw className="w-3 h-3 text-zinc-300 animate-spin" />
                        )}
                        {lastRefreshed && (
                            <span className="text-[9px] text-zinc-300 font-medium">
                                Live
                            </span>
                        )}
                    </div>
                </div>

                {capturedPhotos.length === 0 ? (
                    <div className="border-2 border-dashed border-zinc-100 rounded-[2rem] p-10 text-center">
                        <Camera className="w-8 h-8 text-zinc-200 mx-auto mb-3" />
                        <p className="text-xs font-black uppercase tracking-widest text-zinc-300">
                            Scan QR code on your phone to capture photos
                        </p>
                        <p className="text-[10px] text-zinc-200 mt-2 font-medium">
                            Photos will appear here automatically
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3">
                        {capturedPhotos.map((photo, i) => (
                            <div
                                key={i}
                                className="aspect-square rounded-2xl overflow-hidden bg-zinc-100 relative group"
                            >
                                <img
                                    src={resolveMediaUrl(photo.url || (photo as any))}
                                    alt={photo.room_label || `Photo ${i + 1}`}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                                {photo.room_label && (
                                    <div className="absolute bottom-0 inset-x-0 bg-black/50 px-2 py-1">
                                        <span className="text-[8px] font-black uppercase tracking-wider text-white truncate block">
                                            {photo.room_label}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="pt-12 flex flex-col gap-6">
                {hasHardComplianceErrors && (
                    <div
                        className="p-6 bg-red-50/80 backdrop-blur-md border border-red-200/50 rounded-3xl max-w-md mx-auto text-left space-y-3 mb-4 animate-fade-in"
                        role="alert"
                    >
                        <div className="flex items-center gap-2 text-red-800 font-black text-xs uppercase tracking-wider">
                            <Shield className="w-4 h-4 text-red-600 animate-pulse" />
                            <span>{t('common.requiredByLaw', undefined, 'Required by Law')}</span>
                        </div>
                        <ul className="list-disc pl-5 space-y-2 text-xs font-bold text-red-600">
                            {isDpeGBanned && (
                                <li>{t('property.create.errors.dpeGBan', undefined, 'Properties with DPE G rating are banned from rental since January 2023.')}</li>
                            )}
                            {isSizeTooSmall && (
                                <li>{t('properties.new.steps.pricing.decencyWarning')} (Min 9m²)</li>
                            )}
                            {isDepositLimitExceeded && (
                                <li>
                                    {t(formData.furnished
                                        ? 'properties.new.steps.pricing.depositWarningFurnished'
                                        : 'properties.new.steps.pricing.depositWarningUnfurnished')}
                                </li>
                            )}
                        </ul>
                    </div>
                )}
                <button
                    onClick={onPublish}
                    disabled={publishing || hasHardComplianceErrors}
                    className="px-16 py-6 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                    {publishing
                        ? t('properties.new.steps.success.synchronizing')
                        : t('properties.new.steps.success.forcePublish')}
                </button>
                <button
                    onClick={onReturn}
                    className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 hover:text-zinc-900 transition-colors"
                >
                    {t('properties.new.steps.success.return')}
                </button>
            </div>
        </div>
    );
}
