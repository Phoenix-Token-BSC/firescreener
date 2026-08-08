import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { redis } from '@/lib/redis';
import { isValidContractAddress } from '@/lib/tokenRegistry';
import { invalidateRegistryCache, type Chain } from '@/lib/tokenRegistry.server';
import { invalidateTokenListCaches } from '@/lib/cache-manager';
import { assessListing } from '@/lib/listingChecks';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CHAINS: Chain[] = ['bsc', 'eth', 'sol', 'rwa'];

// Per-developer submission cap. Generous enough that a legitimate team never hits it,
// low enough that a compromised account cannot flood the queue.
const RATE_LIMIT = 5;
const RATE_WINDOW_SECONDS = 60 * 60;

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY ?? ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Submissions are restricted to developer accounts. A valid Supabase JWT is not enough —
 * the user must also have a row in developer_accounts.
 */
async function resolveDeveloper(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;

  const token = auth.slice(7);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();
  if (error || !user) return null;

  const { data: dev } = await adminClient()
    .from('developer_accounts')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!dev) return null;
  return user;
}

async function underRateLimit(userId: string): Promise<boolean> {
  const key = `listing-submits:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_WINDOW_SECONDS);
    return count <= RATE_LIMIT;
  } catch (err) {
    // Redis being down should not block legitimate listings.
    console.error('[api/listings] rate limit check failed:', err);
    return true;
  }
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    // Only http(s) — javascript: and data: URLs would be rendered as links.
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

const SCAN_BASE: Record<string, string> = {
  bsc: 'https://bscscan.com/token/',
  rwa: 'https://bscscan.com/token/',
  eth: 'https://etherscan.io/token/',
  sol: 'https://solscan.io/token/',
};

// Matches the limits already enforced by /api/dev/upload-logo and upload-header.
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

function extensionFor(type: string) {
  return type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
}

function validateImage(file: unknown, label: string): { file: Blob } | { error: string } | null {
  if (!file || !(file instanceof Blob) || file.size === 0) return null; // not supplied
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: `${label} must be a PNG, JPEG or WEBP.` };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: `${label} exceeds the 2 MB limit.` };
  }
  return { file };
}

/**
 * The form posts multipart (it carries a logo and header); other callers may post JSON.
 * Normalizes both into a plain field bag plus the two files.
 */
async function readSubmission(req: NextRequest): Promise<{
  fields: Record<string, unknown>;
  logo: Blob | null;
  header: Blob | null;
} | null> {
  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const fields: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string') fields[key] = value;
    }
    // Checkboxes arrive as the string "true".
    fields.isBurn = form.get('isBurn') === 'true';

    const logo = form.get('logo');
    const header = form.get('header');
    return {
      fields,
      logo: logo instanceof Blob && logo.size > 0 ? logo : null,
      header: header instanceof Blob && header.size > 0 ? header : null,
    };
  }

  try {
    return { fields: await req.json(), logo: null, header: null };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await resolveDeveloper(req);
  if (!user) {
    return NextResponse.json(
      { error: 'A developer account is required to submit a listing.' },
      { status: 401 }
    );
  }

  if (!(await underRateLimit(user.id))) {
    return NextResponse.json(
      { error: `Too many submissions. You can submit up to ${RATE_LIMIT} tokens per hour.` },
      { status: 429 }
    );
  }

  const submission = await readSubmission(req);
  if (!submission) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { fields: body, logo, header } = submission;

  // Reject oversized/unsupported images before running any network checks.
  const logoCheck = validateImage(logo, 'Logo');
  if (logoCheck && 'error' in logoCheck) {
    return NextResponse.json({ error: logoCheck.error }, { status: 400 });
  }
  const headerCheck = validateImage(header, 'Header image');
  if (headerCheck && 'error' in headerCheck) {
    return NextResponse.json({ error: headerCheck.error }, { status: 400 });
  }

  const rawAddress = typeof body.address === 'string' ? body.address.trim() : '';
  const rawChain = typeof body.chain === 'string' ? body.chain.trim().toLowerCase() : '';

  if (!rawAddress || !rawChain) {
    return NextResponse.json({ error: 'Contract address and chain are required.' }, { status: 400 });
  }
  if (!CHAINS.includes(rawChain as Chain)) {
    return NextResponse.json({ error: `Unsupported chain "${rawChain}".` }, { status: 400 });
  }

  const chain = rawChain as Chain;
  if (!isValidContractAddress(rawAddress, chain)) {
    return NextResponse.json(
      { error: `That does not look like a valid ${chain.toUpperCase()} contract address.` },
      { status: 400 }
    );
  }

  // Solana addresses are case-sensitive base58 and must be stored verbatim; EVM hex is
  // folded to lowercase to match the rest of the table.
  const address = chain === 'sol' ? rawAddress : rawAddress.toLowerCase();

  const db = adminClient();

  // Duplicate check. The unique index in add_listing_submissions.sql is what actually
  // prevents a concurrent double-insert; this exists to return a friendly message.
  const { data: existing } = await db
    .from('tokens')
    .select('symbol, status')
    .ilike('address', rawAddress)
    .eq('chain', chain)
    .maybeSingle();

  if (existing) {
    const status = (existing as { status?: string }).status ?? 'live';
    const message =
      status === 'pending'
        ? 'This token has already been submitted and is awaiting review.'
        : status === 'rejected'
          ? 'This token was previously reviewed and rejected. Contact the team if that is wrong.'
          : 'This token is already listed.';
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const assessment = await assessListing(chain, rawAddress);

  if (assessment.verdict === 'reject') {
    // Nothing is written — a rejected submission should not occupy the address.
    return NextResponse.json(
      { error: assessment.reason, checks: assessment.checks, verdict: 'reject' },
      { status: 422 }
    );
  }

  const symbol =
    (typeof body.symbol === 'string' && body.symbol.trim()) ||
    assessment.discovered.symbol ||
    '';
  const name =
    (typeof body.name === 'string' && body.name.trim()) || assessment.discovered.name || '';

  if (!symbol || !name) {
    return NextResponse.json(
      { error: 'Could not determine the token name and symbol. Please supply them.' },
      { status: 400 }
    );
  }

  const status = assessment.verdict === 'approve' ? 'live' : 'pending';

  const { data: inserted, error: insertErr } = await db
    .from('tokens')
    .insert({
      address,
      symbol,
      name,
      chain,
      decimals: chain === 'sol' ? 9 : 18,
      is_burn: body.isBurn === true,
      website: normalizeUrl(body.website),
      twitter: normalizeUrl(body.twitter),
      telegram: normalizeUrl(body.telegram),
      scan: `${SCAN_BASE[chain]}${rawAddress}`,
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      status,
      submitted_by: user.id,
      submitted_at: new Date().toISOString(),
      // The submitting developer owns what they list, so it appears in their dashboard
      // straight away and they can upload artwork without a separate claim step.
      developer_id: user.id,
      checks: assessment.checks,
    })
    .select('id, address, symbol, name, chain, status')
    .single();

  if (insertErr) {
    // 23505 = unique_violation: someone submitted the same token microseconds earlier.
    if (insertErr.code === '23505') {
      return NextResponse.json({ error: 'This token has already been submitted.' }, { status: 409 });
    }
    console.error('[api/listings] insert failed:', insertErr.message);
    return NextResponse.json({ error: 'Could not save the listing.' }, { status: 500 });
  }

  // Artwork is uploaded after the insert, since the paths are keyed on the stored
  // address. A failure here must not fail the listing — the token is already valid
  // without artwork, and the developer can retry from the dashboard.
  const uploadWarnings: string[] = [];

  if (logo instanceof Blob) {
    const ext = extensionFor(logo.type);
    const { error } = await db.storage
      .from('token-logos')
      .upload(`${chain}/${address}.${ext}`, await logo.arrayBuffer(), {
        upsert: true,
        contentType: logo.type,
      });
    if (error) {
      console.error('[api/listings] logo upload failed:', error.message);
      uploadWarnings.push('The logo could not be saved. You can upload it from your dashboard.');
    }
  }

  if (header instanceof Blob) {
    const ext = extensionFor(header.type);
    const path = `headers/${chain}/${address}.${ext}`;
    const { error } = await db.storage
      .from('token-headers')
      .upload(path, await header.arrayBuffer(), { upsert: true, contentType: header.type });

    if (error) {
      console.error('[api/listings] header upload failed:', error.message);
      uploadWarnings.push('The header image could not be saved. You can upload it from your dashboard.');
    } else {
      const { data: { publicUrl } } = db.storage.from('token-headers').getPublicUrl(path);
      await db.from('tokens').update({ header_image: publicUrl }).eq('id', inserted.id);
    }
  }

  // Only a live token changes what the site serves.
  if (status === 'live') {
    await Promise.all([invalidateRegistryCache(), invalidateTokenListCaches()]);
  }

  return NextResponse.json(
    {
      success: true,
      status,
      verdict: assessment.verdict,
      checks: assessment.checks,
      warnings: uploadWarnings,
      token: inserted,
    },
    { status: 201 }
  );
}

/**
 * The submitting developer's own listings, so the form can show what they've sent and
 * where each one stands.
 */
export async function GET(req: NextRequest) {
  const user = await resolveDeveloper(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await adminClient()
    .from('tokens')
    .select('id, address, symbol, name, chain, status, submitted_at, rejection_reason, checks')
    .eq('submitted_by', user.id)
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('[api/listings GET]', error.message);
    return NextResponse.json({ error: 'Could not load your submissions.' }, { status: 500 });
  }

  return NextResponse.json({ listings: data ?? [] });
}
