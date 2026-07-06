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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const email = request.headers.get('x-user-email');

    if (!email || !(await isAdmin(email))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, type, cost, stock, icon, color, badge } = body;

    // Build update object, only including defined values
    const updateData: Record<string, any> = {
      name,
      description,
      type,
      cost,
      icon,
      color,
      updated_at: new Date().toISOString(),
    };

    // Handle optional fields
    if (type === 'fcfs' && stock !== undefined) {
      updateData.stock = stock;
    } else {
      updateData.stock = null;
    }

    if (badge !== undefined && badge !== '') {
      updateData.badge = badge;
    } else {
      updateData.badge = null;
    }

    const { data: reward, error } = await supabase
      .from('rewards')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      throw error;
    }

    if (!reward || reward.length === 0) {
      return NextResponse.json(
        { error: 'Reward not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ reward: reward[0] });
  } catch (error) {
    console.error('Error updating reward:', error);
    return NextResponse.json(
      { error: 'Failed to update reward' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const email = request.headers.get('x-user-email');

    if (!email || !(await isAdmin(email))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from('rewards')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting reward:', error);
    return NextResponse.json(
      { error: 'Failed to delete reward' },
      { status: 500 }
    );
  }
}
