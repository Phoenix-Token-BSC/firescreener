import { createClient } from '@supabase/supabase-js';
import { hashPassword, validateEmail, validateUsername, validatePassword } from '@/lib/auth';
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
    const { username, email, password, confirmPassword } = body;
    console.log('Signup request:', { username, email });

    if (!username || !email || !password || !confirmPassword) {
      console.log('Missing fields');
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (!validateUsername(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-50 characters and contain only letters, numbers, hyphens, and underscores' },
        { status: 400 }
      );
    }

    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: 'Password does not meet requirements', details: passwordValidation.errors },
        { status: 400 }
      );
    }

    const { data: existingEmail, error: emailCheckError } = await supabase
      .from('auth_users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (emailCheckError) {
      console.error('Email check error:', emailCheckError);
      return NextResponse.json(
        { error: 'Failed to check email', details: emailCheckError.message },
        { status: 500 }
      );
    }

    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    const { data: existingUsername, error: usernameCheckError } = await supabase
      .from('auth_users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (usernameCheckError) {
      console.error('Username check error:', usernameCheckError);
      return NextResponse.json(
        { error: 'Failed to check username', details: usernameCheckError.message },
        { status: 500 }
      );
    }

    if (existingUsername) {
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Create user account
    console.log('Creating user account...');
    const { data, error } = await supabase
      .from('auth_users')
      .insert([
        {
          username,
          email,
          password_hash: passwordHash,
          is_email_verified: false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase user creation error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      // Handle specific constraint errors
      if (error.code === '23505') {
        // Duplicate key error
        if (error.message?.includes('email')) {
          return NextResponse.json(
            { error: 'Email already registered' },
            { status: 409 }
          );
        }
        if (error.message?.includes('username')) {
          return NextResponse.json(
            { error: 'Username already taken' },
            { status: 409 }
          );
        }
        // Blaze stats duplicate
        console.log('Blaze stats conflict:', error.message);
        return NextResponse.json(
          {
            error: 'Failed to create account',
            details: `${error.message} - This may be due to stale data. Please contact support if this persists.`,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to create account',
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    console.log('User created:', data.id);

    // Send email verification code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const { error: verificationDbError } = await supabase
      .from('email_verification')
      .insert([
        {
          user_id: data.id,
          email,
          code,
          expires_at: expiresAt.toISOString(),
          is_verified: false,
        },
      ]);

    if (verificationDbError) {
      console.error('Verification code storage error:', verificationDbError);
    } else {
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
        // User can request a new code from the verification screen
        console.error('Verification email send error:', emailError);
      }
    }

    const { password_hash, ...userWithoutPassword } = data;

    return NextResponse.json(
      {
        message: 'Account created. Please verify your email.',
        user: userWithoutPassword,
        requiresVerification: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'An error occurred during signup' },
      { status: 500 }
    );
  }
}
