import { NextRequest, NextResponse } from "next/server";
import { getTokenByAddress, getTokenBySymbol, isValidContractAddress } from "@/lib/tokenRegistry";
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
          website: data.website || "",
          twitter: data.twitter || "",
          telegram: data.telegram || "",
          scan: data.scan || ""
        });
      }
    } catch (sbError) {
      // Silently fail and validly fall back to registry
      console.warn("Supabase lookup failed or not found, falling back:", sbError);
    }

    /*
    // 2. Fallback to existing static registry
    // Determine if identifier is a contract address or symbol
    let tokenMetadata;

    if (isValidContractAddress(identifierLower, chainLower)) {
      // It's a contract address
      tokenMetadata = getTokenByAddress(identifierLower);
    } else {
      // It's a symbol - specify chain to avoid conflicts with duplicate symbols
      tokenMetadata = getTokenBySymbol(identifierLower, chainLower);
    }

    if (!tokenMetadata) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    // Verify chain matches
    if (tokenMetadata.chain !== chainLower) {
      return NextResponse.json({
        error: `Token is on ${tokenMetadata.chain.toUpperCase()}, not ${chainLower.toUpperCase()}`
      }, { status: 400 });
    }

    // Determine scan URL based on chain
    let scanUrl = `https://bscscan.com/token/${tokenMetadata.address}`;
    if (tokenMetadata.chain === 'rwa') {
      scanUrl = `https://scan.assetchain.org/token/${tokenMetadata.address}`;
    } else if (tokenMetadata.chain === 'sol') {
      scanUrl = `https://solscan.io/token/${tokenMetadata.address}`;
    }

    // Get social links from token metadata or fallback
    const socialLinks = tokenMetadata.socials || FALLBACK_SOCIALS[tokenMetadata.symbol] || {
      website: "https://example.com",
      twitter: "https://x.com",
      telegram: "https://t.me",
      scan: scanUrl
    };

    return NextResponse.json(socialLinks);
    */

    return NextResponse.json({ error: 'Token not found (Supabase lookup failed)' }, { status: 404 });

  } catch (error) {
    console.error('Socials API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch social links' },
      { status: 500 }
    );
  }
}
