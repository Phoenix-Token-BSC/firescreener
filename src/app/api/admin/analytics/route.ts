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

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total rewards
    const { count: totalRewards } = await supabase
      .from('rewards')
      .select('*', { count: 'exact', head: true });

    // Total redemptions
    const { count: totalRedemptions } = await supabase
      .from('reward_redemptions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString());

    // Total points spent
    const { data: pointsSpent } = await supabase
      .from('reward_redemptions')
      .select('rewards(cost)')
      .gte('created_at', startDate.toISOString());

    const totalPointsSpent = pointsSpent?.reduce((sum, r: any) => {
      return sum + (r.rewards?.cost || 0);
    }, 0) || 0;

    // Top rewards by redemptions
    const { data: topRewards } = await supabase
      .from('reward_redemptions')
      .select('reward_id, rewards(name, icon)', { count: 'exact' })
      .gte('created_at', startDate.toISOString());

    const rewardCounts = new Map<string, { name: string; icon: string; count: number }>();
    topRewards?.forEach((r: any) => {
      const key = r.reward_id;
      if (rewardCounts.has(key)) {
        const existing = rewardCounts.get(key)!;
        existing.count += 1;
      } else {
        rewardCounts.set(key, {
          name: r.rewards?.name || 'Unknown',
          icon: r.rewards?.icon || '🎁',
          count: 1,
        });
      }
    });

    const topRewardsList = Array.from(rewardCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Redemptions by type
    const { data: redemptionsByType } = await supabase
      .from('reward_redemptions')
      .select('rewards(type)', { count: 'exact' })
      .gte('created_at', startDate.toISOString());

    const typeCounts = { fcfs: 0, ticket: 0, instant: 0 };
    redemptionsByType?.forEach((r: any) => {
      const type = r.rewards?.type || 'instant';
      typeCounts[type as keyof typeof typeCounts]++;
    });

    return NextResponse.json({
      summary: {
        totalRewards,
        totalRedemptions,
        totalPointsSpent,
        averagePointsPerRedemption:
          totalRedemptions > 0 ? Math.round(totalPointsSpent / totalRedemptions) : 0,
      },
      topRewards: topRewardsList,
      redemptionsByType: typeCounts,
      period: days,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
