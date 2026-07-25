'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TokenPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('Token page error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <p className="text-4xl mb-4" aria-hidden>🔥</p>
        <h1 className="text-xl font-semibold text-white mb-2">
          Something went wrong loading this token
        </h1>
        <p className="text-sm text-gray-400 mb-6">
          A part of the dashboard failed to render. You can try again or head back to the screener.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => router.push('/')}
            className="border border-orange-500/30 text-gray-300 hover:bg-orange-500/10 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}
