import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('deviceId');
  const chain = searchParams.get('chain');
  const address = searchParams.get('address');

  if (!deviceId || !chain || !address) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('price_alerts')
    .select('*')
    .eq('device_id', deviceId)
    .eq('chain', chain)
    .eq('contract_address', address.toLowerCase())
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { deviceId, pushToken, chain, contractAddress, tokenSymbol, type, threshold } = body;

  if (!deviceId || !chain || !contractAddress || !tokenSymbol || !type || threshold == null) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  if (type !== 'price_above' && type !== 'price_below') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('price_alerts')
    .insert({
      device_id: deviceId,
      push_token: pushToken ?? null,
      chain,
      contract_address: contractAddress.toLowerCase(),
      token_symbol: tokenSymbol,
      type,
      threshold,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
