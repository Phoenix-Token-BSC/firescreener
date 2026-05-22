import Ably from 'ably';
import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Ably not configured' }, { status: 503 });
  }

  const rest = new Ably.Rest(apiKey);
  const tokenRequest = await rest.auth.createTokenRequest({
    // clients can only subscribe to price-update channels
    capability: { 'price-updates:*': ['subscribe'] },
    ttl: 3_600_000,
  });

  return NextResponse.json(tokenRequest);
}
