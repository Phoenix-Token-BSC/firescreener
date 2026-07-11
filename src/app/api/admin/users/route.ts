import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function isAdmin(email: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', email)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('Admin check error:', err);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');

    if (!email || !(await isAdmin(email))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: admins, error } = await supabase
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ admins });
  } catch (error) {
    console.error('Error fetching admins:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admins' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');

    if (!email || !(await isAdmin(email))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email: newAdminEmail, username, role = 'admin' } = body;

    if (!newAdminEmail) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const { data: admin, error } = await supabase
      .from('admin_users')
      .insert([
        {
          email: newAdminEmail,
          username,
          role,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Admin user already exists' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ admin: admin[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating admin:', error);
    return NextResponse.json(
      { error: 'Failed to create admin' },
      { status: 500 }
    );
  }
}
