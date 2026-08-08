-- Restore case-sensitive base58 casing for Solana addresses in `tokens`.
--
-- Solana addresses are case-sensitive base58. Every sol row in `tokens` is stored
-- lowercased, which breaks every Helius RPC call for those tokens:
--
--   /api/sol/total-supply/<addr>   -> {"error":"Token not found on Solana"}
--   /api/sol/token-holders/<addr>  -> {"error":"Failed to fetch token holders"}
--   /api/sol/token-metrics/<addr>  -> {"error":"Failed to fetch token supply from Solana RPC"}
--
-- EVM chains (bsc/eth/rwa) are unaffected — hex addresses are case-insensitive.
--
-- This did not surface while TOKEN_REGISTRY was the source of truth, because the
-- static array holds the canonical casing. It bites as soon as the `tokens` table
-- becomes authoritative.
--
-- RUN THIS IN THE SUPABASE SQL EDITOR. A plain PostgREST PATCH is not enough: a
-- BEFORE trigger on `tokens` rewrites address to lower() on write, so the UPDATEs
-- below silently no-op until that trigger is dropped (step 1).

-- ── 1. Find and drop the trigger that lowercases address ────────────────────────
--
-- The trigger was created directly in the SQL editor and is not tracked in this
-- repo (same story as drop_legacy_blaze_triggers.sql). Inspect first:

SELECT t.tgname            AS trigger_name,
       p.proname           AS function_name,
       pg_get_functiondef(p.oid) AS definition
FROM pg_trigger t
JOIN pg_class  c ON c.oid = t.tgrelid
JOIN pg_proc   p ON p.oid = t.tgfoid
WHERE c.relname = 'tokens'
  AND NOT t.tgisinternal;

-- Then drop the one that lowercases address, e.g.:
--
--   DROP TRIGGER <trigger_name> ON tokens;
--   DROP FUNCTION <function_name>();
--
-- If you want to keep normalizing EVM addresses, make the function chain-aware
-- instead of dropping it outright:
--
--   NEW.address := CASE WHEN NEW.chain = 'sol' THEN NEW.address
--                       ELSE lower(NEW.address) END;

-- ── 2. Restore canonical casing ─────────────────────────────────────────────────

UPDATE tokens SET address = '3roGjzv4TeaWFN8VN6hfUKAsmoVUrYmmB2Dz3NYF1GAA' WHERE lower(address) = '3rogjzv4teawfn8vn6hfukasmovurymmb2dz3nyf1gaa' AND chain = 'sol'; -- finu
UPDATE tokens SET address = 'ERpXkEafaKuKEARBCFsVnLZA1GARWUjBBbQCukXpbonk' WHERE lower(address) = 'erpxkeafakukearbcfsvnlza1garwujbbbqcukxpbonk' AND chain = 'sol'; -- rest
UPDATE tokens SET address = 'CbdMt7xCe91AiAwnqtiHpUB5QrR3Z3ZL3LqnKGSypump' WHERE lower(address) = 'cbdmt7xce91aiawnqtihpub5qrr3z3zl3lqnkgsypump' AND chain = 'sol'; -- amen
UPDATE tokens SET address = '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump' WHERE lower(address) = '9crcn9rgt8v2imem2baks13yhmeais3rum3rpvtgpump' AND chain = 'sol'; -- ansem
UPDATE tokens SET address = '5Cd2u2mkWXPMXdXFAHSPXvbDaUPYTkc4KWVMyFw1hray' WHERE lower(address) = '5cd2u2mkwxpmxdxfahspxvbdaupytkc4kwvmyfw1hray' AND chain = 'sol'; -- dxa
UPDATE tokens SET address = '4kdX3qeL1t8CoVLVM6XDygTBWz8XfWLRSuLJmojJpump' WHERE lower(address) = '4kdx3qel1t8covlvm6xdygtbwz8xfwlrsuljmojjpump' AND chain = 'sol'; -- king
UPDATE tokens SET address = 'q8gxXxDi4NK6W4NAJkNjwn52DBUgFkK9MazVDMHpump' WHERE lower(address) = 'q8gxxxdi4nk6w4najknjwn52dbugfkk9mazvdmhpump' AND chain = 'sol'; -- merry cat
UPDATE tokens SET address = 'NUKEB18Z7r2o9dT15uu5sjpcvsMKCsUAwJN1xch48JR' WHERE lower(address) = 'nukeb18z7r2o9dt15uu5sjpcvsmkcsuawjn1xch48jr' AND chain = 'sol'; -- nuke
UPDATE tokens SET address = '2vvw3cSwibzGD6SgW9QzRaBdmjkYrvs218DUy6VWpump' WHERE lower(address) = '2vvw3cswibzgd6sgw9qzrabdmjkyrvs218duy6vwpump' AND chain = 'sol'; -- sunusi
UPDATE tokens SET address = '8iX3bBsYuA2u7zfcYX8LrHQNWtqDrAAXCfKvgZWbonk' WHERE lower(address) = '8ix3bbsyua2u7zfcyx8lrhqnwtqdraaxcfkvgzwbonk' AND chain = 'sol'; -- tpt

-- ── 3. Verify — expect 0 rows ───────────────────────────────────────────────────

SELECT address, symbol FROM tokens WHERE chain = 'sol' AND address = lower(address);
