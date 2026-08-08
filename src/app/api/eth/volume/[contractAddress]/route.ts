import { NextRequest, NextResponse } from "next/server";
import { isValidContractAddress } from "@/lib/tokenRegistry";
import { getToken as getTokenByAddress } from "@/lib/tokenRegistry.server";

interface RouteParams {
  contractAddress: string;
}

interface VolumeResponse {
  volumeTotal: string;
  volumeBuys: string;
  volumeSells: string;
}

interface ErrorResponse {
  error: string;
}

const MORALIS_ANALYTICS_URL = "https://deep-index.moralis.io/api/v2.2/tokens";
const DEXSCREENER_API_URL = "https://api.dexscreener.com/latest/dex/tokens";

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

    const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
    if (!MORALIS_API_KEY) {
      return NextResponse.json(
        { error: "Moralis API key not configured" },
        { status: 500 }
      );
    }

    const addressLower = contractAddress.toLowerCase();

    if (!isValidContractAddress(addressLower, "eth")) {
      return NextResponse.json({ error: "Invalid contract address format" }, { status: 400 });
    }

    const tokenMetadata = await getTokenByAddress(addressLower);
    if (!tokenMetadata) {
      return NextResponse.json({ error: "Token not found in registry" }, { status: 404 });
    }

    if (tokenMetadata.chain !== "eth") {
      return NextResponse.json(
        { error: `Token is on ${tokenMetadata.chain.toUpperCase()}, not ETH` },
        { status: 400 }
      );
    }

    const tokenAddress = tokenMetadata.address;

    // Fetch Moralis Token Analytics (returns buy/sell volume directly)
    const analyticsRes = await fetch(
      `${MORALIS_ANALYTICS_URL}/${tokenAddress}/analytics?chain=eth`,
      {
        headers: { "X-API-Key": MORALIS_API_KEY, Accept: "application/json" },
      }
    );

    let volumeBuys = 0;
    let volumeSells = 0;

    if (analyticsRes.ok) {
      const analytics = await analyticsRes.json();
      const buy24 = analytics.totalBuyVolume?.["24h"];
      const sell24 = analytics.totalSellVolume?.["24h"];
      volumeBuys = typeof buy24 === "number" ? buy24 : parseFloat(buy24) || 0;
      volumeSells = typeof sell24 === "number" ? sell24 : parseFloat(sell24) || 0;
    }

    // Use DexScreener for aggregated 24h volume
    const dsRes = await fetch(`${DEXSCREENER_API_URL}/${tokenAddress}`);
    let volumeTotal = volumeBuys + volumeSells;
    if (dsRes.ok) {
      const dsData = await dsRes.json();
      const pair = dsData?.pairs?.[0];
      const h24 = pair?.volume?.h24;
      if (typeof h24 === "string" && parseFloat(h24) > 0) {
        volumeTotal = parseFloat(h24);
      } else if (typeof h24 === "number" && h24 > 0) {
        volumeTotal = h24;
      }
    }

    return NextResponse.json({
      volumeTotal: volumeTotal.toFixed(2),
      volumeBuys: volumeBuys.toFixed(2),
      volumeSells: volumeSells.toFixed(2),
    });
  } catch (error) {
    console.error("Volume API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
