/**
 * Mentor data for <MeetTheMentors />
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EDIT THIS FILE ONLY. The component reads everything from here — you should
 * never need to touch MeetTheMentors.tsx to change copy, photos or ordering.
 *
 * Fields marked  ⟵ REPLACE  are still placeholders carried over from the
 * existing academy site. Everything else (photos, captions, achievements) is
 * real and already wired to the twelve selected photographs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type MentorPhoto = {
  /** Path under /public, or an imported StaticImageData. */
  src: string;
  /** Required. Describes the photo for screen readers. */
  alt: string;
  /** Short caption shown under the front photo. */
  caption: string;
  /**
   * object-position for the crop. Tune per photo so faces are never cut off.
   * e.g. '50% 30%' pulls the crop upward toward a face near the top.
   */
  focal?: string;
};

export type Mentor = {
  id: string;
  name: string;
  role: string;
  rating: string;
  ratingLabel: string;
  experience: string;
  experienceLabel: string;
  /** 2–3 sentences. Keep under ~320 characters so the card never overflows. */
  bio: string;
  /** Coaching specialties. 3–4 reads best. */
  specialties: string[];
  /** Exactly three key achievements — rendered as hoverable chips. */
  achievements: [string, string, string];
  /**
   * Exactly four photographs, in this order:
   *   [0] strong primary portrait
   *   [1] coach teaching students
   *   [2] coach playing or analysing chess
   *   [3] tournament, award or achievement photograph
   */
  photos: [MentorPhoto, MentorPhoto, MentorPhoto, MentorPhoto];
  cta: { label: string; href: string };
  /** Individual accent, kept within the academy's antique-gold family. */
  accent: string;
};

export const MENTORS: Mentor[] = [
  {
    id: 'founder',
    name: '[Coach 1 — name]', //                                  ⟵ REPLACE
    role: 'Founder & Head Coach',
    rating: '[rating]', //                                        ⟵ REPLACE
    ratingLabel: 'FIDE rating',
    experience: '[years]', //                                     ⟵ REPLACE
    experienceLabel: 'Years coaching',
    bio: '[Short biography — replace. Two or three sentences on how they teach, who they have brought through, and what a student can expect from a session.]', // ⟵ REPLACE
    specialties: ['Opening repertoire', 'Endgame technique', 'Tournament preparation'],
    achievements: [
      'Certified Instructor',
      'Tournament Organizer',
      'National Arbiter',
    ],
    photos: [
      {
        src: '/coaches/a_portrait.jpg',
        alt: 'Coach studying a position at the board',
        caption: 'At the board',
        focal: '50% 28%',
      },
      {
        src: '/coaches/a_teach.jpg',
        alt: 'Coach coaching a session with students at the academy',
        caption: 'Coaching a session at the academy',
        focal: '50% 40%',
      },
      {
        src: '/coaches/a_stage.jpg',
        alt: 'Coach at an award ceremony at the Arts Council of Pakistan',
        caption: 'Award ceremony, Arts Council of Pakistan',
        focal: '50% 35%',
      },
      {
        src: '/coaches/a_cert.jpg',
        alt: 'Certificate presentation at the U.S. Consulate General Karachi',
        caption: 'Certificate — U.S. Consulate General Karachi',
        focal: '50% 40%',
      },
    ],
    cta: { label: 'Book a session', href: '#book' },
    accent: '#c9a66b', // antique gold
  },

  {
    id: 'tournament',
    name: '[Coach 2 — name]', //                                  ⟵ REPLACE
    role: 'Coach · Tournament Preparation',
    rating: '[rating]', //                                        ⟵ REPLACE
    ratingLabel: 'FIDE rating',
    experience: '[years]', //                                     ⟵ REPLACE
    experienceLabel: 'Years coaching',
    bio: '[Short biography — replace. Two or three sentences on their competitive record and how they prepare students for rated play.]', // ⟵ REPLACE
    specialties: ['Rated-game preparation', 'Time management', 'Tournament rules'],
    achievements: [
      'District South 2025',
      'Denning Open — Winner',
      'Certified Instructor',
    ],
    photos: [
      {
        src: '/coaches/b_portrait.jpg',
        alt: 'Coach playing a rated game at a tournament',
        caption: 'Playing a rated game',
        focal: '50% 28%',
      },
      {
        src: '/coaches/b_class.jpg',
        alt: 'Coach teaching tournament rules to students at the academy',
        caption: 'Teaching tournament rules at the academy',
        focal: '50% 38%',
      },
      {
        src: '/coaches/b_award.jpg',
        alt: 'Prize presentation at the District South Sports Tournament 2025',
        caption: 'District South Sports Tournament 2025',
        focal: '50% 32%',
      },
      {
        src: '/coaches/b_cheque.jpg',
        alt: 'Winner’s cheque presented on stage at the Denning Institute open',
        caption: 'Winner — Denning Institute open',
        focal: '50% 35%',
      },
    ],
    cta: { label: 'Book a session', href: '#book' },
    accent: '#b98f5a', // warm bronze
  },

  {
    id: 'youth',
    name: '[Coach 3 — name]', //                                  ⟵ REPLACE
    role: 'Coach · Youth Program',
    rating: '[rating]', //                                        ⟵ REPLACE
    ratingLabel: 'FIDE rating',
    experience: '[years]', //                                     ⟵ REPLACE
    experienceLabel: 'Years coaching',
    bio: '[Short biography — replace. Two or three sentences on working with younger players and building confidence at the board.]', // ⟵ REPLACE
    specialties: ['Junior development', 'Calculation drills', 'Team events'],
    achievements: [
      'Sindh Games 2024',
      'Intervarsity — 2nd position',
      'Karachi Games 2023',
    ],
    photos: [
      {
        src: '/coaches/c_portrait.jpg',
        alt: 'Coach holding the Sindh Games 2024 trophy and medal',
        caption: 'Sindh Games 2024 — Chess',
        focal: '50% 26%',
      },
      {
        src: '/coaches/c_varsity.jpg',
        alt: 'Team photograph at the 8th All Pakistan Intervarsity Championship, May 2024',
        caption: '8th All Pakistan Intervarsity, May 2024',
        focal: '50% 40%',
      },
      {
        src: '/coaches/c_trophy.jpg',
        alt: 'Sindh Games 2024 trophy and medal',
        caption: 'Sindh Games 2024 trophy',
        focal: '50% 38%',
      },
      {
        src: '/coaches/c_cheque.jpg',
        alt: 'Prize presentation for 2nd position at the All Pakistan Intervarsity 2024',
        caption: 'All Pakistan Intervarsity 2024 — 2nd position',
        focal: '50% 35%',
      },
    ],
    cta: { label: 'Book a session', href: '#book' },
    accent: '#d0a978', // pale gold
  },
];
