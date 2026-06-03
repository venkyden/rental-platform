'use client';

import { Zap } from 'lucide-react';
import { TFn } from './types';

interface Props {
    t: TFn;
    descriptionEn: string;
    setDescriptionEn: (v: string) => void;
    descriptionFr: string;
    setDescriptionFr: (v: string) => void;
    descLanguage: 'en' | 'fr';
    setDescLanguage: (v: 'en' | 'fr') => void;
    generatingAi: boolean;
    onAiSuggest: () => void;
}

export default function Step7Description({
    t,
    descriptionEn,
    setDescriptionEn,
    descriptionFr,
    setDescriptionFr,
    descLanguage,
    setDescLanguage,
    generatingAi,
    onAiSuggest,
}: Props) {
    return (
        <div className="space-y-10 animate-fade-in">
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                        {t('properties.new.steps.narrative.label')}
                    </label>
                    <button
                        type="button"
                        onClick={onAiSuggest}
                        disabled={generatingAi}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-50"
                    >
                        <Zap className={`w-3.5 h-3.5 ${generatingAi ? 'animate-spin' : ''}`} />
                        {generatingAi ? 'Generating...' : t('properties.new.steps.narrative.aiSuggest')}
                    </button>
                </div>

                {/* Language tabs */}
                <div className="flex gap-4 border-b border-zinc-100 pb-4">
                    {(['en', 'fr'] as const).map((lang) => (
                        <button
                            key={lang}
                            type="button"
                            onClick={() => setDescLanguage(lang)}
                            className={`pb-2 px-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                                descLanguage === lang
                                    ? 'border-zinc-900 text-zinc-900 font-bold'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-600'
                            }`}
                        >
                            {lang === 'en'
                                ? t('properties.new.steps.narrative.englishTab')
                                : t('properties.new.steps.narrative.frenchTab')}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    {descLanguage === 'en' ? (
                        <textarea
                            value={descriptionEn}
                            onChange={(e) => setDescriptionEn(e.target.value)}
                            placeholder={t('properties.new.steps.narrative.descriptionEnPlaceholder')}
                            className="w-full h-64 bg-zinc-50 p-6 rounded-3xl border-none font-medium text-sm text-zinc-600 focus:ring-0 resize-none"
                        />
                    ) : (
                        <textarea
                            value={descriptionFr}
                            onChange={(e) => setDescriptionFr(e.target.value)}
                            placeholder={t('properties.new.steps.narrative.descriptionFrPlaceholder')}
                            className="w-full h-64 bg-zinc-50 p-6 rounded-3xl border-none font-medium text-sm text-zinc-600 focus:ring-0 resize-none"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
