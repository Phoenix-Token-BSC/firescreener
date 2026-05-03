import { NextRequest, NextResponse } from "next/server";
import { getTokenByAddress, getTokenBySymbol, isValidContractAddress } from "@/lib/tokenRegistry";

interface RouteParams {
  chain: string;
  identifier: string;
}

// Pool mapping for chart data - maps token symbols to their pool addresses
const TOKEN_POOL_MAPPING: Record<string, string> = {
  pht: "0x8a2328b2c8e6a6f56668a0e26081efc250a8d6c0",
  wkc: "0x933477eba23726ca95a957cb85dbb1957267ef85",
  war: "0xf1c2d7d7e539a02acc3f0c46ca1e83c0f69baac2",
  dtg: "0xd2e4a524d1a932adbc70fb41f2bec05884d5f6c2",
  yukan: "0x0797395fcad3f27059405f266080701a77688c7f",
  btcdragon: "0x59670d4ac4862b5b9c495ca31a2a4bc6fd1d0101",
  ocicat: "0x1df65d3a75aecd000a9c17c97e99993af01dbcd1",
  nene: "0x9697815e4581cdf320cbc4aac212dc92a1ac2992",
  twc: "0x955ed3d0e1d2615a1d7bebb10ffab37f150bbb21",
  durt: "0xdc98307571709e048f8c6d1ff0bb48eab054e535",
  gtan: "0xe965e86bc7da68fd489c4ab438eb81a48a4ad6e5",
  zedek: "0x246d1711a3834c405845ae52de0b808ef9bfba6e",
  tkc: "0xbee567474f87f7725791f2872d165fb69e0bbcdd",
  twd: "0x4f61c7672d36da605cef5e52f6f2896193b61e83",
  bcat: "0x91e5de867f67cf90d3f658b22aff4e8c881d4d2a",
  nct: "0xa52c143c9f5e410497e671ec9ad40b868835e9bb",
  kitsune: "0x969d92e917e68a3a4e8596770852d94bd315d194",
  bengcat: "0x07acf7676d34adf7c217c89a1efbf8379c00cea6",
  crystalstones: "0xe252fcb1aa2e0876e9b5f3ed1e15b9b4d11a0b00",
  bft: "0x99c2d5977b94bdfdf91ee36f613e330e8102e326",
  cross: "0x3e93fec6e3ae5940dac4869acf5178bd30f4fc04",
  thc: "0x62be1533f3a78de99ca297ebbe489a3fb7253bef",
  bbft: "0xfB69e2d3d673A8DB9Fa74ffc036A8Cf641255769",
  bob: "0x51363F073b1E4920fdA7AA9E9d84BA97EdE1560e",
  puffcat: "0x14a8d0AC8Fc456899F2DD33C3f4E32403A78126c",
  crepe: "0xeb2B7d5691878627eff20492cA7c9a71228d931D",
  popielno: "0xdc3d92dd5a468edb7a7772452700cc93bb1826ad",
  spray: "0x6C0D4adAc8fb85CC336C669C08b44f2e1d492575",
  mbc: "0x170f044f9c7a41ff83caccad6ccca1b941d75af7",
  mars: "0x6844b2e9afb002d188a072a3ef0fbb068650f214",
  sdc: "0x8cDC41236C567511f84C12Da10805cF50Dcdc27b",
  kind: "0x41f52A42091A6B2146561bF05b722Ad1d0e46f8b",
  shibc: "0x456B1049bA12f906326891486B2BA93e46Ae0369",
  pcat: "0xFeD56F9Cd29F44e7C61c396DAc95cb3ed33d3546",
  // Add contract address mappings to handle duplicate symbols
  "0xfed56f9cd29f44e7c61c396dac95cb3ed33d3546": "0xFeD56F9Cd29F44e7C61c396DAc95cb3ed33d3546", // Phenomenal Cat
  "0x71fd83d49faad4612e9d35876a75a97a5add4bc2": "0x71fd83d49fAaD4612E9d35876A75a97a5aDd4Bc2", // Persian Cat Token
  egw: "0x2056d14A4116A7165cfeb7D79dB760a06b57DBCa",
  "1000pdf": "0xCa7930478492CDe4Be997FA898Cd1a6AfB8F41A1",
  aidove: "0xe9E3CDB871D315fEE80aF4c9FcD4886782694856",
  hmt: "0x360f2cf415d9be6e82a7252681ac116fb63d2fa2",
  rbcat: "0x14A2db256Ef18c4f7165d5E48f65a528b4155100",
  bbcat: "0x32Eb603F30ba75052f608CFcbAC45e39B5eF9beC",
  cct: "0x8489c022a10a8d2a65eb5aF2b0E4aE0191e7916D",
  talent: "0x38Aec84f305564cB2625430A294382Cf33e3c317",
  bp: "0xF8418D9144172d43d12938caB74AFa695984062A",
  jawgular: "0x73cD10B66c4EBC6eE77ADFcc4310C03D79a74444",
  dst: "0x39B4cBC1CE609D736E9aC3BaDd98E95c890731F3",
  peperice: "0x5f3170D7A37D70FFE92a3e573ec67400b795B854",
  godinu: "0xfd8eab4F5cf3572Ae62445CAD634226DbaA37F69",
  zoe: "0x034437C7037317eaAbA782f2aD5B0A54cFcCf726",
  lai: "0x90206Ad9b7d23c672cd75A633CA96b5D9e9AE8Ed",
  babydew: "0x45c0f77541d195a6dea20a681e6c02a94ca04dd0",
  sat: "0x4ff377aad0c67541aa12ece8b12d1217f3c94444",
  orb: "0x218ce180c6b21a355a55cdbb5b3b3bf7aad5c8a5",
  captainbnb: "0x47A1EB0b825b73e6A14807BEaECAFef199d5477c",
  anndy: "0xDc11726C4efa126CFe9614408CD310B22fe74444",
  light: "0x794BF989b667E718FD4053029397CF8BF8CaC4ca",
  zonic: "0xC284A77838D09784C79061BA57B7203F8CBF76d9",
};

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

    const chainLower = chain.toLowerCase() as 'bsc' | 'sol' | 'eth';
    const identifierLower = identifier.toLowerCase();

    // Determine if identifier is a contract address or symbol
    // Use original-case identifier for validation — Solana base58 is case-sensitive
    let tokenMetadata;

    if (isValidContractAddress(identifier, chainLower)) {
      tokenMetadata = getTokenByAddress(identifier);
    } else {
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

    // Get the pool address for the token (try by contract address first, then by symbol)
    const poolAddress = TOKEN_POOL_MAPPING[tokenMetadata.address.toLowerCase()] ||
                       TOKEN_POOL_MAPPING[tokenMetadata.symbol];

    if (!poolAddress) {
      return NextResponse.json({ error: 'Chart data not available for this token' }, { status: 404 });
    }

    // Generate the GeckoTerminal embed URL
    const GECKO_NETWORK: Record<string, string> = { bsc: 'bsc', eth: 'ethereum', sol: 'solana', rwa: 'bsc' };
    const geckoNetwork = GECKO_NETWORK[chainLower] ?? 'bsc';
    const embedUrl = `https://www.geckoterminal.com/${geckoNetwork}/pools/${poolAddress}?embed=1&info=0&swaps=0`;
    
    // Return HTML that redirects to the embed URL
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="0; url=${embedUrl}">
          <title>Redirecting to Chart...</title>
        </head>
        <body>
          <p>Redirecting to chart...</p>
          <script>window.location.href = "${embedUrl}";</script>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });

  } catch (error) {
    console.error('Chart API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}
