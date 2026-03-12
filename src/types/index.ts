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
  last_active_date?: string | null;
  followers_count?: number;
  following_count?: number;
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
  // Source & Google Places integration
  source?: 'google_places' | 'ony';   // default 'ony'
  google_rating?: number;              // Google's rating (1-5)
  google_place_id?: string;            // Google Places API ID
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

export interface Story {
  id: string;
  title: string;
  thumbnail_url: string;
  video_url: string;
  external_url: string;
  venue_id?: string;
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
  post_type: 'discovery' | 'meetup' | 'question' | 'moment';
  expires_at: string | null;
  caption: string;
  created_at: string;
  // Joined
  user?: User;
  venue?: Venue;
  images?: PostImage[];
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  is_bookmarked?: boolean;
  event?: Event;
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
  condition_type: 'venues_added' | 'reviews_written' | 'posts_created' | 'likes_received' | 'streak_days' | 'meetups_attended' | 'meetups_organized' | 'moments_shared' | 'upvotes_received' | 'buddy_matches_completed' | 'lists_created';
  condition_value: number;
  color: string;
}

export interface UserBadge {
  user_id: string;
  badge_id: string;
  earned_at: string;
  badge?: Badge;
}

export interface Event {
  id: string;
  creator_id: string;
  venue_id: string | null;
  post_id: string;
  title: string;
  description: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  event_date: string;
  max_attendees: number;
  is_public: boolean;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  created_at: string;
  // Joined
  creator?: User;
  venue?: Venue;
  attendees?: EventAttendee[];
  attendee_count?: number;
}

export interface EventAttendee {
  event_id: string;
  user_id: string;
  status: 'confirmed' | 'waitlisted' | 'cancelled';
  joined_at: string;
  // Joined
  user?: User;
}

export interface EventMessage {
  id: string;
  event_id: string;
  user_id: string;
  message: string;
  created_at: string;
  // Joined
  user?: User;
}

export interface RecommendationAnswer {
  id: string;
  post_id: string;
  user_id: string;
  venue_id: string | null;
  text: string;
  upvotes: number;
  created_at: string;
  // Joined
  user?: User;
  venue?: Venue;
}

export type PostType = 'discovery' | 'meetup' | 'question' | 'moment';

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
export type FeedCategory = 'all' | 'nearby' | 'top' | 'new' | 'meetups' | 'questions' | 'moments';

// Pagination state tipi
export interface PaginationState {
  hasMore: boolean;
  cursor: string | null;
  pageSize: number;
}

export interface List {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  slug: string | null;
  likes_count: number;
  followers_count: number;
  created_at: string;
  updated_at: string;
  user?: User;
  venues?: ListVenue[];
}

export interface ListVenue {
  id: string;
  list_id: string;
  venue_id: string;
  position: number;
  note: string | null;
  added_at: string;
  venue?: Venue;
}

export interface MealBuddy {
  id: string;
  user_id: string;
  status: 'available' | 'matched' | 'expired';
  latitude: number;
  longitude: number;
  radius_km: number;
  available_from: string;
  available_until: string;
  note: string | null;
  created_at: string;
  user?: User;
}

export interface BuddyMatch {
  id: string;
  requester_buddy_id: string;
  target_buddy_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  requester?: MealBuddy;
  target?: MealBuddy;
}

export interface BuddyMessage {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  user?: User;
}

export interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_text: string | null;
  last_message_at: string;
  last_message_sender_id: string | null;
  created_at: string;
  // Joined
  other_user?: User;
  unread_count?: number;
}

export interface DirectMessageMetadata {
  image_url?: string;
  venue_id?: string;
  venue_name?: string;
  venue_cover_url?: string;
  venue_rating?: number;
  venue_price_range?: number;
}

export type DirectMessageType = 'text' | 'image' | 'venue';

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type?: DirectMessageType;
  metadata?: DirectMessageMetadata;
  is_read: boolean;
  created_at: string;
  // Joined
  user?: User;
}
