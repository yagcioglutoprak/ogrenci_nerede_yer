# Landing Page Design — Öğrenci Nerede Yer?

## Overview

A single-page marketing website to introduce the mobile app, showcase features, and drive App Store / Google Play downloads. All UI text in Turkish.

**Tech:** Pure HTML + CSS + vanilla JS. Single `index.html` file, no dependencies, no build step. Deployable to Netlify, Vercel, GitHub Pages, or any static host.

**Visual Direction:** Light & warm — white/cream backgrounds, red (#E23744) primary, golden amber (#F5A623) accent, Nunito font. Professional with youthful energy. Inspired by Airbnb/DoorDash landing page aesthetics.

## Page Structure

### 1. Sticky Navbar
- Logo (app icon + "Öğrenci Nerede Yer?" text)
- Section links: Özellikler, Nasıl Çalışır, İndir
- Responsive: hamburger menu on mobile
- Background becomes semi-transparent white with backdrop blur on scroll

### 2. Hero Section
- Background: white → warm cream gradient (#FFF8F5)
- Badge: "🍕 Öğrenci Yemek Platformu" (uppercase, red, small)
- Headline: "Kampüste En İyi Mekanları Keşfet" (large, bold, dark)
- Subtitle: one sentence explaining the app's value proposition
- Two CTA buttons: App Store (black) + Google Play (black). Links point to `#` for now. Buttons include `data-store` attribute (`appstore` / `googleplay`) for easy find-and-replace later.
- Three tilted phone mockups below (center larger, flanking phones rotated ±6deg with subtle red shadows). Phone frames are CSS-only: dark rounded rectangle with a top notch cutout. No external device frame images.
- Screenshots: placeholder frames for now — will be replaced with real app screenshots

### 3. Features Grid
- Section title: "Neden Öğrenci Nerede Yer?"
- 4 feature cards on warm cream (#FFF8F5) backgrounds with rounded corners:
  1. 🗺️ **Harita Keşfi** — interactive map discovery
  2. ⭐ **3 Eksenli Puanlama** — taste, value, atmosphere ratings
  3. 🤝 **Yemek Arkadaşı** — meal buddy matching
  4. 📋 **Küratörlü Listeler** — curated venue collections
- Layout: 4-column grid on desktop, 2-column on tablet, 1-column on mobile

### 4. App Screenshots Carousel
- Background: light grey (#FAFAFA)
- Section title: "Bir Göz At"
- Horizontal scrolling carousel of phone-framed screenshots
- Dot indicators below — interactive: clicking a dot scrolls to the corresponding slide. Active dot is red (#E23744), inactive dots are grey (#D0D0D0).
- Touch/drag scrollable on mobile
- Screenshots: placeholders for now — real screenshots will be provided later

### 5. How It Works
- Section title: "3 Adımda Başla"
- 3 steps in a row, each with gradient circle number (red→amber):
  1. **İndir** — download and create account
  2. **Keşfet** — find nearby venues on the map
  3. **Paylaş** — share experiences, find buddies, create lists
- Connected by subtle dashed line between circles on desktop. On mobile (<768px) the connector line is hidden; steps stack vertically without a connector.

### 6. Social Proof — Testimonials
- Background: warm cream (#FFF8F5)
- Section title: "Öğrenciler Ne Diyor?"
- 3 testimonial cards with white background, subtle shadow:
  - Quote text
  - Avatar circle (colored initial), student name, university + department
- Mock testimonials from fictional students at İTÜ, Boğaziçi, İstanbul Üni.

### 7. Stats Bar
- Full-width gradient background (red→amber)
- 4 stats in white, bold numbers with labels:
  - 500+ Mekan
  - 10K+ Öğrenci
  - 20+ Üniversite
  - 4.8 App Store Puanı
- Animated count-up on scroll into view (IntersectionObserver)

### 8. Final Download CTA
- White background
- Headline: "Hadi Başlayalım!"
- Subtitle encouraging download
- App Store + Google Play buttons (same style as hero)

### 9. Footer
- Dark background (#1a1a1a)
- Logo + copyright (© 2026 Memet Kebab)
- 3 link columns:
  - Uygulama: Özellikler, Nasıl Çalışır, İndir
  - Yasal: Gizlilik Politikası, Kullanım Şartları, KVKK
  - Sosyal: Instagram, Twitter, LinkedIn (links point to `#` until real handles are provided; use `aria-label` for accessibility)

## Animations & Interactions

- **Scroll reveal**: sections fade in + slide up on scroll (IntersectionObserver, CSS transitions)
- **Stats count-up**: numbers animate from 0 to target value when stats bar enters viewport. Duration: 1.5s, ease-out. Decimals animate with one decimal place (e.g. 0.0 → 4.8). The "+" suffix and label text are static — only the number animates.
- **Screenshot carousel**: horizontal drag/scroll with CSS scroll-snap
- **Navbar**: transparent on top, white+blur on scroll (scroll event listener)
- **Smooth scroll**: anchor links scroll smoothly to sections
- **Hover effects**: buttons scale slightly, feature cards lift with shadow

## Responsive Breakpoints

- **Desktop**: ≥1024px — full layout, 4-column features, 3-column testimonials
- **Tablet**: 768px–1023px — 2-column features, 2-column testimonials
- **Mobile**: <768px — single column, hamburger menu, stacked content

## Assets Required

- App logo: use existing `/assets/logo.png` and `/assets/favicon.png`
- App screenshots: to be provided by user (placeholder frames for now)
- Fonts: Nunito loaded from Google Fonts CDN
- Icons: emoji-based (no icon library needed)
- App Store / Google Play badges: SVG badge images or styled buttons

## File Structure

```
website/
  index.html          # Complete single-page site (HTML + inline CSS + inline JS)
  assets/
    logo.png          # Copy of app logo
    favicon.png       # Copy of app favicon
    screenshots/      # Directory for app screenshots (to be added later)
```

## Out of Scope

- No backend / API
- No blog or multi-page content
- No user authentication
- No analytics (can be added later with a script tag)
- No cookie consent banner (no cookies used)
- No i18n — Turkish only
