'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Download, AlertTriangle, FileText } from 'lucide-react';
import { api } from '@/lib/api';

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
      // This is a public endpoint, we just pass the token in URL
      const data = await api.get(`/v1/dossiers/share/${token}`);
      setDetails(data);
    } catch (err: any) {
      setError(err.response?.status === 404 ? t.dossier.viewer.notFound : t.common.errors.failed);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    // Navigate to the actual PDF download endpoint
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/v1/dossiers/share/${token}/download`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-pulse flex flex-col items-center">
          <ShieldCheck className="h-12 w-12 text-slate-300 mb-4" />
          <p className="text-slate-500">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <Card className="max-w-md w-full border-red-100 dark:border-red-900/50">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {t.dossier.viewer.expired}
            </h2>
            <p className="text-slate-500">{error || t.dossier.viewer.notFound}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 flex flex-col items-center">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t.dossier.viewer.title}
          </h1>
          <p className="text-slate-500 text-lg max-w-lg mx-auto">
            {t.dossier.viewer.desc}
          </p>
        </div>

        <Card className="border-blue-100 dark:border-slate-800 shadow-lg">
          <CardHeader className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span className="capitalize">{details.role} Dossier</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 flex flex-col items-center text-center space-y-6 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Valid until</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                {new Date(details.expires_at).toLocaleDateString(undefined, {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                })}
              </p>
            </div>
            
            <Button size="lg" onClick={handleDownload} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 shadow-md hover:shadow-lg transition-all">
              <Download className="mr-2 h-5 w-5" />
              {t.dossier.viewer.downloadBtn}
            </Button>
            
            <p className="text-xs text-slate-400 max-w-sm">
              Documents are automatically watermarked to prevent reuse. The verification is mathematically proven by Roomivo.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
