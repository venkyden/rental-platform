'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ScanSearch, FileSignature, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

/**
 * The credential layer — Roomivo's core, presented as a product.
 * Verify → signed short-lived credential → source documents forgotten.
 * Includes the anti-phishing verify-by-code box: users type the code on
 * the canonical domain instead of trusting links.
 */
export default function CredentialLayerSection() {
  const { t } = useLanguage();
  const router = useRouter();
  const [code, setCode] = useState('');

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed) router.push(`/c/${encodeURIComponent(trimmed)}`);
  };

  const steps = [
    {
      icon: <ScanSearch className="w-7 h-7" />,
      title: t('landing.credential.steps.verify.title', undefined, 'Both sides verified'),
      desc: t('landing.credential.steps.verify.desc', undefined, 'Tenants prove they can pay. Landlords prove the home is theirs to rent. Before anyone commits.'),
    },
    {
      icon: <FileSignature className="w-7 h-7" />,
      title: t('landing.credential.steps.issue.title', undefined, 'Proof that travels'),
      desc: t('landing.credential.steps.issue.desc', undefined, 'You get signed, tamper-evident proof you can share anywhere — even outside Roomivo.'),
    },
    {
      icon: <EyeOff className="w-7 h-7" />,
      title: t('landing.credential.steps.forget.title', undefined, 'Nothing left to leak'),
      desc: t('landing.credential.steps.forget.desc', undefined, 'Once checked, your documents are deleted. You share results — never paperwork.'),
    },
  ];

  return (
    <section className="py-24 sm:py-40 bg-zinc-900 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/3 w-[600px] h-[400px] bg-white/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="max-w-3xl mb-20">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2.5 px-4 py-2 bg-white text-zinc-900 rounded-full text-xs font-bold uppercase tracking-wider mb-8"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{t('landing.credential.badge', undefined, 'The Trust Layer')}</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight mb-6"
          >
            {t('landing.credential.title', undefined, 'One verification. Portable, signed proof.')}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-zinc-400 text-lg leading-relaxed"
          >
            {t('landing.credential.subtitle', undefined, "Verification that protects both sides — without your paperwork ending up in a stranger's inbox.")}
          </motion.p>
        </div>

        {/* Three steps */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.8 }}
              className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-sm"
            >
              <div className="w-14 h-14 rounded-2xl bg-white text-zinc-900 flex items-center justify-center mb-6 shadow-xl">
                {step.icon}
              </div>
              <h3 className="text-xl font-black text-white tracking-tight mb-3">
                {step.title}
              </h3>
              <p className="text-zinc-400 text-sm font-medium leading-relaxed">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Portability + verify-by-code */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid lg:grid-cols-2 gap-8 items-center bg-white/5 border border-white/10 rounded-[2.5rem] p-8 sm:p-12"
        >
          <div>
            <p className="text-white text-lg sm:text-xl font-bold leading-relaxed mb-3">
              {t('landing.credential.portable', undefined, 'Your credential works anywhere — share the link or code on any listing site.')}
            </p>
            <p className="text-zinc-400 text-sm font-medium leading-relaxed">
              {t('landing.credential.verifyBox.desc', undefined, 'Someone sent you a Roomivo credential? Don’t trust the link — type its code here yourself.')}
            </p>
          </div>

          <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3">
            <label htmlFor="credential-code" className="sr-only">
              {t('landing.credential.verifyBox.title', undefined, 'Verify a credential')}
            </label>
            <input
              id="credential-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('landing.credential.verifyBox.placeholder', undefined, 'Credential code')}
              className="flex-1 px-6 py-4 rounded-2xl bg-white/10 border border-white/10 text-white placeholder:text-zinc-500 font-mono text-sm focus:ring-2 focus:ring-white/30 focus:border-white/30 outline-none"
            />
            <button
              type="submit"
              disabled={!code.trim()}
              className="px-8 py-4 bg-white text-zinc-900 rounded-2xl font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100"
            >
              {t('landing.credential.verifyBox.button', undefined, 'Check')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </motion.div>
      </div>
    </section>
  );
}
