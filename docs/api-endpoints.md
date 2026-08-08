# FireScreener API Endpoint Catalog

**Base URL:** `https://firescreener.com/api`

All 109 route handlers under [src/app/api/](../src/app/api/), documented against the production origin. Every example below is a copy-pasteable `curl`.

> Generated from source. No live requests were made — status codes and response bodies are **not** verified here.

## Conventions

- `<chain>` is one of `bsc` | `eth` | `sol` | `rwa` (RWA = AssetChain).
- `<address>` is a token contract address. EVM chains use `0x…`; Solana uses a base58 mint.
- Addresses are lowercased when used as Redis cache keys, but routes accept either case.
- `"N/A"` is the pervasive sentinel for missing data — a **string**, not `null`.
- CORS is allowlisted in [cors.ts](../src/app/api/utils/cors.ts): `firescreener.com`, `smcstats.com`, `5.smcstats.com`, `phoenixtoken.community`, `tracker.phoenixtoken.community`, `localhost:3000`. Requests from other origins get the first allowlisted origin echoed back, so browser calls from elsewhere will fail.

### Sample addresses used in examples

| Chain | Symbol | Address |
|---|---|---|
| `bsc` | PHT | `0x885c99a787BE6b41cbf964174C771A9f7ec48e04` |
| `eth` | TET | `0x68A47Fe1CF42eBa4a030a10CD4D6a1031Ca3CA0a` |
| `sol` | REST | `ERpXkEafaKuKEARBCFsVnLZA1GARWUjBBbQCukXpbonk` |
| `rwa` | xRWA | `0x02afe9989D86a0357fbb238579FE035dc17BcAB0` |

---

## 1. Core token data

The endpoints the home page and token pages actually depend on.

| Method | Endpoint | Query params | Notes |
|---|---|---|---|
| GET | `/api/tokens` | `sortBy`, `identifier`, `source` | Home page list. `sortBy` = `marketCap` (default) \| `volume`. Pass `identifier` for a single token; `source` = `dexscreener` \| `assetchain` forces one upstream. Cached 30s, stale-while-revalidate. |
| GET | `/api/trending` | — | Trending tokens. |
| GET | `/api/price-change` | `limit`, `sortBy` | Top movers. |
| GET | `/api/featured-tokens` | `address` | Also `POST` (body: `address`, `daysActive`) and `DELETE` to manage. |
| GET | `/api/native-price/<chain>` | — | Native coin price. Supports `bsc`, `eth`, `sol`, `rwa`. |
| GET | `/api/stats/views` · `/api/stats/pages` · `/api/stats/referrers` | — | Site stats. |

```bash
curl -s "https://firescreener.com/api/tokens?sortBy=marketCap"
curl -s "https://firescreener.com/api/tokens?identifier=0x885c99a787BE6b41cbf964174C771A9f7ec48e04"
curl -s "https://firescreener.com/api/trending"
curl -s "https://firescreener.com/api/price-change?limit=10&sortBy=gainers"
curl -s "https://firescreener.com/api/native-price/bsc"
```

---

## 2. Per-chain token endpoints

The same endpoint set is duplicated per chain (each chain reads different RPCs/explorers). Substitute `<chain>` and `<address>`.

| Method | Endpoint | Query params | bsc | eth | sol | rwa |
|---|---|---|:-:|:-:|:-:|:-:|
| GET | `/api/<chain>/token-price/<address>` | — | ✅ | ✅ | ✅ | ✅ |
| GET | `/api/<chain>/token-metrics/<address>` | — | ✅ | ✅ | ✅ | ✅ |
| GET | `/api/<chain>/token-profile/<address>` | — | ✅ | ✅ | ✅ | ✅ |
| GET | `/api/<chain>/token-holders/<address>` | — | ✅ | ✅ | ✅ | ✅ |
| GET | `/api/<chain>/total-supply/<address>` | — | ✅ | ✅ | ✅ | ✅ |
| GET | `/api/<chain>/total-burnt/<address>` | — | ✅ | ✅ | ✅ | ✅ |
| GET | `/api/<chain>/burn-history/<address>` | — | ✅ | ✅ | ✅ | ✅ |
| GET | `/api/<chain>/price-data/<address>` | `selector` *(rwa only)* | ✅ | ✅ | ✅ | ✅ |
| GET | `/api/<chain>/price-history/<address>` | `days`, `priceHistory` | ✅ | ✅ | ⚠️ | ✅ |
| GET | `/api/<chain>/ca/<address>` | — | ✅ | ✅ | ✅ | ✅ |
| GET | `/api/<chain>/volume/<address>` | — | ✅ | ✅ | ✅ | ❌ |
| GET | `/api/<chain>/volume/24h/<address>` | — | ✅ | ✅ | ✅ | ✅ |
| GET | `/api/<chain>/volume/dex/<address>` | — | ✅ | ✅ | ✅ | ✅ |
| GET | `/api/<chain>/token-holders-test` | `tokenAddress` | ✅ | ✅ | ✅ | ✅ |

**Gaps worth knowing:**
- `rwa/volume/<address>` **does not exist** — only `volume/24h` and `volume/dex`. Calling it returns 404.
- `sol/price-history` accepts only `priceHistory`, not `days`.
- `rwa/price-data` uniquely accepts a `selector` query param.
- `token-holders-test` takes the address as a **query param**, not a path segment.

```bash
# One token, full sweep
ADDR=0x885c99a787BE6b41cbf964174C771A9f7ec48e04
for ep in token-price token-metrics token-profile token-holders total-supply total-burnt burn-history price-data ca; do
  echo "== $ep"; curl -s "https://firescreener.com/api/bsc/$ep/$ADDR"; echo
done

curl -s "https://firescreener.com/api/bsc/price-history/$ADDR?days=7"
curl -s "https://firescreener.com/api/bsc/volume/24h/$ADDR"
curl -s "https://firescreener.com/api/sol/token-price/ERpXkEafaKuKEARBCFsVnLZA1GARWUjBBbQCukXpbonk"
curl -s "https://firescreener.com/api/rwa/price-data/0x02afe9989D86a0357fbb238579FE035dc17BcAB0?selector=1d"
```

---

## 3. Chain-generic endpoints

These branch on `chain` internally — one handler, all chains.

| Method | Endpoint | Query params | Notes |
|---|---|---|---|
| GET | `/api/<chain>/logo/<identifier>` | — | Supabase Storage-backed; tries original-case and lowercase, png/jpg/jpeg/webp. |
| GET | `/api/<chain>/socials/<identifier>` | — | |
| GET | `/api/<chain>/description/<identifier>` | — | |
| GET | `/api/<chain>/chart/<identifier>` | — | |
| GET | `/api/<chain>/token-data/<identifier>` | — | |
| GET | `/api/<chain>/holders/<identifier>` | — | |
| GET | `/api/<chain>/security/<address>` | — | GoPlus security score. |
| GET | `/api/<chain>/honeypot/<address>` | — | |
| GET | `/api/<chain>/waraguard` | `address` **(required)** | Address is a **query param**, not a path segment. Returns 400 for `sol`. |

```bash
curl -s "https://firescreener.com/api/bsc/logo/0x885c99a787BE6b41cbf964174C771A9f7ec48e04"
curl -s "https://firescreener.com/api/bsc/security/0x885c99a787BE6b41cbf964174C771A9f7ec48e04"
curl -s "https://firescreener.com/api/bsc/waraguard?address=0x885c99a787BE6b41cbf964174C771A9f7ec48e04"
```

---

## 4. Auth

Regular users (`auth_users` table, bcrypt, session in `localStorage`).

| Method | Endpoint | Body |
|---|---|---|
| POST | `/api/auth/signup` | `username`, `email`, `password`, `confirmPassword` |
| POST | `/api/auth/login` | `login`, `password` |
| POST | `/api/auth/logout` | — |
| POST | `/api/auth/send-verification` | `userId`, `email` |
| POST | `/api/auth/verify-code` | `userId`, `code` |
| POST | `/api/auth/verify-session` | `userId` |
| POST | `/api/auth/user-type` | `userId`, `email` |

```bash
curl -s -X POST "https://firescreener.com/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"login":"user@example.com","password":"..."}'
```

---

## 5. Developer accounts

Supabase Auth proper (`developer_accounts`). Mutating routes require `Authorization: Bearer <supabase_access_token>`.

| Method | Endpoint | Body / Notes |
|---|---|---|
| POST | `/api/dev/signup` | `username`, `email`, `password` |
| POST | `/api/dev/verify` | `email`, `code` |
| GET | `/api/dev/token-info` | 🔒 Bearer |
| POST · PATCH | `/api/dev/token-info` | 🔒 Bearer — `address`, `chain`, `description`, `website`, `twitter`, `telegram`, `header_image`, `is_burn` |
| POST | `/api/dev/upload-logo` | 🔒 Bearer — multipart form |
| POST | `/api/dev/upload-header` | 🔒 Bearer — multipart form |

```bash
curl -s "https://firescreener.com/api/dev/token-info" -H "Authorization: Bearer $SUPABASE_TOKEN"
```

---

## 6. Blaze rewards (7-day streak)

Streak board is a bitmask on the user row (`blaze_claimed_days`). Resets at 00:00 UTC.

| Method | Endpoint | Body / Query |
|---|---|---|
| POST | `/api/blaze/claim` | `userId` |
| POST | `/api/blaze/bonus-claim` | `userId` — bonus unlocks on days 3 and 7, same-UTC-day window only |
| GET | `/api/blaze/history` | `?userId=` |

```bash
curl -s -X POST "https://firescreener.com/api/blaze/claim" \
  -H 'Content-Type: application/json' -d '{"userId":"<uuid>"}'
curl -s "https://firescreener.com/api/blaze/history?userId=<uuid>"
```

---

## 7. Rewards & engagement

| Method | Endpoint | Body / Query |
|---|---|---|
| GET | `/api/rewards` | — |
| POST | `/api/rewards/redeem` | `userId`, `rewardId`, `walletAddress` |
| POST | `/api/rewards/user-claims` | `userId` |
| GET | `/api/user/rewards-claims` | `?userId=` |
| GET · POST | `/api/vote` | GET `?address=` · POST body `tokenAddress`, `chain`, `emoji` |
| GET · POST | `/api/reactions/<address>` | POST body `reactions` |

```bash
curl -s "https://firescreener.com/api/rewards"
curl -s "https://firescreener.com/api/vote?address=0x885c99a787BE6b41cbf964174C771A9f7ec48e04"
curl -s "https://firescreener.com/api/reactions/0x885c99a787BE6b41cbf964174C771A9f7ec48e04"
```

---

## 8. Analytics

| Method | Endpoint | Query |
|---|---|---|
| GET | `/api/analytics` | `timeRange` |
| GET | `/api/analytics/pageviews` | — |
| GET | `/api/analytics/visitors` | — |

---

## 9. Admin 🔒

Gated by an `x-user-email` header checked against admin records (plus `AdminContext` client-side). Not a bearer token.

| Method | Endpoint | Body / Query |
|---|---|---|
| POST | `/api/admin/login` | `email`, `password` |
| POST | `/api/admin/verify` | `email` |
| GET | `/api/admin/analytics` | `?days=` |
| GET · POST | `/api/admin/users` | POST: `username`, `email`, `role` |
| PUT · DELETE | `/api/admin/users/<id>` | PUT: `username`, `role`, `is_active` |
| GET · POST | `/api/admin/rewards` | POST: `name`, `description`, `cost`, `type`, `stock`, `icon`, `color`, `badge` |
| PUT · DELETE | `/api/admin/rewards/<id>` | same fields as POST |
| GET | `/api/admin/rewards/<id>/claims` | — |
| GET | `/api/admin/redemptions` | `limit`, `offset`, `rewardId` |

---

## 10. Workers & cache 🔒

Cron-driven cache warming. `refresh-*` require `Authorization: Bearer $CRON_SECRET` (enforced only when `CRON_SECRET` is set).

| Method | Endpoint | Schedule | Notes |
|---|---|---|---|
| GET | `/api/workers/refresh-active` | every minute | 🔒 Refreshes only tokens currently being viewed. |
| GET | `/api/workers/refresh-cache` | every 5 min | 🔒 Broader sweep. |
| GET · POST | `/api/workers/track-active` | on demand | POST body `tokenAddress`, `chain`. Called by `useTrackActiveToken` on token-page mount. |
| GET | `/api/cache/api` | — | `action`, `chain`, `address` |
| GET | `/api/cache/logos` | — | `action` |
| GET | `/api/debug/featured-tokens` | — | Debug helper. |

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://firescreener.com/api/workers/refresh-active"

curl -s -X POST "https://firescreener.com/api/workers/track-active" \
  -H 'Content-Type: application/json' \
  -d '{"tokenAddress":"0x885c99a787BE6b41cbf964174C771A9f7ec48e04","chain":"bsc"}'
```

⚠️ Upstash's REST API does not support `SCAN`, so cache clearing cannot enumerate keys — `clearDexScreenerCache` / `clearAssetChainCache` in [cache-manager.ts](../src/lib/cache-manager.ts) are stubs returning `0`. Invalidation must target known addresses.

---

## Quick reference — copy-paste sweep

```bash
BASE=https://firescreener.com/api

# Public, no auth
curl -s "$BASE/tokens?sortBy=marketCap" | head -c 500
curl -s "$BASE/trending" | head -c 500
curl -s "$BASE/price-change?limit=10" | head -c 500
curl -s "$BASE/featured-tokens" | head -c 500
curl -s "$BASE/rewards" | head -c 500

# Per chain
for c in bsc eth sol rwa; do
  curl -s "$BASE/native-price/$c"; echo
done
```
