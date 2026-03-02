import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Post, Comment } from '../types';

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

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  selectedPost: null,
  comments: [],
  loading: false,
  refreshing: false,

  fetchPosts: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from('posts')
      .select(`
        *,
        user:users(*),
        venue:venues(id, name, cover_image_url),
        images:post_images(*)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      // Her post için beğeni ve yorum sayısını al
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
    }
    set({ loading: false });
  },

  fetchPostById: async (id) => {
    const { data } = await supabase
      .from('posts')
      .select(`
        *,
        user:users(*),
        venue:venues(id, name),
        images:post_images(*)
      `)
      .eq('id', id)
      .single();

    if (data) {
      set({ selectedPost: data as Post });
    }
  },

  fetchComments: async (postId) => {
    const { data } = await supabase
      .from('comments')
      .select('*, user:users(*)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (data) {
      set({ comments: data as Comment[] });
    }
  },

  createPost: async ({ user_id, venue_id, caption, image_urls }) => {
    const { data: post, error } = await supabase
      .from('posts')
      .insert({ user_id, venue_id: venue_id || null, caption })
      .select()
      .single();

    if (error) return { error: error.message };

    // Fotoğrafları ekle
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
    const { data: existing } = await supabase
      .from('likes')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId);
    } else {
      await supabase.from('likes').insert({ post_id: postId, user_id: userId });
    }

    // Lokal state güncelle
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
    }

    return { error: error?.message || null };
  },

  refreshFeed: async () => {
    set({ refreshing: true });
    await get().fetchPosts();
    set({ refreshing: false });
  },
}));
