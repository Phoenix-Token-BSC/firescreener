import { NextRequest, NextResponse } from "next/server";
import { getTokenByAddress, isValidContractAddress } from "@/lib/tokenRegistry";
import { getProvider, getRecentSwaps, SwapTransaction } from "@/lib/infura";
import { redis } from "@/lib/redis";

interface RouteParams {
  chain: string;
  contractAddress: string;
}

export interface TransactionsResponse {
  transactions: SwapTransaction[];
  fromBlock: number;
  toBlock: number;
  tokenSymbol: string;
  chain: string;
  pairAddress: string;
  updatedAt: string;
}

interface ErrorResponse {
  error: string;
}

// How many blocks to scan per pass (initial + expand)
const BLOCK_STEP: Record<string, number> = {
  eth: 1000,
  bsc: 3000,
};

// Max passes to expand backward before giving up
const MAX_PASSES = 5;

// Max transactions to keep per response
const MAX_TXS = 30;

const SUPPORTED_CHAINS = new Set(["eth", "bsc"]);
const INITIAL_CACHE_TTL = 30;

export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse<TransactionsResponse | ErrorResponse>> {
  try {
    const params = await context.params;
    const chain = params.chain?.toLowerCase();
    const contractAddress = params.contractAddress;

    if (!chain || !contractAddress) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    if (!SUPPORTED_CHAINS.has(chain)) {
      return NextResponse.json(
        { error: `Chain "${chain}" not supported. Use eth or bsc.` },
        { status: 400 }
      );
    }

    const hasProvider =
      process.env.ANKR_API_KEY ||
      process.env.DRPC_API_KEY ||
      process.env.INFURA_API_KEY ||
      process.env.QUICKNODE_ETH_URL ||
      process.env.QUICKNODE_BSC_URL ||
      process.env.ALCHEMY_API_KEY;
    if (!hasProvider) {
      return NextResponse.json({ error: "No RPC provider configured" }, { status: 503 });
    }

    const addressLower = contractAddress.toLowerCase();

    if (!isValidContractAddress(addressLower, chain as "eth" | "bsc")) {
      return NextResponse.json({ error: "Invalid contract address format" }, { status: 400 });
    }

    const tokenMeta = getTokenByAddress(addressLower);
    if (!tokenMeta || tokenMeta.chain !== chain) {
      return NextResponse.json({ error: "Token not found in registry" }, { status: 404 });
    }

    // sinceBlock drives incremental mode: only scan blocks after lastToBlock
    const sinceBlockParam = request.nextUrl.searchParams.get("sinceBlock");
    const sinceBlock = sinceBlockParam !== null ? parseInt(sinceBlockParam, 10) : NaN;
    const isIncremental = !isNaN(sinceBlock) && sinceBlock > 0;

    // Initial loads are cached; incremental fetches are not (they're lightweight)
    const cacheKey = `infura:txns:${chain}:${addressLower}`;
    if (!isIncremental) {
      const cached = await redis.get<TransactionsResponse>(cacheKey);
      if (cached) return NextResponse.json(cached);
    }

    // Always fetch fresh price; pair address is stable but comes in the same call
    const dsRes = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenMeta.address}`,
      { next: { revalidate: 0 } }
    );

    if (!dsRes.ok) {
      return NextResponse.json({ error: "Failed to fetch pair data" }, { status: 502 });
    }

    const dsData = await dsRes.json();
    const pair = dsData?.pairs?.[0];

    if (!pair?.pairAddress) {
      return NextResponse.json(
        { error: "No DEX pair found for this token" },
        { status: 404 }
      );
    }

    const pairAddress: string = pair.pairAddress;
    const priceUsd = parseFloat(pair.priceUsd ?? "0") || 0;
    const decimals = tokenMeta.decimals ?? 18;

    const provider = getProvider(chain);
    const toBlock = await provider.getBlockNumber();

    // Incremental poll: only new blocks since last fetch
    if (isIncremental) {
      const fromBlock = sinceBlock + 1;
      if (fromBlock > toBlock) {
        return NextResponse.json({
          transactions: [],
          fromBlock: toBlock,
          toBlock,
          tokenSymbol: tokenMeta.symbol.toUpperCase(),
          chain,
          pairAddress,
          updatedAt: new Date().toISOString(),
        });
      }

      const transactions = await getRecentSwaps(
        chain, pairAddress, tokenMeta.address, decimals, priceUsd, fromBlock, toBlock, toBlock
      );

      return NextResponse.json({
        transactions: transactions.slice(0, MAX_TXS),
        fromBlock,
        toBlock,
        tokenSymbol: tokenMeta.symbol.toUpperCase(),
        chain,
        pairAddress,
        updatedAt: new Date().toISOString(),
      });
    }

    // Initial load: scan backward in BLOCK_STEP chunks until MAX_TXS found
    const step = BLOCK_STEP[chain] ?? 1000;
    let transactions: SwapTransaction[] = [];
    let scanTo = toBlock;
    let earliestFrom = toBlock;

    for (let pass = 0; pass < MAX_PASSES && transactions.length < MAX_TXS; pass++) {
      const scanFrom = Math.max(0, scanTo - step);
      const chunk = await getRecentSwaps(
        chain, pairAddress, tokenMeta.address, decimals, priceUsd, scanFrom, scanTo, toBlock
      );
      transactions = [...transactions, ...chunk];
      earliestFrom = scanFrom;
      if (scanFrom === 0) break;
      scanTo = scanFrom - 1;
    }

    const response: TransactionsResponse = {
      transactions: transactions.slice(0, MAX_TXS),
      fromBlock: earliestFrom,
      toBlock,
      tokenSymbol: tokenMeta.symbol.toUpperCase(),
      chain,
      pairAddress,
      updatedAt: new Date().toISOString(),
    };

    await redis.set(cacheKey, response, { ex: INITIAL_CACHE_TTL });
    return NextResponse.json(response);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("Infura transactions error:", msg, stack);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
