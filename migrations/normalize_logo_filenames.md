# Normalize `token-logos` filenames to lowercase

## Why this exists

Logo files in the `token-logos` bucket are named after the token address:

```
token-logos/<chain>/<address>.<png|jpg|jpeg|webp>
```

Historically the address came from `TOKEN_REGISTRY`, which stores EVM addresses in
mixed case. So roughly half the legacy files are named with mixed case:

```
bsc/0x000Ae314E2A2172a039B26378814C252734f556A.jpg
bsc/0x034437C7037317eaAbA782f2aD5B0A54cFcCf726.jpg
```

Now that Supabase `tokens` is the source of truth and a BEFORE trigger lowercases
`address` on write, the registry no longer carries that casing — so those files stop
resolving. `/api/dev/upload-logo` writes `tokenRow.address` (already lowercased), so
**new** uploads are lowercase and unaffected.

## Current state — working, but not clean

`CANONICAL_ADDRESSES` in `src/lib/tokenRegistry.server.ts` recovers the mixed-case
address from the static registry, which makes the legacy filenames resolve again.
Verified: 123 of 127 token logos return 200. (The other 4 — `nuke`, `rapa`, `rvm`,
`wnt` — have no file in the bucket at all; that is a missing-asset gap, not a casing
problem.)

The cost is that `TOKEN_REGISTRY` stays load-bearing for logo resolution, which is
exactly what the migration away from it was meant to end.

## The cleanup

One-time rename of every mixed-case object in the bucket to its lowercase name, after
which `CANONICAL_ADDRESSES` can be reduced to sol-only (still needed there — base58 is
genuinely case-sensitive) or dropped entirely once
`fix_solana_address_casing.sql` has been applied.

Sketch — the Storage API has no rename, so it is copy-then-delete per object:

```
POST /storage/v1/object/copy   { bucketId, sourceKey, destinationKey }
DELETE /storage/v1/object/token-logos/<sourceKey>
```

Steps:

1. List every object under each `<chain>/` prefix.
2. Select those where `name !== name.toLowerCase()`.
3. Copy to the lowercased key; verify the copy reads back.
4. Delete the original only after the copy is confirmed.
5. Bust the logo cache keys: `logo:<chain>:<address-lowercased>`.

Do this with the service-role key, and take a bucket listing beforehand so the
pre-state is recoverable.

## Known cruft to fix while in there

- `sol/0x0a3eb4a67f9a1f7a7fe06de5c21cb5aeca083d7b.jpeg` — an EVM address filed under
  the `sol/` prefix.
- `sol/erpxkeafakukearbcfsvnlza1garwujbbbqcukxpbonk.jpg` duplicates
  `sol/ERpXkEafaKuKEARBCFsVnLZA1GARWUjBBbQCukXpbonk.jpeg`. Solana filenames must keep
  their canonical base58 casing — do **not** lowercase the `sol/` prefix.
