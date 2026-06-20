import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('http://localhost:3000/api/trending', {
      cache: 'no-store',
    });

    const data = await response.json();

    const featured = (data as any[]).filter((t: any) => t.isFeatured);

    console.log(`[Debug Trending] Total tokens: ${data.length}, Featured: ${featured.length}`);

    return NextResponse.json({
      totalTokens: data.length,
      featuredCount: featured.length,
      featured: featured.map(t => ({
        symbol: t.symbol,
        address: t.address,
        chain: t.chain,
        isFeatured: t.isFeatured,
      })),
      allTokens: data.map(t => ({
        symbol: t.symbol,
        address: t.address,
        isFeatured: (t as any).isFeatured || 'undefined',
      })),
    });
  } catch (error) {
    return NextResponse.json({
      error: String(error),
    }, { status: 500 });
  }
}
