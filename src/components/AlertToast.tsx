'use client';
import { useEffect } from 'react';
import { FaTimes, FaArrowUp, FaArrowDown, FaBell } from 'react-icons/fa';
import type { AlertToastData } from '@/hooks/usePriceAlerts';

interface Props {
  toasts: AlertToastData[];
  onDismiss: (id: string) => void;
}

const AUTO_DISMISS_MS = 10_000;

export default function AlertToast({ toasts, onDismiss }: Props) {
  // Auto-dismiss each toast after AUTO_DISMISS_MS
  useEffect(() => {
    if (toasts.length === 0) return;
    const latest = toasts[toasts.length - 1];
    const timer = setTimeout(() => onDismiss(latest.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toasts, onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-[100] flex flex-col gap-2 w-72">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 p-3.5 rounded-xl shadow-2xl border text-white animate-slide-up ${
            toast.direction === 'up'
              ? 'bg-green-900/95 border-green-600'
              : 'bg-red-900/95 border-red-600'
          }`}
        >
          {/* Icon */}
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              toast.direction === 'up' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {toast.direction === 'up' ? (
              <FaArrowUp size={12} />
            ) : (
              <FaArrowDown size={12} />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <FaBell size={10} className="opacity-70" />
              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                Price Alert
              </span>
            </div>
            <p className="text-sm font-semibold leading-tight">{toast.message}</p>
            <p className="text-xs opacity-70 mt-0.5">
              Now: ${toast.price < 0.0001 ? toast.price.toExponential(4) : toast.price.toFixed(8)}
            </p>
          </div>

          {/* Dismiss */}
          <button
            onClick={() => onDismiss(toast.id)}
            className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity mt-0.5"
          >
            <FaTimes size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
