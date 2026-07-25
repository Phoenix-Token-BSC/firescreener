'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { FiX, FiZap, FiGift, FiTrendingUp } from 'react-icons/fi';
import { useAuth } from '@/contexts/AuthContext';

const OPEN_DELAY_MS = 600;

export default function BlazeWelcomeModal() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  // Don't promote sign-up on top of the auth/admin pages themselves
  const path = pathname?.toLowerCase() || '';
  if (path.startsWith('/auth') || path.startsWith('/admin')) return null;

  if (!open || authLoading) return null;

  const close = () => setOpen(false);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={close}
      />

      {/* Card */}
      <div className="blaze-modal-pop relative w-full max-w-md bg-neutral-900 border border-orange-500/40 rounded-2xl shadow-2xl shadow-orange-500/20 overflow-hidden">
        {/* Close */}
        <button
          onClick={close}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-orange-500/20 transition-colors"
        >
          <FiX className="h-5 w-5" />
        </button>

        {/* Banner */}
        <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-red-700 px-6 pt-8 pb-6 text-center">
          <div className="flex justify-center mb-3">
            <Image src="/logo-fixed.png" alt="FireScreener" width={48} height={48} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-100 mb-1">
            New on FireScreener
          </p>
          <h2 className="text-2xl font-bold text-white">
            BLAZE Candies <span aria-hidden>🔥</span>
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-300 text-center">
            Earn free BLAZE points every day just for showing up.
          </p>

          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 p-2 rounded-lg bg-orange-500/15 text-orange-400">
                <FiZap className="h-4 w-4" />
              </span>
              <p className="text-sm text-gray-300">
                <span className="text-white font-medium">10 BLAZE daily</span> — one tap claims your points for the day.
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 p-2 rounded-lg bg-orange-500/15 text-orange-400">
                <FiTrendingUp className="h-4 w-4" />
              </span>
              <p className="text-sm text-gray-300">
                <span className="text-white font-medium">Keep the streak</span> — claim 7 days in a row without missing one.
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 p-2 rounded-lg bg-orange-500/15 text-orange-400">
                <FiGift className="h-4 w-4" />
              </span>
              <p className="text-sm text-gray-300">
                <span className="text-white font-medium">Bonus drops</span> — +10 BLAZE on day 3 and +20 on day 7.
              </p>
            </li>
          </ul>

          {/* CTAs */}
          {isAuthenticated ? (
            <div className="space-y-2 pt-1">
              <Link
                href="/blaze-claim"
                onClick={close}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
              >
                <FiZap className="h-4 w-4" />
                Claim Today&apos;s BLAZE
              </Link>
              <button
                onClick={close}
                className="w-full px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-orange-500/10 transition-colors"
              >
                Maybe later
              </button>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              <Link
                href="/auth/signup"
                onClick={close}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
              >
                <FiZap className="h-4 w-4" />
                Sign Up &amp; Start Claiming
              </Link>
              <Link
                href="/auth/login"
                onClick={close}
                className="flex items-center justify-center w-full px-4 py-2 rounded-lg border border-orange-500/30 text-sm text-gray-300 hover:bg-orange-500/10 transition-colors"
              >
                I already have an account
              </Link>
              <p className="text-xs text-gray-500 text-center pt-1">
                Free forever. Takes less than a minute.
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes blaze-modal-pop {
          0% { opacity: 0; transform: scale(0.92) translateY(12px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .blaze-modal-pop { animation: blaze-modal-pop 0.35s ease-out; }
      `}</style>
    </div>
  );
}
