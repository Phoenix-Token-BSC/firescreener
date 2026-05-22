import Ably from 'ably';

let rest: Ably.Rest | null = null;

function getRest(): Ably.Rest | null {
  if (!process.env.ABLY_API_KEY) return null;
  if (!rest) rest = new Ably.Rest(process.env.ABLY_API_KEY);
  return rest;
}

export interface PriceUpdatePayload {
  price: string;
  marketCap: string;
  volume: string;
  change24h: string;
  change6h?: string;
  change1h?: string;
  liquidity?: string;
}

export async function publishPriceUpdate(
  chain: string,
  contractAddress: string,
  data: PriceUpdatePayload,
): Promise<void> {
  const client = getRest();
  if (!client) return;
  try {
    const channel = client.channels.get(
      `price-updates:${chain}:${contractAddress.toLowerCase()}`,
    );
    await channel.publish('price-update', data);
  } catch {
    // non-fatal — alerts just won't fire for this tick
  }
}
