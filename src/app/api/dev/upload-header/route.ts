import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

function makeUserClient(token: string) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY ?? ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  // Verify JWT
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = auth.slice(7);
  const { data: { user }, error: authErr } = await makeUserClient(token).auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse multipart form
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only PNG, JPEG and WEBP are allowed" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 2 MB limit" }, { status: 400 });
  }

  const db = adminClient();

  // Look up the token linked to this developer to build the storage path
  const { data: tokenRow, error: tokenErr } = await db
    .from("tokens")
    .select("address, chain")
    .eq("developer_id", user.id)
    .single();

  if (tokenErr || !tokenRow) {
    return NextResponse.json({ error: "No token linked to this account" }, { status: 404 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `headers/${tokenRow.chain}/${tokenRow.address}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadErr } = await db.storage
    .from("token-headers")
    .upload(path, arrayBuffer, { upsert: true, contentType: file.type });

  if (uploadErr) {
    console.error("[dev/upload-header]", uploadErr.message);
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: { publicUrl } } = db.storage.from("token-headers").getPublicUrl(path);
  return NextResponse.json({ url: publicUrl });
}
