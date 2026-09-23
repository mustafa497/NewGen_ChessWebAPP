'use client';

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from 'framer-motion';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MENTORS, type Mentor, type MentorPhoto } from './mentors';

/* ─────────────────────────────────────────────────────────────────────────────
   Tuning
   ───────────────────────────────────────────────────────────────────────── */

/** One gesture = one transition. Also the rotation settle time. */
const COOLDOWN_MS = 950;
/** Sustained pointer travel (px) before a rotation fires. Kills jitter. */
const POINTER_THRESHOLD = 78;
/** Pointer accumulator resets after this long without movement. */
const POINTER_IDLE_MS = 260;
/** Wheel delta needed to fire. */
const WHEEL_THRESHOLD = 28;
/** Vertical swipe distance (px) to rotate on touch. */
const SWIPE_THRESHOLD = 56;
/** Front photo dwell time — spec calls for 2.8–3.5s. */
const PHOTO_INTERVAL_MS = 3100;

/** Substantial and cinematic: ~900ms, almost no bounce. */
const CARD_SPRING: Transition = { type: 'spring', duration: 0.9, bounce: 0.14 };
const PHOTO_SPRING: Transition = { type: 'spring', duration: 0.75, bounce: 0.16 };
const FADE: Transition = { duration: 0.45, ease: [0.22, 1, 0.36, 1] };

/** Depth layout for the three stacked cards, indexed by distance from front. */
const STACK = [
  { y: 0, z: 0, scale: 1, opacity: 1, rotateX: 0, blur: 0 },
  { y: -40, z: -150, scale: 0.935, opacity: 0.55, rotateX: 5, blur: 1.2 },
  { y: -72, z: -280, scale: 0.875, opacity: 0.3, rotateX: 8, blur: 2.4 },
] as const;

/* ─────────────────────────────────────────────────────────────────────────────
   Background texture — subtle chessboard geometry, no external assets
   ───────────────────────────────────────────────────────────────────────── */

const BOARD_TEXTURE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='60' height='60' fill='%23ffffff' fill-opacity='0.014'/><rect x='60' y='60' width='60' height='60' fill='%23ffffff' fill-opacity='0.014'/></svg>\")";

/* ─────────────────────────────────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────────────────────────────── */

export type MeetTheMentorsProps = {
  mentors?: Mentor[];
  className?: string;
};

export default function MeetTheMentors({
  mentors = MENTORS,
  className = '',
}: MeetTheMentorsProps) {
  const count = mentors.length;
  const reduceMotion = useReducedMotion();
  const headingId = useId();

  const [active, setActive] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);

  const sectionRef = useRef<HTMLElement | null>(null);
  const lastChangeRef = useRef(0);
  const pointerAccRef = useRef(0);
  const pointerYRef = useRef<number | null>(null);
  const pointerTimeRef = useRef(0);
  const touchYRef = useRef<number | null>(null);

  /* ── rotation ─────────────────────────────────────────────────────────── */

  const rotate = useCallback(
    (dir: 1 | -1) => {
      const now = Date.now();
      if (now - lastChangeRef.current < COOLDOWN_MS) return;
      lastChangeRef.current = now;
      pointerAccRef.current = 0;
      setHasInteracted(true);
      setActive((i) => (i + dir + count) % count);
    },
    [count],
  );

  const goTo = useCallback(
    (index: number) => {
      const now = Date.now();
      if (now - lastChangeRef.current < COOLDOWN_MS) return;
      if (index === active) return;
      lastChangeRef.current = now;
      pointerAccRef.current = 0;
      setHasInteracted(true);
      setActive(((index % count) + count) % count);
    },
    [active, count],
  );

  /* ── wheel: scroll up = next ──────────────────────────────────────────── */

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < WHEEL_THRESHOLD) return;
      // Only hijack the wheel while the section fills most of the viewport,
      // so the page still scrolls normally on the way past.
      const r = el.getBoundingClientRect();
      const covers = r.top < window.innerHeight * 0.3 && r.bottom > window.innerHeight * 0.7;
      if (!covers) return;
      if (Date.now() - lastChangeRef.current < COOLDOWN_MS) return;
      rotate(e.deltaY < 0 ? 1 : -1);
    };

    el.addEventListener('wheel', onWheel, { passive: true });
    return () => el.removeEventListener('wheel', onWheel);
  }, [rotate]);

  /* ── pointer: sustained upward travel = next ──────────────────────────── */

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'mouse') return;

      const now = Date.now();
      const prev = pointerYRef.current;
      pointerYRef.current = e.clientY;

      // A pause, or a change of direction, starts a fresh gesture.
      if (prev === null || now - pointerTimeRef.current > POINTER_IDLE_MS) {
        pointerTimeRef.current = now;
        pointerAccRef.current = 0;
        return;
      }
      pointerTimeRef.current = now;

      const dy = e.clientY - prev;
      if (Math.abs(dy) < 1) return;
      if (Math.sign(dy) !== Math.sign(pointerAccRef.current)) pointerAccRef.current = 0;
      pointerAccRef.current += dy;

      if (Math.abs(pointerAccRef.current) >= POINTER_THRESHOLD) {
        rotate(pointerAccRef.current < 0 ? 1 : -1);
      }
    },
    [rotate],
  );

  /* ── keyboard ─────────────────────────────────────────────────────────── */

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        rotate(1);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        rotate(-1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(count - 1);
      }
    },
    [rotate, goTo, count],
  );

  /* ── touch: swipe up = next ───────────────────────────────────────────── */

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchYRef.current = e.touches[0]?.clientY ?? null;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchYRef.current;
      touchYRef.current = null;
      if (start === null) return;
      const end = e.changedTouches[0]?.clientY;
      if (end === undefined) return;
      const dy = end - start;
      if (Math.abs(dy) < SWIPE_THRESHOLD) return;
      rotate(dy < 0 ? 1 : -1);
    },
    [rotate],
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby={headingId}
      tabIndex={0}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={[
        'relative isolate overflow-hidden bg-[#0a0a0c] py-20 sm:py-28',
        'outline-none focus-visible:ring-2 focus-visible:ring-[#c9a66b]/70 focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[#0a0a0c]',
        className,
      ].join(' ')}
      style={{ fontFamily: 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)' }}
    >
      {/* chessboard geometry + warm walnut wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ backgroundImage: BOARD_TEXTURE, backgroundSize: '120px 120px' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 0%, rgba(201,166,107,0.07), transparent 65%),' +
            'radial-gradient(ellipse 60% 50% at 15% 100%, rgba(120,72,38,0.09), transparent 70%)',
        }}
      />

      <div className="mx-auto w-full max-w-[1240px] px-6 sm:px-8">
        {/* ── heading ─────────────────────────────────────────────────── */}
        <header className="mb-14 max-w-2xl sm:mb-20">
          <p className="mb-4 flex items-center gap-3 text-[0.7rem] uppercase tracking-[0.22em] text-[#c9a66b]">
            <span aria-hidden className="h-px w-6 bg-[#c9a66b]/70" />
            Meet the mentors
          </p>
          <h2
            id={headingId}
            className="text-[clamp(2rem,4.2vw,3.1rem)] font-medium leading-[1.12] tracking-[-0.015em] text-[#f4efe4]"
            style={{ fontFamily: 'var(--font-display, ui-serif, Georgia, serif)' }}
          >
            Three minds. One mission—to develop confident, strategic players.
          </h2>
        </header>

        {/* ── stage ───────────────────────────────────────────────────── */}
        <div
          className="relative mx-auto"
          style={{ perspective: reduceMotion ? undefined : 1800 }}
        >
          {/* Reserve height so nothing shifts as cards animate or images load. */}
          <div className="relative min-h-[720px] sm:min-h-[620px] lg:min-h-[560px]">
            {mentors.map((mentor, i) => {
              const pos = (i - active + count) % count;
              return (
                <MentorCard
                  key={mentor.id}
                  mentor={mentor}
                  position={pos}
                  isActive={pos === 0}
                  reduceMotion={!!reduceMotion}
                  onSelect={() => goTo(i)}
                />
              );
            })}
          </div>

          {/* ── indicator ─────────────────────────────────────────────── */}
          <div className="mt-10 flex items-center gap-5">
            <p
              className="text-sm tabular-nums text-[#8d8579]"
              style={{ fontFamily: 'var(--font-display, ui-serif, Georgia, serif)' }}
            >
              <span className="text-[#f4efe4]">
                {String(active + 1).padStart(2, '0')}
              </span>
              <span className="mx-1.5 opacity-50">/</span>
              {String(count).padStart(2, '0')}
            </p>

            <div className="flex items-center gap-2" role="tablist" aria-label="Choose a mentor">
              {mentors.map((m, i) => (
                <button
                  key={m.id}
                  role="tab"
                  aria-selected={i === active}
                  aria-label={`Show ${m.name}`}
                  onClick={() => goTo(i)}
                  className={[
                    'h-1 rounded-full transition-all duration-500',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a66b] focus-visible:ring-offset-4',
                    'focus-visible:ring-offset-[#0a0a0c]',
                    i === active
                      ? 'w-10 bg-[#c9a66b]'
                      : 'w-5 bg-white/15 hover:bg-white/30',
                  ].join(' ')}
                />
              ))}
            </div>

            {/* interaction hint — retires after the first gesture */}
            <AnimatePresence>
              {!hasInteracted && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.3 } }}
                  transition={{ delay: 0.9, duration: 0.6 }}
                  className="ml-auto hidden items-center gap-2 text-xs text-[#8d8579] sm:flex"
                >
                  <motion.span
                    aria-hidden
                    animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    ↑
                  </motion.span>
                  Move to explore
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Screen-reader announcement of the active mentor. */}
          <p aria-live="polite" className="sr-only">
            {mentors[active]?.name}, {mentors[active]?.role}. Mentor {active + 1} of {count}.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Card
   ───────────────────────────────────────────────────────────────────────── */

function MentorCard({
  mentor,
  position,
  isActive,
  reduceMotion,
  onSelect,
}: {
  mentor: Mentor;
  position: number;
  isActive: boolean;
  reduceMotion: boolean;
  onSelect: () => void;
}) {
  const depth = STACK[Math.min(position, STACK.length - 1)];

  const animate = reduceMotion
    ? { opacity: isActive ? 1 : 0, y: 0, scale: 1, rotateX: 0, z: 0 }
    : {
        y: depth.y,
        z: depth.z,
        scale: depth.scale,
        opacity: depth.opacity,
        rotateX: depth.rotateX,
      };

  return (
    <motion.article
      aria-hidden={!isActive}
      initial={false}
      animate={animate}
      transition={reduceMotion ? FADE : CARD_SPRING}
      className="absolute inset-x-0 top-0"
      style={{
        transformStyle: reduceMotion ? undefined : 'preserve-3d',
        zIndex: STACK.length - position,
        // Background cards stay clickable — that is how you bring one forward.
        // In reduced-motion mode they are invisible, so they must not be.
        pointerEvents: reduceMotion && !isActive ? 'none' : 'auto',
        filter: reduceMotion || !depth.blur ? undefined : `blur(${depth.blur}px)`,
      }}
    >
      {/*
        Fully opaque on purpose: at 95% the card behind bleeds through the copy
        and the photo stack, which reads as a rendering fault rather than depth.
      */}
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#101013]"
        style={{
          boxShadow:
            '0 40px 90px -40px rgba(0,0,0,0.95), 0 8px 30px -18px rgba(0,0,0,0.8)',
        }}
      >
        {/* gold edge highlight on the active card */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
          animate={{ opacity: isActive ? 1 : 0 }}
          transition={FADE}
          style={{
            border: `1px solid ${mentor.accent}55`,
            boxShadow: `inset 0 1px 0 0 ${mentor.accent}30, 0 0 44px -14px ${mentor.accent}55`,
          }}
        />

        <div className="grid gap-8 p-7 sm:p-9 lg:grid-cols-[3fr_2fr] lg:gap-10 lg:p-11">
          {/* ── left 60%: information ─────────────────────────────────── */}
          <div className="min-w-0">
            <p
              className="mb-2 text-[0.7rem] uppercase tracking-[0.18em]"
              style={{ color: mentor.accent }}
            >
              {mentor.role}
            </p>

            <h3
              className="text-[clamp(1.65rem,3vw,2.35rem)] font-medium leading-tight tracking-[-0.015em] text-[#f4efe4]"
              style={{ fontFamily: 'var(--font-display, ui-serif, Georgia, serif)' }}
            >
              {mentor.name}
            </h3>

            {/* rating + experience */}
            <dl className="mt-5 flex flex-wrap gap-x-9 gap-y-4">
              <div>
                <dd
                  className="text-xl tabular-nums text-[#f4efe4]"
                  style={{ fontFamily: 'var(--font-display, ui-serif, Georgia, serif)' }}
                >
                  {mentor.rating}
                </dd>
                <dt className="mt-0.5 text-[0.72rem] text-[#8d8579]">{mentor.ratingLabel}</dt>
              </div>
              <div>
                <dd
                  className="text-xl tabular-nums text-[#f4efe4]"
                  style={{ fontFamily: 'var(--font-display, ui-serif, Georgia, serif)' }}
                >
                  {mentor.experience}
                </dd>
                <dt className="mt-0.5 text-[0.72rem] text-[#8d8579]">
                  {mentor.experienceLabel}
                </dt>
              </div>
            </dl>

            <p className="mt-6 max-w-[52ch] text-[0.93rem] leading-relaxed text-[#a9a196]">
              {mentor.bio}
            </p>

            {/* achievements */}
            <ul className="mt-6 flex flex-wrap gap-2">
              {mentor.achievements.map((a) => (
                <li key={a}>
                  <span
                    className="inline-block cursor-default rounded-sm border px-2.5 py-1 text-[0.74rem] text-[#c4bcb0] transition-all duration-300 hover:-translate-y-0.5"
                    style={{ borderColor: `${mentor.accent}44` }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = `${mentor.accent}aa`;
                      e.currentTarget.style.backgroundColor = `${mentor.accent}14`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = `${mentor.accent}44`;
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {a}
                  </span>
                </li>
              ))}
            </ul>

            {/* specialties */}
            <div className="mt-6">
              <p className="mb-2 text-[0.68rem] uppercase tracking-[0.16em] text-[#8d8579]">
                Specialties
              </p>
              <p className="text-[0.86rem] text-[#a9a196]">
                {mentor.specialties.join('  ·  ')}
              </p>
            </div>

            <MagneticCTA
              href={mentor.cta.href}
              accent={mentor.accent}
              disabled={!isActive}
              reduceMotion={reduceMotion}
            >
              {mentor.cta.label}
            </MagneticCTA>
          </div>

          {/* ── right 40%: photo stack ────────────────────────────────── */}
          <PhotoStack
            photos={mentor.photos}
            mentorId={mentor.id}
            accent={mentor.accent}
            isActive={isActive}
            reduceMotion={reduceMotion}
          />
        </div>
      </div>

      {/* Whole-card hit target for background cards only. */}
      {!isActive && (
        <button
          onClick={onSelect}
          aria-label={`Bring ${mentor.name} to the front`}
          className="absolute inset-0 z-10 cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a66b]"
        />
      )}
    </motion.article>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Photo stack — four overlapping mini-cards
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Resting transform for each photo by distance from the front.
 * Max x here must stay under the 52px gutter on the stack wrapper, or the
 * fanned cards get clipped by the card's `overflow-hidden`.
 */
const PHOTO_POS = [
  { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 },
  { x: 17, y: -14, rotate: 2.2, scale: 0.95, opacity: 0.82 },
  { x: 32, y: -26, rotate: 4, scale: 0.905, opacity: 0.6 },
  { x: 44, y: -36, rotate: 5.6, scale: 0.865, opacity: 0.38 },
] as const;

function PhotoStack({
  photos,
  mentorId,
  accent,
  isActive,
  reduceMotion,
}: {
  photos: readonly MentorPhoto[];
  mentorId: string;
  accent: string;
  isActive: boolean;
  reduceMotion: boolean;
}) {
  const [front, setFront] = useState(0);
  const [paused, setPaused] = useState(false);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  // Reset the sequence whenever a different mentor takes the stage.
  useEffect(() => {
    setFront(0);
    setParallax({ x: 0, y: 0 });
  }, [mentorId]);

  // Auto-advance only while this card is active, unpaused and motion is allowed.
  useEffect(() => {
    if (!isActive || paused || reduceMotion) return;
    const id = window.setInterval(
      () => setFront((f) => (f + 1) % photos.length),
      PHOTO_INTERVAL_MS,
    );
    return () => window.clearInterval(id);
  }, [isActive, paused, reduceMotion, photos.length]);

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (reduceMotion || !isActive) return;
      const r = e.currentTarget.getBoundingClientRect();
      setParallax({
        x: ((e.clientX - r.left) / r.width - 0.5) * 14,
        y: ((e.clientY - r.top) / r.height - 0.5) * 14,
      });
    },
    [reduceMotion, isActive],
  );

  const caption = photos[front]?.caption;

  return (
    // Gutter is symmetric on small screens so the stack stays centred, and
    // right-only from lg up where the column is wide enough to spare it.
    <div className="min-w-0 px-[52px] lg:pl-0 lg:pr-[52px]">
      <div
        className="relative mx-auto aspect-[4/5] w-full max-w-[280px] lg:max-w-none"
        onPointerMove={onMove}
        onPointerLeave={() => {
          setPaused(false);
          setParallax({ x: 0, y: 0 });
        }}
        onPointerEnter={() => setPaused(true)}
        style={{ perspective: reduceMotion ? undefined : 1200 }}
      >
        {photos.map((photo, i) => {
          const d = (i - front + photos.length) % photos.length;
          const p = PHOTO_POS[Math.min(d, PHOTO_POS.length - 1)];
          const isFront = d === 0;

          return (
            <motion.button
              key={photo.src}
              type="button"
              onClick={() => setFront(i)}
              aria-label={
                isFront ? `${photo.alt} (shown)` : `Show photograph: ${photo.alt}`
              }
              aria-current={isFront}
              tabIndex={isActive ? 0 : -1}
              initial={false}
              animate={
                reduceMotion
                  ? { opacity: isFront ? 1 : 0 }
                  : {
                      x: p.x + (isFront ? parallax.x : parallax.x * 0.35),
                      y: p.y + (isFront ? parallax.y : parallax.y * 0.35),
                      rotate: p.rotate,
                      scale: p.scale,
                      opacity: p.opacity,
                    }
              }
              transition={reduceMotion ? FADE : PHOTO_SPRING}
              className="absolute inset-0 overflow-hidden rounded-xl border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a66b]"
              style={{
                zIndex: photos.length - d,
                cursor: isFront ? 'default' : 'pointer',
                boxShadow: isFront
                  ? `0 28px 60px -28px rgba(0,0,0,0.95), 0 0 0 1px ${accent}22`
                  : '0 18px 40px -24px rgba(0,0,0,0.9)',
              }}
            >
              {/*
                PHOTOGRAPH SLOT — swap the `src` in mentors.ts, not here.
                width/height are set so the browser reserves space (no CLS).
              */}
              <img
                src={photo.src}
                alt={isFront ? photo.alt : ''}
                width={540}
                height={675}
                loading={isFront && isActive ? 'eager' : 'lazy'}
                decoding="async"
                draggable={false}
                className="h-full w-full object-cover"
                style={{ objectPosition: photo.focal ?? '50% 35%' }}
              />
              {/* keeps caption text readable over any photograph */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to top, rgba(8,8,10,0.78) 0%, rgba(8,8,10,0.12) 38%, transparent 62%)',
                }}
              />
            </motion.button>
          );
        })}
      </div>

      {/* caption for the front photograph */}
      <div className="mt-4 min-h-[2.5rem] px-1">
        <AnimatePresence mode="wait">
          <motion.p
            key={caption}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="text-[0.78rem] leading-snug text-[#8d8579]"
          >
            {caption}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CTA with a restrained magnetic hover
   ───────────────────────────────────────────────────────────────────────── */

function MagneticCTA({
  href,
  accent,
  disabled,
  reduceMotion,
  children,
}: {
  href: string;
  accent: string;
  disabled: boolean;
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLAnchorElement>) => {
      if (reduceMotion) return;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Capped at ±6px — a hint of pull, not a slide.
      setOffset({
        x: ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * 6,
        y: ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * 6,
      });
    },
    [reduceMotion],
  );

  return (
    <motion.a
      ref={ref}
      href={href}
      tabIndex={disabled ? -1 : 0}
      onPointerMove={onMove}
      onPointerLeave={() => setOffset({ x: 0, y: 0 })}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="mt-8 inline-flex items-center gap-2.5 rounded-sm px-6 py-3 text-[0.88rem] font-medium text-[#0a0a0c] transition-shadow duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101013]"
      style={{
        backgroundColor: accent,
        boxShadow: `0 0 0 0 ${accent}00`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 10px 34px -10px ${accent}bb`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 0 ${accent}00`;
      }}
    >
      {children}
      <span aria-hidden>→</span>
    </motion.a>
  );
}
