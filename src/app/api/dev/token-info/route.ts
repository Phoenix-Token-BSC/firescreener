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

// GET — fetch the token linked to this developer
export async function GET(req: NextRequest) {
  const resolved = await resolveUser(req);
  if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminClient();

  const { data, error } = await db
    .from("tokens")
    .select("address, symbol, name, chain, description, header_image, is_burn, website, twitter, telegram, scan")
    .eq("developer_id", resolved.user.id)
    .single();

  if (error) {
    console.error("[dev/token-info GET]", error.message, "| user:", resolved.user.id);
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  if (!data) {
    return NextResponse.json({ error: "No token linked to this account" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PATCH — update editable fields
export async function PATCH(req: NextRequest) {
  const resolved = await resolveUser(req);
  if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminClient();
  const body = await req.json();
  const { description, header_image, is_burn, website, twitter, telegram } = body;

  const { error } = await db
    .from("tokens")
    .update({ description, header_image, is_burn, website, twitter, telegram })
    .eq("developer_id", resolved.user.id);

  if (error) {
    console.error("[dev/token-info PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// POST — claim an unclaimed token
export async function POST(req: NextRequest) {
  const resolved = await resolveUser(req);
  if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminClient();
  const { address, chain } = await req.json();

  if (!address || !chain) {
    return NextResponse.json({ error: "address and chain are required" }, { status: 400 });
  }

  const { data: existing, error: fetchErr } = await db
    .from("tokens")
    .select("developer_id")
    .eq("address", address.toLowerCase())
    .eq("chain", chain.toLowerCase())
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Token not found in registry" }, { status: 404 });
  }

  if (existing.developer_id) {
    return NextResponse.json({ error: "Token is already claimed" }, { status: 409 });
  }

  const { data: alreadyOwns } = await db
    .from("tokens")
    .select("address")
    .eq("developer_id", resolved.user.id)
    .single();

  if (alreadyOwns) {
    return NextResponse.json({ error: "Your account already has a linked token" }, { status: 409 });
  }

  const { error: updateErr } = await db
    .from("tokens")
    .update({ developer_id: resolved.user.id })
    .eq("address", address.toLowerCase())
    .eq("chain", chain.toLowerCase());

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
