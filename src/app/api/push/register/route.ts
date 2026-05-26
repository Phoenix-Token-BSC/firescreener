import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

// Link a OneSignal push token to all existing alerts for a device.
// Called whenever the OneSignal subscription ID becomes available so the
// cron worker can deliver push notifications to pre-existing alerts.
export async function POST(req: NextRequest) {
  const { deviceId, pushToken } = await req.json();

  if (!deviceId || !pushToken) {
    return NextResponse.json({ error: 'Missing deviceId or pushToken' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('price_alerts')
    .update({ push_token: pushToken })
    .eq('device_id', deviceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Clear push token from all alerts for this device (user disabled push).
export async function DELETE(req: NextRequest) {
  const { deviceId } = await req.json();

  if (!deviceId) {
    return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('price_alerts')
    .update({ push_token: null })
    .eq('device_id', deviceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
