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
    const days = parseInt(searchParams.get('days') || '30') || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startIso = startDate.toISOString();

    // Total rewards
    const { count: totalRewards } = await supabase
      .from('rewards')
      .select('*', { count: 'exact', head: true });

    // User signups
    const { count: totalUsers } = await supabase
      .from('auth_users')
      .select('*', { count: 'exact', head: true });

    const { count: newSignups } = await supabase
      .from('auth_users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startIso);

    // Redemptions in period (recorded in reward_claims by the redeem flow)
    const { data: periodClaims } = await supabase
      .from('reward_claims')
      .select('reward_id, cost_paid, rewards(name, icon, type)')
      .gte('claimed_at', startIso);

    const totalRedemptions = periodClaims?.length || 0;

    const totalPointsSpent = periodClaims?.reduce((sum, r: any) => {
      return sum + (r.cost_paid || 0);
    }, 0) || 0;

    // Total points claimed (all-time). total_blazes_claimed is the user's current
    // balance — spending deducts from it — so claimed = balances + all-time spend.
    const { data: userBalances } = await supabase
      .from('auth_users')
      .select('total_blazes_claimed');

    const { data: devBalances } = await supabase
      .from('developer_accounts')
      .select('total_blazes_claimed');

    const totalBalances = [...(userBalances || []), ...(devBalances || [])].reduce(
      (sum, r) => sum + (r.total_blazes_claimed || 0),
      0
    );

    const { data: allClaims } = await supabase
      .from('reward_claims')
      .select('cost_paid');

    const allTimeSpent = allClaims?.reduce((sum, r) => {
      return sum + (r.cost_paid || 0);
    }, 0) || 0;

    const totalPointsClaimed = totalBalances + allTimeSpent;

    // Top rewards by redemptions
    const rewardCounts = new Map<string, { name: string; icon: string; count: number }>();
    periodClaims?.forEach((r: any) => {
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
    const typeCounts = { fcfs: 0, ticket: 0, instant: 0 };
    periodClaims?.forEach((r: any) => {
      const type = r.rewards?.type || 'instant';
      typeCounts[type as keyof typeof typeCounts]++;
    });

    return NextResponse.json({
      summary: {
        totalUsers: totalUsers ?? 0,
        newSignups: newSignups ?? 0,
        totalRewards,
        totalRedemptions,
        totalPointsSpent,
        totalPointsClaimed,
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
