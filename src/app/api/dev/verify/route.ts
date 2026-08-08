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

  // Confirm email in Supabase auth
  const { error: updateErr } = await admin.auth.admin.updateUserById(entry.userId, {
    email_confirm: true,
  });

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Grant the developer capability explicitly.
  //
  // This used to rely on a database trigger that inserted a developer_accounts row on
  // email confirmation. That table is retired: a developer is now an ordinary account
  // with is_developer set, so the capability is granted here where it can be seen.
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("id", entry.userId)
    .maybeSingle();

  if (existing) {
    // Already has an account — they keep it, their username, and their blaze balance,
    // and simply gain the capability. This is the whole point of the merge: one person,
    // one account.
    const { error } = await admin
      .from("profiles")
      .update({ is_developer: true })
      .eq("id", entry.userId);

    if (error) {
      console.error("[dev/verify] granting developer capability failed:", error.message);
      return NextResponse.json(
        { error: "Verified, but the developer capability could not be granted." },
        { status: 500 }
      );
    }
  } else {
    // Brand new account. The username is derived from the email and suffixed with part
    // of the user id, which keeps it unique without a retry loop.
    const username =
      email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "") + "_" + entry.userId.slice(0, 4);

    const { error } = await admin.from("profiles").insert({
      id: entry.userId,
      username,
      email: email.toLowerCase(),
      is_developer: true,
      is_active: true,
    });

    if (error) {
      console.error("[dev/verify] profile creation failed:", error.message);
      return NextResponse.json(
        { error: "Verified, but the developer profile could not be created." },
        { status: 500 }
      );
    }
  }

  await redis.del(otpKey(email));

  return NextResponse.json({ success: true });
}
