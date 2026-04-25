import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OTP_TTL_SEC  = 600; // 10 minutes

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const resend = new Resend(process.env.RESEND_API_KEY);

function otpKey(email: string) {
  return `dev-otp:${email.toLowerCase()}`;
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; username?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, password, username } = body;
  if (!email || !password || !username) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = adminClient();

  // Create user but keep email unconfirmed until code is verified
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    user_metadata: { username },
    email_confirm: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const code = generateCode();
  // Store code + userId together so verify can confirm without listUsers()
  await redis.set(otpKey(email), JSON.stringify({ code, userId: created.user.id }), { ex: OTP_TTL_SEC });

  const { error: mailErr } = await resend.emails.send({
    from: "FireScreener <team@firescreener.com>",
    to: email,
    subject: "Your FireScreener verification code",
    html: buildEmail(username, code),
  });

  if (mailErr) {
    console.error("[dev/signup] Email delivery failed:", mailErr);
  }

  return NextResponse.json({ success: true });
}

function buildEmail(username: string, code: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verification code</title>
</head>
<body style="margin:0;padding:0;background:#1a0303;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a0303;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#2a0505;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px 36px;" cellpadding="0" cellspacing="0">

          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <span style="color:#ffffff;font-size:22px;font-weight:900;letter-spacing:-0.5px;">FireScreener</span>
              <span style="color:rgba(255,255,255,0.3);font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-left:8px;vertical-align:middle;">Dev Portal</span>
            </td>
          </tr>

          <tr>
            <td style="padding-bottom:8px;">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">
                Hi ${username}, here is your code
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding-bottom:28px;">
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.45);line-height:1.6;">
                Enter the code below to verify your email and activate your developer account. It expires in 10 minutes.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding-bottom:28px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:20px 40px;">
                <span style="font-size:36px;font-weight:900;letter-spacing:10px;color:#ffffff;font-variant-numeric:tabular-nums;">${code}</span>
              </div>
            </td>
          </tr>

          <tr>
            <td style="border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);line-height:1.5;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}
