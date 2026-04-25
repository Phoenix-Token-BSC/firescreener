import { NextRequest, NextResponse } from "next/server";
import { isValidContractAddress } from "@/lib/tokenRegistry";
import { supabase } from "@/lib/supabase";

interface RouteParams {
  chain: string;
  identifier: string;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { chain, identifier } = params;

    if (!chain || !identifier) {
      return NextResponse.json({ error: 'Missing chain or identifier' }, { status: 400 });
    }

    const chainLower = chain.toLowerCase() as 'bsc' | 'sol' | 'rwa' | 'eth';
    const identifierLower = identifier.toLowerCase();

    // 1. Try Supabase first
    try {
      // Determine if identifier is a contract address or symbol for Supabase query
      const isAddress = isValidContractAddress(identifierLower, chainLower);

      let query = supabase
        .from('tokens')
        .select('*')
        .eq('chain', chainLower);

      if (isAddress) {
        query = query.eq('address', identifierLower);
      } else {
        query = query.eq('symbol', identifierLower);
      }

      const { data, error } = await query.single();

      if (!error && data) {
        return NextResponse.json({
          description: data.description || "",
          is_burn: data.is_burn ?? null,
          header_image: data.header_image || null,
        });
      }
    } catch (sbError) {
      // Silently fail and validly fall back to registry
      console.warn("Supabase lookup failed or not found, falling back:", sbError);
    }

    return NextResponse.json({ error: 'Token not found (Supabase lookup failed)' }, { status: 404 });

  } catch (error) {
    console.error('Socials API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch social links' },
      { status: 500 }
    );
  }
}
