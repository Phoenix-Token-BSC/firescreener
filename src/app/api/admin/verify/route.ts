import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { isAdmin: false, error: 'Email required' },
        { status: 400 }
      );
    }

    // Verify admin exists and is active
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('id, is_active')
      .eq('email', email)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error verifying admin:', error);
      return NextResponse.json({ isAdmin: false });
    }

    return NextResponse.json({ isAdmin: !!adminUser });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json({ isAdmin: false });
  }
}
