// Database-powered token registry using Supabase
// import { createClient } from '@supabase/supabase-js';

// Types
export interface SocialLinks {
  website?: string;
  twitter?: string;
  telegram?: string;
  bscscan?: string;
}

export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  chain: 'bsc' | 'sol' | 'rwa' | 'eth';
  decimals?: number;
  socials?: SocialLinks;
  isBurn?: boolean;
}

// Database token type (matches Supabase table structure)
// interface DbToken {
//   id: number;
//   address: string;
//   symbol: string;
//   name: string;
//   chain: string;
//   decimals?: number;
//   is_burn?: boolean;
//   website?: string;
//   twitter?: string;
//   telegram?: string;
//   bscscan?: string;
//   created_at: string;
//   updated_at: string;
// }

// Initialize Supabase client
// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// if (!supabaseUrl || !supabaseKey) {
//   console.warn('Missing Supabase environment variables, falling back to empty registry');
// }

// const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// In-memory cache to reduce database queries
// interface TokenCache {
//   data: Map<string, TokenMetadata>;
//   lastFetch: number;
//   ttl: number; // Time to live in milliseconds
// }

// const tokenCache: TokenCache = {
//   data: new Map(),
//   lastFetch: 0,
//   ttl: 5 * 60 * 1000, // 5 minutes
// };

// Helper function to convert database token to TokenMetadata
// function dbTokenToMetadata(dbToken: DbToken): TokenMetadata {
//   const socials: SocialLinks = {};
//   if (dbToken.website) socials.website = dbToken.website;
//   if (dbToken.twitter) socials.twitter = dbToken.twitter;
//   if (dbToken.telegram) socials.telegram = dbToken.telegram;
//   if (dbToken.bscscan) socials.bscscan = dbToken.bscscan;

//   return {
//     address: dbToken.address,
//     symbol: dbToken.symbol,
//     name: dbToken.name,
//     chain: dbToken.chain as 'bsc' | 'sol',
//     decimals: dbToken.decimals || 18,
//     socials: Object.keys(socials).length > 0 ? socials : undefined,
//     isBurn: dbToken.is_burn || false,
//   };
// }

// Centralized token registry - single source of truth
export const TOKEN_REGISTRY: TokenMetadata[] = [
  // BSC Tokens
  {
    address: "0x885c99a787BE6b41cbf964174C771A9f7ec48e04",
    symbol: "pht",
    name: "Phoenix Token",
    chain: "bsc",
    isBurn: true,
    socials: {
      website: "https://phoenixtoken.community",
      twitter: "https://x.com/PhoenixToken0",
      telegram: "https://t.me/PhoenixToken0",
      bscscan: "https://bscscan.com/token/0x885c99a787BE6b41cbf964174C771A9f7ec48e04"
    }
  },
  { address: "0x6Ec90334d89dBdc89E08A133271be3d104128Edb", symbol: "wkc", name: "WikiCat Coin", chain: "bsc", isBurn: true },
  { address: "0x57bfe2af99aeb7a3de3bc0c42c22353742bfd20d", symbol: "war", name: "Water Rabbit Token", chain: "bsc", isBurn: true },
  { address: "0xb1957BDbA889686EbdE631DF970ecE6A7571A1B6", symbol: "dtg", name: "Defi Tiger Token", chain: "bsc", isBurn: true },
  { address: "0xd086B849a71867731D74D6bB5Df4f640de900171", symbol: "yukan", name: "Yukan Token", chain: "bsc", isBurn: true },
  { address: "0x1ee8a2f28586e542af677eb15fd00430f98d8fd8", symbol: "btcdragon", name: "BTCDragon Token", chain: "bsc", isBurn: false },
  { address: "0xE53D384Cf33294C1882227ae4f90D64cF2a5dB70", symbol: "ocicat", name: "Ocicat Token", chain: "bsc", isBurn: true },
  { address: "0x551877C1A3378c3A4b697bE7f5f7111E88Ab4Af3", symbol: "nene", name: "Nene Token", chain: "bsc", isBurn: true },
  { address: "0xDA1060158F7D593667cCE0a15DB346BB3FfB3596", symbol: "twc", name: "TIWICAT", chain: "bsc", isBurn: true },
  { address: "0x06Dc293c250e2fB2416A4276d291803fc74fb9B5", symbol: "tkc", name: "The Kingdom Coin", chain: "bsc", isBurn: false },
  { address: "0x48a510A3394C2A07506d10910EBEFf3E25b7a3f1", symbol: "durt", name: "Dutch Rabbit Token", chain: "bsc", isBurn: false },
  { address: "0xf00cD9366A13e725AB6764EE6FC8Bd21dA22786e", symbol: "twd", name: "The Word Token", chain: "bsc", isBurn: false },
  { address: "0xbD7909318b9Ca4ff140B840F69bB310a785d1095", symbol: "gtan", name: "Giant Token", chain: "bsc", isBurn: false },
  { address: "0xCbEaaD74dcB3a4227D0E6e67302402E06c119271", symbol: "zedek", name: "Zedek Token", chain: "bsc", isBurn: true },
  { address: "0xD000815DB567372C3C3d7070bEF9fB7a9532F9e8", symbol: "bengcat", name: "Bengal Cat Token", chain: "bsc", isBurn: true },
  { address: "0x47a9B109Cfb8f89D16e8B34036150eE112572435", symbol: "bcat", name: "BilliCat Token", chain: "bsc", isBurn: false },
  { address: "0xb5499B14Aca2A9B27F0E1E263186d93379485B64", symbol: "nct", name: "New Cat Token", chain: "bsc", isBurn: false },
  { address: "0xb6623B503d269f415B9B5c60CDDa3Aa4fE34Fd22", symbol: "kitsune", name: "Kitsune Token", chain: "bsc", isBurn: false },
  { address: "0xe252FCb1Aa2E0876E9B5f3eD1e15B9b4d11A0b00", symbol: "crystalstones", name: "Crystal Stones", chain: "bsc", isBurn: true },
  { address: "0x4b87F578d6FaBf381f43bd2197fBB2A877da6ef8", symbol: "bft", name: "Big Five Token", chain: "bsc", isBurn: false },
  { address: "0x72928a49c4E88F382b0b6fF3E561F56Dd75485F9", symbol: "cross", name: "Cross Token", chain: "bsc", isBurn: true },
  { address: "0x56083560594E314b5cDd1680eC6a493bb851BBd8", symbol: "thc", name: "Transhuman Coin", chain: "bsc", isBurn: false },
  { address: "0xfB69e2d3d673A8DB9Fa74ffc036A8Cf641255769", symbol: "bbft", name: "Baby BFT", chain: "bsc", isBurn: false },
  { address: "0x51363f073b1e4920fda7aa9e9d84ba97ede1560e", symbol: "bob", name: "Build on BNB", chain: "bsc", isBurn: false },
  { address: "0xAfF713b62e642b25898e24d5Be6561f863582144", symbol: "surv", name: "Survarium", chain: "bsc", isBurn: false },
  { address: "0xCAAE2A2F939F51d97CdFa9A86e79e3F085b799f3", symbol: "tut", name: "Tutorial Token", chain: "bsc", isBurn: false },
  { address: "0x14a8d0AC8Fc456899F2DD33C3f4E32403A78126c", symbol: "puffcat", name: "PuffCat Token", chain: "bsc", isBurn: true },
  { address: "0xeb2B7d5691878627eff20492cA7c9a71228d931D", symbol: "crepe", name: "CREPE", chain: "bsc", isBurn: false },
  { address: "0xdc3d92dd5a468edb7a7772452700cc93bb1826ad", symbol: "popielno", name: "POPIELNO", chain: "bsc", isBurn: true },
  { address: "0x6C0D4adAc8fb85CC336C669C08b44f2e1d492575", symbol: "spray", name: "SPRAY LOTTERY TOKEN", chain: "bsc", isBurn: true },
  { address: "0x170f044f9c7a41ff83caccad6ccca1b941d75af7", symbol: "mbc", name: "Mamba Token", chain: "bsc", isBurn: true },
  { address: "0x6844b2e9afb002d188a072a3ef0fbb068650f214", symbol: "mars", name: "Matara Token", chain: "bsc", isBurn: true },
  { address: "0x8cDC41236C567511f84C12Da10805cF50Dcdc27b", symbol: "sdc", name: "SIDE CHICK", chain: "bsc", isBurn: true },
  { address: "0x41f52a42091a6b2146561bf05b722ad1d0e46f8b", symbol: "kind", name: "KIND CAT TOKEN", chain: "bsc", isBurn: true },
  { address: "0x456B1049bA12f906326891486B2BA93e46Ae0369", symbol: "shibc", name: "AIShibCeo", chain: "bsc", isBurn: true },
  { address: "0xFeD56F9Cd29F44e7C61c396DAc95cb3ed33d3546", symbol: "pcat", name: "Phenomenal Cat", chain: "bsc", isBurn: true },
  { address: "0x2056d14A4116A7165cfeb7D79dB760a06b57DBCa", symbol: "egw", name: "Eagles Wings", chain: "bsc", isBurn: false },
  { address: "0xCa7930478492CDe4Be997FA898Cd1a6AfB8F41A1", symbol: "1000pdf", name: "1000PDF", chain: "bsc", isBurn: true },
  { address: "0xe9E3CDB871D315fEE80aF4c9FcD4886782694856", symbol: "aidove", name: "AiDove", chain: "bsc", isBurn: true },
  { address: "0x360f2cf415d9be6e82a7252681ac116fb63d2fa2", symbol: "hmt", name: "HawkMoon Token", chain: "bsc", isBurn: true },
  { address: "0x14A2db256Ef18c4f7165d5E48f65a528b4155100", symbol: "rbcat", name: "Russian Blue Cat", chain: "bsc", isBurn: false },
  { address: "0x32Eb603F30ba75052f608CFcbAC45e39B5eF9beC", symbol: "bbcat", name: "Baby BilliCat", chain: "bsc", isBurn: true },
  { address: "0x8489c022a10a8d2a65eb5aF2b0E4aE0191e7916D", symbol: "cct", name: "CatCake Token", chain: "bsc", isBurn: true },
  { address: "0x38Aec84f305564cB2625430A294382Cf33e3c317", symbol: "talent", name: "Talent Token", chain: "bsc", isBurn: true },
  { address: "0x71fd83d49fAaD4612E9d35876A75a97a5aDd4Bc2", symbol: "pcat", name: "Persian Cat Token", chain: "bsc", isBurn: false },
  { address: "0xF8418D9144172d43d12938caB74AFa695984062A", symbol: "bp", name: "Baby Priceless", chain: "bsc", isBurn: true },
  { address: "0x73cD10B66c4EBC6eE77ADFcc4310C03D79a74444", symbol: "jawgular", name: "JAWGULAR", chain: "bsc", isBurn: false },
  { address: "0x39B4cBC1CE609D736E9aC3BaDd98E95c890731F3", symbol: "dst", name: "DayStar Token", chain: "bsc", isBurn: true },
  { address: "0x5f3170D7A37D70FFE92a3e573ec67400b795B854", symbol: "peperice", name: "Pepe Rice", chain: "bsc", isBurn: true },
  { address: "0xfd8eab4F5cf3572Ae62445CAD634226DbaA37F69", symbol: "godinu", name: "GOD INU", chain: "bsc", isBurn: true },
  { address: "0x034437C7037317eaAbA782f2aD5B0A54cFcCf726", symbol: "zoe", name: "ZOE Token", chain: "bsc", isBurn: true },
  { address: "0x90206Ad9b7d23c672cd75A633CA96b5D9e9AE8Ed", symbol: "lai", name: "LeadAI Token", chain: "bsc", isBurn: true },
  { address: "0x45c0f77541d195a6dea20a681e6c02a94ca04dd0", symbol: "babydew", name: "BABY DEW", chain: "bsc", isBurn: false },
  { address: "0x4ff377aad0c67541aa12ece8b12d1217f3c94444", symbol: "sat", name: "SATERIA", chain: "bsc", isBurn: false },
  { address: "0x218ce180c6b21a355a55cdbb5b3b3bf7aad5c8a5", symbol: "orb", name: "ORBITAL", chain: "bsc", isBurn: true },
  { address: "0x47A1EB0b825b73e6A14807BEaECAFef199d5477c", symbol: "CaptainBNB", name: "Captain BNB", chain: "bsc", isBurn: false },
  { address: "0xDc11726C4efa126CFe9614408CD310B22fe74444", symbol: "anndy", name: "首席模因官", chain: "bsc", isBurn: true },
  { address: "0x794BF989b667E718FD4053029397CF8BF8CaC4ca", symbol: "light", name: "Luminous Token", chain: "bsc", isBurn: true },
  { address: "0xC284A77838D09784C79061BA57B7203F8CBF76d9", symbol: "zonic", name: "Zion Token", chain: "bsc", isBurn: false },
  { address: "0x61Fc93c7C070B32B1b1479B86056d8Ec1D7125BD", symbol: "bc400", name: "BITCOIN CULTIVATOR 400", chain: "bsc", isBurn: false },
  { address: "0x591DF09AF60366298FE31C4590a9230585D34FBd", symbol: "bnc", name: "BULLNANCE", chain: "bsc", isBurn: false },
  { address: "0x199A88E5BFacc9eAB72913c5F05Ca75D1f30234f", symbol: "jct", name: "JustCat Token", chain: "bsc", isBurn: true },
  { address: "0xa98283c7e78e7604960f672b3d609d0c5e594ed0", symbol: "RICH", name: "RichSea Token", chain: "bsc", isBurn: true },
  { address: "0xf1c599e9a5fbdea408a7409c0176a2fe42c64444", symbol: "hachiko", name: "Hachiko Inu", chain: "bsc", isBurn: false },
  { address: "0x63852B25cFabFE4EaB380df29A68663656f757EA", symbol: "jiti", name: "JITI", chain: "bsc", isBurn: false },
  { address: "0xc269d59a0D608EA0bd672F2F4616C372d8554444", symbol: "ClipX", name: "ClipX", chain: "bsc", isBurn: false },
  { address: "0x103c164727572D7A0BE8021F3d9274F0eB9F4CF8", symbol: "NEKO", name: "Nekomeow", chain: "bsc", isBurn: false },
  { address: "0xE1bf97baCF682AE17cA3E239aB68a7b525f994A4", symbol: "zuba", name: "Zuba TheSuperDog", chain: "bsc", isBurn: false },
  { address: "0x3925f2ae71bCd36b9e4284F92f519f3924b2A91a", symbol: "spt", name: "SAFEPOINT TOKEN", chain: "bsc", isBurn: true },
  { address: "0x5944C5278298ADfa691d29ceA70e29333dD47777", symbol: "gpan", name: "Giant Panda", chain: "bsc", isBurn: false },
  { address: "0xA925EbCF141c5efdDA5c38c569Ab789aa52f0Fc3", symbol: "aide", name: "AI DEFI", chain: "bsc", isBurn: false },
  { address: "0xc0a0626dfc53b05460eca06f546f1a1f0d0a4444", symbol: "kratos", name: "Kratos Token", chain: "bsc", isBurn: false },
  { address: "0x903badf5bf9175297cc889030e051431950cffff", symbol: "Cardio", name: "Cardio", chain: "bsc", isBurn: false },
  { address: "0xAA091C8bd5bded850a78F1cf72d5029b19459237", symbol: "$iaped", name: "IAped Token", chain: "bsc", isBurn: false },
  { address: "0xbe2306D28852Ea53A1e90CABA1bc9e6db5E11CE8", symbol: "can", name: "CANDLEFI", chain: "bsc", isBurn: false },
  { address: "0x47318Ce01d3c447acA06A7bbBd25a35Ad1184D96", symbol: "gcat", name: "Glory Cat", chain: "bsc", isBurn: false },
  { address: "0x6fc20e595A8704725DBd160E7c799665706e0bdD", symbol: "lexa", name: "Lexa Coin", chain: "bsc", isBurn: false },
  { address: "0x4CF42771B73dACb4C2c78790dA77D64a9ae6bdBd", symbol: "kinka", name: "Kinkajou Token", chain: "bsc", isBurn: false },
  { address: "0x81DD6A9395520263Ded0BdB9578274ab9d3Be186", symbol: "bgoat", name: "BNBGOAT", chain: "bsc", isBurn: false },
  { address: "0x391d9DDA8E3d0418D323EA6BcC194300d1b76eDC", symbol: "lscat", name: "Light Speed Cat v2", chain: "bsc", isBurn: true },
  { address: "0x860de30baf288efaefd90f2700358d26d4fc4444", symbol: "rkc", name: "Rocky Cat", chain: "bsc", isBurn: true },


  { address: "0xf20f989CAf263C513f9183B4Fed88F14Fc04c8dB", symbol: "shalom", name: "Shalom", chain: "rwa", isBurn: false },
  { address: "0x782ea82124B474f1f968262ec24FCdED39689dd5", symbol: "rvm", name: "Real World Meme", chain: "rwa", isBurn: false },
  { address: "0x02afe9989D86a0357fbb238579FE035dc17BcAB0", symbol: "xRWA", name: "Xend Finance RWA", chain: "rwa", isBurn: false },
  { address: "0xEc6943BB984AED25eC96986898721a7f8aB6212E", symbol: "", name: "WiCrypt Network", chain: "rwa", isBurn: false },
  { address: "0x7923C0f6FA3d1BA6EAFCAedAaD93e737Fd22FC4F", symbol: "cNGN", name: "cNGN", chain: "rwa", isBurn: false },
  { address: "0xbe231A8492487aAe6096278A97050FAe6B9d5BEc", symbol: "weth", name: "Wrapped Ether", chain: "rwa", isBurn: false },

  { address: "0x4200000623d0242cccd4e907008583dcb4af6472", symbol: "estee", name: "SHIBSTEE", chain: "eth", isBurn: false },

];

// Utility functions for token lookups
export function getTokenByAddress(address: string): TokenMetadata | undefined {
  return TOKEN_REGISTRY.find(token =>
    token.address.toLowerCase() === address.toLowerCase()
  );
}

export function getTokenBySymbol(symbol: string, chain?: 'bsc' | 'sol' | 'rwa' | 'eth'): TokenMetadata | undefined {
  const tokens = TOKEN_REGISTRY.filter(token =>
    token.symbol.toLowerCase() === symbol.toLowerCase() &&
    (chain ? token.chain === chain : true)
  );

  // If multiple tokens with same symbol, prefer BSC tokens or return first match
  if (tokens.length > 1) {
    return tokens.find(token => token.chain === 'bsc') || tokens[0];
  }

  return tokens[0];
}

export function getTokensBySymbol(symbol: string): TokenMetadata[] {
  return TOKEN_REGISTRY.filter(token =>
    token.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

export function getTokensByChain(chain: 'bsc' | 'sol' | 'rwa' | 'eth'): TokenMetadata[] {
  return TOKEN_REGISTRY.filter(token => token.chain === chain);
}

export function isValidContractAddress(address: string, chain: 'bsc' | 'sol' | 'rwa' | 'eth'): boolean {
  if (chain === 'bsc') {
    // EVM address validation: 42 characters, starts with 0x, followed by 40 hex characters
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
  if (chain === 'eth') {
    // EVM address validation: 42 characters, starts with 0x, followed by 40 hex characters
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
  else if (chain === 'sol') {
    // Solana address validation: 32-44 characters, base58 encoded
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }
  else if (chain === 'rwa') {

    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
  return false;
}

// Address-to-symbol mapping for quick lookups
export const ADDRESS_TO_SYMBOL_MAP: Record<string, string> = TOKEN_REGISTRY.reduce((acc, token) => {
  acc[token.address.toLowerCase()] = token.symbol;
  return acc;
}, {} as Record<string, string>);

// Symbol-to-address mapping for backward compatibility (handles duplicates by preferring BSC)
export const SYMBOL_TO_ADDRESS_MAP: Record<string, string> = {};
TOKEN_REGISTRY.forEach(token => {
  const symbolKey = token.symbol.toLowerCase();
  // Only set if not already set, or if current token is BSC and existing is not
  if (!SYMBOL_TO_ADDRESS_MAP[symbolKey] ||
    (token.chain === 'bsc' && getTokenByAddress(SYMBOL_TO_ADDRESS_MAP[symbolKey])?.chain !== 'bsc')) {
    SYMBOL_TO_ADDRESS_MAP[symbolKey] = token.address;
  }
});

// Legacy support - maps old symbol-based lookups to new address-based system (handles duplicates)
export const TOKEN_MAP: Record<string, { address: string }> = {};
TOKEN_REGISTRY.forEach(token => {
  // Only set if not already set, or if current token is BSC and existing is not
  if (!TOKEN_MAP[token.symbol] ||
    (token.chain === 'bsc' && getTokenByAddress(TOKEN_MAP[token.symbol].address)?.chain !== 'bsc')) {
    TOKEN_MAP[token.symbol] = { address: token.address };
  }
});
