'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useLanguage as useTranslation } from '@/lib/LanguageContext';
import { ShieldCheck, Calendar, Download, Eye, MapPin, Building, Lock, AlertTriangle, FileText } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface ShareDetails {
  id: string;
  dossier_id: string;
  role: string;
  expires_at: string;
  status: string;
}

export default function SharedDossierViewer() {
  const { t } = useTranslation();
  const params = useParams();
  const token = params.token as string;

  const [details, setDetails] = useState<ShareDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) fetchDetails();
  }, [token]);

  const fetchDetails = async () => {
    try {
      const res = await apiClient.client.get(`/dossiers/shared/${token}/meta`);
      setDetails(res.data);
    } catch (err: any) {
      setError(err.response?.status === 404 ? t('dossier.viewer.notFound') : t('common.errors.failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/dossiers/shared/${token}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-pulse flex flex-col items-center">
          <ShieldCheck className="h-12 w-12 text-slate-300 mb-4" />
          <p className="text-slate-500">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('common.errors.title', undefined, 'Error')}</h2>
          <p className="text-slate-500">{error || t('dossier.viewer.notFound')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 flex flex-col items-center">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('dossier.viewer.title')}
          </h1>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Main Content */}
            <div className="md:col-span-2 space-y-6">
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-6 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <h2 className="text-xl font-bold capitalize">{details.role} Dossier</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-300">
                      <p>{t('dossier.viewer.verifiedDesc')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Info */}
            <div className="space-y-6">
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-semibold">{t('dossier.viewer.download')}</h3>
                </div>
                <div className="p-6">
                  <p className="text-sm text-slate-500 mb-4">
                    {t('dossier.viewer.downloadDesc')}
                  </p>
                  <button 
                    onClick={handleDownload}
                    className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center justify-center"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
