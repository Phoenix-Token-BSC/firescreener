export const DAILY_REWARD = 10;

// Bonus rewards unlocked when the matching daily streak day is claimed.
export const BONUS_REWARDS: Record<number, number> = {
  3: 10,
  7: 20,
};

// The 7-day board is stored as a bitmask on the user row: bit 0 = day 1 ... bit 6 = day 7.
export function isDayClaimed(mask: number, dayNumber: number): boolean {
  return (mask & (1 << (dayNumber - 1))) !== 0;
}

export function withDayClaimed(mask: number, dayNumber: number): number {
  return mask | (1 << (dayNumber - 1));
}

export const BONUS_DAYS = Object.keys(BONUS_REWARDS).map(Number);

export function isBonusDay(dayNumber: number): boolean {
  return dayNumber in BONUS_REWARDS;
}

/**
 * Bonus claims are only available on the same UTC day as the matching daily claim.
 * After claiming daily day N, current_streak_day advances to N+1 (or 1 after day 7).
 */
export function isBonusClaimWindow(
  bonusDay: number,
  currentStreakDay: number,
  claimedToday: boolean,
  dailyDayClaimed: boolean,
  boardWasReset: boolean
): boolean {
  if (boardWasReset || !dailyDayClaimed || !claimedToday || !isBonusDay(bonusDay)) {
    return false;
  }

  if (bonusDay === 7) {
    return currentStreakDay === 1;
  }

  return currentStreakDay === bonusDay + 1;
}

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
