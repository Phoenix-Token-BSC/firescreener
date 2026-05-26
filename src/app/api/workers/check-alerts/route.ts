import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { sendPriceAlertNotification } from '@/lib/onesignal-server';
import { redis } from '@/lib/redis';

const DEXSCREENER_API_URL = 'https://api.dexscreener.com/latest/dex/tokens';
const ASSETCHAIN_LIQUIDITY_API = 'https://liquidity-pool-api.assetchain.org/tokens';

/**
 * Alert checker — runs every minute via cron.
 * Reads non-triggered alerts from Supabase, checks current price (Redis cache
 * first, live fetch fallback), fires OneSignal notifications for hits, then
 * marks those rows as triggered.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: alerts, error } = await supabaseServer
    .from('price_alerts')
    .select('*')
    .eq('triggered', false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!alerts || alerts.length === 0) {
    return NextResponse.json({ success: true, message: 'No active alerts', fired: 0 });
  }

  // Group alerts by chain:address to minimise price fetches
  const groups = new Map<string, typeof alerts>();
  for (const alert of alerts) {
    const key = `${alert.chain}:${alert.contract_address}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(alert);
  }

  let fired = 0;
  const toTrigger: string[] = [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  await Promise.allSettled(
    Array.from(groups.entries()).map(async ([key, groupAlerts]) => {
      const [chain, address] = key.split(':');
      const price = await fetchPrice(chain, address);
      if (price == null || isNaN(price) || price <= 0) return;

      for (const alert of groupAlerts) {
        const hit =
          alert.type === 'price_above'
            ? price >= alert.threshold
            : price <= alert.threshold;
        if (!hit) continue;

        const direction = alert.type === 'price_above' ? '↑' : '↓';
        const title = `${direction} ${alert.token_symbol} Price Alert`;
        const body =
          alert.type === 'price_above'
            ? `Price crossed above $${alert.threshold} — now $${fmtPrice(price)}`
            : `Price dropped below $${alert.threshold} — now $${fmtPrice(price)}`;

        await sendPriceAlertNotification(
          [alert.subscription_id],
          title,
          body,
          `${appUrl}/${chain}/${address}`,
          `${appUrl}/api/${chain}/logo/${address}`,
          alert.id,
        );

        toTrigger.push(alert.id);
        fired++;
      }
    }),
  );

  if (toTrigger.length > 0) {
    await supabaseServer
      .from('price_alerts')
      .update({ triggered: true })
      .in('id', toTrigger);
  }

  return NextResponse.json({ success: true, fired, checked: alerts.length });
}

function fmtPrice(price: number): string {
  if (price < 0.0001) return price.toExponential(4);
  if (price < 1) return price.toFixed(8);
  return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

async function fetchPrice(chain: string, address: string): Promise<number | null> {
  const cacheKey =
    chain === 'rwa'
      ? `assetchain:${address.toLowerCase()}`
      : `dexscreener:${address.toLowerCase()}`;

  try {
    const cached = await redis.get<{ price: string | number }>(cacheKey);
    if (cached?.price) {
      const p = parseFloat(String(cached.price));
      if (!isNaN(p) && p > 0) return p;
    }
  } catch {}

  try {
    if (chain === 'rwa') {
      const res = await fetch(`${ASSETCHAIN_LIQUIDITY_API}?address=${address}`);
      const data = await res.json();
      return parseFloat(data?.items?.[0]?.usdPrice) || null;
    } else {
      const res = await fetch(`${DEXSCREENER_API_URL}/${address}`);
      const data = await res.json();
      return parseFloat(data?.pairs?.[0]?.priceUsd) || null;
    }
  } catch {
    return null;
  }
}
