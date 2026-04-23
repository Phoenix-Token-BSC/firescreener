import { NextRequest, NextResponse } from "next/server";
import { getTokenByAddress, isValidContractAddress } from "@/lib/tokenRegistry";

interface RouteParams {
  contractAddress: string;
}

interface VolumeResponse {
  volumeTotal: string;
  volumeBuys: string;
  volumeSells: string;
  buysCount: number;
  sellsCount: number;
}

interface ErrorResponse {
  error: string;
}

const DEXSCREENER_API_URL = "https://api.dexscreener.com/latest/dex/tokens";
const TXN_API_BASE = "https://enpdzndcjxlzupmxpmms.supabase.co/functions/v1/token-analysis-api";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse<VolumeResponse | ErrorResponse>> {
  try {
    const params = await context.params;
    const { contractAddress } = params;

    if (!contractAddress) {
      return NextResponse.json({ error: "Missing contract address" }, { status: 400 });
    }

    const addressLower = contractAddress.toLowerCase();

    if (!isValidContractAddress(addressLower, "bsc")) {
      return NextResponse.json({ error: "Invalid contract address format" }, { status: 400 });
    }

    const tokenMetadata = getTokenByAddress(addressLower);
    if (!tokenMetadata) {
      return NextResponse.json({ error: "Token not found in registry" }, { status: 404 });
    }

    if (tokenMetadata.chain !== "bsc") {
      return NextResponse.json(
        { error: `Token is on ${tokenMetadata.chain.toUpperCase()}, not BSC` },
        { status: 400 }
      );
    }

    const tokenAddress = tokenMetadata.address;

    const txnUrl = `${TXN_API_BASE}?chain=bsc&token=${tokenAddress}&timeframe=24h`;

    const [txnRes, dsRes] = await Promise.all([
      fetch(txnUrl),
      fetch(`${DEXSCREENER_API_URL}/${tokenAddress}`),
    ]);

    let volumeBuys = 0;
    let volumeSells = 0;
    let buysCount = 0;
    let sellsCount = 0;

    if (txnRes.ok) {
      const txnData = await txnRes.json();
      const bs = txnData?.buySell;
      volumeBuys = parseFloat(bs?.buyVolumeUsd) || 0;
      volumeSells = parseFloat(bs?.sellVolumeUsd) || 0;
      buysCount = parseInt(bs?.buysCount) || 0;
      sellsCount = parseInt(bs?.sellsCount) || 0;
    }

    let volumeTotal = volumeBuys + volumeSells;
    if (dsRes.ok) {
      const dsData = await dsRes.json();
      const h24 = dsData?.pairs?.[0]?.volume?.h24;
      const parsed = parseFloat(h24);
      if (parsed > 0) volumeTotal = parsed;
    }

    return NextResponse.json({
      volumeTotal: volumeTotal.toFixed(2),
      volumeBuys: volumeBuys.toFixed(2),
      volumeSells: volumeSells.toFixed(2),
      buysCount,
      sellsCount,
    });
  } catch (error) {
    console.error("Volume API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
