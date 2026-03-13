# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page marketing website for the Öğrenci Nerede Yer? mobile app that showcases features and drives app store downloads.

**Architecture:** Single `index.html` file with inline CSS and inline JS. No dependencies, no build step. Sections built incrementally — each task adds one complete section to the page. Assets (logo, favicon) copied from the existing app repo.

**Tech Stack:** HTML5, CSS3 (flexbox/grid, scroll-snap, media queries), vanilla JavaScript (IntersectionObserver, scroll events)

**Spec:** `docs/superpowers/specs/2026-03-13-landing-page-design.md`

---

## Chunk 1: Scaffolding + Navbar + Hero

### Task 1: Project scaffolding and asset setup

**Files:**
- Create: `website/index.html`
- Create: `website/assets/` (directory)
- Copy: `assets/logo.png` → `website/assets/logo.png`
- Copy: `assets/favicon.png` → `website/assets/favicon.png`
- Create: `website/assets/screenshots/` (empty directory with `.gitkeep`)

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p website/assets/screenshots
cp assets/logo.png website/assets/logo.png
cp assets/favicon.png website/assets/favicon.png
touch website/assets/screenshots/.gitkeep
```

- [ ] **Step 2: Create index.html with boilerplate**

Create `website/index.html` with:
- `<!DOCTYPE html>`, lang="tr"
- Meta charset UTF-8, viewport meta tag
- Title: "Öğrenci Nerede Yer? — Kampüste En İyi Mekanları Keşfet"
- Favicon link to `assets/favicon.png`
- Google Fonts link for Nunito (400, 500, 600, 700, 800)
- Open Graph meta tags (title, description, image pointing to logo)
- `<style>` block with CSS reset, root variables, and base typography:
  - `--primary: #E23744`
  - `--accent: #F5A623`
  - `--dark: #1a1a1a`
  - `--text: #333`
  - `--text-light: #666`
  - `--text-muted: #888`
  - `--bg-cream: #FFF8F5`
  - `--bg-light: #FAFAFA`
  - `--white: #ffffff`
  - `--max-width: 1200px`
  - `--nav-height: 72px`
  - Font family: `'Nunito', sans-serif`
  - Box-sizing border-box on all elements
  - Smooth scroll on `html`
  - Body margin 0, font-family from variable
- Empty `<body>` for now
- Empty `<script>` block at end of body

```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Öğrenci Nerede Yer? — Kampüste En İyi Mekanları Keşfet</title>
  <meta name="description" content="Üniversite öğrencileri için sosyal yemek platformu. Uygun fiyatlı restoranları bul, deneyimlerini paylaş, yemek arkadaşını eşleştir.">
  <meta property="og:title" content="Öğrenci Nerede Yer?">
  <meta property="og:description" content="Kampüste en iyi mekanları keşfet. Öğrenciden öğrenciye yemek platformu.">
  <meta property="og:image" content="assets/logo.png">
  <meta property="og:type" content="website">
  <link rel="icon" href="assets/favicon.png" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    /* --- variables and reset will go here --- */
  </style>
</head>
<body>
  <!-- sections will be added incrementally -->
  <script>
    // JS will go here
  </script>
</body>
</html>
```

- [ ] **Step 3: Add CSS reset and variables inside `<style>`**

```css
:root {
  --primary: #E23744;
  --accent: #F5A623;
  --dark: #1a1a1a;
  --text: #333333;
  --text-light: #666666;
  --text-muted: #888888;
  --bg-cream: #FFF8F5;
  --bg-light: #FAFAFA;
  --white: #ffffff;
  --max-width: 1200px;
  --nav-height: 72px;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: 'Nunito', sans-serif;
  color: var(--text);
  background: var(--white);
  -webkit-font-smoothing: antialiased;
}

img {
  max-width: 100%;
  display: block;
}

a {
  text-decoration: none;
  color: inherit;
}

.container {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 24px;
}

.section-label {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--primary);
  font-weight: 700;
  margin-bottom: 8px;
}

.section-title {
  font-size: 36px;
  font-weight: 800;
  color: var(--dark);
  margin-bottom: 16px;
}

/* Scroll reveal base */
.reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}

.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
```

- [ ] **Step 4: Verify in browser**

```bash
open website/index.html
```

Expected: blank white page, no console errors, Nunito font loaded.

- [ ] **Step 5: Commit**

```bash
git add website/
git commit -m "feat(website): scaffold project with assets and CSS foundation"
```

---

### Task 2: Sticky Navbar

**Files:**
- Modify: `website/index.html` (add navbar HTML + CSS + JS)

- [ ] **Step 1: Add navbar HTML to `<body>`**

```html
<nav class="navbar" id="navbar">
  <div class="container nav-container">
    <a href="#" class="nav-logo">
      <img src="assets/logo.png" alt="Öğrenci Nerede Yer?" class="nav-logo-img">
      <span class="nav-logo-text">Öğrenci Nerede Yer?</span>
    </a>
    <div class="nav-links" id="navLinks">
      <a href="#features" class="nav-link">Özellikler</a>
      <a href="#how-it-works" class="nav-link">Nasıl Çalışır</a>
      <a href="#download" class="nav-link">İndir</a>
    </div>
    <button class="nav-hamburger" id="hamburger" aria-label="Menüyü aç">
      <span></span>
      <span></span>
      <span></span>
    </button>
  </div>
</nav>
```

- [ ] **Step 2: Add navbar CSS**

```css
/* Navbar */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--nav-height);
  z-index: 1000;
  transition: background 0.3s ease, box-shadow 0.3s ease;
}

.navbar.scrolled {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
}

.nav-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
}

.nav-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nav-logo-img {
  width: 36px;
  height: 36px;
  border-radius: 8px;
}

.nav-logo-text {
  font-size: 18px;
  font-weight: 800;
  color: var(--dark);
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 32px;
}

.nav-link {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-light);
  transition: color 0.2s ease;
}

.nav-link:hover {
  color: var(--primary);
}

/* Hamburger */
.nav-hamburger {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
}

.nav-hamburger span {
  width: 24px;
  height: 2px;
  background: var(--dark);
  border-radius: 2px;
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.nav-hamburger.active span:nth-child(1) {
  transform: rotate(45deg) translate(5px, 5px);
}

.nav-hamburger.active span:nth-child(2) {
  opacity: 0;
}

.nav-hamburger.active span:nth-child(3) {
  transform: rotate(-45deg) translate(5px, -5px);
}

/* Mobile nav */
@media (max-width: 767px) {
  .nav-hamburger {
    display: flex;
  }

  .nav-links {
    position: fixed;
    top: var(--nav-height);
    left: 0;
    right: 0;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    flex-direction: column;
    padding: 24px;
    gap: 20px;
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none;
    transition: transform 0.3s ease, opacity 0.3s ease;
  }

  .nav-links.open {
    transform: translateY(0);
    opacity: 1;
    pointer-events: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  }
}
```

- [ ] **Step 3: Add navbar JS inside `<script>`**

```javascript
// Navbar scroll effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
});

// Hamburger toggle
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  navLinks.classList.toggle('open');
});

// Close mobile menu on link click
navLinks.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navLinks.classList.remove('open');
  });
});
```

- [ ] **Step 4: Verify in browser**

Expected: navbar visible at top, transparent initially, gets white+blur background on scroll. Hamburger menu works on mobile viewport.

- [ ] **Step 5: Commit**

```bash
git add website/index.html
git commit -m "feat(website): add sticky navbar with responsive hamburger menu"
```

---

### Task 3: Hero Section

**Files:**
- Modify: `website/index.html` (add hero HTML + CSS below navbar)

- [ ] **Step 1: Add hero HTML after navbar**

```html
<section class="hero">
  <div class="container hero-content">
    <div class="hero-badge">🍕 Öğrenci Yemek Platformu</div>
    <h1 class="hero-title">Kampüste En İyi<br>Mekanları Keşfet</h1>
    <p class="hero-subtitle">
      Üniversite öğrencileri için sosyal yemek platformu. Uygun fiyatlı restoranları bul,
      deneyimlerini paylaş, yemek arkadaşını eşleştir.
    </p>
    <div class="hero-buttons">
      <a href="#" class="store-btn" data-store="appstore">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
        App Store
      </a>
      <a href="#" class="store-btn" data-store="googleplay">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.61 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/></svg>
        Google Play
      </a>
    </div>
    <div class="hero-phones">
      <div class="phone phone-left">
        <div class="phone-notch"></div>
        <div class="phone-screen">Harita</div>
      </div>
      <div class="phone phone-center">
        <div class="phone-notch"></div>
        <div class="phone-screen">Ana Ekran</div>
      </div>
      <div class="phone phone-right">
        <div class="phone-notch"></div>
        <div class="phone-screen">Profil</div>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add hero CSS**

```css
/* Hero */
.hero {
  padding-top: calc(var(--nav-height) + 60px);
  padding-bottom: 80px;
  background: linear-gradient(180deg, var(--white) 0%, var(--bg-cream) 100%);
  text-align: center;
  overflow: hidden;
}

.hero-content {
  max-width: 700px;
}

.hero-badge {
  display: inline-block;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--primary);
  font-weight: 700;
  margin-bottom: 20px;
}

.hero-title {
  font-size: 56px;
  font-weight: 800;
  color: var(--dark);
  line-height: 1.15;
  margin-bottom: 20px;
}

.hero-subtitle {
  font-size: 18px;
  color: var(--text-light);
  line-height: 1.7;
  margin-bottom: 36px;
  max-width: 540px;
  margin-left: auto;
  margin-right: auto;
}

.hero-buttons {
  display: flex;
  gap: 14px;
  justify-content: center;
  margin-bottom: 60px;
}

.store-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--dark);
  color: var(--white);
  padding: 14px 28px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.store-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

/* Phone mockups */
.hero-phones {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 16px;
  margin-top: 20px;
}

.phone {
  background: var(--dark);
  border-radius: 24px;
  border: 3px solid #333;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.phone-notch {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 20px;
  background: var(--dark);
  border-radius: 0 0 12px 12px;
  z-index: 2;
}

.phone-screen {
  width: 100%;
  height: 100%;
  background: #f5f5f5;
  margin: 3px;
  border-radius: 21px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #ccc;
  font-weight: 600;
}

.phone-center {
  width: 220px;
  height: 440px;
  z-index: 2;
  box-shadow: 0 20px 60px rgba(226, 55, 68, 0.15);
}

.phone-left,
.phone-right {
  width: 180px;
  height: 360px;
  opacity: 0.9;
  box-shadow: 0 16px 40px rgba(226, 55, 68, 0.08);
}

.phone-left {
  transform: rotate(-6deg);
}

.phone-right {
  transform: rotate(6deg);
}

/* Hero responsive */
@media (max-width: 767px) {
  .hero {
    padding-top: calc(var(--nav-height) + 40px);
    padding-bottom: 60px;
  }

  .hero-title {
    font-size: 36px;
  }

  .hero-subtitle {
    font-size: 16px;
  }

  .hero-buttons {
    flex-direction: column;
    align-items: center;
    gap: 10px;
    margin-bottom: 40px;
  }

  .phone-center {
    width: 160px;
    height: 320px;
  }

  .phone-left,
  .phone-right {
    width: 120px;
    height: 240px;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .hero-title {
    font-size: 44px;
  }
}
```

- [ ] **Step 3: Verify in browser**

Expected: hero section with headline, subtitle, two black store buttons, three tilted phone mockups. Responsive on mobile/tablet.

- [ ] **Step 4: Commit**

```bash
git add website/index.html
git commit -m "feat(website): add hero section with phone mockups"
```

---

## Chunk 2: Features + Screenshots + How It Works

### Task 4: Features Grid

**Files:**
- Modify: `website/index.html`

- [ ] **Step 1: Add features HTML after hero section**

```html
<section class="features reveal" id="features">
  <div class="container">
    <div class="section-header">
      <div class="section-label">Özellikler</div>
      <h2 class="section-title">Neden Öğrenci Nerede Yer?</h2>
    </div>
    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-icon">🗺️</div>
        <h3 class="feature-title">Harita Keşfi</h3>
        <p class="feature-desc">Kampüs çevresindeki tüm mekanları interaktif haritada keşfet. Filtrelere göre en yakın ve en uygun yeri bul.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">⭐</div>
        <h3 class="feature-title">3 Eksenli Puanlama</h3>
        <p class="feature-desc">Lezzet, fiyat/performans ve ortam — gerçek öğrenci yorumlarıyla mekanları 3 farklı eksende değerlendir.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🤝</div>
        <h3 class="feature-title">Yemek Arkadaşı</h3>
        <p class="feature-desc">Yalnız yemek yeme! Kampüsten yemek buddy'ni bul, eşleş ve birlikte yeni mekanlar keşfet.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">📋</div>
        <h3 class="feature-title">Küratörlü Listeler</h3>
        <p class="feature-desc">En sevdiğin mekanları listele, arkadaşlarınla paylaş. Başkalarının listelerini takip et.</p>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add features CSS**

```css
/* Section shared */
.section-header {
  text-align: center;
  margin-bottom: 48px;
}

/* Features */
.features {
  padding: 100px 0;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

.feature-card {
  background: var(--bg-cream);
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 30px rgba(226, 55, 68, 0.08);
}

.feature-icon {
  font-size: 40px;
  margin-bottom: 16px;
}

.feature-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--dark);
  margin-bottom: 8px;
}

.feature-desc {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.6;
}

@media (max-width: 767px) {
  .features {
    padding: 60px 0;
  }

  .features-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .section-title {
    font-size: 28px;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .features-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

- [ ] **Step 3: Verify in browser**

Expected: 4 feature cards in a row on desktop, 2 on tablet, stacked on mobile. Cards lift on hover.

- [ ] **Step 4: Commit**

```bash
git add website/index.html
git commit -m "feat(website): add features grid section"
```

---

### Task 5: App Screenshots Carousel

**Files:**
- Modify: `website/index.html`

- [ ] **Step 1: Add screenshots HTML after features**

```html
<section class="screenshots reveal" id="screenshots">
  <div class="container">
    <div class="section-header">
      <div class="section-label">Uygulama</div>
      <h2 class="section-title">Bir Göz At</h2>
    </div>
    <div class="screenshots-carousel" id="screenshotCarousel">
      <div class="screenshot-slide">
        <div class="phone phone-carousel">
          <div class="phone-notch"></div>
          <div class="phone-screen">Harita Ekranı</div>
        </div>
      </div>
      <div class="screenshot-slide">
        <div class="phone phone-carousel">
          <div class="phone-notch"></div>
          <div class="phone-screen">Sosyal Akış</div>
        </div>
      </div>
      <div class="screenshot-slide">
        <div class="phone phone-carousel">
          <div class="phone-notch"></div>
          <div class="phone-screen">Mekan Detay</div>
        </div>
      </div>
      <div class="screenshot-slide">
        <div class="phone phone-carousel">
          <div class="phone-notch"></div>
          <div class="phone-screen">Buddy Eşleşme</div>
        </div>
      </div>
      <div class="screenshot-slide">
        <div class="phone phone-carousel">
          <div class="phone-notch"></div>
          <div class="phone-screen">Mesajlar</div>
        </div>
      </div>
    </div>
    <div class="screenshot-dots" id="screenshotDots">
      <button class="dot active" data-index="0" aria-label="Ekran 1"></button>
      <button class="dot" data-index="1" aria-label="Ekran 2"></button>
      <button class="dot" data-index="2" aria-label="Ekran 3"></button>
      <button class="dot" data-index="3" aria-label="Ekran 4"></button>
      <button class="dot" data-index="4" aria-label="Ekran 5"></button>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add screenshots CSS**

```css
/* Screenshots */
.screenshots {
  padding: 100px 0;
  background: var(--bg-light);
}

.screenshots-carousel {
  display: flex;
  gap: 24px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding: 20px 0;
  scrollbar-width: none;
}

.screenshots-carousel::-webkit-scrollbar {
  display: none;
}

.screenshot-slide {
  flex: 0 0 auto;
  scroll-snap-align: center;
}

.phone-carousel {
  width: 240px;
  height: 480px;
  box-shadow: 0 16px 50px rgba(0, 0, 0, 0.08);
}

.screenshot-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 24px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #D0D0D0;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: background 0.3s ease, transform 0.3s ease;
}

.dot.active {
  background: var(--primary);
  transform: scale(1.3);
}

@media (max-width: 767px) {
  .screenshots {
    padding: 60px 0;
  }

  .phone-carousel {
    width: 200px;
    height: 400px;
  }
}
```

- [ ] **Step 3: Add carousel JS**

```javascript
// Screenshot carousel dots
const carousel = document.getElementById('screenshotCarousel');
const dots = document.querySelectorAll('#screenshotDots .dot');

dots.forEach(dot => {
  dot.addEventListener('click', () => {
    const index = parseInt(dot.dataset.index);
    const slide = carousel.children[index];
    slide.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });
});

carousel.addEventListener('scroll', () => {
  const scrollLeft = carousel.scrollLeft;
  const slideWidth = carousel.children[0].offsetWidth + 24; // gap
  const activeIndex = Math.round(scrollLeft / slideWidth);
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === activeIndex);
  });
});
```

- [ ] **Step 4: Verify in browser**

Expected: horizontal scrolling carousel of phone mockups, dots update on scroll, clicking dots scrolls to slide.

- [ ] **Step 5: Commit**

```bash
git add website/index.html
git commit -m "feat(website): add screenshots carousel with interactive dots"
```

---

### Task 6: How It Works

**Files:**
- Modify: `website/index.html`

- [ ] **Step 1: Add how-it-works HTML after screenshots**

```html
<section class="how-it-works reveal" id="how-it-works">
  <div class="container">
    <div class="section-header">
      <div class="section-label">Nasıl Çalışır</div>
      <h2 class="section-title">3 Adımda Başla</h2>
    </div>
    <div class="steps">
      <div class="step">
        <div class="step-number">1</div>
        <h3 class="step-title">İndir</h3>
        <p class="step-desc">Uygulamayı indir, üniversiteni seç ve hesabını oluştur.</p>
      </div>
      <div class="step-line"></div>
      <div class="step">
        <div class="step-number">2</div>
        <h3 class="step-title">Keşfet</h3>
        <p class="step-desc">Haritada yakınındaki mekanları bul, yorumları oku, puanla.</p>
      </div>
      <div class="step-line"></div>
      <div class="step">
        <div class="step-number">3</div>
        <h3 class="step-title">Paylaş</h3>
        <p class="step-desc">Deneyimini paylaş, yemek buddy'ni bul, listeler oluştur.</p>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add how-it-works CSS**

```css
/* How It Works */
.how-it-works {
  padding: 100px 0;
}

.steps {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 0;
}

.step {
  text-align: center;
  flex: 1;
  max-width: 260px;
}

.step-number {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--white);
  font-size: 22px;
  font-weight: 800;
  margin: 0 auto 16px;
}

.step-line {
  width: 80px;
  height: 2px;
  border-top: 2px dashed #ddd;
  margin-top: 28px;
  flex-shrink: 0;
}

.step-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--dark);
  margin-bottom: 8px;
}

.step-desc {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.6;
}

@media (max-width: 767px) {
  .how-it-works {
    padding: 60px 0;
  }

  .steps {
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }

  .step-line {
    display: none;
  }
}
```

- [ ] **Step 3: Verify in browser**

Expected: 3 steps in a row with gradient circles, dashed connector lines between them. Stacks vertically on mobile, lines hidden.

- [ ] **Step 4: Commit**

```bash
git add website/index.html
git commit -m "feat(website): add how-it-works section with 3 steps"
```

---

## Chunk 3: Social Proof + Stats + CTA + Footer + Animations

### Task 7: Social Proof — Testimonials

**Files:**
- Modify: `website/index.html`

- [ ] **Step 1: Add testimonials HTML after how-it-works**

```html
<section class="testimonials reveal" id="testimonials">
  <div class="container">
    <div class="section-header">
      <div class="section-label">Öğrenciler Ne Diyor?</div>
      <h2 class="section-title">Kullanıcı Yorumları</h2>
    </div>
    <div class="testimonials-grid">
      <div class="testimonial-card">
        <p class="testimonial-text">"Kampüs çevresinde uygun fiyatlı yemek bulmak artık çok kolay. Harita özelliği harika, her gün kullanıyorum!"</p>
        <div class="testimonial-author">
          <div class="author-avatar" style="background: var(--primary);">A</div>
          <div>
            <div class="author-name">Ayşe K.</div>
            <div class="author-info">İTÜ — Bilgisayar Mühendisliği</div>
          </div>
        </div>
      </div>
      <div class="testimonial-card">
        <p class="testimonial-text">"Yemek buddy özelliği sayesinde yeni arkadaşlar edindim. Yalnız yemek yemek tarihe karıştı, çok teşekkürler!"</p>
        <div class="testimonial-author">
          <div class="author-avatar" style="background: var(--accent);">M</div>
          <div>
            <div class="author-name">Mehmet Y.</div>
            <div class="author-info">Boğaziçi Üni. — İşletme</div>
          </div>
        </div>
      </div>
      <div class="testimonial-card">
        <p class="testimonial-text">"3 eksenli puanlama sistemi çok mantıklı. Artık sadece lezzete değil, fiyata ve ortama göre de seçiyorum."</p>
        <div class="testimonial-author">
          <div class="author-avatar" style="background: #14B8A6;">Z</div>
          <div>
            <div class="author-name">Zeynep S.</div>
            <div class="author-info">İstanbul Üni. — Hukuk</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add testimonials CSS**

```css
/* Testimonials */
.testimonials {
  padding: 100px 0;
  background: var(--bg-cream);
}

.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.testimonial-card {
  background: var(--white);
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.testimonial-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.testimonial-text {
  font-size: 15px;
  color: var(--text-light);
  line-height: 1.7;
  margin-bottom: 20px;
  font-style: italic;
}

.testimonial-author {
  display: flex;
  align-items: center;
  gap: 12px;
}

.author-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--white);
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
}

.author-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--dark);
}

.author-info {
  font-size: 12px;
  color: var(--text-muted);
}

@media (max-width: 767px) {
  .testimonials {
    padding: 60px 0;
  }

  .testimonials-grid {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .testimonials-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

- [ ] **Step 3: Verify in browser**

Expected: 3 testimonial cards with quotes, avatars with colored initials, university info. Responsive grid.

- [ ] **Step 4: Commit**

```bash
git add website/index.html
git commit -m "feat(website): add testimonials section"
```

---

### Task 8: Stats Bar

**Files:**
- Modify: `website/index.html`

- [ ] **Step 1: Add stats HTML after testimonials**

```html
<section class="stats" id="stats">
  <div class="container">
    <div class="stats-grid">
      <div class="stat">
        <div class="stat-number" data-target="500" data-suffix="+">0</div>
        <div class="stat-label">Mekan</div>
      </div>
      <div class="stat">
        <div class="stat-number" data-target="10000" data-suffix="+" data-display="10K">0</div>
        <div class="stat-label">Öğrenci</div>
      </div>
      <div class="stat">
        <div class="stat-number" data-target="20" data-suffix="+">0</div>
        <div class="stat-label">Üniversite</div>
      </div>
      <div class="stat">
        <div class="stat-number" data-target="4.8" data-decimal="true">0</div>
        <div class="stat-label">App Store Puanı</div>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add stats CSS**

```css
/* Stats */
.stats {
  padding: 60px 0;
  background: linear-gradient(135deg, var(--primary), var(--accent));
}

.stats-grid {
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.stat-number {
  font-size: 48px;
  font-weight: 800;
  color: var(--white);
  line-height: 1;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 600;
}

@media (max-width: 767px) {
  .stats {
    padding: 40px 0;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 32px;
  }

  .stat-number {
    font-size: 36px;
  }
}
```

- [ ] **Step 3: Add count-up animation JS**

```javascript
// Stats count-up animation
function animateCountUp(el) {
  const target = parseFloat(el.dataset.target);
  const suffix = el.dataset.suffix || '';
  const isDecimal = el.dataset.decimal === 'true';
  const displayAs = el.dataset.display;
  const duration = 1500;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = eased * target;

    if (displayAs && progress >= 1) {
      el.textContent = displayAs + suffix;
    } else if (isDecimal) {
      el.textContent = current.toFixed(1);
    } else {
      el.textContent = Math.floor(current).toLocaleString('tr-TR') + (progress >= 1 ? suffix : '');
    }

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('.stat-number').forEach(animateCountUp);
      statsObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.3 });

const statsSection = document.getElementById('stats');
if (statsSection) statsObserver.observe(statsSection);
```

- [ ] **Step 4: Verify in browser**

Expected: gradient bar with 4 stats. Numbers animate from 0 when scrolled into view. "10K+" displays correctly. 4.8 shows one decimal.

- [ ] **Step 5: Commit**

```bash
git add website/index.html
git commit -m "feat(website): add stats bar with count-up animation"
```

---

### Task 9: Final Download CTA

**Files:**
- Modify: `website/index.html`

- [ ] **Step 1: Add CTA HTML after stats**

```html
<section class="cta reveal" id="download">
  <div class="container">
    <div class="cta-content">
      <h2 class="cta-title">Hadi Başlayalım!</h2>
      <p class="cta-subtitle">Kampüsündeki en iyi mekanları keşfetmeye bugün başla. Ücretsiz indir, hemen kullanmaya başla.</p>
      <div class="hero-buttons">
        <a href="#" class="store-btn" data-store="appstore">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          App Store
        </a>
        <a href="#" class="store-btn" data-store="googleplay">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.61 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/></svg>
          Google Play
        </a>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add CTA CSS**

```css
/* CTA */
.cta {
  padding: 100px 0;
  text-align: center;
}

.cta-content {
  max-width: 560px;
  margin: 0 auto;
}

.cta-title {
  font-size: 40px;
  font-weight: 800;
  color: var(--dark);
  margin-bottom: 16px;
}

.cta-subtitle {
  font-size: 17px;
  color: var(--text-light);
  line-height: 1.7;
  margin-bottom: 32px;
}

@media (max-width: 767px) {
  .cta {
    padding: 60px 0;
  }

  .cta-title {
    font-size: 30px;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add website/index.html
git commit -m "feat(website): add download CTA section"
```

---

### Task 10: Footer

**Files:**
- Modify: `website/index.html`

- [ ] **Step 1: Add footer HTML after CTA**

```html
<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="footer-logo">
          <img src="assets/logo.png" alt="Öğrenci Nerede Yer?" class="nav-logo-img">
          <span>Öğrenci Nerede Yer?</span>
        </div>
        <p class="footer-copyright">© 2026 Memet Kebab. Tüm hakları saklıdır.</p>
      </div>
      <div class="footer-links">
        <div class="footer-col">
          <h4 class="footer-heading">Uygulama</h4>
          <a href="#features">Özellikler</a>
          <a href="#how-it-works">Nasıl Çalışır</a>
          <a href="#download">İndir</a>
        </div>
        <div class="footer-col">
          <h4 class="footer-heading">Yasal</h4>
          <a href="#">Gizlilik Politikası</a>
          <a href="#">Kullanım Şartları</a>
          <a href="#">KVKK</a>
        </div>
        <div class="footer-col">
          <h4 class="footer-heading">Sosyal</h4>
          <a href="#" aria-label="Instagram">Instagram</a>
          <a href="#" aria-label="Twitter">Twitter</a>
          <a href="#" aria-label="LinkedIn">LinkedIn</a>
        </div>
      </div>
    </div>
  </div>
</footer>
```

- [ ] **Step 2: Add footer CSS**

```css
/* Footer */
.footer {
  background: var(--dark);
  padding: 60px 0 40px;
  color: var(--white);
}

.footer-grid {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.footer-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 800;
  margin-bottom: 12px;
}

.footer-logo .nav-logo-img {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.footer-copyright {
  font-size: 13px;
  color: #888;
}

.footer-links {
  display: flex;
  gap: 60px;
}

.footer-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.footer-heading {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 4px;
  color: var(--white);
}

.footer-col a {
  font-size: 14px;
  color: #aaa;
  transition: color 0.2s ease;
}

.footer-col a:hover {
  color: var(--white);
}

@media (max-width: 767px) {
  .footer {
    padding: 40px 0 30px;
  }

  .footer-grid {
    flex-direction: column;
    gap: 32px;
  }

  .footer-links {
    gap: 32px;
    flex-wrap: wrap;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add website/index.html
git commit -m "feat(website): add footer with links and branding"
```

---

### Task 11: Scroll reveal animations

**Files:**
- Modify: `website/index.html` (add JS at end of script block)

- [ ] **Step 1: Add scroll reveal JS**

```javascript
// Scroll reveal
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => {
  revealObserver.observe(el);
});
```

- [ ] **Step 2: Verify full page in browser**

Expected: all sections visible, scroll reveals animate sections as they enter viewport, stats count up, carousel scrolls, navbar blur on scroll, responsive at all breakpoints.

- [ ] **Step 3: Final commit**

```bash
git add website/index.html
git commit -m "feat(website): add scroll reveal animations — landing page complete"
```
