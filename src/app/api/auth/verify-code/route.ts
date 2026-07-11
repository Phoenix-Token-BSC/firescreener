import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, code } = body;

    if (!userId || !code) {
      return NextResponse.json(
        { error: 'User ID and verification code are required' },
        { status: 400 }
      );
    }

    // Find the verification record
    const { data: verification, error: fetchError } = await supabase
      .from('email_verification')
      .select('*')
      .eq('user_id', userId)
      .eq('code', code)
      .eq('is_verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !verification) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    // Check if code has expired
    const now = new Date();
    const expiresAt = new Date(verification.expires_at);

    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'Verification code has expired' },
        { status: 400 }
      );
    }

    // Check if max attempts exceeded
    if (verification.attempts >= verification.max_attempts) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Please request a new code.' },
        { status: 429 }
      );
    }

    // Mark verification as verified
    const now_str = now.toISOString();
    const { error: updateError } = await supabase
      .from('email_verification')
      .update({
        is_verified: true,
        verified_at: now_str,
      })
      .eq('id', verification.id);

    if (updateError) {
      console.error('Update verification error:', updateError);
      return NextResponse.json(
        { error: 'Failed to verify code' },
        { status: 500 }
      );
    }

    // Update user as email verified
    const { error: userError } = await supabase
      .from('auth_users')
      .update({
        is_email_verified: true,
        email_verified_at: now_str,
      })
      .eq('id', userId);

    if (userError) {
      console.error('Update user error:', userError);
      return NextResponse.json(
        { error: 'Failed to update user verification status' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Email verified successfully',
        verified: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Verify code error:', error);
    return NextResponse.json(
      { error: 'An error occurred during verification' },
      { status: 500 }
    );
  }
}
