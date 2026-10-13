'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { formatMonth, parseSearch, suggestCities, toSearchUrl } from '@/lib/smartSearch';
import { PhoneApplicant, PhoneFee, PhoneFilm, PhoneLease, PhoneScan, PhoneWatch } from './screens';

type Audience = 'tenant' | 'landlord';

/**
 * The home page body, for both audiences. The switch swaps the hero copy and
 * call to action (sentence search for a student, "List my place" for an owner)
 * and the copy and wireframes of the four stops; the final call is shared.
 * The vertical gold line beside the stops fills on scroll. Text never depends
 * on an animation to be visible; motion follows the visitor's reduced-motion
 * setting.
 */
export default function HomeExperience() {
  const [audience, setAudience] = useState<Audience>('tenant');

  return (
    <MotionConfig reducedMotion="user">
      <div data-testid="home-experience" className="relative bg-[#fffdf7] text-zinc-950">
        <div className="paper-grain pointer-events-none absolute inset-0" aria-hidden="true" />
        <Hero audience={audience} onAudience={setAudience} />
        <Thread audience={audience} />
        <FinalCall />
      </div>
    </MotionConfig>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero({ audience, onAudience }: { audience: Audience; onAudience: (a: Audience) => void }) {
  const { t } = useLanguage();
  const tenant = audience === 'tenant';

  const copy = tenant
    ? {
        title1: t('landing.home.hero.tenant.title1', undefined, 'Land your real home.'),
        title2: t('landing.home.hero.tenant.title2', undefined, 'In a few clicks.'),
        sub: t('landing.home.hero.tenant.sub', undefined, 'See the place in photos and video taken on site, get your papers checked once, and sign from your phone.'),
        nodes: [
          t('landing.home.nodes.tenant.film', undefined, 'Photos and video taken on site'),
          t('landing.home.nodes.tenant.papers', undefined, 'Papers checked, then deleted'),
          t('landing.home.nodes.tenant.lease', undefined, 'The official French lease'),
          t('landing.home.nodes.tenant.fee', undefined, 'One small fee, nothing more'),
        ],
      }
    : {
        title1: t('landing.home.hero.landlord.title1', undefined, 'Film it once.'),
        title2: t('landing.home.hero.landlord.title2', undefined, "Your place speaks for itself."),
        sub: t('landing.home.hero.landlord.sub', undefined, 'Add the basics, photograph each room and film one walk-through on your phone, and hear from students who have already seen the place.'),
        nodes: [
          t('landing.home.nodes.landlord.film', undefined, 'One walk-through on your phone'),
          t('landing.home.nodes.landlord.energy', undefined, 'Energy rating looked up for you'),
          t('landing.home.nodes.landlord.deposit', undefined, 'Deposit limit worked out'),
          t('landing.home.nodes.landlord.free', undefined, 'Free to list'),
        ],
      };

  return (
    <section className="relative px-6 pt-36 pb-16 sm:pt-44 sm:pb-24">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <AudienceSwitch audience={audience} onAudience={onAudience} />

          <p className="font-display mt-10 text-xl italic text-[#8a5e07] sm:text-2xl">
            {t('landing.footer.slogan', undefined, 'Where your heart wants to live')}
          </p>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={audience}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
            >
              <h1 className="font-display mt-4 text-[clamp(2.6rem,5.4vw,4.4rem)] font-medium leading-[0.98] tracking-[-0.035em] text-zinc-950">
                {copy.title1}
                <span className="block text-balance italic text-[#b07c12]">{copy.title2}</span>
              </h1>
              <p className="mt-7 max-w-[34rem] text-lg leading-relaxed text-zinc-600">{copy.sub}</p>

              {tenant ? (
                <SmartSearch />
              ) : (
                <div className="mt-9 flex flex-wrap items-center gap-4">
                  <Link
                    href="/auth/register?role=landlord"
                    className="inline-flex items-center gap-2 rounded-full bg-[#946608] px-7 py-4 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {t('landing.home.hero.landlord.button', undefined, 'List my place')}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <span className="text-sm text-zinc-600">{t('landing.home.hero.landlord.hint', undefined, 'Listing is free. One small flat fee, once.')}</span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-12 inline-block -rotate-2 rounded-[3px] border-2 border-gold px-5 py-3">
            <p className="font-display text-xl font-semibold leading-tight text-[#8a5e07]">{t('landing.home.stamp.line1', undefined, 'One small fee.')}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8a5e07]">{t('landing.home.stamp.line2', undefined, 'Pay for nothing more')}</p>
          </div>
        </div>

        <Constellation key={audience} nodes={copy.nodes} />
      </div>
    </section>
  );
}

function AudienceSwitch({ audience, onAudience }: { audience: Audience; onAudience: (a: Audience) => void }) {
  const { t } = useLanguage();
  const options: { id: Audience; label: string }[] = [
    { id: 'tenant', label: t('landing.home.switch.tenant', undefined, 'Moving to France') },
    { id: 'landlord', label: t('landing.home.switch.landlord', undefined, 'Letting a place') },
  ];
  return (
    <div role="group" aria-label={t('landing.home.switch.label', undefined, 'Who is this page for?')} className="inline-flex rounded-full border border-zinc-200 bg-white p-1 shadow-sm">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={audience === o.id}
          onClick={() => onAudience(o.id)}
          className="relative rounded-full px-5 py-2.5 text-sm font-semibold transition-colors"
        >
          {audience === o.id && (
            <motion.span layoutId="audience-thumb" className="absolute inset-0 rounded-full bg-zinc-950" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
          )}
          <span className={`relative ${audience === o.id ? 'text-white' : 'text-zinc-600'}`}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * One sentence in, filters out. Everything is understood locally as the visitor
 * types (lib/smartSearch.ts) and echoed back as chips, so they can see what
 * the search will use before they send it.
 */
function SmartSearch() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [announced, setAnnounced] = useState('');
  const parsed = useMemo(() => parseSearch(text), [text]);
  const cities = useMemo(() => suggestCities(text), [text]);

  const examples = [
    t('landing.home.hero.search.examples.one', undefined, 'a studio in Lyon under €600'),
    t('landing.home.hero.search.examples.two', undefined, 'a flatshare in Nantes from September'),
    t('landing.home.hero.search.examples.three', undefined, '2 bedrooms, 2 bathrooms in Paris'),
  ];

  const typologyLabel = { studio: 'Studio', t1: 'T1', t2: 'T2', t3plus: 'T3+' } as const;
  const understoodLabel = t('landing.home.hero.search.understood', undefined, 'Understood:');
  const understood = [
    parsed.city,
    parsed.typology && typologyLabel[parsed.typology],
    parsed.colocation && t('landing.hero.colocation', undefined, 'Flatshare'),
    parsed.bedrooms && t('search.smart.bedrooms', { count: parsed.bedrooms }, `${parsed.bedrooms}+ bedrooms`),
    parsed.bathrooms && t('search.smart.bathrooms', { count: parsed.bathrooms }, `${parsed.bathrooms}+ bathrooms`),
    parsed.furnished === true && t('listing.furnished', undefined, 'Furnished'),
    parsed.furnished === false && t('listing.unfurnished', undefined, 'Unfurnished'),
    parsed.maxRent && t('search.smart.budget', { amount: parsed.maxRent }, `Up to €${parsed.maxRent}`),
    ...parsed.amenities.map((a) => t(`property.amenity_labels.${a}`, undefined, a)),
    parsed.moveIn && t('search.smart.from', { month: formatMonth(parsed.moveIn, language) }, `From ${formatMonth(parsed.moveIn, language)}`),
    parsed.months && t('search.smart.months', { count: parsed.months }, `${parsed.months} months or longer`),
  ].filter((v): v is string => typeof v === 'string' && v.length > 0);

  // Screen readers hear the result once typing pauses, not on every keystroke.
  const summary = understood.length ? `${understoodLabel} ${understood.join(', ')}` : '';
  useEffect(() => {
    const timer = setTimeout(() => setAnnounced(summary), 700);
    return () => clearTimeout(timer);
  }, [summary]);

  // Clicking a suggestion removes its button, so hand focus back to the sentence.
  const fill = (value: string) => {
    setText(value);
    inputRef.current?.focus();
  };
  const completeCity = (city: string) => {
    // Replace the half-typed place at the end of the sentence, or add the city.
    const typed = parsed.city;
    const endsWithTyped = typed && text.toLowerCase().trimEnd().endsWith(typed.toLowerCase());
    fill(endsWithTyped ? `${text.trimEnd().slice(0, -typed.length)}${city} ` : `${text.trimEnd()} ${city} `);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(toSearchUrl(parsed));
  };

  return (
    <form onSubmit={submit} role="search" className="mt-9 max-w-xl">
      <label htmlFor="smart-search" className="font-display block text-2xl text-zinc-950 sm:text-3xl">
        {t('landing.home.hero.search.lead', undefined, "I'm looking for")}
      </label>
      <input
        id="smart-search"
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={examples[0]}
        maxLength={200}
        autoComplete="off"
        aria-describedby="smart-search-understood"
        className="font-display mt-2 block w-full border-0 border-b-2 border-gold bg-transparent px-1 pb-2 text-xl italic text-[#8a5e07] placeholder:text-[#857046] focus:outline-none focus:ring-0 focus-visible:shadow-[0_3px_0_0_#946608] sm:text-2xl"
      />
      <p role="status" className="sr-only">{announced}</p>

      <div className="mt-3 flex min-h-[2rem] flex-wrap items-center gap-2 text-xs">
        <div id="smart-search-understood" className="flex flex-wrap items-center gap-2">
          {understood.length > 0 && (
            <>
              <span className="text-zinc-600">{understoodLabel}</span>
              {understood.map((chip) => (
                <span key={chip} className="rounded-full border border-gold/60 bg-[#fbf3e2] px-3 py-1 font-semibold text-[#8a5e07]">
                  {chip}
                </span>
              ))}
            </>
          )}
        </div>
        {understood.length === 0 && (
          <>
            <span className="text-zinc-600">{t('landing.home.hero.search.try', undefined, 'Try:')}</span>
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => fill(example)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-zinc-700 transition-colors hover:border-gold hover:text-zinc-950"
              >
                {example}
              </button>
            ))}
          </>
        )}
        {cities.map((city) => (
          <button
            key={city}
            type="button"
            onClick={() => completeCity(city)}
            className="rounded-full border border-dashed border-gold px-3 py-1 font-semibold text-[#8a5e07] hover:bg-[#fbf3e2]"
          >
            {city}?
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-[#946608] px-7 py-4 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
        >
          {t('landing.home.hero.search.button', undefined, 'Show me rooms')}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="text-sm text-zinc-600">{t('landing.home.hero.search.hint', undefined, 'No account needed to look around.')}</span>
      </div>
    </form>
  );
}

/** The Roomivo mark, opened out: the hub in the middle, one spoke per thing the visitor gets. */
function Constellation({ nodes }: { nodes: string[] }) {
  const points = [
    { x: 18, y: 14 },
    { x: 82, y: 20 },
    { x: 84, y: 66 },
    { x: 20, y: 72 },
  ];
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {points.map((p, i) => (
          <motion.line
            key={i}
            x1="50" y1="46" x2={p.x} y2={p.y}
            stroke="#cb8f1b" strokeWidth="0.7" strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: 0.25 + i * 0.18 }}
          />
        ))}
      </svg>

      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 16 }}
        className="absolute left-1/2 top-[46%] w-[30%] -translate-x-1/2 -translate-y-1/2"
      >
        <Image src="/images/roomivo-icon.png" alt="" width={320} height={320} priority className="h-auto w-full drop-shadow-[0_18px_30px_rgba(120,84,10,0.35)]" />
      </motion.div>

      {points.map((p, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.9 + i * 0.18, type: 'spring', stiffness: 220, damping: 18 }}
          className="absolute flex w-36 -translate-x-1/2 flex-col items-center sm:w-40"
          style={{ left: `${p.x}%`, top: `${p.y}%`, marginTop: '-7px' }}
        >
          <span className="h-3.5 w-3.5 rounded-full border-[3px] border-[#fffdf7] bg-gold shadow" />
          <span className="font-display mt-2 rounded-2xl border border-zinc-200 bg-white px-3.5 py-2 text-center text-[13px] leading-snug text-zinc-900 shadow-[0_14px_28px_-18px_rgba(60,42,10,0.5)] sm:text-sm">
            {nodes[i]}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

/* ───────────────────────── The thread ───────────────────────── */

function Thread({ audience }: { audience: Audience }) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 55%'] });
  const fill = useSpring(scrollYProgress, { stiffness: 90, damping: 24 });
  const tenant = audience === 'tenant';


  const stations = [
    {
      title: tenant
        ? t('landing.home.stations.film.tenant.title', undefined, 'See it move.')
        : t('landing.home.stations.film.landlord.title', undefined, 'Film it once.'),
      body: tenant
        ? t('landing.home.stations.film.tenant.body', undefined, 'Every room is photographed on site, and a filmed walk-through shows how the place fits together when the owner records one.')
        : t('landing.home.stations.film.landlord.body', undefined, 'Open the link on your phone, photograph each room and film one walk-through. Students see the place as it is, so the ones who write to you already know it.'),
      sketch: tenant ? <PhoneWatch /> : <PhoneFilm />,
    },
    {
      title: t('landing.home.stations.check.title', undefined, 'Checked once. Then deleted.'),
      body: tenant
        ? t('landing.home.stations.check.tenant.body', undefined, 'We read your documents, confirm what they say, and delete them. The landlord sees the result, never the papers. No guarantor? Visale is a free guarantee from Action Logement: see visale.fr to find out whether you qualify, and we will check your certificate.')
        : t('landing.home.stations.check.landlord.body', undefined, "Applicants can have their identity and their income checked. You get a clear result, with no folder of strangers' papers to keep."),
      link: { href: '/trust', label: t('landing.home.stations.check.link', undefined, 'How we check, and what we keep') },
      sketch: tenant ? <PhoneScan /> : <PhoneApplicant />,
    },
    {
      title: t('landing.home.stations.sign.title', undefined, 'Signed from your phone.'),
      body: tenant
        ? t('landing.home.stations.sign.tenant.body', undefined, 'The lease follows the official French model, with the deposit kept within the legal limit. You both sign online and each keep a copy.')
        : t('landing.home.stations.sign.landlord.body', undefined, 'The lease is built from your listing on the official French model. You both sign online, with nothing to print or post.'),
      sketch: <PhoneLease />,
    },
    {
      title: t('landing.home.stations.fee.title', undefined, "One small fee. That's all."),
      body: tenant
        ? t('landing.home.stations.fee.tenant.body', undefined, "Looking around and applying cost nothing. You pay Roomivo one small fee, once, and nothing after that.")
        : t('landing.home.stations.fee.landlord.body', undefined, 'Listing your place is free. You pay Roomivo one small flat fee, once, and nothing after that.'),
      sketch: <PhoneFee tenant={tenant} />,
    },
  ];

  return (
    <section className="relative px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display max-w-[16ch] text-[clamp(2rem,4.6vw,3.6rem)] font-medium leading-[1.02] tracking-[-0.03em] text-zinc-950">
          {tenant
            ? t('landing.home.thread.tenant', undefined, 'From far away to the front door')
            : t('landing.home.thread.landlord', undefined, 'From empty room to signed lease')}
        </h2>

        <div ref={ref} className="relative mt-14">
          <div className="absolute bottom-0 left-4 top-0 w-px bg-gold/25 lg:left-1/2" aria-hidden="true" />
          <motion.div
            style={{ scaleY: reduce ? 1 : fill }}
            className="absolute bottom-0 left-4 top-0 -ml-px w-[3px] origin-top rounded-full bg-gold lg:left-1/2"
            aria-hidden="true"
          />

          {stations.map((s, i) => (
            <div key={i} className="relative grid grid-cols-1 items-center gap-8 py-12 pl-14 lg:grid-cols-2 lg:gap-28 lg:pl-0">
              <span className="font-display absolute left-4 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-gold bg-[#fffdf7] text-base font-semibold text-[#8a5e07] lg:left-1/2">
                {i + 1}
              </span>

              <div className={i % 2 ? 'lg:order-2' : ''}>
                <h3 className="font-display text-[clamp(1.75rem,3.2vw,2.6rem)] font-medium leading-[1.05] tracking-[-0.025em] text-zinc-950">{s.title}</h3>
                <p className="mt-4 max-w-[30rem] text-[1.05rem] leading-relaxed text-zinc-600">{s.body}</p>
                {s.link && (
                  <Link href={s.link.href} className="mt-5 inline-flex items-center gap-2 border-b border-gold pb-0.5 text-sm font-semibold text-[#8a5e07] hover:text-zinc-950">
                    {s.link.label}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                )}
              </div>

              <div key={`${audience}-screen-${i}`} className={i % 2 ? 'lg:order-1 lg:rotate-2' : 'lg:-rotate-2'}>
                {s.sketch}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Final call ───────────────────────── */

function FinalCall() {
  const { t } = useLanguage();
  return (
    <section className="relative px-6 pb-24">
      <div className="mx-auto max-w-6xl rounded-[2.25rem] bg-zinc-950 px-8 py-16 text-center sm:px-16 sm:py-20">
        <Image src="/images/roomivo-icon.png" alt="" width={96} height={96} className="mx-auto h-14 w-14" />
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.24em] text-gold">
          {t('landing.footer.slogan', undefined, 'Where your heart wants to live')}
        </p>
        <h2 className="font-display mx-auto mt-4 max-w-[14ch] text-[clamp(2.25rem,5vw,4rem)] font-medium leading-[1] tracking-[-0.03em] text-white">
          {t('landing.home.final.title', undefined, 'Ready when you are.')}
        </h2>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/search" className="inline-flex items-center gap-2 rounded-full bg-[#946608] px-7 py-4 text-sm font-bold text-white transition-transform hover:-translate-y-0.5">
            {t('landing.home.final.tenant', undefined, 'Find a room')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/auth/register?role=landlord" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-4 text-sm font-bold text-white transition-colors hover:border-gold">
            {t('landing.home.final.landlord', undefined, 'List my place')}
          </Link>
        </div>
      </div>
    </section>
  );
}
