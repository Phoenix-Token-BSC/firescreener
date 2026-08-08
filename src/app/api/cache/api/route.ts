import { NextRequest, NextResponse } from 'next/server';
import { clearTokenCache, clearMultipleTokensCache, getTokenCacheInfo, getCacheHealth } from '@/lib/cache-manager';
import { getAllTokens } from '@/lib/tokenRegistry.server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const address = searchParams.get('address');

    switch (action) {
      case 'health':
        const health = await getCacheHealth();
        return NextResponse.json(health, { status: 200 });

      case 'info':
        if (!address) {
          return NextResponse.json({
            error: 'Address parameter required. Use ?action=info&address=0x...',
          }, { status: 400 });
        }
        const info = await getTokenCacheInfo(address);
        return NextResponse.json({
          address,
          cached: info,
        }, { status: 200 });

      case 'clear':
        if (address) {
          // Clear specific token
          await clearTokenCache(address);
          return NextResponse.json({
            message: `Cache cleared for ${address}`,
          }, { status: 200 });
        } else {
          // Clear all tokens
          const addresses = (await getAllTokens()).map(t => t.address);
          const cleared = await clearMultipleTokensCache(addresses);
          return NextResponse.json({
            message: 'Cache cleared for all tokens',
            cleared,
          }, { status: 200 });
        }

      case 'clear-chain':
        const chain = searchParams.get('chain');
        if (!chain) {
          return NextResponse.json({
            error: 'Chain parameter required. Use ?action=clear-chain&chain=bsc',
          }, { status: 400 });
        }
        const chainTokens = (await getAllTokens()).filter(t => t.chain.toLowerCase() === chain.toLowerCase());
        const chainAddresses = chainTokens.map(t => t.address);
        const clearedChain = await clearMultipleTokensCache(chainAddresses);
        return NextResponse.json({
          message: `Cache cleared for ${chain.toUpperCase()} tokens`,
          cleared: clearedChain,
          total: chainTokens.length,
        }, { status: 200 });

      default:
        return NextResponse.json({
          error: 'Invalid action',
          availableActions: {
            health: 'GET /api/cache/api?action=health',
            info: 'GET /api/cache/api?action=info&address=0x...',
            clear: 'GET /api/cache/api?action=clear (all) or ?action=clear&address=0x... (specific)',
            clearChain: 'GET /api/cache/api?action=clear-chain&chain=bsc',
          },
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Cache API management error:', error);
    return NextResponse.json(
      { error: 'Failed to manage cache' },
      { status: 500 }
    );
  }
}
