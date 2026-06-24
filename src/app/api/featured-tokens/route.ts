import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { TOKEN_REGISTRY } from '@/lib/tokenRegistry';

interface FeaturedToken {
  address: string;
  symbol: string;
  name: string;
  chain: string;
  addedAt: string;
  daysActive: number;
  expiresAt: string;
}

const FEATURED_KEY = 'featured:tokens';

// Lookup token in registry by address
function lookupTokenByAddress(address: string): { symbol: string; name: string; chain: string } | null {
  const normalized = address.toLowerCase();
  const token = TOKEN_REGISTRY.find(t => t.address.toLowerCase() === normalized);

  if (!token) {
    return null;
  }

  return {
    symbol: token.symbol,
    name: token.name,
    chain: token.chain,
  };
}

// Add a new featured token
async function addFeaturedToken(
  address: string,
  daysActive: number
): Promise<FeaturedToken> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + daysActive * 24 * 60 * 60 * 1000);

  // Lookup token in registry
  const tokenData = lookupTokenByAddress(address);
  if (!tokenData) {
    throw new Error('Token not found in registry');
  }

  const token: FeaturedToken = {
    address: address.toLowerCase(),
    symbol: tokenData.symbol,
    name: tokenData.name,
    chain: tokenData.chain,
    addedAt: now.toISOString(),
    daysActive,
    expiresAt: expiresAt.toISOString(),
  };

  // Store in Redis as a list
  try {
    const existing = await redis.get(FEATURED_KEY);
    const tokens = (existing as FeaturedToken[]) || [];
    console.log(`[Featured Tokens] Storing token. Current count: ${tokens.length}, new token: ${token.symbol}`);
    tokens.push(token);
    await redis.set(FEATURED_KEY, tokens);
    console.log(`[Featured Tokens] Successfully stored. Total count now: ${tokens.length}`);
  } catch (error) {
    console.error('Error saving featured token:', error);
    throw error;
  }

  return token;
}

// Get all active featured tokens
async function getActiveFeaturedTokens(): Promise<FeaturedToken[]> {
  try {
    const stored = await redis.get(FEATURED_KEY);
    const tokens = (stored as FeaturedToken[]) || [];

    const now = new Date();
    return tokens.filter(token => new Date(token.expiresAt) > now);
  } catch (error) {
    console.error('Error fetching featured tokens:', error);
    return [];
  }
}

// Remove a featured token
async function removeFeaturedToken(address: string): Promise<boolean> {
  try {
    const stored = await redis.get(FEATURED_KEY);
    const tokens = (stored as FeaturedToken[]) || [];

    const filtered = tokens.filter(t => t.address.toLowerCase() !== address.toLowerCase());
    await redis.set(FEATURED_KEY, filtered);

    return true;
  } catch (error) {
    console.error('Error removing featured token:', error);
    return false;
  }
}

// Clean up invalid tokens
async function cleanupFeaturedTokens(): Promise<void> {
  try {
    const stored = await redis.get(FEATURED_KEY);
    const tokens = (stored as FeaturedToken[]) || [];
    const validChains = ['sol', 'eth', 'bsc', 'rwa'];
    const now = new Date();

    const cleaned = tokens.filter(token => {
      const isActive = new Date(token.expiresAt) > now;
      const hasValidChain = validChains.includes(String(token.chain).toLowerCase());
      const hasAddress = token.address && String(token.address).length > 0;
      return isActive && hasValidChain && hasAddress;
    });

    if (cleaned.length !== tokens.length) {
      await redis.set(FEATURED_KEY, cleaned);
      console.log(`Cleaned up ${tokens.length - cleaned.length} invalid featured tokens`);
    }
  } catch (error) {
    console.error('Error cleaning up featured tokens:', error);
  }
}

// API Routes
export async function GET(request: NextRequest) {
  try {
    // Clean up any invalid tokens first
    await cleanupFeaturedTokens();

    const tokens = await getActiveFeaturedTokens();
    return NextResponse.json(tokens, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, daysActive } = body;

    if (!address || !daysActive) {
      return NextResponse.json(
        { error: 'Missing required fields: address, daysActive' },
        { status: 400 }
      );
    }

    if (daysActive < 1 || daysActive > 90) {
      return NextResponse.json(
        { error: 'Days active must be between 1 and 90' },
        { status: 400 }
      );
    }

    // Lookup token in registry
    const tokenData = lookupTokenByAddress(address);
    if (!tokenData) {
      return NextResponse.json(
        { error: 'Token not found in registry. Please ensure the address is correct.' },
        { status: 404 }
      );
    }

    const token = await addFeaturedToken(address, parseInt(daysActive));
    console.log(`[Featured Tokens API] Added ${token.symbol} (${token.address}) on chain ${token.chain} for ${token.daysActive} days`);
    return NextResponse.json(token, { status: 201 });
  } catch (error) {
    console.error('Error in featured tokens POST:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter required' },
        { status: 400 }
      );
    }

    const removed = await removeFeaturedToken(address);
    if (!removed) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error in featured tokens DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
