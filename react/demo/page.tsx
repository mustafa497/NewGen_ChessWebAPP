/**
 * Demo page — drop this at `app/mentors/page.tsx` in a Next.js App Router
 * project and visit /mentors.
 *
 * The fonts below are the pairing the section is designed around: an elegant
 * serif display (Fraunces) with a clean modern sans (Space Grotesk), exposed as
 * the CSS variables the component reads. Swap them freely — the component falls
 * back to system serif/sans if the variables are absent.
 */

import { Fraunces, Space_Grotesk } from 'next/font/google';
import MeetTheMentors from '@/components/MeetTheMentors';

const display = Fraunces({
  subsets: ['latin'],
  weight: ['300', '500', '600'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

export default function MentorsPage() {
  return (
    <main className={`${display.variable} ${sans.variable} min-h-screen bg-[#0a0a0c]`}>
      {/* Spacer above, so you can test the scroll-to-rotate behaviour. */}
      <div className="h-[40vh]" />

      <MeetTheMentors />

      <div className="h-[60vh]" />
    </main>
  );
}
