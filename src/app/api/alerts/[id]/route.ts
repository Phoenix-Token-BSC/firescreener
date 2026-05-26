import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const subscriptionId = req.headers.get('x-subscription-id');

  if (!subscriptionId) {
    return NextResponse.json({ error: 'Missing x-subscription-id header' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('price_alerts')
    .delete()
    .eq('id', id)
    .eq('subscription_id', subscriptionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const subscriptionId = req.headers.get('x-subscription-id');

  if (!subscriptionId) {
    return NextResponse.json({ error: 'Missing x-subscription-id header' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const triggered = typeof body.triggered === 'boolean' ? body.triggered : false;

  const { data, error } = await supabaseServer
    .from('price_alerts')
    .update({ triggered })
    .eq('id', id)
    .eq('subscription_id', subscriptionId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
