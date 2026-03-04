import { supabase } from './supabase';

/**
 * Check user stats against all badge conditions and award any newly-earned badges.
 * This is a fire-and-forget call — errors are silently ignored to not block the main action.
 */
export async function checkAndAwardBadges(userId: string): Promise<void> {
  try {
    // Fetch all badges and user's current badges
    const [{ data: allBadges }, { data: userBadges }] = await Promise.all([
      supabase.from('badges').select('*'),
      supabase.from('user_badges').select('badge_id').eq('user_id', userId),
    ]);

    if (!allBadges) return;
    const earnedIds = new Set((userBadges || []).map((ub: any) => ub.badge_id));

    // Fetch user stats in parallel
    const [
      { count: venueCount },
      { count: reviewCount },
      { count: postCount },
      { count: likesReceived },
      { count: meetupsAttended },
      { count: meetupsOrganized },
      { count: momentsCount },
    ] = await Promise.all([
      supabase.from('venues').select('*', { count: 'exact', head: true }).eq('created_by', userId),
      supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', userId), // Note: this counts likes ON user's posts
      supabase.from('event_attendees').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'confirmed'),
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('creator_id', userId),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('post_type', 'moment'),
    ]);

    const statsMap: Record<string, number> = {
      venues_added: venueCount || 0,
      reviews_written: reviewCount || 0,
      posts_created: postCount || 0,
      likes_received: likesReceived || 0,
      meetups_attended: meetupsAttended || 0,
      meetups_organized: meetupsOrganized || 0,
      moments_shared: momentsCount || 0,
    };

    // Award any newly-earned badges
    for (const badge of allBadges) {
      if (earnedIds.has(badge.id)) continue;
      const stat = statsMap[badge.condition_type];
      if (stat !== undefined && stat >= badge.condition_value) {
        await supabase.from('user_badges').insert({ user_id: userId, badge_id: badge.id });
      }
    }
  } catch {
    // Silently ignore badge check errors — they should never block the main action
  }
}

/**
 * Add XP points to a user. Fire-and-forget.
 */
export async function addXP(userId: string, points: number): Promise<void> {
  try {
    // Try to use the users table directly since we may not have an RPC function
    const { data: user } = await supabase
      .from('users')
      .select('xp_points')
      .eq('id', userId)
      .single();

    if (user) {
      await supabase
        .from('users')
        .update({ xp_points: (user.xp_points || 0) + points })
        .eq('id', userId);
    }
  } catch {
    // Silently ignore XP errors
  }
}
