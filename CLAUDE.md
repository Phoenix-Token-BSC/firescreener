# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FireScreener — a real-time crypto analytics platform built by the Phoenix Token ($PHT) community. Tracks token burns, prices, charts, holders, and security scores across BNB Smart Chain, Ethereum, Solana, and AssetChain (RWA).

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4, deployed on Vercel. Package manager is **pnpm**.

## Commands

```bash
pnpm dev              # dev server on :3000
pnpm build            # production build (also the fastest full typecheck)
pnpm start            # serve the production build
pnpm lint             # next lint
npx tsc --noEmit      # typecheck only
```

There is **no test framework** in this repo — no tests, no runner, no `test` script. Verification is `pnpm build` plus hitting routes manually:

```bash
curl -s "http://localhost:3000/api/tokens" | head
curl -s "http://localhost:3000/api/bsc/token-price/0x885c99a787BE6b41cbf964174C771A9f7ec48e04"
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/workers/refresh-active"
```

Migrations in `migrations/*.sql` are applied by hand against Supabase (or via `node scripts/apply-blaze-migration.js`); there is no migration runner or ordering convention.

## Architecture

### The central data pipeline

Everything on the home page and token pages flows through one pattern:

```
DexScreener / AssetChain APIs → Upstash Redis → API route → client polls every 15s
```

- **`src/lib/tokenRegistry.ts` is the single source of truth.** `TOKEN_REGISTRY` is a hardcoded array of ~120 tokens, each with `address`, `symbol`, `name`, `chain` (`'bsc' | 'eth' | 'sol' | 'rwa'`), and `isBurn`. Everything else — `TOKEN_MAP`, `ADDRESS_TO_SYMBOL_MAP`, `SYMBOL_TO_ADDRESS_MAP` — is derived from it at module load. **Adding a token means adding a row here.** The top ~80 lines are a commented-out Supabase-backed version of this registry; it is not active.
- **`src/app/api/tokens/route.ts`** builds the home page list. Per token it hits DexScreener and AssetChain in parallel and merges via `pickBestValue` (prefer any non-`"N/A"` value, AssetChain wins for price/market cap). Solana addresses skip the AssetChain call entirely to avoid a 5s timeout. The assembled list is cached under `tokens:all:<sortBy>` for 30s and served stale-while-revalidate — a cache hit returns immediately and kicks off an un-awaited background rebuild.
- **`src/app/page.tsx`** polls `/api/tokens` every 15s and on tab re-focus. Background refreshes preserve object identity for unchanged tokens so `React.memo`'d `TokenRow`s skip re-rendering; results persist to `sessionStorage` for scroll restoration on back-navigation.

`"N/A"` is the pervasive sentinel for missing data — it's a string, propagated end-to-end, and formatters check for it explicitly. Don't replace it with `null` piecemeal.

### Cache warming

Two Vercel crons (`vercel.json`) keep Redis warm, both gated on a `Bearer ${CRON_SECRET}` auth header:

- `/api/workers/refresh-active` — every minute, refreshes only tokens users are currently viewing
- `/api/workers/refresh-cache` — every 5 minutes, broader sweep

"Currently viewing" is tracked in a Redis sorted set `active-tokens`, scored by timestamp. The token detail page calls `useTrackActiveToken` → `POST /api/workers/track-active` on mount; the worker reads back members scored within the last 5 minutes.

Redis key conventions: `dexscreener:<addr>`, `assetchain:<addr>`, `token:<addr>`, `logo:<chain>:<addr>`, `tokens:all:<sortBy>`, `active-tokens`. Addresses are lowercased in keys. Note that **Upstash's REST API does not support `SCAN`**, so there is no way to enumerate or bulk-clear keys — `src/lib/cache-manager.ts` has stub functions (`clearDexScreenerCache`, `clearAssetChainCache`) that return `0` for this reason. Invalidation must target known addresses.

### Three databases, split by purpose

- **Supabase** (`src/lib/supabase.ts`) — users, developer accounts, rewards, blaze streaks, plus Storage buckets for token logos and headers (`token-logos/<chain>/<address>.<ext>`; the logo cacher tries both original-case and lowercase filenames, and png/jpg/jpeg/webp).
- **Upstash Redis** (`src/lib/redis.ts`) — all API response caching. Nothing durable lives here.
- **Firestore** (`src/db/firebase.ts`) — burn event history only, used by the `total-burnt` routes.

### API route layout (~110 routes)

Two distinct groups under `src/app/api/`:

- **Per-chain, duplicated:** `{bsc,eth,sol,rwa}/<endpoint>/[contractAddress]/route.ts` — the same ~14 endpoints (`token-price`, `token-metrics`, `total-supply`, `total-burnt`, `burn-history`, `token-holders`, `volume`, `price-history`, `price-data`, `token-profile`, `ca`) copy-pasted per chain, since each chain reads from different RPCs and explorers. EVM chains use ethers.js against `BSC_RPC_URL` / etc.; Solana routes go through the Helius REST API (`@solana/web3.js` is in `package.json` but is not actually imported anywhere). **A change to one chain's endpoint usually needs replicating across the other three.**
- **Chain-generic:** `[chain]/<endpoint>/[identifier]/route.ts` — `logo`, `socials`, `chart`, `description`, `security` (GoPlus), `honeypot`, `waraguard`. These branch on the `chain` param internally.

Type definitions (`TokenData`, `DexScreenerPair`, …) are declared locally per route rather than shared; `src/types/` holds only analytics types and a GoPlus SDK shim.

### Auth — three parallel systems

1. **Regular users** — custom `auth_users` Supabase table, bcrypt via `src/lib/auth.ts`, email verification codes sent through Resend/nodemailer. Session in `localStorage`.
2. **Developers** — Supabase Auth proper (`developer_accounts`), `userType: 'dev'`. Used for the token-listing/dev dashboard flows.
3. **Admin** — separate again, via `AdminContext` + `/api/admin/verify`.

`AuthContext` unifies (1) and (2) behind one `useAuth()`. It **hydrates optimistically from `localStorage` and verifies against `/api/auth/verify-session` in the background** — the user is only cleared if the server explicitly rejects; network errors keep the optimistic session so offline users aren't logged out.

### Blaze rewards

`src/lib/blaze.ts` implements a 7-day daily claim streak. The board is stored as a **bitmask integer on the user row** (`blaze_claimed_days`, bit 0 = day 1 … bit 6 = day 7) rather than as rows — use `isDayClaimed` / `withDayClaimed` rather than manipulating it directly. Claims reset at 00:00 UTC (`isSameUtcDay`, `hasClaimedToday`); a streak breaks only after 2+ full UTC days without a claim. Bonus payouts unlock on days 3 and 7, and are claimable only during the same UTC day as the matching daily claim (`isBonusClaimWindow`). Both `auth_users` and `developer_accounts` carry the blaze columns, so claim logic must handle either table — see `src/lib/blazeUser.ts`.

## Known rough edges

- **`src/hooks/useTokenData.ts` is dead code.** It is never imported, and its hardcoded `TOKEN_LIST` is a stale, symbol-keyed duplicate of the token registry. Don't use it as a reference or extend it; the live token page is `src/app/[chain]/[contractAddress]/page.tsx` (~1300 lines), which fetches endpoints directly.
- `src/components/desktop/` is empty; `test_rpc.js` at the repo root is empty.
- ESLint has `@typescript-eslint/no-explicit-any` **off** and `no-console` at warn — the codebase uses `any` in places and has a lot of commented-out `console.log` calls.
- `.env` and `.env.local` exist locally and are gitignored. ~35 env vars are required across RPCs, explorers (BscScan/Etherscan/Solscan/Moralis/Helius), Supabase, Upstash, Firebase, Resend, Cloudinary, GoPlus, WaraGuard, and analytics (Umami/Simple Analytics). Missing Supabase vars throw at import time in `src/lib/supabase.ts`.
