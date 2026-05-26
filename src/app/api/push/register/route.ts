import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

// Acknowledge a OneSignal subscription ID — called on first page load so we
// know a device is active. No extra table needed; subscription IDs live on
// each price_alert row.
export async function POST() {
  return NextResponse.json({ ok: true });
}

// Remove all alerts tied to a subscription ID — called when a user disables
// push notifications so stale alerts don't pile up.
export async function DELETE(req: NextRequest) {
  const { subscriptionId } = await req.json();

  if (!subscriptionId) {
    return NextResponse.json({ error: 'Missing subscriptionId' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('price_alerts')
    .delete()
    .eq('subscription_id', subscriptionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
