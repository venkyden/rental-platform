'use client';

import { useState, useEffect } from 'react';
import { useLanguage as useTranslation } from '@/lib/LanguageContext';
import { useAuthContext as useAuth } from '@/lib/AuthContext';
import { ShieldCheck, Share2, FileText, CheckCircle2, Copy } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';

interface Dossier {
  id: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string | null;
}

export default function DossierHub() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDossiers();
  }, []);

  const fetchDossiers = async () => {
    try {
      const res = await apiClient.client.get('/api/v1/dossiers/me');
      setDossiers(res.data);
    } catch (err) {
      console.error(err);
      setError(t('common.errors.failed'));
      toast.error(t('common.errors.failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCompile = async () => {
    setCompiling(true);
    try {
      await apiClient.client.post('/api/v1/dossiers/compile', { role: user?.role || 'tenant' });
      await fetchDossiers();
      toast.success(t('common.save')); // Generic success
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('common.errors.failed'));
    } finally {
      setCompiling(false);
    }
  };

  const handleShare = async (dossierId: string) => {
    setSharing(dossierId);
    try {
      const res = await apiClient.client.post('/api/v1/dossiers/share', { 
        dossier_id: dossierId,
        expires_in_days: 7 
      });
      await navigator.clipboard.writeText(res.data.url);
      toast.success(t('dossier.hub.shareSuccess'));
    } catch (err: any) {
      toast.error(t('dossier.hub.shareError'));
    } finally {
      setSharing(null);
    }
  };

  return (
    <div className="container max-w-4xl py-12 px-4 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-blue-600" />
            {t('dossier.hub.title')}
          </h1>
          <p className="text-slate-500 mt-2 text-lg">
            {t('dossier.hub.subtitle')}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="md:col-span-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 border border-blue-100 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-blue-100/50 dark:border-slate-800/50">
            <h3 className="font-semibold text-lg">{t('dossier.hub.desc')}</h3>
          </div>
          <div className="p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Verified by Roomivo</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Your documents stay private</div>
            </div>
            <button 
              onClick={handleCompile} 
              disabled={compiling || loading}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center justify-center disabled:opacity-50"
            >
              <FileText className="mr-2 h-4 w-4" />
              {compiling ? t('dossier.hub.compiling') : t('dossier.hub.compileBtn')}
            </button>
          </div>
        </div>

        {!loading && !error && dossiers.length === 0 && (
          <div className="md:col-span-2 py-12 text-center border-2 border-dashed rounded-xl border-slate-200 dark:border-slate-800">
            <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">{t('dossier.hub.empty')}</p>
          </div>
        )}

        {error && (
          <div className="md:col-span-2 py-12 text-center border-2 border-red-200 rounded-xl bg-red-50 dark:bg-red-900/20 dark:border-red-900">
            <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
          </div>
        )}

        {dossiers.map((dossier) => (
          <div key={dossier.id} className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="text-lg font-semibold flex items-center justify-between">
                <span className="capitalize">{dossier.role} Dossier</span>
                {dossier.status === 'ready' && <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full">Ready</span>}
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Generated: {new Date(dossier.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t('dossier.hub.shareDesc')}
                </p>
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-2">
              <button 
                className="flex-1 py-2 px-4 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-sm flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                disabled={dossier.status !== 'ready' || sharing === dossier.id}
                onClick={() => handleShare(dossier.id)}
              >
                {sharing === dossier.id ? (
                  <>{t('dossier.hub.generating')}</>
                ) : (
                  <><Copy className="mr-2 h-4 w-4" /> {t('dossier.hub.generateLinkBtn')}</>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
