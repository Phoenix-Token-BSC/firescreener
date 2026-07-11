// Daily claim cooldown: one claim per UTC calendar day, resetting at 00:00 UTC.

export function isSameUtcDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

export function hasClaimedToday(lastClaimAt: string | null, now: Date = new Date()): boolean {
  if (!lastClaimAt) return false;
  return isSameUtcDay(new Date(lastClaimAt), now);
}

// Whole UTC calendar days between two timestamps (0 = same day, 1 = yesterday, ...)
export function utcDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((b - a) / (24 * 60 * 60 * 1000));
}

// The streak breaks when at least one full day passed without a claim:
// last claim today (0) or yesterday (1) keeps it alive, 2+ days resets it.
export function isStreakBroken(lastClaimAt: string | null, now: Date = new Date()): boolean {
  if (!lastClaimAt) return false;
  return utcDaysBetween(new Date(lastClaimAt), now) >= 2;
}

export function timeUntilNextUtcMidnight(now: Date = new Date()): {
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
} {
  const nextMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  );
  const remaining = nextMidnight - now.getTime();

  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((remaining % (60 * 1000)) / 1000);

  return { hours, minutes, seconds, formatted: `${hours}h ${minutes}m ${seconds}s` };
}
