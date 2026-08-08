import { NextResponse } from 'next/server';
import { getAllTokens, invalidateRegistryCache } from '@/lib/tokenRegistry.server';
import { invalidateTokenListCaches } from '@/lib/cache-manager';

export const dynamic = 'force-dynamic';

/**
 * The token registry, for client components that cannot reach Supabase/Redis directly
 * (Header, Sidebar, SearchBar, gains, price-predict) via the useRegistry() hook.
 */
export async function GET() {
  try {
    const tokens = await getAllTokens();
    return NextResponse.json(
      { tokens, count: tokens.length },
      {
        headers: {
          // Matches the 60s registry TTL; stale-while-revalidate keeps navigation snappy.
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('[api/registry] failed:', error);
    return NextResponse.json({ error: 'Failed to load registry' }, { status: 500 });
  }
}

/**
 * Force a registry refresh. Used after a listing is approved/edited so the change is
 * live immediately rather than after the 60s TTL.
 */
export async function POST(request: Request) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await Promise.all([invalidateRegistryCache(), invalidateTokenListCaches()]);
  const tokens = await getAllTokens();

  return NextResponse.json({ success: true, count: tokens.length });
}
