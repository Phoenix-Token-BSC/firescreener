import { ethers } from "ethers";

// Uniswap V2 / PancakeSwap V2 Swap event topic
const SWAP_V2_TOPIC = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";

const SWAP_V2_IFACE = new ethers.Interface([
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
]);

const INFURA_RPC: Record<string, string> = {
  eth: "https://mainnet.infura.io/v3",
  bsc: "https://bsc-mainnet.infura.io/v3",
};

const ALCHEMY_RPC: Record<string, string> = {
  eth: "https://eth-mainnet.g.alchemy.com/v2",
  bsc: "https://bnb-mainnet.g.alchemy.com/v2",
};

const ANKR_RPC: Record<string, string> = {
  eth: "https://rpc.ankr.com/eth",
  bsc: "https://rpc.ankr.com/bsc",
};

const DRPC_RPC: Record<string, string> = {
  eth: "https://lb.drpc.live/eth",
  bsc: "https://lb.drpc.live/bsc",
};

// Approximate block time per chain in seconds
const SECS_PER_BLOCK: Record<string, number> = {
  eth: 12,
  bsc: 3,
};

// Resolves a JsonRpcProvider for every configured RPC source and
// wraps them in a FallbackProvider (quorum=1) so the first healthy
// node to respond wins.  Priority order: Infura → Alchemy → Ankr → QuickNode.
export function getProvider(chain: string): ethers.AbstractProvider {
  const ankrKey      = process.env.ANKR_API_KEY;
  const drpcKey      = process.env.DRPC_API_KEY;
  const infuraKey    = process.env.INFURA_API_KEY;
  const alchemyKey   = process.env.ALCHEMY_API_KEY;
  // QuickNode embeds the key in the URL subdomain — store the full URL per chain
  const quicknodeUrl = chain === "eth"
    ? process.env.QUICKNODE_ETH_URL
    : process.env.QUICKNODE_BSC_URL;

  type Candidate = { provider: ethers.JsonRpcProvider; priority: number; stallTimeout: number };
  const candidates: Candidate[] = [];

  if (ankrKey && ANKR_RPC[chain]) {
    candidates.push({
      provider: new ethers.JsonRpcProvider(`${ANKR_RPC[chain]}/${ankrKey}`),
      priority: 1,
      stallTimeout: 3000,
    });
  }

  if (drpcKey && DRPC_RPC[chain]) {
    candidates.push({
      provider: new ethers.JsonRpcProvider(`${DRPC_RPC[chain]}/${drpcKey}`),
      priority: 2,
      stallTimeout: 3000,
    });
  }

  if (infuraKey && INFURA_RPC[chain]) {
    candidates.push({
      provider: new ethers.JsonRpcProvider(`${INFURA_RPC[chain]}/${infuraKey}`),
      priority: 3,
      stallTimeout: 3000,
    });
  }

  if (quicknodeUrl) {
    candidates.push({
      provider: new ethers.JsonRpcProvider(quicknodeUrl),
      priority: 4,
      stallTimeout: 3000,
    });
  }

  if (alchemyKey && ALCHEMY_RPC[chain]) {
    candidates.push({
      provider: new ethers.JsonRpcProvider(`${ALCHEMY_RPC[chain]}/${alchemyKey}`),
      priority: 5,
      stallTimeout: 3000,
    });
  }

  if (candidates.length === 0) {
    throw new Error(`No RPC provider configured for chain "${chain}"`);
  }
  if (candidates.length === 1) {
    return candidates[0].provider;
  }

  return new ethers.FallbackProvider(candidates, undefined, { quorum: 1 });
}

export interface SwapTransaction {
  hash: string;
  logIndex: number;
  type: "buy" | "sell";
  amountUsd: string;
  tokenAmount: string;
  pricePerToken: string;
  wallet: string;
  blockNumber: number;
  estimatedTimestamp: number;
}

function bigintToFloat(raw: bigint, decimals: number): number {
  if (raw === BigInt(0)) return 0;
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = raw / divisor;
  const rem = raw % divisor;
  // rem < divisor so Number(rem)/Number(divisor) never overflows
  return Number(whole) + Number(rem) / Number(divisor);
}

function formatTokenAmount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

function formatPrice(p: number): string {
  if (p === 0) return "$0";
  if (p >= 1) return `$${p.toFixed(4)}`;
  // For all prices below $1 compute enough decimal places so the component
  // can always find 4 significant digits after the leading zeros.
  // Never use exponential notation — PriceDisplay needs a plain decimal string.
  const leadingZeros = Math.max(0, Math.ceil(-Math.log10(p)));
  const places = Math.min(leadingZeros + 4, 18);
  return `$${p.toFixed(places)}`;
}

/**
 * Fetches Uniswap/PancakeSwap V2 swap events for a token pair via Infura.
 *
 * The caller is responsible for choosing the block range:
 *  - Initial load  → fromBlock = latestBlock - WINDOW, toBlock = latestBlock
 *  - Incremental   → fromBlock = lastToBlock + 1,       toBlock = latestBlock
 *
 * @param chain        "eth" or "bsc"
 * @param pairAddress  V2 pair contract address (from DexScreener)
 * @param tokenAddress Token contract address (to determine buy vs sell direction)
 * @param decimals     Token decimals
 * @param priceUsd     Current token price in USD
 * @param fromBlock    First block to scan (inclusive)
 * @param toBlock      Last block to scan (inclusive) — used as timestamp reference
 */
export async function getRecentSwaps(
  chain: string,
  pairAddress: string,
  tokenAddress: string,
  decimals: number,
  priceUsd: number,
  fromBlock: number,
  toBlock: number,
  latestBlock?: number   // timestamp reference — always the real chain tip, even in older passes
): Promise<SwapTransaction[]> {
  const provider = getProvider(chain);
  const secsPerBlock = SECS_PER_BLOCK[chain] ?? 12;
  const refBlock = latestBlock ?? toBlock;

  const [token0Addr, logs] = await Promise.all([
    new ethers.Contract(
      pairAddress,
      ["function token0() view returns (address)"],
      provider
    ).token0() as Promise<string>,
    provider.getLogs({
      address: pairAddress,
      topics: [SWAP_V2_TOPIC],
      fromBlock,
      toBlock,
    }),
  ]);

  const isToken0 = token0Addr.toLowerCase() === tokenAddress.toLowerCase();

  const txns: SwapTransaction[] = [];

  for (const log of logs) {
    try {
      const parsed = SWAP_V2_IFACE.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (!parsed) continue;

      const { amount0In, amount1In, amount0Out, amount1Out, to } = parsed.args;

      // Determine direction: which side is our token and is it going in or out?
      let type: "buy" | "sell";
      let rawAmount: bigint;

      if (isToken0) {
        // amount0In > 0 means our token flowed INTO the pool → user is selling it
        if (BigInt(amount0In) > BigInt(0)) {
          type = "sell";
          rawAmount = BigInt(amount0In);
        } else {
          type = "buy";
          rawAmount = BigInt(amount0Out);
        }
      } else {
        if (BigInt(amount1In) > BigInt(0)) {
          type = "sell";
          rawAmount = BigInt(amount1In);
        } else {
          type = "buy";
          rawAmount = BigInt(amount1Out);
        }
      }

      const tokenAmount = bigintToFloat(rawAmount, decimals);
      if (tokenAmount === 0) continue;

      const amountUsd = tokenAmount * priceUsd;
      const blocksAgo = refBlock - log.blockNumber;
      const estimatedTimestamp = Date.now() - blocksAgo * secsPerBlock * 1000;

      txns.push({
        hash: log.transactionHash,
        logIndex: log.index,
        type,
        amountUsd: amountUsd.toFixed(2),
        tokenAmount: formatTokenAmount(tokenAmount),
        pricePerToken: formatPrice(priceUsd),
        // `to` is the swap recipient — the actual wallet for both buys and sells
        wallet: (to as string).toLowerCase(),
        blockNumber: log.blockNumber,
        estimatedTimestamp,
      });
    } catch {
      // Skip any malformed log entries
    }
  }

  return txns.sort((a, b) => b.blockNumber - a.blockNumber);
}
