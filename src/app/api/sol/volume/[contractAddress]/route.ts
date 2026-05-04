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

    if (!isValidContractAddress(contractAddress, "sol")) {
      return NextResponse.json({ error: "Invalid Solana address format" }, { status: 400 });
    }

    const tokenMetadata = getTokenByAddress(contractAddress);
    if (!tokenMetadata) {
      return NextResponse.json({ error: "Token not found in registry" }, { status: 404 });
    }

    if (tokenMetadata.chain !== "sol") {
      return NextResponse.json(
        { error: `Token is on ${tokenMetadata.chain.toUpperCase()}, not SOL` },
        { status: 400 }
      );
    }

    const dsRes = await fetch(`${DEXSCREENER_API_URL}/${tokenMetadata.address}`);

    let volumeTotal = 0;
    let buysCount = 0;
    let sellsCount = 0;

    if (dsRes.ok) {
      const dsData = await dsRes.json();
      const pair = dsData?.pairs?.[0];
      if (pair) {
        volumeTotal = parseFloat(pair.volume?.h24) || 0;
        const txns = pair.txns?.h24;
        if (txns && typeof txns === "object") {
          buysCount = txns.buys ?? 0;
          sellsCount = txns.sells ?? 0;
        }
      }
    }

    return NextResponse.json({
      volumeTotal: volumeTotal.toFixed(2),
      volumeBuys: "0.00",
      volumeSells: "0.00",
      buysCount,
      sellsCount,
    });
  } catch (error) {
    console.error("Volume API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
