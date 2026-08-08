import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// User-scoped client — used only to verify the JWT and get user.id
function makeUserClient(token: string) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// Admin client — uses service role key to bypass RLS for server-side operations.
// Falls back to anon key if SUPABASE_SERVICE_ROLE_KEY is not set.
function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY ?? ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveUser(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const { data: { user }, error } = await makeUserClient(token).auth.getUser();
  if (error || !user) return null;
  return { user, token };
}

// A developer may own several tokens, so every operation here is scoped by
// (developer_id, address, chain) rather than developer_id alone.
interface TokenRow {
  address: string;
  symbol: string;
  name: string;
  chain: string;
  description: string | null;
  header_image: string | null;
  is_burn: boolean | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  scan: string | null;
  // Added by migrations/add_listing_submissions.sql; absent before that runs.
  status?: string | null;
}

function toResponse(row: TokenRow) {
  return {
    address: row.address,
    symbol: row.symbol,
    name: row.name,
    chain: row.chain,
    description: row.description,
    header_image: row.header_image,
    is_burn: row.is_burn,
    website: row.website,
    twitter: row.twitter,
    telegram: row.telegram,
    scan: row.scan,
    // Rows written before the status column existed are all pre-existing listings.
    status: row.status ?? "live",
  };
}

// GET — every token linked to this developer
export async function GET(req: NextRequest) {
  const resolved = await resolveUser(req);
  if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminClient();

  // select('*') so this works both before and after the status column is added —
  // naming a column that does not exist yet would fail the whole query.
  const { data, error } = await db
    .from("tokens")
    .select("*")
    .eq("developer_id", resolved.user.id)
    .order("name", { ascending: true });

  if (error) {
    console.error("[dev/token-info GET]", error.message, "| user:", resolved.user.id);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tokens: (data ?? []).map((r) => toResponse(r as TokenRow)) });
}

// PATCH — update editable fields on ONE of the developer's tokens
export async function PATCH(req: NextRequest) {
  const resolved = await resolveUser(req);
  if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const address = typeof body.address === "string" ? body.address.trim() : "";
  const chain = typeof body.chain === "string" ? body.chain.trim().toLowerCase() : "";

  // Without these the update would fan out across every token this developer owns.
  if (!address || !chain) {
    return NextResponse.json({ error: "address and chain are required" }, { status: 400 });
  }

  const { description, header_image, is_burn, website, twitter, telegram } = body as {
    description?: string; header_image?: string | null; is_burn?: boolean;
    website?: string; twitter?: string; telegram?: string;
  };

  // ilike, not eq: Solana addresses are case-sensitive base58 stored in canonical
  // casing, so matching a lowercased copy would silently miss.
  const { data, error } = await db
    .from("tokens")
    .update({ description, header_image, is_burn, website, twitter, telegram })
    .eq("developer_id", resolved.user.id)
    .ilike("address", address)
    .eq("chain", chain)
    .select("address");

  if (error) {
    console.error("[dev/token-info PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Zero rows means the token is not this developer's — do not report success.
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Token not found on this account" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// POST — claim an unclaimed token
export async function POST(req: NextRequest) {
  const resolved = await resolveUser(req);
  if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminClient();

  let body: { address?: string; chain?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { address, chain } = body;
  if (!address || !chain) {
    return NextResponse.json({ error: "address and chain are required" }, { status: 400 });
  }

  const chainLower = chain.toLowerCase();

  // Match case-insensitively rather than lowercasing the input: Solana addresses are
  // case-sensitive base58 and are stored in their canonical casing, so an .eq() against
  // a lowercased address would silently fail to find them.
  const { data: existing, error: fetchErr } = await db
    .from("tokens")
    .select("developer_id")
    .ilike("address", address)
    .eq("chain", chainLower)
    .maybeSingle();

  if (fetchErr) {
    console.error("[dev/token-info POST]", fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Token not found in registry" }, { status: 404 });
  }
  if (existing.developer_id) {
    return NextResponse.json(
      {
        error:
          existing.developer_id === resolved.user.id
            ? "You have already claimed this token"
            : "Token is already claimed",
      },
      { status: 409 }
    );
  }

  // A developer may own any number of tokens, so there is deliberately no check here
  // that they own none already.
  //
  // The developer_id IS NULL guard makes the claim atomic: if two developers submit at
  // the same moment, the second update matches zero rows instead of overwriting.
  const { data: claimed, error: updateErr } = await db
    .from("tokens")
    .update({ developer_id: resolved.user.id })
    .ilike("address", address)
    .eq("chain", chainLower)
    .is("developer_id", null)
    .select("address, chain");

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: "Token was claimed by someone else." }, { status: 409 });
  }

  return NextResponse.json({ success: true, token: claimed[0] });
}
