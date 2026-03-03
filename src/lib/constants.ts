// ==========================================
// Öğrenci Nerede Yer? - Design System
// Palette: White / Red / Orange (Food Theme)
// ==========================================

export const Colors = {
  // Primary - Warm Red (appetite-inducing)
  primary: '#E23744',          // Zomato-style rich red
  primaryDark: '#C62828',      // Deeper red for pressed states
  primaryLight: '#FF5252',     // Lighter red for highlights
  primarySoft: '#FFF0F0',      // Very soft red tint for backgrounds

  // Accent - Warm Orange (energy, food warmth)
  accent: '#FF6B35',           // Vibrant warm orange
  accentDark: '#E55A2B',
  accentLight: '#FF8F66',
  accentSoft: '#FFF3ED',       // Soft orange tint

  // Gradient pair
  gradientStart: '#E23744',    // Red
  gradientEnd: '#FF6B35',      // Orange

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
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#F0F0F3',
  shadow: '#1B1B1F',

  // Glass effect colors (iOS 26 Liquid Glass / BlurView fallback)
  glass: {
    background: 'rgba(255,255,255,0.78)',
    backgroundDark: 'rgba(0,0,0,0.3)',
    border: 'rgba(255,255,255,0.5)',
    borderDark: 'rgba(255,255,255,0.15)',
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

  accent: '#FF6B35',
  accentDark: '#E55A2B',
  accentLight: '#FF8F66',
  accentSoft: 'rgba(255,107,53,0.15)',

  gradientStart: '#E23744',
  gradientEnd: '#FF6B35',

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
  tabBarBg: '#121212',
  tabBarBorder: '#232325',
  shadow: '#000000',

  // Glass effect — dark mode
  glass: {
    background: 'rgba(30,30,30,0.78)',
    backgroundDark: 'rgba(0,0,0,0.5)',
    border: 'rgba(255,255,255,0.12)',
    borderDark: 'rgba(255,255,255,0.08)',
  },
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
  { key: 'friendliness', label: 'Öğrenci Dostu', icon: 'people' },
] as const;

// Mekan seviyeleri
export const VenueLevels = [
  { level: 1, name: 'Yeni', minReviews: 0, color: '#A0A0B0' },
  { level: 2, name: 'Popüler', minReviews: 5, color: '#FF6B35' },
  { level: 3, name: 'Öğrenci Onaylı', minReviews: 15, color: '#E23744' },
  { level: 4, name: 'Efsane', minReviews: 50, color: '#FFB800' },
] as const;

// Tasarım sabitleri
export const Spacing = {
  xs: 4,
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
  display: 40,
} as const;

// Supabase config
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

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
