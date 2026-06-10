
import { CheckCircle2, Shield } from 'lucide-react';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import { PropertyFormData, TFn } from './types';

interface Props {
    formData: PropertyFormData;
    t: TFn;
    mediaSession: { verification_code: string; id: string; expires_at: string } | null;
    publishing: boolean;
    onPublish: () => void;
    onReturn: () => void;
}

export default function Step9Success({ formData, t, mediaSession, publishing, onPublish, onReturn }: Props) {
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
                    captureUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/capture/${mediaSession?.verification_code}`}
                    expiresAt={mediaSession?.expires_at || new Date().toISOString()}
                />
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
