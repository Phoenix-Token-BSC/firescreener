import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

function otpKey(email: string) {
  return `dev-otp:${email.toLowerCase()}`;
}

interface OtpEntry {
  code: string;
  userId: string;
}

export async function POST(req: NextRequest) {
  let body: { email?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, code } = body;
  if (!email || !code) {
    return NextResponse.json({ error: "Missing email or code" }, { status: 400 });
  }

  const raw = await redis.get<string>(otpKey(email));
  if (!raw) {
    return NextResponse.json({ error: "Code expired or not found. Please sign up again." }, { status: 400 });
  }

  let entry: OtpEntry;
  try {
    entry = typeof raw === "string" ? JSON.parse(raw) : (raw as OtpEntry);
  } catch {
    return NextResponse.json({ error: "Invalid session. Please sign up again." }, { status: 400 });
  }

  if (entry.code !== code.trim()) {
    return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 });
  }

  const admin = adminClient();
  const { error: updateErr } = await admin.auth.admin.updateUserById(entry.userId, {
    email_confirm: true,
  });

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await redis.del(otpKey(email));

  return NextResponse.json({ success: true });
}
