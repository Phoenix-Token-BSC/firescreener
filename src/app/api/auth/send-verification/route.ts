import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const resendApiKey = process.env.RESEND_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
const resend = new Resend(resendApiKey);

function generateVerificationCode(): string {
  return Math.random().toString().slice(2, 8);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email } = body;

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'User ID and email are required' },
        { status: 400 }
      );
    }

    // Generate 6-digit verification code
    const code = generateVerificationCode();

    // Code expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Store verification code in database
    const { data, error: dbError } = await supabase
      .from('email_verification')
      .insert([
        {
          user_id: userId,
          email,
          code,
          expires_at: expiresAt.toISOString(),
          is_verified: false,
        },
      ])
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to generate verification code' },
        { status: 500 }
      );
    }

    // Send verification email via Resend
    const { error: emailError } = await resend.emails.send({
      from: 'team@firescreener.com',
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Email Verification</h2>
          <p>Thank you for signing up! To verify your email address, use the code below:</p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 2px; margin: 0;">${code}</p>
          </div>
          <p>This code expires in 15 minutes.</p>
          <p>If you didn't create this account, please ignore this email.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #666;">
            PHT Tracker - Your Crypto Rewards Dashboard
          </p>
        </div>
      `,
    });

    if (emailError) {
      console.error('Resend error:', emailError);
      return NextResponse.json(
        { error: 'Failed to send verification email', details: emailError },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Verification code sent to email',
        verificationId: data.id,
        expiresIn: 15 * 60, // seconds
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Send verification error:', error);
    return NextResponse.json(
      { error: 'An error occurred while sending verification code' },
      { status: 500 }
    );
  }
}
