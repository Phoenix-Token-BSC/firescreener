import { NextResponse } from 'next/server';
import { sessionCookieOptions } from '@/lib/adminSession';

export async function POST() {
  const response = NextResponse.json({ success: true });
  // maxAge 0 expires the cookie immediately.
  response.cookies.set({ ...sessionCookieOptions(0), value: '' });
  return response;
}
