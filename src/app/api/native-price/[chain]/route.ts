import { NextRequest, NextResponse } from 'next/server';

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';

// WBNB on BSC
const BNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
// WETH on ETH
const ETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
// RWA native token
const RWA_NATIVE_ADDRESS = '0x02afe9989D86a0357fbb238579FE035dc17BcAB0';

export async function GET(
    _req: NextRequest,
    context: { params: Promise<{ chain: string }> }
): Promise<NextResponse> {
    const { chain } = await context.params;
    const chainLower = chain.toLowerCase();

    try {
        if (chainLower === 'bsc') {
            const res = await fetch(`${DEXSCREENER_API}/${BNB_ADDRESS}`);
            if (!res.ok) throw new Error('DexScreener BNB fetch failed');
            const data = await res.json();
            const pairs = data?.pairs ?? [];
            const best = [...pairs].sort(
                (a: { liquidity?: { usd?: number } }, b: { liquidity?: { usd?: number } }) =>
                    (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
            )[0];
            const price = best?.priceUsd ? parseFloat(best.priceUsd) : null;
            if (!price) throw new Error('No BNB price found');
            return NextResponse.json({ price, symbol: 'BNB' });
        }

        if (chainLower === 'eth') {
            const res = await fetch(`${DEXSCREENER_API}/${ETH_ADDRESS}`);
            if (!res.ok) throw new Error('DexScreener ETH fetch failed');
            const data = await res.json();
            const pairs = data?.pairs ?? [];
            const best = [...pairs].sort(
                (a: { liquidity?: { usd?: number } }, b: { liquidity?: { usd?: number } }) =>
                    (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
            )[0];
            const price = best?.priceUsd ? parseFloat(best.priceUsd) : null;
            if (!price) throw new Error('No ETH price found');
            return NextResponse.json({ price, symbol: 'ETH' });
        }

        if (chainLower === 'sol') {
            const res = await fetch(
                'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
            );
            if (!res.ok) throw new Error('CoinGecko SOL fetch failed');
            const data = await res.json();
            const price = data?.solana?.usd ?? null;
            if (!price) throw new Error('No SOL price found');
            return NextResponse.json({ price, symbol: 'SOL' });
        }

        if (chainLower === 'rwa') {
            const res = await fetch(
                `https://www.firescreener.com/api/rwa/token-price/${RWA_NATIVE_ADDRESS}`
            );
            if (!res.ok) throw new Error('RWA native price fetch failed');
            const data = await res.json();
            const price = data?.price ?? data?.usdPrice ?? null;
            if (!price) throw new Error('No RWA price found');
            return NextResponse.json({ price, symbol: 'RWA' });
        }

        return NextResponse.json({ error: 'Chain not supported' }, { status: 400 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
