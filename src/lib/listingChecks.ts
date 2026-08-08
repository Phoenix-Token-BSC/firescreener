// Automated vetting for self-service token listings.
//
// Decides one of three outcomes for a submitted contract:
//
//   reject  — the token cannot work on the site, or is provably hostile. Told to the
//             submitter with a reason; nothing is written as live.
//   review  — plausible but not clean enough to publish unattended. Goes to the admin
//             queue with the findings attached.
//   approve — passes every check. Goes live immediately.
//
// Bias: a check that errors or times out yields `review`, never `approve`. An outage at
// GoPlus must not become an open door.

import type { Chain } from './tokenRegistry.server';

// A pair below this is too illiquid to render meaningful charts//metrics, and is the
// usual shape of a freshly deployed rug.
const MIN_LIQUIDITY_USD = 5_000;
// Pairs younger than this haven't established anything yet.
const MIN_PAIR_AGE_HOURS = 24;

const GOPLUS_CHAIN_ID: Record<string, string> = {
  bsc: '56',
  rwa: '56',
  eth: '1',
  sol: 'solana',
};

export type Verdict = 'approve' | 'review' | 'reject';

export interface CheckResult {
  /** Stable id so the UI and stored `checks` JSON can be matched up. */
  id: string;
  label: string;
  /** pass = clean, warn = needs a human, fail = disqualifying. */
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface ListingAssessment {
  verdict: Verdict;
  checks: CheckResult[];
  /** Metadata discovered on-chain/from the pair — used to prefill the listing row. */
  discovered: {
    name?: string;
    symbol?: string;
    liquidityUsd?: number;
    priceUsd?: string;
    pairCreatedAt?: number;
  };
  /** Present when verdict is 'reject' — shown to the submitter. */
  reason?: string;
}

async function fetchJson(url: string, timeoutMs = 10_000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface DexToken {
  address?: string;
  name?: string;
  symbol?: string;
}

interface DexPair {
  chainId?: string;
  baseToken?: DexToken;
  quoteToken?: DexToken;
  liquidity?: { usd?: number };
  priceUsd?: string;
  pairCreatedAt?: number;
}

/**
 * The submitted token's own side of a pair.
 *
 * A pair has two sides and the submitted address may be either one. Reading `baseToken`
 * unconditionally misnames anything that trades as the quote asset — submitting USDT
 * returned the deepest USDT pair, whose base is some other token entirely, and recorded
 * that token's name and symbol against the USDT address.
 */
function sideOf(pair: DexPair, address: string): DexToken | null {
  const target = address.toLowerCase();
  if (pair.baseToken?.address?.toLowerCase() === target) return pair.baseToken;
  if (pair.quoteToken?.address?.toLowerCase() === target) return pair.quoteToken;
  return null;
}

/**
 * DexScreener is the gating check: if there is no tradeable pair, no amount of other
 * data makes the token renderable on the site.
 */
export interface DiscoveredToken {
  name: string;
  symbol: string;
  liquidityUsd?: number;
  priceUsd?: string;
  pairCount: number;
}

/**
 * Name/symbol lookup for the listing form's live preview — DexScreener only, no
 * security checks, so it stays fast enough to run as the user pastes an address.
 * assessListing() remains the authority at submit time.
 */
export async function discoverToken(address: string): Promise<DiscoveredToken | null> {
  try {
    const data = (await fetchJson(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`
    )) as { pairs?: DexPair[] };

    const pairs = (data?.pairs ?? []).filter((p) => sideOf(p, address) !== null);
    if (pairs.length === 0) return null;

    const pair = rankPairs(pairs, address)[0];
    const token = sideOf(pair, address);
    if (!token?.symbol) return null;

    return {
      name: token.name || token.symbol,
      symbol: token.symbol,
      liquidityUsd: pair.liquidity?.usd,
      priceUsd: pair.priceUsd,
      pairCount: pairs.length,
    };
  } catch {
    return null;
  }
}

/**
 * Deepest pair first, but always preferring pairs where the submitted token is the base
 * asset — that is the pool whose price and liquidity describe *this* token rather than
 * its counterparty.
 */
function rankPairs(pairs: DexPair[], address: string): DexPair[] {
  const target = address.toLowerCase();
  return [...pairs].sort((a, b) => {
    const aBase = a.baseToken?.address?.toLowerCase() === target ? 1 : 0;
    const bBase = b.baseToken?.address?.toLowerCase() === target ? 1 : 0;
    if (aBase !== bBase) return bBase - aBase;
    return (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0);
  });
}

async function checkDexScreener(
  address: string
): Promise<{ check: CheckResult; pair: DexPair | null; token: DexToken | null }> {
  try {
    const data = (await fetchJson(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`
    )) as { pairs?: DexPair[] };

    // Keep only pairs that actually contain the submitted token, then judge the deepest
    // of those — minor pools tell you nothing about real liquidity.
    const pairs = (data?.pairs ?? []).filter((p) => sideOf(p, address) !== null);

    if (pairs.length === 0) {
      return {
        check: {
          id: 'dexscreener',
          label: 'Tradeable pair',
          status: 'fail',
          detail: 'No trading pair found on DexScreener.',
        },
        pair: null,
        token: null,
      };
    }

    const pair = rankPairs(pairs, address)[0];

    return {
      check: {
        id: 'dexscreener',
        label: 'Tradeable pair',
        status: 'pass',
        detail: `Found ${pairs.length} pair${pairs.length === 1 ? '' : 's'}.`,
      },
      pair,
      token: sideOf(pair, address),
    };
  } catch (err) {
    return {
      check: {
        id: 'dexscreener',
        label: 'Tradeable pair',
        status: 'warn',
        detail: `DexScreener unreachable (${(err as Error).message}). Needs manual check.`,
      },
      pair: null,
      token: null,
    };
  }
}

function checkLiquidity(pair: DexPair | null): CheckResult {
  const usd = pair?.liquidity?.usd;
  if (usd == null) {
    return {
      id: 'liquidity',
      label: 'Liquidity',
      status: 'warn',
      detail: 'Liquidity unknown.',
    };
  }
  const formatted = `$${Math.round(usd).toLocaleString()}`;
  if (usd < MIN_LIQUIDITY_USD) {
    return {
      id: 'liquidity',
      label: 'Liquidity',
      status: 'warn',
      detail: `${formatted} is below the $${MIN_LIQUIDITY_USD.toLocaleString()} auto-approve threshold.`,
    };
  }
  return { id: 'liquidity', label: 'Liquidity', status: 'pass', detail: formatted };
}

function checkPairAge(pair: DexPair | null): CheckResult {
  const created = pair?.pairCreatedAt;
  if (!created) {
    return { id: 'pair_age', label: 'Pair age', status: 'warn', detail: 'Age unknown.' };
  }
  const hours = (Date.now() - created) / 3_600_000;
  if (hours < MIN_PAIR_AGE_HOURS) {
    return {
      id: 'pair_age',
      label: 'Pair age',
      status: 'warn',
      detail: `Pair is ${Math.floor(hours)}h old (under ${MIN_PAIR_AGE_HOURS}h).`,
    };
  }
  const days = Math.floor(hours / 24);
  return { id: 'pair_age', label: 'Pair age', status: 'pass', detail: `${days} day${days === 1 ? '' : 's'} old.` };
}

interface GoPlusSecurity {
  is_honeypot?: string;
  cannot_sell_all?: string;
  is_blacklisted?: string;
  is_proxy?: string;
  is_mintable?: string;
  can_take_back_ownership?: string;
  hidden_owner?: string;
  selfdestruct?: string;
  is_open_source?: string;
  buy_tax?: string;
  sell_tax?: string;
}

const yes = (v: string | undefined) => v === '1';

/**
 * GoPlus token-security. EVM only — Solana returns a different shape with far fewer
 * fields, so sol submissions always go to review instead.
 */
async function checkSecurity(chain: Chain, address: string): Promise<CheckResult[]> {
  if (chain === 'sol') {
    return [
      {
        id: 'security',
        label: 'Contract security',
        status: 'warn',
        detail: 'Automated security analysis is not available for Solana — needs manual review.',
      },
    ];
  }

  const chainId = GOPLUS_CHAIN_ID[chain];
  try {
    const data = (await fetchJson(
      `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`
    )) as { code?: number; result?: Record<string, GoPlusSecurity> };

    if (data?.code !== 1 || !data.result) throw new Error('GoPlus returned no result');

    const sec =
      data.result[address.toLowerCase()] ?? data.result[address] ?? Object.values(data.result)[0];
    if (!sec) throw new Error('Contract not indexed by GoPlus');

    const checks: CheckResult[] = [];

    // Disqualifying — these are not judgement calls.
    if (yes(sec.is_honeypot)) {
      checks.push({ id: 'honeypot', label: 'Honeypot', status: 'fail', detail: 'Flagged as a honeypot — buyers cannot sell.' });
    } else {
      checks.push({ id: 'honeypot', label: 'Honeypot', status: 'pass', detail: 'Not flagged as a honeypot.' });
    }

    if (yes(sec.selfdestruct)) {
      checks.push({ id: 'selfdestruct', label: 'Self-destruct', status: 'fail', detail: 'Contract can self-destruct.' });
    }
    if (yes(sec.cannot_sell_all)) {
      checks.push({ id: 'cannot_sell', label: 'Sell restriction', status: 'fail', detail: 'Holders cannot sell their full balance.' });
    }

    // Worth a human, not an automatic no.
    const flags: Array<[boolean, string, string]> = [
      [yes(sec.hidden_owner), 'Hidden owner', 'Contract has a hidden owner.'],
      [yes(sec.can_take_back_ownership), 'Ownership', 'Ownership can be reclaimed.'],
      [yes(sec.is_mintable), 'Mintable', 'Supply can be minted.'],
      [yes(sec.is_blacklisted), 'Blacklist', 'Contract can blacklist addresses.'],
      [yes(sec.is_proxy), 'Proxy', 'Contract is upgradeable via proxy.'],
    ];
    for (const [tripped, label, detail] of flags) {
      if (tripped) checks.push({ id: label.toLowerCase().replace(/\s+/g, '_'), label, status: 'warn', detail });
    }

    if (sec.is_open_source !== undefined && !yes(sec.is_open_source)) {
      checks.push({ id: 'verified', label: 'Source verified', status: 'warn', detail: 'Contract source is not verified.' });
    }

    const buyTax = parseFloat(sec.buy_tax ?? '0') * 100;
    const sellTax = parseFloat(sec.sell_tax ?? '0') * 100;
    if (buyTax > 10 || sellTax > 10) {
      checks.push({
        id: 'tax',
        label: 'Trading tax',
        status: 'warn',
        detail: `Buy ${buyTax.toFixed(1)}% / sell ${sellTax.toFixed(1)}% — above 10%.`,
      });
    } else {
      checks.push({ id: 'tax', label: 'Trading tax', status: 'pass', detail: `Buy ${buyTax.toFixed(1)}% / sell ${sellTax.toFixed(1)}%.` });
    }

    return checks;
  } catch (err) {
    // Never let an outage auto-approve.
    return [
      {
        id: 'security',
        label: 'Contract security',
        status: 'warn',
        detail: `Security check unavailable (${(err as Error).message}). Needs manual review.`,
      },
    ];
  }
}

/**
 * Run every check and fold the results into a single verdict.
 */
export async function assessListing(chain: Chain, address: string): Promise<ListingAssessment> {
  const { check: dexCheck, pair, token } = await checkDexScreener(address);

  // No pair means nothing else is worth asking — the token cannot render.
  if (dexCheck.status === 'fail') {
    return {
      verdict: 'reject',
      checks: [dexCheck],
      discovered: {},
      reason:
        'No trading pair was found for this contract on DexScreener. A token needs a live pair before it can be listed.',
    };
  }

  const [securityChecks] = await Promise.all([checkSecurity(chain, address)]);

  const checks: CheckResult[] = [
    dexCheck,
    checkLiquidity(pair),
    checkPairAge(pair),
    ...securityChecks,
  ];

  const discovered = {
    // From the submitted token's own side of the pair, not whichever side happens to
    // be listed as base.
    name: token?.name,
    symbol: token?.symbol,
    liquidityUsd: pair?.liquidity?.usd,
    priceUsd: pair?.priceUsd,
    pairCreatedAt: pair?.pairCreatedAt,
  };

  const failed = checks.filter((c) => c.status === 'fail');
  if (failed.length > 0) {
    return {
      verdict: 'reject',
      checks,
      discovered,
      reason: failed.map((c) => c.detail).join(' '),
    };
  }

  const warned = checks.some((c) => c.status === 'warn');
  return { verdict: warned ? 'review' : 'approve', checks, discovered };
}
