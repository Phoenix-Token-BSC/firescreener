import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidContractAddress } from '@/lib/tokenRegistry';
import { discoverToken } from '@/lib/listingChecks';
import { requireDeveloper } from '@/lib/profile';
import type { Chain } from '@/lib/tokenRegistry.server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CHAINS: Chain[] = ['bsc', 'eth', 'sol', 'rwa'];

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY ?? ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Developer-gated, same as the submit endpoint. Without this the route would be an open
 * proxy to DexScreener that anyone could hammer.
 */
async function resolveDeveloper(req: NextRequest) {
  return requireDeveloper(req);
}

/**
 * Preview a contract before submitting it: resolves the token's real name and symbol so
 * the form can fill them in as the address is pasted, and reports whether it is already
 * listed. Deliberately does not run the security checks — those belong at submit time.
 */
export async function GET(req: NextRequest) {
  const user = await resolveDeveloper(req);
  if (!user) {
    return NextResponse.json({ error: 'A developer account is required.' }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const address = (params.get('address') ?? '').trim();
  const chain = (params.get('chain') ?? '').trim().toLowerCase();

  if (!address || !chain) {
    return NextResponse.json({ error: 'address and chain are required' }, { status: 400 });
  }
  if (!CHAINS.includes(chain as Chain)) {
    return NextResponse.json({ error: `Unsupported chain "${chain}".` }, { status: 400 });
  }
  if (!isValidContractAddress(address, chain as Chain)) {
    return NextResponse.json(
      { error: `That does not look like a valid ${chain.toUpperCase()} address.` },
      { status: 400 }
    );
  }

  // Surface "already listed" here rather than making the user fill the whole form first.
  const { data: existing } = await adminClient()
    .from('tokens')
    .select('symbol, status')
    .ilike('address', address)
    .eq('chain', chain)
    .maybeSingle();

  if (existing) {
    const status = (existing as { status?: string }).status ?? 'live';
    return NextResponse.json({
      alreadyListed: true,
      status,
      message:
        status === 'pending'
          ? 'This token has already been submitted and is awaiting review.'
          : status === 'rejected'
            ? 'This token was previously reviewed and rejected.'
            : 'This token is already listed on FireScreener.',
    });
  }

  const discovered = await discoverToken(address);
  if (!discovered) {
    return NextResponse.json(
      { found: false, error: 'No trading pair found for this contract on DexScreener.' },
      { status: 404 }
    );
  }

  return NextResponse.json({ found: true, alreadyListed: false, ...discovered });
}
