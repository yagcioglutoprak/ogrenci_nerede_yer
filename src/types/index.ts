// ==========================================
// Veritabanı Tipleri - Öğrenci Nerede Yer?
// ==========================================

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  university: string | null;
  bio: string | null;
  xp_points: number;
  created_at: string;
}

export interface Venue {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  address: string;
  phone: string | null;
  price_range: 1 | 2 | 3 | 4; // ₺ to ₺₺₺₺
  is_verified: boolean;         // YouTube ekibi onayı
  youtube_video_url: string | null;
  avg_taste_rating: number;
  avg_value_rating: number;
  avg_friendliness_rating: number;
  overall_rating: number;       // 3 rating ortalaması
  total_reviews: number;
  level: number;                // 1-4 (Yeni -> Efsane)
  cover_image_url: string | null;
  tags: string[];               // ['wifi', 'vejetaryen', 'kahvalti']
  created_by: string;
  created_at: string;
  // Editorial (OgrenciNeredeYer team review)
  editorial_rating?: number | null;   // 1-10 team rating
  editorial_note?: string | null;     // Team written note
}

export interface SocialVideo {
  id: string;
  venue_id: string;
  platform: 'youtube' | 'instagram' | 'tiktok';
  video_url: string;
  thumbnail_url: string;
  title: string;
  author?: string;
}

export interface Review {
  id: string;
  venue_id: string;
  user_id: string;
  taste_rating: number;         // 1-5
  value_rating: number;         // 1-5
  friendliness_rating: number;  // 1-5
  comment: string;
  created_at: string;
  // Joined
  user?: User;
}

export interface Post {
  id: string;
  user_id: string;
  venue_id: string | null;
  caption: string;
  created_at: string;
  // Joined
  user?: User;
  venue?: Venue;
  images?: PostImage[];
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
}

export interface PostImage {
  id: string;
  post_id: string;
  image_url: string;
  order: number;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  created_at: string;
  // Joined
  user?: User;
}

export interface Like {
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface Favorite {
  user_id: string;
  venue_id: string;
  created_at: string;
  // Joined
  venue?: Venue;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon_name: string;
  condition_type: 'venues_added' | 'reviews_written' | 'posts_created' | 'likes_received' | 'streak_days';
  condition_value: number;
  color: string;
}

export interface UserBadge {
  user_id: string;
  badge_id: string;
  earned_at: string;
  badge?: Badge;
}

// Navigation parametreleri
export type RootStackParamList = {
  '(tabs)': undefined;
  'venue/[id]': { id: string };
  'post/[id]': { id: string };
  'user/[id]': { id: string };
  'auth/login': undefined;
  'auth/register': undefined;
};

// Harita Region tipi
export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

// Filter tipi
export interface VenueFilters {
  priceRange?: number[];
  minRating?: number;
  tags?: string[];
  isVerified?: boolean;
  sortBy?: 'distance' | 'rating' | 'newest' | 'price';
  searchQuery?: string;
}

// Feed category tipi
export type FeedCategory = 'all' | 'nearby' | 'top' | 'new';

// Pagination state tipi
export interface PaginationState {
  hasMore: boolean;
  cursor: string | null;
  pageSize: number;
}
