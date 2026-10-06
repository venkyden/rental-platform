'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Check, ScanLine } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

/**
 * Phone wireframes for the landing page thread: each one shows the step it
 * sits beside as the visitor would meet it in the product. Drawn in markup,
 * with no photographs.
 */

const inView = { once: true, margin: '-80px' } as const;

function Phone({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={inView}
      transition={{ duration: 0.6 }}
      className="relative mx-auto flex aspect-[9/15.5] w-[250px] flex-col overflow-hidden rounded-[2.2rem] border-[7px] border-zinc-950 bg-white shadow-[0_44px_70px_-42px_rgba(60,42,10,0.65)]"
    >
      <span className="absolute left-1/2 top-2 z-10 h-1.5 w-14 -translate-x-1/2 rounded-full bg-zinc-950" aria-hidden="true" />
      <div className={`flex flex-1 flex-col px-4 pb-4 pt-8 ${dark ? 'bg-zinc-950 text-white' : 'text-zinc-950'}`}>{children}</div>
    </motion.div>
  );
}

/** A room in a few white lines, used wherever a video would play. */
function RoomLines({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 130" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M40 18h120v70H40zM40 88l-22 34M160 88l22 34" />
      <path d="M56 32h34v36H56zM73 32v36M56 50h34" />
      <path d="M108 64h44v20h-44zM108 64c0-9 6-14 14-14h16c8 0 14 5 14 14M113 84v7M147 84v7" />
    </svg>
  );
}

function Segments({ done, total, dark = false }: { done: number; total: number; dark?: boolean }) {
  return (
    <div className="flex gap-1" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`relative h-1 flex-1 overflow-hidden rounded-full ${dark ? 'bg-white/25' : 'bg-zinc-200'}`}>
          {i < done && (
            <motion.span
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={inView}
              transition={{ delay: 0.5 + i * 0.35, duration: 0.4 }}
              className="absolute inset-0 origin-left rounded-full bg-gold"
            />
          )}
        </span>
      ))}
    </div>
  );
}

function Tick({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-zinc-100 py-2 text-[11.5px] last:border-b-0">
      <span className="flex h-4 w-4 flex-none items-center justify-center rounded-full bg-gold text-white">
        <Check className="h-2.5 w-2.5" strokeWidth={4} aria-hidden="true" />
      </span>
      <span>{children}</span>
    </div>
  );
}

const pill = 'mt-auto rounded-full bg-gold py-3 text-center text-[12px] font-bold text-white';
const ghost = 'mt-2 rounded-full border border-zinc-200 py-3 text-center text-[12px] font-bold text-zinc-700';
const heading = 'font-display text-[17px] font-semibold leading-tight text-zinc-950';
const small = 'text-[10.5px] text-zinc-500';

/** Student, step 1: the room page with its walk-through. */
export function PhoneWatch() {
  const { t } = useLanguage();
  return (
    <Phone>
      <div className="relative -mx-4 -mt-8 flex h-[50%] items-center justify-center bg-zinc-950 text-white/85">
        <RoomLines className="w-[78%]" />
        <span className="absolute flex h-11 w-11 items-center justify-center rounded-full bg-gold pl-0.5 text-sm text-white">▶</span>
        <span className="absolute bottom-2 left-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/80">
          {t('landing.home.screens.watch.tag', undefined, 'Filmed on site · 6 rooms')}
        </span>
      </div>
      <div className="mt-3">
        <Segments done={3} total={6} />
        <p className={`${small} mt-1.5`}>{t('landing.home.screens.watch.rooms', undefined, 'Entrance · Kitchen · Bedroom')}</p>
      </div>
      <p className={`${heading} mt-3`}>{t('landing.home.screens.watch.title', undefined, 'Studio · Lyon 7ᵉ')}</p>
      <p className={small}>{t('landing.home.screens.watch.meta', undefined, 'Furnished · free from 1 September')}</p>
      <div className={pill}>{t('landing.home.screens.watch.button', undefined, 'Apply for this room')}</div>
    </Phone>
  );
}

/** Landlord, step 1: filming one room at a time. */
export function PhoneFilm() {
  const { t } = useLanguage();
  return (
    <Phone dark>
      <p className="font-display text-center text-[16px] leading-tight text-white">{t('landing.home.screens.film.prompt', undefined, 'Show us the kitchen.')}</p>
      <p className="mt-1 text-center text-[10.5px] text-white/60">{t('landing.home.screens.film.hint', undefined, 'Turn slowly so we see all of it.')}</p>
      <div className="mt-3 flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/30 text-white/80">
        <RoomLines className="w-[80%]" />
      </div>
      <div className="mt-3">
        <Segments done={3} total={6} dark />
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[10.5px] text-white/80">
        <span>{t('landing.home.screens.film.count', undefined, 'Room 3 of 6')}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white">
          <span className="h-3.5 w-3.5 rounded-[4px] bg-red-500" />
        </span>
        <span>{t('landing.home.screens.film.next', undefined, 'Next room →')}</span>
      </div>
    </Phone>
  );
}

/** Student, step 2: a document scan that ends in a short result. */
export function PhoneScan() {
  const { t } = useLanguage();
  return (
    <Phone>
      <p className={heading}>{t('landing.home.screens.scan.title', undefined, 'Scan your passport')}</p>
      <div className="mt-3 flex h-[40%] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gold bg-[#fbf3e2] text-[#8a5e07]">
        <ScanLine className="h-7 w-7" aria-hidden="true" />
        <span className="text-[10.5px] font-semibold">{t('landing.home.screens.scan.frame', undefined, 'Hold the photo page in the frame')}</span>
      </div>
      <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={inView} transition={{ delay: 0.9 }} className="mt-3">
        <Tick>{t('landing.home.screens.scan.identity', undefined, 'Identity confirmed')}</Tick>
        <Tick>{t('landing.home.screens.scan.rent', undefined, 'Can cover the rent')}</Tick>
      </motion.div>
      <p className={`${small} mt-auto text-center`}>{t('landing.home.screens.scan.note', undefined, 'Read, confirmed, then deleted.')}</p>
    </Phone>
  );
}

/** Landlord, step 2: an application that arrives as a result, not a folder. */
export function PhoneApplicant() {
  const { t } = useLanguage();
  return (
    <Phone>
      <p className="rounded-2xl rounded-bl-md bg-zinc-100 px-3 py-2 text-[11.5px] text-zinc-800">
        {t('landing.home.screens.applicant.message', undefined, 'Someone applied for your studio.')}
      </p>
      <p className={`${heading} mt-3`}>{t('landing.home.screens.applicant.name', undefined, 'Asha, arriving 1 September')}</p>
      <div className="mt-2">
        <Tick>{t('landing.home.screens.applicant.identity', undefined, 'Identity checked')}</Tick>
        <Tick>{t('landing.home.screens.applicant.rent', undefined, 'Can cover the rent')}</Tick>
        <Tick>{t('landing.home.screens.applicant.visale', undefined, 'Visale certificate valid')}</Tick>
      </div>
      <div className={pill}>{t('landing.home.screens.applicant.accept', undefined, 'Accept')}</div>
      <div className={ghost}>{t('landing.home.screens.applicant.decline', undefined, 'Not this time')}</div>
    </Phone>
  );
}

/** Both sides, step 3: the lease, ready to sign. */
export function PhoneLease() {
  const { t } = useLanguage();
  return (
    <Phone>
      <p className={heading}>{t('landing.home.screens.lease.title', undefined, 'Your lease is ready')}</p>
      <p className={`${small} mt-1`}>{t('landing.home.screens.lease.note', undefined, 'The official French model, filled in from the listing.')}</p>
      <div className="mt-3 space-y-2 rounded-xl border border-zinc-200 p-3" aria-hidden="true">
        {[100, 100, 82, 100, 64, 100, 90, 70].map((w, i) => (
          <span key={i} className="block h-1 rounded-full bg-zinc-200" style={{ width: `${w}%` }} />
        ))}
      </div>
      <svg viewBox="0 0 200 60" className="mt-3 w-full" fill="none" strokeLinecap="round" aria-hidden="true">
        <path d="M24 50h152" stroke="#d4d4d8" strokeWidth="1.5" />
        <motion.path
          d="M30 44c10-26 20-30 24-8s14 12 20-8 14-14 18 4 10 14 24-4 20-10 30 6"
          stroke="#cb8f1b" strokeWidth="3"
          initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={inView} transition={{ delay: 0.7, duration: 1.4 }}
        />
      </svg>
      <div className="mt-auto rounded-full bg-zinc-950 py-3 text-center text-[12px] font-bold text-white">{t('landing.home.screens.lease.button', undefined, 'Sign')}</div>
    </Phone>
  );
}

/** Both sides, step 4: what each side pays Roomivo, laid out like a receipt. */
export function PhoneFee({ tenant }: { tenant: boolean }) {
  const { t } = useLanguage();
  const free = t('landing.home.screens.fee.free', undefined, 'Free');
  const fee = t('landing.home.screens.fee.fee', undefined, 'One small fee');
  const rows = tenant
    ? [
        [t('landing.home.screens.fee.tenant.look', undefined, 'Looking around'), free],
        [t('landing.home.screens.fee.tenant.apply', undefined, 'Applying'), free],
        [t('landing.home.screens.fee.tenant.confirmed', undefined, 'Room confirmed'), fee],
      ]
    : [
        [t('landing.home.screens.fee.landlord.list', undefined, 'Listing your place'), free],
        [t('landing.home.screens.fee.landlord.applications', undefined, 'Receiving applications'), free],
        [t('landing.home.screens.fee.landlord.signed', undefined, 'Lease signed'), fee],
      ];
  return (
    <Phone>
      <div className="flex items-center gap-2">
        <Image src="/images/roomivo-icon.png" alt="" width={56} height={56} className="h-7 w-7 flex-none" />
        <p className={heading}>{t('landing.home.screens.fee.title', undefined, 'What you pay Roomivo')}</p>
      </div>
      <div className="mt-4 border-t-2 border-zinc-950">
        {rows.map(([label, value], i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={inView}
            transition={{ delay: 0.4 + i * 0.25 }}
            className="flex items-baseline justify-between gap-3 border-b border-zinc-200 py-3 text-[12px]"
          >
            <span className="text-zinc-700">{label}</span>
            <span className={`font-display text-[14px] font-semibold ${value === fee ? 'text-[#8a5e07]' : 'text-zinc-950'}`}>{value}</span>
          </motion.div>
        ))}
        <div className="flex items-baseline justify-between gap-3 py-3 text-[12px]">
          <span className="text-zinc-700">{t('landing.home.screens.fee.after', undefined, 'After that')}</span>
          <span className="font-display text-[14px] font-semibold text-zinc-950">{t('landing.home.screens.fee.nothing', undefined, 'Nothing')}</span>
        </div>
      </div>
      <p className="mt-auto rounded-[3px] border-2 border-gold py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a5e07]">
        {t('landing.home.stamp.line2', undefined, 'Pay for nothing more')}
      </p>
    </Phone>
  );
}
