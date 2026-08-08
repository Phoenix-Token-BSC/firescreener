-- Self-service token listings: submission + review state on `tokens`.
--
-- RUN THIS IN THE SUPABASE SQL EDITOR before deploying the /new-listing form.
--
-- Until it is applied, the read path treats a missing `status` as 'live', so the site
-- keeps working exactly as it does today — but submissions will fail.

-- ── 1. Submission / review columns ─────────────────────────────────────────────

ALTER TABLE tokens
  ADD COLUMN IF NOT EXISTS status           text NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS submitted_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at     timestamptz,
  -- Admin identity is an email (admin_users is keyed by email, not auth.users).
  ADD COLUMN IF NOT EXISTS reviewed_by      text,
  ADD COLUMN IF NOT EXISTS reviewed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS checks           jsonb;

-- Every token that predates self-service listing is already public. The DEFAULT above
-- covers new rows; this covers any row that somehow landed with a NULL.
UPDATE tokens SET status = 'live' WHERE status IS NULL;

ALTER TABLE tokens
  DROP CONSTRAINT IF EXISTS tokens_status_check;

ALTER TABLE tokens
  ADD CONSTRAINT tokens_status_check
  CHECK (status IN ('pending', 'live', 'rejected'));

-- The registry read path filters on status, and the admin queue filters on
-- (status, submitted_at).
CREATE INDEX IF NOT EXISTS tokens_status_idx        ON tokens (status);
CREATE INDEX IF NOT EXISTS tokens_status_submitted_idx ON tokens (status, submitted_at DESC);

-- ── 2. One row per token per chain ─────────────────────────────────────────────
--
-- Without this, two people can submit the same contract concurrently and both inserts
-- succeed — the API's duplicate check is a read, so it cannot prevent the race on its
-- own. Addresses are compared case-insensitively so a mixed-case resubmission of an
-- existing token is still caught (see fix_solana_address_casing.sql for why casing
-- varies at all).

CREATE UNIQUE INDEX IF NOT EXISTS tokens_address_chain_uniq
  ON tokens (lower(address), chain);

-- ── 3. Verify ──────────────────────────────────────────────────────────────────

-- Expect every pre-existing token to be 'live' and none pending.
SELECT status, count(*) FROM tokens GROUP BY status ORDER BY status;
