import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook to preserve scroll position and prevent page refresh when navigating back
 * Stores scroll position in sessionStorage and automatically restores it
 */
export function useScrollRestoration(key: string = 'scrollPosition') {
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Restore scroll position when component mounts
    const restoreScroll = () => {
      const savedPosition = sessionStorage.getItem(key);
      if (savedPosition) {
        const position = parseInt(savedPosition, 10);
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
          window.scrollTo(0, position);
        }, 0);
      }
    };

    // Restore on mount
    restoreScroll();

    // Save scroll position when user scrolls
    const handleScroll = () => {
      scrollPositionRef.current = window.scrollY;
      sessionStorage.setItem(key, String(window.scrollY));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [key]);

  // Return a function to manually save current scroll position
  return () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(key, String(window.scrollY));
    }
  };
}

/**
 * Hook to preserve any data in sessionStorage with automatic cleanup on tab close
 * Useful for preserving tokens list, filters, etc.
 */
export function useSessionStorage<T>(key: string, initialValue: T) {
  // Always start with initialValue so server and client initial renders match.
  // sessionStorage is read in a useEffect (client-only) to avoid hydration mismatches
  // caused by the server/client branch `if (typeof window !== 'undefined')`.
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const item = sessionStorage.getItem(key);
      if (item !== null) {
        setValue(JSON.parse(item) as T);
      }
    } catch (error) {
      console.error(`Error reading from sessionStorage key "${key}":`, error);
    }
  }, [key]);

  // Use functional setState so this setter doesn't close over stale `value`.
  const setStoredValue = useCallback((newValueOrFn: T | ((prev: T) => T)) => {
    setValue(prev => {
      const next = typeof newValueOrFn === 'function'
        ? (newValueOrFn as (p: T) => T)(prev)
        : newValueOrFn;
      try {
        sessionStorage.setItem(key, JSON.stringify(next));
      } catch (error) {
        console.error(`Error writing to sessionStorage key "${key}":`, error);
      }
      return next;
    });
  }, [key]);

  return [value, setStoredValue] as const;
}

/**
 * Hook to detect if user is returning to page without triggering re-fetch
 * Uses a ref to check on first mount only - avoids re-render cycles
 */
export function useShouldSkipInitialFetch(pageKey: string): boolean {
  const shouldSkipRef = useRef(false);
  const initializedRef = useRef(false);

  // Check only once on mount
  if (!initializedRef.current) {
    initializedRef.current = true;
    // Only check sessionStorage on client side
    if (typeof window !== 'undefined') {
      shouldSkipRef.current = sessionStorage.getItem(`${pageKey}-data`) !== null;
    }
  }

  return shouldSkipRef.current;
}
