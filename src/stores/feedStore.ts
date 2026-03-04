import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { uploadImages } from '../lib/imageUpload';
import { checkAndAwardBadges, addXP } from '../lib/badgeChecker';
import type { Post, Comment, FeedCategory, RecommendationAnswer } from '../types';
import { MOCK_POSTS, MOCK_USERS, MOCK_VENUES, MOCK_POST_IMAGES, MOCK_COMMENTS, MOCK_EVENTS, MOCK_EVENT_ATTENDEES, MOCK_RECOMMENDATION_ANSWERS } from '../lib/mockData';

const PAGE_SIZE = 20;

interface FeedState {
  posts: Post[];
  selectedPost: Post | null;
  comments: Comment[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  category: FeedCategory;
  hasMore: boolean;

  fetchPosts: () => Promise<void>;
  fetchMorePosts: () => Promise<void>;
  fetchPostById: (id: string) => Promise<void>;
  fetchComments: (postId: string) => Promise<void>;
  createPost: (post: { user_id: string; venue_id?: string; caption: string; image_urls: string[]; post_type?: string; expires_at?: string }) => Promise<{ error: string | null }>;
  toggleLike: (postId: string, userId: string) => Promise<void>;
  addComment: (postId: string, userId: string, text: string) => Promise<{ error: string | null }>;
  fetchAnswers: (postId: string) => Promise<RecommendationAnswer[]>;
  submitAnswer: (postId: string, userId: string, text: string, venueId?: string) => Promise<RecommendationAnswer | null>;
  upvoteAnswer: (answerId: string, userId: string) => Promise<boolean | null>;
  refreshFeed: () => Promise<void>;
  setCategory: (category: FeedCategory) => void;
  clearError: () => void;
}

/**
 * Build fully-joined mock posts (with user, venue, images data attached).
 */
function buildMockPostsWithJoins(): Post[] {
  return MOCK_POSTS.map((post) => {
    const venue = post.venue_id
      ? MOCK_VENUES.find((v) => v.id === post.venue_id)
      : undefined;

    const mockLikes = Math.floor(Math.random() * 20);
    const mockComments = MOCK_COMMENTS.filter((c) => c.post_id === post.id).length;

    // Join event data for meetup posts
    let event = undefined;
    if (post.post_type === 'meetup') {
      const mockEvent = MOCK_EVENTS.find((e) => e.post_id === post.id);
      if (mockEvent) {
        const attendees = MOCK_EVENT_ATTENDEES
          .filter((a) => a.event_id === mockEvent.id)
          .map((a) => ({
            ...a,
            user: MOCK_USERS.find((u) => u.id === a.user_id),
          }));
        event = {
          ...mockEvent,
          creator: MOCK_USERS.find((u) => u.id === mockEvent.creator_id),
          venue: mockEvent.venue_id ? MOCK_VENUES.find((v) => v.id === mockEvent.venue_id) : undefined,
          attendees,
          attendee_count: attendees.filter((a) => a.status === 'confirmed').length,
        };
      }
    }

    return {
      ...post,
      user: MOCK_USERS.find((u) => u.id === post.user_id),
      venue: venue as Post['venue'],
      images: MOCK_POST_IMAGES.filter((img) => img.post_id === post.id).sort((a, b) => a.order - b.order),
      likes_count: mockLikes,
      comments_count: mockComments,
      event,
    };
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Apply category sorting/filtering to mock posts client-side.
 */
function applyCategoryToMockPosts(posts: Post[], category: FeedCategory): Post[] {
  let filtered = [...posts];
  const now = new Date().getTime();

  switch (category) {
    case 'meetups':
      filtered = filtered.filter((p) => p.post_type === 'meetup');
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case 'questions':
      filtered = filtered.filter((p) => p.post_type === 'question');
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case 'moments':
      filtered = filtered.filter((p) => p.post_type === 'moment' && (!p.expires_at || new Date(p.expires_at).getTime() > now));
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case 'top':
      filtered.sort((a, b) => (b.likes_count ?? 0) - (a.likes_count ?? 0));
      break;
    case 'new':
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case 'all':
    default:
      // Exclude expired moments from "all" feed
      filtered = filtered.filter((p) => {
        if (p.post_type === 'moment' && p.expires_at) {
          return new Date(p.expires_at).getTime() > now;
        }
        return true;
      });
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
  }
  return filtered;
}

/**
 * Build mock comments with user data joined.
 */
function buildMockCommentsWithUser(postId: string): Comment[] {
  return MOCK_COMMENTS
    .filter((c) => c.post_id === postId)
    .map((c) => ({
      ...c,
      user: MOCK_USERS.find((u) => u.id === c.user_id),
    }))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

/**
 * Build the Supabase query with category-based ordering.
 */
function buildCategoryQuery(category: FeedCategory) {
  let query = supabase
    .from('posts_with_counts')
    .select(`
      *,
      user:users(*),
      venue:venues(id, name, cover_image_url),
      images:post_images(*)
    `);

  const now = new Date().toISOString();

  switch (category) {
    case 'meetups':
      query = query.eq('post_type', 'meetup').order('created_at', { ascending: false });
      break;
    case 'questions':
      query = query.eq('post_type', 'question').order('created_at', { ascending: false });
      break;
    case 'moments':
      query = query.eq('post_type', 'moment').gt('expires_at', now).order('created_at', { ascending: false });
      break;
    case 'top':
      query = query.order('likes_count', { ascending: false });
      break;
    case 'new':
      query = query.order('created_at', { ascending: false });
      break;
    case 'all':
    default:
      // Exclude expired moments
      query = query.or(`expires_at.is.null,expires_at.gt.${now}`).order('created_at', { ascending: false });
      break;
  }

  return query;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  selectedPost: null,
  comments: [],
  loading: false,
  refreshing: false,
  loadingMore: false,
  error: null,
  category: 'all',
  hasMore: true,

  fetchPosts: async () => {
    set({ loading: true, error: null });
    const { category } = get();

    try {
      const { data, error } = await buildCategoryQuery(category)
        .range(0, PAGE_SIZE - 1);

      if (!error && data && data.length > 0) {
        set({
          posts: data as Post[],
          hasMore: data.length >= PAGE_SIZE,
        });
      } else {
        // Fallback to mock data
        const mockPosts = buildMockPostsWithJoins();
        const sorted = applyCategoryToMockPosts(mockPosts, category);
        set({
          posts: sorted.slice(0, PAGE_SIZE) as Post[],
          hasMore: sorted.length > PAGE_SIZE,
        });
      }
    } catch (err: any) {
      const mockPosts = buildMockPostsWithJoins();
      const sorted = applyCategoryToMockPosts(mockPosts, get().category);
      set({
        posts: sorted.slice(0, PAGE_SIZE) as Post[],
        hasMore: sorted.length > PAGE_SIZE,
        error: err?.message || 'Gonderiler yuklenirken hata olustu',
      });
    }

    set({ loading: false });
  },

  fetchMorePosts: async () => {
    const { posts, loadingMore, hasMore, category } = get();
    if (loadingMore || !hasMore) return;

    set({ loadingMore: true });
    const from = posts.length;
    const to = from + PAGE_SIZE - 1;

    try {
      const { data, error } = await buildCategoryQuery(category)
        .range(from, to);

      if (!error && data && data.length > 0) {
        set({
          posts: [...posts, ...(data as Post[])],
          hasMore: data.length >= PAGE_SIZE,
        });
      } else if (error) {
        // Mock data pagination
        const allMock = applyCategoryToMockPosts(buildMockPostsWithJoins(), category);
        const nextPage = allMock.slice(from, to + 1);
        if (nextPage.length > 0) {
          set({
            posts: [...posts, ...nextPage],
            hasMore: allMock.length > to + 1,
          });
        } else {
          set({ hasMore: false });
        }
      } else {
        set({ hasMore: false });
      }
    } catch {
      set({ hasMore: false });
    }

    set({ loadingMore: false });
  },

  fetchPostById: async (id) => {
    const { data, error } = await supabase
      .from('posts_with_counts')
      .select(`
        *,
        user:users(*),
        venue:venues(id, name, cover_image_url),
        images:post_images(*)
      `)
      .eq('id', id)
      .single();

    if (!error && data) {
      set({ selectedPost: data as Post });
    } else {
      // Fallback: find from mock data with joins
      const allMock = buildMockPostsWithJoins();
      const mockPost = allMock.find((p) => p.id === id) || null;
      set({ selectedPost: mockPost });
    }
  },

  fetchComments: async (postId) => {
    const { data, error } = await supabase
      .from('comments')
      .select('*, user:users(*)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (!error && data && data.length > 0) {
      set({ comments: data as Comment[] });
    } else {
      // Fallback to mock comments
      const mockComments = buildMockCommentsWithUser(postId);
      set({ comments: mockComments as Comment[] });
    }
  },

  createPost: async ({ user_id, venue_id, caption, image_urls, post_type, expires_at }) => {
    // Upload images to Supabase Storage
    const uploadedUrls = await uploadImages(image_urls, 'posts');

    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        user_id,
        venue_id: venue_id || null,
        caption,
        post_type: post_type || 'discovery',
        expires_at: expires_at || null,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    // Fotograflari ekle
    if (post && uploadedUrls.length > 0) {
      const images = uploadedUrls.map((url, index) => ({
        post_id: post.id,
        image_url: url,
        order: index,
      }));
      await supabase.from('post_images').insert(images);
    }

    await get().fetchPosts();

    // Badge check and XP (fire-and-forget)
    checkAndAwardBadges(user_id);
    addXP(user_id, 10);

    return { error: null };
  },

  toggleLike: async (postId, userId) => {
    // Try Supabase first
    const { data: existing, error: fetchError } = await supabase
      .from('likes')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .single();

    if (!fetchError || fetchError.code === 'PGRST116') {
      // Supabase is reachable - do normal toggle
      if (existing) {
        await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId);
      } else {
        await supabase.from('likes').insert({ post_id: postId, user_id: userId });
      }
    }
    // If Supabase fails entirely, we still update local state below

    // Lokal state guncelle (works for both Supabase and mock data)
    const posts = get().posts.map((p) => {
      if (p.id === postId) {
        const isLiked = !p.is_liked;
        return {
          ...p,
          is_liked: isLiked,
          likes_count: (p.likes_count || 0) + (isLiked ? 1 : -1),
        };
      }
      return p;
    });
    set({ posts });
  },

  addComment: async (postId, userId, text) => {
    const { error } = await supabase.from('comments').insert({
      post_id: postId,
      user_id: userId,
      text,
    });

    if (!error) {
      await get().fetchComments(postId);
    } else {
      // Fallback: add comment to local state for mock data
      const newComment: Comment = {
        id: `c-local-${Date.now()}`,
        post_id: postId,
        user_id: userId,
        text,
        created_at: new Date().toISOString(),
        user: MOCK_USERS.find((u) => u.id === userId),
      };
      const currentComments = get().comments;
      set({ comments: [...currentComments, newComment] });
    }

    // Update local post comments_count
    const posts = get().posts.map((p) => {
      if (p.id === postId) {
        return { ...p, comments_count: (p.comments_count || 0) + 1 };
      }
      return p;
    });
    set({ posts });

    return { error: error?.message || null };
  },

  fetchAnswers: async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('recommendation_answers')
        .select('*, user:users(*), venue:venues(id, name, cover_image_url)')
        .eq('post_id', postId)
        .order('upvotes', { ascending: false });

      if (error || !data?.length) {
        const mockAnswers = MOCK_RECOMMENDATION_ANSWERS
          .filter((a: any) => a.post_id === postId)
          .map((a: any) => ({
            ...a,
            user: MOCK_USERS.find((u: any) => u.id === a.user_id),
            venue: a.venue_id ? MOCK_VENUES.find((v: any) => v.id === a.venue_id) : undefined,
          }))
          .sort((a: any, b: any) => (b.upvotes ?? 0) - (a.upvotes ?? 0));
        return mockAnswers;
      }
      return data;
    } catch {
      return [];
    }
  },

  submitAnswer: async (postId: string, userId: string, text: string, venueId?: string) => {
    try {
      const { data, error } = await supabase
        .from('recommendation_answers')
        .insert({
          post_id: postId,
          user_id: userId,
          text,
          venue_id: venueId || null,
          upvotes: 0,
        })
        .select('*, user:users(*), venue:venues(id, name, cover_image_url)')
        .single();

      if (error) throw error;
      addXP(userId, 10).catch(() => {});
      checkAndAwardBadges(userId).catch(() => {});
      return data;
    } catch {
      return null;
    }
  },

  upvoteAnswer: async (answerId: string, userId: string) => {
    try {
      const { data: existing } = await supabase
        .from('answer_upvotes')
        .select('*')
        .eq('answer_id', answerId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        await supabase.from('answer_upvotes').delete().eq('answer_id', answerId).eq('user_id', userId);
        const { data: answer } = await supabase.from('recommendation_answers').select('upvotes').eq('id', answerId).single();
        if (answer) {
          await supabase.from('recommendation_answers').update({ upvotes: Math.max(0, (answer.upvotes || 0) - 1) }).eq('id', answerId);
        }
        return false;
      } else {
        await supabase.from('answer_upvotes').insert({ answer_id: answerId, user_id: userId });
        const { data: answer } = await supabase.from('recommendation_answers').select('upvotes').eq('id', answerId).single();
        if (answer) {
          await supabase.from('recommendation_answers').update({ upvotes: (answer.upvotes || 0) + 1 }).eq('id', answerId);
        }
        return true;
      }
    } catch {
      return null;
    }
  },

  refreshFeed: async () => {
    set({ refreshing: true });
    await get().fetchPosts();
    set({ refreshing: false });
  },

  setCategory: (category) => {
    set({ category, posts: [], hasMore: true });
    get().fetchPosts();
  },

  clearError: () => set({ error: null }),
}));
