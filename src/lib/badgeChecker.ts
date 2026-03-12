import { supabase } from './supabase';
import { sendPushNotification } from './notifications';
import { useAuthStore } from '../stores/authStore';

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
      { data: answersData },
      { data: userData },
      { count: listsCount },
      { count: buddyRatingsCount },
    ] = await Promise.all([
      supabase.from('venues').select('*', { count: 'exact', head: true }).eq('created_by', userId),
      supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('likes').select('post_id, post:posts!inner(user_id)', { count: 'exact', head: true }).eq('post.user_id', userId),
      supabase.from('event_attendees').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'confirmed'),
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('creator_id', userId),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('post_type', 'moment'),
      supabase.from('recommendation_answers').select('upvotes').eq('user_id', userId),
      supabase.from('users').select('last_active_date').eq('id', userId).single(),
      supabase.from('lists').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('buddy_ratings').select('*', { count: 'exact', head: true }).eq('rater_id', userId),
    ]);

    const upvotesReceived = (answersData || []).reduce((sum: number, a: any) => sum + (a.upvotes || 0), 0);

    // Calculate streak: count distinct active days in the last 30 days by querying
    // posts and reviews created by the user, then counting consecutive days from today backwards.
    const streakDays = await (async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cutoff = thirtyDaysAgo.toISOString();

        // Fetch recent activity timestamps (posts + reviews) in parallel
        const [{ data: recentPosts }, { data: recentReviews }] = await Promise.all([
          supabase.from('posts').select('created_at').eq('user_id', userId).gte('created_at', cutoff),
          supabase.from('reviews').select('created_at').eq('user_id', userId).gte('created_at', cutoff),
        ]);

        // Collect all unique active dates (YYYY-MM-DD)
        const activeDates = new Set<string>();
        for (const item of [...(recentPosts || []), ...(recentReviews || [])]) {
          activeDates.add(item.created_at.split('T')[0]);
        }
        // Also include the last_active_date from user data if present
        if (userData?.last_active_date) {
          activeDates.add(userData.last_active_date.split('T')[0]);
        }

        if (activeDates.size === 0) return 0;

        // Count consecutive days backwards from today
        let streak = 0;
        const today = new Date();
        for (let i = 0; i < 30; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(today.getDate() - i);
          const dateStr = checkDate.toISOString().split('T')[0];
          if (activeDates.has(dateStr)) {
            streak++;
          } else if (i === 0) {
            // If not active today, still check if active yesterday to not break the streak prematurely
            continue;
          } else {
            break;
          }
        }
        return streak;
      } catch {
        // Fallback: if queries fail, use the simple last_active_date check
        if (!userData?.last_active_date) return 0;
        const daysSinceActive = Math.floor((Date.now() - new Date(userData.last_active_date).getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceActive <= 1 ? 1 : 0;
      }
    })();

    const statsMap: Record<string, number> = {
      venues_added: venueCount || 0,
      reviews_written: reviewCount || 0,
      posts_created: postCount || 0,
      likes_received: likesReceived || 0,
      meetups_attended: meetupsAttended || 0,
      meetups_organized: meetupsOrganized || 0,
      moments_shared: momentsCount || 0,
      upvotes_received: upvotesReceived,
      streak_days: streakDays,
      lists_created: listsCount || 0,
      buddy_matches_completed: buddyRatingsCount || 0,
    };

    // Award any newly-earned badges
    for (const badge of allBadges) {
      if (earnedIds.has(badge.id)) continue;
      const stat = statsMap[badge.condition_type];
      if (stat !== undefined && stat >= badge.condition_value) {
        await supabase.from('user_badges').insert({ user_id: userId, badge_id: badge.id });

        // Send push notification for newly earned badge
        sendPushNotification(
          userId,
          'Yeni Rozet!',
          `"${badge.name}" rozetini kazandin!`,
          { route: '/profile' }
        ).catch(() => {});
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
      const currentXP = user.xp_points || 0;
      const newXP = currentXP + points;
      const { error } = await supabase
        .from('users')
        .update({
          xp_points: newXP,
          last_active_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', userId);

      // Refresh auth store so XP changes are visible in the UI immediately
      if (!error) {
        const authState = useAuthStore.getState();
        if (authState.user && authState.user.id === userId) {
          useAuthStore.setState({
            user: { ...authState.user, xp_points: newXP },
          });
        }
      }
    }
  } catch {
    // Silently ignore XP errors
  }
}
