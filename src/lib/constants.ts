// ==========================================
// Öğrenci Nerede Yer? - Design System
// Palette: White / Red / Golden Amber (Food Theme)
// ==========================================

export const Colors = {
  // Primary - Warm Red (appetite-inducing)
  primary: '#E23744',          // Zomato-style rich red
  primaryDark: '#C62828',      // Deeper red for pressed states
  primaryLight: '#FF5252',     // Lighter red for highlights
  primarySoft: '#FFF0F0',      // Very soft red tint for backgrounds

  // Accent - Golden Amber (energy, food warmth)
  accent: '#F5A623',           // Vibrant golden amber
  accentDark: '#D4900E',
  accentLight: '#F7BC5A',
  accentSoft: '#FEF6E7',       // Soft amber tint

  // Gradient pair
  gradientStart: '#E23744',    // Red
  gradientEnd: '#F5A623',      // Golden Amber

  // Neutrals - Clean whites and grays
  background: '#FFFFFF',
  backgroundSecondary: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FAFAFA',
  card: '#FFFFFF',

  // Text
  text: '#1B1B1F',            // Near-black
  textSecondary: '#6C6C80',
  textTertiary: '#A0A0B0',
  textOnPrimary: '#FFFFFF',
  textOnDark: '#FFFFFF',

  // Borders
  border: '#EEEFF2',
  borderLight: '#F5F5F8',
  borderFocus: '#E23744',

  // Semantic
  star: '#FFB800',             // Rich gold for ratings
  starEmpty: '#E8E8EC',
  error: '#DC2626',
  success: '#16A34A',
  warning: '#F59E0B',
  info: '#3B82F6',
  verified: '#E23744',         // YouTube verified = red badge

  // Misc
  overlay: 'rgba(27, 27, 31, 0.6)',
  overlayLight: 'rgba(27, 27, 31, 0.3)',
  shimmer: '#F0F0F5',
  shimmerHighlight: 'rgba(255,255,255,0.6)',
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#F0F0F3',
  shadow: '#1B1B1F',

  // Tag & muted colors
  tagUnreviewed: '#ECECF0',
  tagUnreviewedBorder: 'rgba(0,0,0,0.06)',
  textMuted: 'rgba(0,0,0,0.45)',

  // Message unread colors
  messageUnreadBg: 'rgba(226,55,68,0.04)',
  messageUnreadBorder: 'rgba(226,55,68,0.12)',

  // Glass effect colors (iOS 26 Liquid Glass / BlurView fallback)
  glass: {
    background: 'rgba(255,255,255,0.78)',
    backgroundDark: 'rgba(0,0,0,0.3)',
    border: 'rgba(255,255,255,0.5)',
    borderDark: 'rgba(255,255,255,0.15)',
    specular: 'rgba(255,255,255,0.35)',
    specularDark: 'rgba(255,255,255,0.15)',
    vibrant: 'rgba(255,255,255,0.12)',
    vibrantDark: 'rgba(255,255,255,0.08)',
    tint: 'rgba(226, 55, 68, 0.15)',
    tintDark: 'rgba(226, 55, 68, 0.25)',
  },
} as const;

type WidenStrings<T> = {
  [K in keyof T]: T[K] extends string ? string : WidenStrings<T[K]>;
};

export type ThemeColors = WidenStrings<typeof Colors>;

export const DarkColors: ThemeColors = {
  // Brand colors stay identical
  primary: '#E23744',
  primaryDark: '#C62828',
  primaryLight: '#FF5252',
  primarySoft: 'rgba(226,55,68,0.15)',

  accent: '#F5A623',
  accentDark: '#D4900E',
  accentLight: '#F7BC5A',
  accentSoft: 'rgba(245,166,35,0.15)',

  gradientStart: '#E23744',
  gradientEnd: '#F5A623',

  // Neutrals — dark surfaces
  background: '#121212',
  backgroundSecondary: '#1A1A1A',
  surface: '#1E1E1E',
  surfaceElevated: '#252525',
  card: '#1E1E1E',

  // Text — inverted
  text: '#F0F0F5',
  textSecondary: '#A0A0B0',
  textTertiary: '#6C6C80',
  textOnPrimary: '#FFFFFF',
  textOnDark: '#FFFFFF',

  // Borders — dark
  border: '#2C2C2E',
  borderLight: '#232325',
  borderFocus: '#E23744',

  // Semantic — brighter for dark bg
  star: '#FFB800',
  starEmpty: '#3A3A3E',
  error: '#FF6B6B',
  success: '#4ADE80',
  warning: '#FBBF24',
  info: '#60A5FA',
  verified: '#E23744',

  // Misc
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.4)',
  shimmer: '#2A2A2E',
  shimmerHighlight: 'rgba(255,255,255,0.08)',
  tabBarBg: '#121212',
  tabBarBorder: '#232325',
  shadow: '#000000',

  // Tag & muted colors
  tagUnreviewed: 'rgba(60,60,60,0.9)',
  tagUnreviewedBorder: 'rgba(255,255,255,0.1)',
  textMuted: 'rgba(255,255,255,0.55)',

  // Message unread colors
  messageUnreadBg: 'rgba(226,55,68,0.08)',
  messageUnreadBorder: 'rgba(226,55,68,0.20)',

  // Glass effect — dark mode
  glass: {
    background: 'rgba(30,30,30,0.78)',
    backgroundDark: 'rgba(0,0,0,0.5)',
    border: 'rgba(255,255,255,0.12)',
    borderDark: 'rgba(255,255,255,0.08)',
    specular: 'rgba(255,255,255,0.15)',
    specularDark: 'rgba(255,255,255,0.08)',
    vibrant: 'rgba(255,255,255,0.08)',
    vibrantDark: 'rgba(255,255,255,0.05)',
    tint: 'rgba(226, 55, 68, 0.25)',
    tintDark: 'rgba(226, 55, 68, 0.35)',
  },
} as const;

// ==========================================
// Dynamic Rating Colors
// Color-coded feedback based on score value
// ==========================================
export const RatingColors = {
  excellent: '#22C55E',    // Bright green — 4.5+
  good: '#84CC16',         // Lime green — 4.0–4.4
  average: '#EAB308',      // Amber — 3.0–3.9
  belowAverage: '#F97316', // Orange — 2.0–2.9
  poor: '#EF4444',         // Red — below 2.0
} as const;

/** Returns a color based on the rating value (0–maxRating scale) */
export function getRatingColor(rating: number, maxRating: number = 5): string {
  const normalized = rating / maxRating;
  if (normalized >= 0.9) return RatingColors.excellent;
  if (normalized >= 0.8) return RatingColors.good;
  if (normalized >= 0.6) return RatingColors.average;
  if (normalized >= 0.4) return RatingColors.belowAverage;
  return RatingColors.poor;
}

// Sub-rating category accent colors (distinct per axis)
export const CategoryColors = {
  taste: '#E23744',        // Red — appetite, flavor
  value: '#F59E0B',        // Amber — money, price-performance
  friendliness: '#14B8A6', // Teal — welcoming, student-friendly
} as const;

// Fiyat aralıkları
export const PriceRanges = [
  { label: '₺', value: 1, description: '0-50₺' },
  { label: '₺₺', value: 2, description: '50-100₺' },
  { label: '₺₺₺', value: 3, description: '100-200₺' },
  { label: '₺₺₺₺', value: 4, description: '200₺+' },
] as const;

// Rating kategorileri
export const RatingCategories = [
  { key: 'taste', label: 'Lezzet', icon: 'restaurant' },
  { key: 'value', label: 'Fiyat/Performans', icon: 'pricetag' },
  { key: 'friendliness', label: 'Ortam', icon: 'cafe' },
] as const;

// Mekan seviyeleri
export const VenueLevels = [
  { level: 1, name: 'Yeni', minReviews: 0, color: '#A0A0B0' },
  { level: 2, name: 'Popüler', minReviews: 5, color: '#F5A623' },
  { level: 3, name: 'Öğrenci Onaylı', minReviews: 15, color: '#E23744' },
  { level: 4, name: 'Efsane', minReviews: 50, color: '#FFB800' },
] as const;

// Tasarım sabitleri
export const Spacing = {
  xs: 4,
  xsm: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  input: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  glass: 22,   // iOS 26 standard glass corner radius
  full: 9999,
} as const;

export const GlassBlur = 80; // Blur intensity for BlurView fallback

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  largeTitle: 34,
  display: 40,
} as const;

export const FontFamily = {
  heading: 'Nunito_800ExtraBold',
  headingBold: 'Nunito_700Bold',
  bodySemiBold: 'Nunito_600SemiBold',
  bodyMedium: 'Nunito_500Medium',
  body: 'Nunito_400Regular',
} as const;

// ==========================================
// Shadow Presets (platform-specific)
// ==========================================
export const Shadows = {
  card: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  elevated: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  subtle: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  glass: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
  },
} as const;

// ==========================================
// Feature Accent Colors
// Centralized colors for post types & features
// ==========================================
export const FeatureColors = {
  buddy: '#06B6D4',
  buddyDark: '#0891B2',
  question: '#8B5CF6',
  questionLight: '#EDE9FE',
  moment: '#F97316',
  momentLight: '#FFF7ED',
  liveGreen: '#22C55E',
  meetup: '#06B6D4',       // same as buddy
  meetupLight: '#ECFEFF',
} as const;

// Supabase config
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

// Google Sign In
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
export const GOOGLE_IOS_CLIENT_ID = '212067618558-2nrcfludvac63nk77mpev0hehtdtrdt6.apps.googleusercontent.com';

// Harita varsayılan değerleri (İstanbul merkez)
export const DEFAULT_REGION = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// Mekan etiketleri
export const VENUE_TAGS = [
  { key: 'ev-yemegi', label: 'Ev Yemeği', icon: 'home' },
  { key: 'fast-food', label: 'Fast Food', icon: 'fast-food' },
  { key: 'kahvalti', label: 'Kahvaltı', icon: 'cafe' },
  { key: 'cay', label: 'Çay/Kahve', icon: 'cafe' },
  { key: 'doner', label: 'Döner/Kebap', icon: 'flame' },
  { key: 'tost', label: 'Tost/Sandviç', icon: 'pizza' },
  { key: 'vejetaryen', label: 'Vejetaryen', icon: 'leaf' },
  { key: 'wifi', label: 'Wi-Fi', icon: 'wifi' },
  { key: 'ogrenci-menu', label: 'Öğrenci Menü', icon: 'school' },
  { key: 'tatli', label: 'Tatlı', icon: 'ice-cream' },
  { key: 'kofte', label: 'Köfte', icon: 'restaurant' },
  { key: 'pide', label: 'Pide/Lahmacun', icon: 'pizza' },
] as const;

// ==========================================
// Social Feature Tokens
// Post types, feed categories, and districts
// ==========================================

export const POST_TYPES = {
  discovery: { label: 'Kesif', icon: 'camera-outline', color: '#E23744' },
  meetup: { label: 'Bulusma', icon: 'people-outline', color: '#06B6D4' },
  question: { label: 'Soru', icon: 'help-circle-outline', color: '#8B5CF6' },
  moment: { label: 'Anlik', icon: 'flash-outline', color: '#F97316' },
} as const;

export const FEED_CATEGORIES = [
  { key: 'all', label: 'Tumu', icon: 'apps-outline' },
  { key: 'meetups', label: 'Bulusmalar', icon: 'people-outline' },
  { key: 'moments', label: 'Anlik', icon: 'flash-outline' },
  { key: 'questions', label: 'Oneriler', icon: 'help-circle-outline' },
  { key: 'top', label: 'Populer', icon: 'trending-up-outline' },
  { key: 'new', label: 'Yeni', icon: 'time-outline' },
] as const;

export const ISTANBUL_SEMTLER = [
  'Kadikoy', 'Besiktas', 'Taksim', 'Sisli', 'Uskudar',
  'Bakirkoy', 'Fatih', 'Beyoglu', 'Maltepe', 'Atasehir',
  'Sariyer', 'Kartal', 'Pendik', 'Umraniye', 'Beylikduzu',
] as const;

// Map configuration
export const MapConfig = {
  CLUSTER_ZOOM_THRESHOLD: 0.005,
  MARKER_ANIMATION_DURATION: 500,
  SEARCH_DEBOUNCE_MS: 300,
  MAX_SEARCH_RESULTS: 5,
  DEFAULT_ZOOM_DELTA: 0.01,
  CLUSTER_PADDING: 0.002,
  MIN_CLUSTER_DELTA: 0.005,
} as const;

// Shared animation configs
export const SpringConfig = {
  default: { damping: 20, stiffness: 300, mass: 0.8 },
  snappy: { damping: 22, stiffness: 340 },
  gentle: { damping: 20, stiffness: 180 },
  bouncy: { damping: 16, stiffness: 280 },
  // Interaction feedback — intentionally underdamped for playful micro-interactions
  microBounce: { damping: 6, stiffness: 400 },
} as const;

export const AnimationConfig = {
  staggerInterval: 50,
  maxStaggerDelay: 250,
  fadeInDuration: 300,
} as const;

// Istanbul okulları (üniversiteler, liseler, meslek okulları)
export const ISTANBUL_SCHOOLS = [
  // Üniversiteler
  { name: 'İstanbul Teknik Üniversitesi (İTÜ)', district: 'Sarıyer', lat: 41.1055, lng: 29.0250 },
  { name: 'Boğaziçi Üniversitesi', district: 'Sarıyer', lat: 41.0843, lng: 29.0510 },
  { name: 'İstanbul Üniversitesi', district: 'Fatih', lat: 41.0115, lng: 28.9634 },
  { name: 'Yıldız Teknik Üniversitesi', district: 'Beşiktaş', lat: 41.0496, lng: 29.0134 },
  { name: 'Marmara Üniversitesi', district: 'Kadıköy', lat: 40.9862, lng: 29.0606 },
  { name: 'Yeditepe Üniversitesi', district: 'Ataşehir', lat: 40.9712, lng: 29.1520 },
  { name: 'Bahçeşehir Üniversitesi', district: 'Beşiktaş', lat: 41.0424, lng: 29.0092 },
  { name: 'Koç Üniversitesi', district: 'Sarıyer', lat: 41.2054, lng: 29.0728 },
  { name: 'Sabancı Üniversitesi', district: 'Pendik', lat: 40.8904, lng: 29.3787 },
  { name: 'Galatasaray Üniversitesi', district: 'Beşiktaş', lat: 41.0462, lng: 29.0116 },
  { name: 'Mimar Sinan Güzel Sanatlar Üniversitesi', district: 'Beyoğlu', lat: 41.0315, lng: 28.9837 },
  { name: 'İstanbul Medeniyet Üniversitesi', district: 'Üsküdar', lat: 41.0218, lng: 29.0539 },
  { name: 'İstanbul Bilgi Üniversitesi', district: 'Beyoğlu', lat: 41.0526, lng: 28.9508 },
  { name: 'Kadir Has Üniversitesi', district: 'Fatih', lat: 41.0218, lng: 28.9503 },
  { name: 'Özyeğin Üniversitesi', district: 'Çekmeköy', lat: 41.0387, lng: 29.2469 },
  { name: 'Medipol Üniversitesi', district: 'Beykoz', lat: 41.1092, lng: 29.0897 },
  { name: 'İstanbul Kültür Üniversitesi', district: 'Bakırköy', lat: 40.9926, lng: 28.8598 },
  { name: 'Maltepe Üniversitesi', district: 'Maltepe', lat: 40.9629, lng: 29.1318 },
  { name: 'İstanbul Ticaret Üniversitesi', district: 'Üsküdar', lat: 41.0236, lng: 29.0431 },
  { name: 'İstanbul Aydın Üniversitesi', district: 'Küçükçekmece', lat: 41.0197, lng: 28.7890 },
  { name: 'İstanbul Gelişim Üniversitesi', district: 'Avcılar', lat: 40.9941, lng: 28.7148 },
  { name: 'Beykent Üniversitesi', district: 'Beylikdüzü', lat: 41.0050, lng: 28.6290 },
  { name: 'Nişantaşı Üniversitesi', district: 'Sarıyer', lat: 41.1061, lng: 29.0210 },
  { name: 'Doğuş Üniversitesi', district: 'Kadıköy', lat: 40.9797, lng: 29.0867 },
  { name: 'Haliç Üniversitesi', district: 'Beyoğlu', lat: 41.0381, lng: 28.9716 },
  // Liseler
  { name: 'Galatasaray Lisesi', district: 'Beyoğlu', lat: 41.0341, lng: 28.9749 },
  { name: 'İstanbul Erkek Lisesi', district: 'Fatih', lat: 41.0153, lng: 28.9500 },
  { name: 'Kabataş Erkek Lisesi', district: 'Beşiktaş', lat: 41.0420, lng: 29.0040 },
  { name: 'Kadıköy Anadolu Lisesi', district: 'Kadıköy', lat: 40.9878, lng: 29.0268 },
  { name: 'Haydarpaşa Lisesi', district: 'Kadıköy', lat: 40.9957, lng: 29.0191 },
  { name: 'Vefa Lisesi', district: 'Fatih', lat: 41.0159, lng: 28.9570 },
  { name: 'Saint-Joseph Lisesi', district: 'Beyoğlu', lat: 41.0361, lng: 28.9800 },
  { name: 'Robert Kolej', district: 'Sarıyer', lat: 41.0850, lng: 29.0520 },
  { name: 'Üsküdar Amerikan Lisesi', district: 'Üsküdar', lat: 41.0291, lng: 29.0267 },
  // Meslek Okulları
  { name: 'İstanbul Anadolu İmam Hatip Lisesi', district: 'Fatih', lat: 41.0087, lng: 28.9527 },
  { name: 'Tuzla Meslek ve Teknik Anadolu Lisesi', district: 'Pendik', lat: 40.8674, lng: 29.3040 },
] as const;
