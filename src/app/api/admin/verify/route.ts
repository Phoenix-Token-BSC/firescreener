import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminSession';

/**
 * Reports whether the caller holds a valid admin session.
 *
 * This used to accept an email in the request body and answer "is this an admin?", which
 * told any caller whether an address was an admin and was the basis of the header-trust
 * scheme. Identity now comes from the signed session cookie only — the body is ignored.
 */
async function handle(request: NextRequest) {
  const email = await requireAdmin(request);
  if (!email) {
    return NextResponse.json({ isAdmin: false }, { status: 401 });
  }
  return NextResponse.json({ isAdmin: true, email });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

// Kept so the existing client call site continues to work.
export async function POST(request: NextRequest) {
  return handle(request);
}
