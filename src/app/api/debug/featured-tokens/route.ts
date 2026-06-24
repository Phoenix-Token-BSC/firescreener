import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function GET() {
  try {
    const stored = await redis.get('featured:tokens');
    const tokens = (stored as any[]) || [];

    console.log(`[Debug] Featured tokens in Redis: ${tokens.length}`);
    console.log(`[Debug] Raw data:`, tokens);

    return NextResponse.json({
      count: tokens.length,
      tokens: tokens,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      error: String(error),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
