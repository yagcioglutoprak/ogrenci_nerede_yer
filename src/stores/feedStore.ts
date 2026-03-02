import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Post, Comment } from '../types';
import { MOCK_POSTS, MOCK_USERS, MOCK_VENUES, MOCK_POST_IMAGES, MOCK_COMMENTS } from '../lib/mockData';

interface FeedState {
  posts: Post[];
  selectedPost: Post | null;
  comments: Comment[];
  loading: boolean;
  refreshing: boolean;

  fetchPosts: () => Promise<void>;
  fetchPostById: (id: string) => Promise<void>;
  fetchComments: (postId: string) => Promise<void>;
  createPost: (post: { user_id: string; venue_id?: string; caption: string; image_urls: string[] }) => Promise<{ error: string | null }>;
  toggleLike: (postId: string, userId: string) => Promise<void>;
  addComment: (postId: string, userId: string, text: string) => Promise<{ error: string | null }>;
  refreshFeed: () => Promise<void>;
}

/**
 * Build fully-joined mock posts (with user, venue, images data attached).
 */
function buildMockPostsWithJoins(): Post[] {
  return MOCK_POSTS.map((post) => {
    const venue = post.venue_id
      ? MOCK_VENUES.find((v) => v.id === post.venue_id)
      : undefined;

    return {
      ...post,
      user: MOCK_USERS.find((u) => u.id === post.user_id),
      venue: venue as Post['venue'],
      images: MOCK_POST_IMAGES.filter((img) => img.post_id === post.id).sort((a, b) => a.order - b.order),
    };
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  selectedPost: null,
  comments: [],
  loading: false,
  refreshing: false,

  fetchPosts: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users(*),
        venue:venues(id, name, cover_image_url),
        images:post_images(*)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data && data.length > 0) {
      // Her post icin begeni ve yorum sayisini al
      const postsWithCounts = await Promise.all(
        data.map(async (post) => {
          const [{ count: likesCount }, { count: commentsCount }] = await Promise.all([
            supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
            supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
          ]);
          return {
            ...post,
            likes_count: likesCount || 0,
            comments_count: commentsCount || 0,
          };
        })
      );
      set({ posts: postsWithCounts as Post[] });
    } else {
      // Fallback to mock data when Supabase returns empty or error
      const mockPosts = buildMockPostsWithJoins();
      set({ posts: mockPosts as Post[] });
    }
    set({ loading: false });
  },

  fetchPostById: async (id) => {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users(*),
        venue:venues(id, name),
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

  createPost: async ({ user_id, venue_id, caption, image_urls }) => {
    const { data: post, error } = await supabase
      .from('posts')
      .insert({ user_id, venue_id: venue_id || null, caption })
      .select()
      .single();

    if (error) return { error: error.message };

    // Fotograflari ekle
    if (post && image_urls.length > 0) {
      const images = image_urls.map((url, index) => ({
        post_id: post.id,
        image_url: url,
        order: index,
      }));
      await supabase.from('post_images').insert(images);
    }

    await get().fetchPosts();
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

    return { error: error?.message || null };
  },

  refreshFeed: async () => {
    set({ refreshing: true });
    await get().fetchPosts();
    set({ refreshing: false });
  },
}));
