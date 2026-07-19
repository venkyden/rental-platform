'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Share2, FileText, CheckCircle2, Copy } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

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
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);

  useEffect(() => {
    fetchDossiers();
  }, []);

  const fetchDossiers = async () => {
    try {
      const data = await api.get('/v1/dossiers/me');
      setDossiers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompile = async () => {
    setCompiling(true);
    try {
      await api.post('/v1/dossiers/compile', { role: user?.role || 'tenant' });
      await fetchDossiers();
      toast.success(t.common.save); // Generic success
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t.common.errors.failed);
    } finally {
      setCompiling(false);
    }
  };

  const handleShare = async (dossierId: string) => {
    setSharing(dossierId);
    try {
      const res = await api.post('/v1/dossiers/share', { 
        dossier_id: dossierId,
        expires_in_days: 7 
      });
      navigator.clipboard.writeText(res.url);
      toast.success(t.dossier.hub.copied);
    } catch (err) {
      toast.error(t.common.errors.failed);
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
            {t.dossier.hub.title}
          </h1>
          <p className="text-slate-500 mt-2 text-lg">
            {t.dossier.hub.subtitle}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 border-blue-100 dark:border-slate-800">
          <CardHeader>
            <CardTitle>{t.dossier.hub.desc}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Verified by Roomivo</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Your documents stay private</div>
            </div>
            <Button 
              size="lg" 
              onClick={handleCompile} 
              disabled={compiling || loading}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
            >
              <FileText className="mr-2 h-4 w-4" />
              {compiling ? t.dossier.hub.compiling : t.dossier.hub.compileBtn}
            </Button>
          </CardContent>
        </Card>

        {!loading && dossiers.length === 0 && (
          <div className="md:col-span-2 py-12 text-center border-2 border-dashed rounded-xl border-slate-200 dark:border-slate-800">
            <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">{t.dossier.hub.empty}</p>
          </div>
        )}

        {dossiers.map((dossier) => (
          <Card key={dossier.id} className="overflow-hidden">
            <CardHeader className="bg-slate-50 dark:bg-slate-900">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="capitalize">{dossier.role} Dossier</span>
                {dossier.status === 'ready' && <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full">Ready</span>}
              </CardTitle>
              <CardDescription>
                Generated: {new Date(dossier.created_at).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t.dossier.hub.shareDesc}
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                disabled={dossier.status !== 'ready' || sharing === dossier.id}
                onClick={() => handleShare(dossier.id)}
              >
                {sharing === dossier.id ? (
                  <>{t.dossier.hub.generating}</>
                ) : (
                  <><Copy className="mr-2 h-4 w-4" /> {t.dossier.hub.generateLinkBtn}</>
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
