import { PriceRanges, VenueLevels } from './constants';

// Zaman formatlama (Türkçe)
export function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffSeconds < 60) return 'Az önce';
  if (diffMinutes < 60) return `${diffMinutes}dk`;
  if (diffHours < 24) return `${diffHours}sa`;
  if (diffDays < 7) return `${diffDays}g`;
  if (diffWeeks < 4) return `${diffWeeks}hf`;
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

// Fiyat aralığı gösterimi
export function getPriceLabel(priceRange: number): string {
  return '₺'.repeat(priceRange);
}

export function getPriceDescription(priceRange: number): string {
  const range = PriceRanges.find((r) => r.value === priceRange);
  return range?.description || '';
}

// Mekan seviyesi
export function getVenueLevel(totalReviews: number) {
  for (let i = VenueLevels.length - 1; i >= 0; i--) {
    if (totalReviews >= VenueLevels[i].minReviews) {
      return VenueLevels[i];
    }
  }
  return VenueLevels[0];
}

// Mesafe hesaplama (Haversine)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // metre
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Mesafe formatlama
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// İsimden baş harfler
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Rating rengi
export function getRatingColor(rating: number): string {
  if (rating >= 4.5) return '#22C55E'; // Yeşil
  if (rating >= 3.5) return '#FBBF24'; // Sarı
  if (rating >= 2.5) return '#F59E0B'; // Turuncu
  return '#EF4444'; // Kırmızı
}

// Sayı kısaltma (1200 -> 1.2K)
export function formatCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
}
