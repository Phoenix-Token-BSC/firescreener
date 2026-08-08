import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminSession';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: NextRequest) {
  try {
    const email = await requireAdmin(request);

    if (!email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: rewards, error } = await supabase
      .from('rewards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ rewards });
  } catch (error) {
    console.error('Error fetching rewards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rewards' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const email = await requireAdmin(request);

    if (!email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, type, cost, stock, icon, color, badge } = body;

    if (!name || !description || !type || cost === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Build insert object, only including defined/valid values
    const insertData: Record<string, any> = {
      name,
      description,
      type,
      cost,
      icon,
      color,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Handle optional fields
    if (type === 'fcfs' && stock !== undefined) {
      insertData.stock = stock;
    } else {
      insertData.stock = null;
    }

    if (badge && badge !== '') {
      insertData.badge = badge;
    }

    const { data: reward, error } = await supabase
      .from('rewards')
      .insert([insertData])
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({ reward: reward[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating reward:', error);
    return NextResponse.json(
      { error: 'Failed to create reward' },
      { status: 500 }
    );
  }
}
