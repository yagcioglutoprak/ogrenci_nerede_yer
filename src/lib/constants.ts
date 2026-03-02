// Uygulama Renkleri
export const Colors = {
  primary: '#FF6B35',       // Ana turuncu
  primaryDark: '#E55A2B',
  primaryLight: '#FF8F66',
  secondary: '#2EC4B6',     // Teal/yeşil accent
  secondaryDark: '#25A093',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceElevated: '#F5F5F5',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  star: '#FBBF24',          // Yıldız sarısı
  error: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  verified: '#8B5CF6',      // YouTube onaylı rozet rengi
  overlay: 'rgba(0,0,0,0.5)',
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
  { level: 1, name: 'Yeni', minReviews: 0, color: '#9CA3AF' },
  { level: 2, name: 'Popüler', minReviews: 5, color: '#3B82F6' },
  { level: 3, name: 'Öğrenci Onaylı', minReviews: 15, color: '#22C55E' },
  { level: 4, name: 'Efsane', minReviews: 50, color: '#FBBF24' },
] as const;

// Supabase config - gerçek key'lerinizi .env'den alın
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

// Harita varsayılan değerleri (İstanbul merkez)
export const DEFAULT_REGION = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};
