import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminSession';
import { invalidateRegistryCache } from '@/lib/tokenRegistry.server';
import { invalidateTokenListCaches } from '@/lib/cache-manager';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

/** The review queue. Defaults to pending; ?status=live|rejected|all for the rest. */
export async function GET(request: NextRequest) {
  const email = await requireAdmin(request);
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const requested = new URL(request.url).searchParams.get('status') ?? 'pending';

  let query = supabase
    .from('tokens')
    .select(
      'id, address, symbol, name, chain, status, submitted_by, submitted_at, reviewed_at, rejection_reason, checks, website, twitter, telegram'
    )
    .order('submitted_at', { ascending: false, nullsFirst: false });

  if (requested !== 'all') query = query.eq('status', requested);

  const { data, error } = await query;

  if (error) {
    console.error('[admin/listings GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ listings: data ?? [] });
}

/** Approve or reject a pending submission. */
export async function PATCH(request: NextRequest) {
  const email = await requireAdmin(request);
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { id?: number; action?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { id, action, reason } = body;
  if (typeof id !== 'number' || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json(
      { error: 'id (number) and action ("approve" | "reject") are required.' },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from('tokens')
    .select('id, status, symbol')
    .eq('id', id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
  }
  if (existing.status !== 'pending') {
    return NextResponse.json(
      { error: `This listing is already ${existing.status}.` },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from('tokens')
    .update({
      status: action === 'approve' ? 'live' : 'rejected',
      rejection_reason: action === 'reject' ? (reason?.trim() || 'No reason given.') : null,
      reviewed_by: email,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    // Only transition from pending, so two admins acting at once cannot double-apply.
    .eq('status', 'pending');

  if (error) {
    console.error('[admin/listings PATCH]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // An approval changes what the site serves; a rejection leaves it unchanged.
  if (action === 'approve') {
    await Promise.all([invalidateRegistryCache(), invalidateTokenListCaches()]);
  }

  return NextResponse.json({ success: true, status: action === 'approve' ? 'live' : 'rejected' });
}
