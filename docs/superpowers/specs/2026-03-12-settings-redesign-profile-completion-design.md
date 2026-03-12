# Settings Redesign + Profile Completion Banner

**Date:** 2026-03-12
**Status:** Approved

## Overview

Two UI improvements:
1. Modernize the settings page with Apple-style grouped sections
2. Add a profile completion banner to the profile page

---

## 1. Settings Page — Apple-Style Grouped Redesign

**File:** `src/app/settings.tsx`

### Layout (top to bottom)

1. **ScreenHeader** — unchanged ("Ayarlar" with back chevron)

2. **Profile Row** — grouped card
   - Avatar circle: 48px, gradient fallback with initials if no `avatar_url`
   - Right side: full name (bold), "Profili Düzenle" subtitle
   - Chevron trailing
   - Taps to `/profile/edit`

3. **Tema Section** — grouped card
   - Section label: "GÖRÜNÜM", uppercase, `FontSize.xs`, `letterSpacing: 0.5`, `textSecondary`
   - 3 theme chips in a row, each with emoji icon + label:
     - ☀️ Açık | 🌙 Koyu | 📱 Otomatik
   - Active chip: `Colors.primary` background, white text
   - Inactive chip: `colors.surface` background, `textSecondary`

4. **Bildirimler Section** — grouped card
   - Section label: "BİLDİRİMLER", same uppercase style
   - Each row: 28x28 rounded-square icon pill (soft tinted bg) + label + Switch
   - Icon pills with distinct soft colors per notification type:
     - Yeni takipçi: `primarySoft` bg, person icon
     - Yorum bildirimi: `accentSoft` bg, chatbubble icon
     - Beğeni bildirimi: pink-soft bg, heart icon
     - Cevap bildirimi: blue-soft bg, arrow-reply icon
     - Etkinlik hatırlatması: teal-soft bg, calendar icon
     - Rozet bildirimi: gold-soft bg, trophy icon
   - Rows separated by `colors.borderLight` (not full card borders)

5. **Gizlilik Section** — grouped card
   - Section label: "GİZLİLİK"
   - Description text: "Kimler sana doğrudan mesaj atabilsin?"
   - Radio rows with icon pills (lock icons)

6. **Çıkış Yap** — standalone grouped card
   - `primarySoft` background, no border
   - Red icon + red text

### Styling Rules

- All grouped cards: `BorderRadius.xl` (20), no `borderWidth`, subtle shadow (`shadowOpacity: 0.06, shadowRadius: 8`)
- Background: `colors.background` (not `backgroundSecondary` per card — cards are white/surface on the scroll bg)
- ScrollView background: `colors.backgroundSecondary` (gray tint)
- Section gaps: `Spacing.md` (12)
- Internal card padding: `Spacing.lg` (16)

### Animations

- Each section enters with `FadeInDown.delay(N).springify()` using `SpringConfig.snappy`
- Stagger: 0, 80, 160, 240, 320ms delays per section

### No Logic Changes

Same Supabase calls, same state management, same notification prefs + DM privacy logic.

---

## 2. Profile Page — Completion Banner

**File:** `src/app/(tabs)/profile.tsx`

### Placement

Between the profile info section (name/username/university/bio) and the XP progress bar. Wrapped in same `FadeInDown` animation sequence as surrounding sections.

### Completion Fields (5 total)

| # | Field | Check | Chip Label | Chip Color |
|---|-------|-------|------------|------------|
| 1 | `full_name` | has non-empty text | — (always filled at signup) | — |
| 2 | `username` | has non-empty text | — (always filled at signup) | — |
| 3 | `avatar_url` | not null | 📷 Fotoğraf Ekle | `primarySoft` bg, `primary` text |
| 4 | `bio` | not null and non-empty | ✏️ Biyografi Yaz | `accentSoft` bg, `accentDark` text |
| 5 | `university` | not null and non-empty | 🎓 Üniversite Seç | light blue bg (`#EFF6FF`), blue text (`#3B82F6`) |

### UI Structure

```
┌──────────────────────────────────────┐
│ 🎯 Profilini Tamamla           %60  │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░ (gradient)  │
│                                      │
│ [📷 Fotoğraf Ekle] [✏️ Biyografi]   │
│ [🎓 Üniversite Seç]                 │
└──────────────────────────────────────┘
```

- Card: `colors.background`, `BorderRadius.xl`, subtle shadow, thin `primarySoft` border (`borderWidth: 1, borderColor: colors.primarySoft || '#FFF0F0'`)
- Header row: emoji + title (bold) + percentage text (`Colors.primary`)
- Progress bar: 6px height, `colors.border` track, gradient fill (`Colors.primary` → `Colors.accent`)
- Chips: `paddingHorizontal: 10, paddingVertical: 6`, `BorderRadius.sm`, each with distinct bg color
- Chip tap: navigates to `/profile/edit`

### Behavior

- Compute `completionPercentage` from the 5 fields: `completedCount / 5 * 100`
- `missingFields` array: only fields that are missing/empty
- **Auto-hide:** When `completionPercentage === 100`, do not render the section at all
- **No new stores or API calls** — reads from existing `user` object in `useAuthStore`
- Entry animation: `FadeInDown` with delay slotted between profile info and XP bar

### Dark Mode

- Same structure, colors from `useThemeColors()` hook
- Chip backgrounds use dark-mode equivalent soft tints (already defined in `DarkColors`)
- Blue chip: `rgba(59, 130, 246, 0.15)` bg in dark mode

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/settings.tsx` | Full visual rewrite (same logic) |
| `src/app/(tabs)/profile.tsx` | Add `ProfileCompletionBanner` component + integrate |

## Files NOT Changed

- No new stores, hooks, or utility files
- No database changes
- No new dependencies
