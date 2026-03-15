# Map Screen Problems — Deep Analysis

## What's Actually Happening (User Experience)

When I move around the map, the unreviewed restaurant pins are broken in multiple ways:

- **Pins blink/flicker when I pan.** Every time I drag the map even a little bit and let go, the restaurant pins disappear and reappear. They visibly flash. It's not smooth at all — it looks like the map is redrawing everything from scratch on every small movement.

- **Pins show up on the wrong side of the screen, not centered.** When I scroll the map to a new area, the restaurant pins stay stuck where I was before. They appear bunched up on the left edge or bottom edge instead of being in the center of where I'm looking. It feels like the pins are "chasing" me but always lagging behind.

- **When I move the map fast/far, it gets worse.** If I fling the map to a completely different neighborhood, for about a second I see the old pins from where I was before, stuck on one edge. Then they all disappear and new pins pop in. The transition is jarring — there's no smooth experience of pins being where I'm looking.

- **Cluster count badges (the grey circles with numbers) also appear at the edges.** The "60", "100" etc. badges that represent groups of restaurants sometimes show up half off-screen at the bottom or sides instead of being visible in the center of the map.

---

## The Cascade of Issues (Technical)

There are 6 interconnected problems that all feed into each other, creating the broken experience.

---

### Problem 1: `visibleVenues` recomputes on EVERY pan stop — causes blinking

**Location:** `map.tsx:215-229`

```js
const visibleVenues = useMemo(() => {
  // ...viewport filter using region...
}, [venues, nearbyScrapedVenues, isNeighborhoodZoom, region]);
//                                                    ^^^^^^
```

`region` is in the dependency array. `region` is a new object on every `onRegionChangeComplete` call (every single pan stop). This means:

1. User drags map slightly → `onRegionChangeComplete` fires → `setRegion(newRegion)`
2. New `region` object → `visibleVenues` recomputes (different venues pass the viewport filter)
3. New `visibleVenues` → `clusteredItems` recomputes (different clusters/markers)
4. React unmounts old `<Marker>` components, mounts new ones → **BLINK**

Even small pans cause the viewport filter boundaries to shift, changing which scraped venues pass the filter, which changes clusters, which causes markers to unmount/remount.

---

### Problem 2: `useDebounce(region, 500)` doesn't actually debounce — object reference comparison

**Location:** `map.tsx:194`, `hooks/useDebounce.ts:6`

```js
const debouncedRegion = useDebounce(region, 500);
```

`useDebounce` uses the value in the `useEffect` dependency array:
```js
useEffect(() => {
  const timer = setTimeout(() => setDebouncedValue(value), delay);
  return () => clearTimeout(timer);
}, [value, delay]);  // value is an object — ALWAYS new reference
```

`region` is a `Region` object. Every `setRegion()` creates a new object reference. React's dependency comparison uses `Object.is()` which does **reference equality** for objects. So every single `setRegion` call triggers the effect, clears the old timer, starts a new timer. The debounce technically works for timing, BUT:

- The `region` state change itself already causes a synchronous re-render
- That re-render recomputes `visibleVenues` (because `region` is in its deps)
- The debounce only delays the FETCH, but the viewport filter + cluster recompute happens IMMEDIATELY on every pan stop

So the debounce is only protecting the network call, not the expensive re-render chain.

---

### Problem 3: The viewport filter is a self-defeating loop

**Location:** `map.tsx:217-224`

```js
const bufLat = region.latitudeDelta;
const bufLng = region.longitudeDelta;
const scrapedToShow = nearbyScrapedVenues.filter(
  (v) =>
    v.latitude >= region.latitude - bufLat && ...
);
```

The viewport filter uses `region` (current map position) to decide which scraped venues to show. But `nearbyScrapedVenues` was fetched for `debouncedRegion` (a previous position). These two are always out of sync:

- `region` = where the map IS right now
- `debouncedRegion` = where the map WAS 500ms ago (when the fetch was triggered)
- `nearbyScrapedVenues` = venues around `debouncedRegion` (after network latency too)

So the filter is comparing venues fetched for position A against viewport boundaries for position B. The result: venues appearing/disappearing unpredictably as the two positions diverge.

---

### Problem 4: Clusters recompute when they shouldn't (because `visibleVenues` changes)

**Location:** `map.tsx:242-245`

```js
const clusteredItems = useMemo(
  () => clusterVenues(visibleVenues, stableCellSize),
  [visibleVenues, stableCellSize],
);
```

`stableCellSize` is quantized (good — stable across small zoom changes). BUT `visibleVenues` changes on every pan stop (Problem 1). New `visibleVenues` → new `clusteredItems` → markers unmount/remount → blink.

The quantized cell size prevents zoom-related blinking but does nothing against pan-related blinking, because the input venue list keeps changing.

---

### Problem 5: `onRegionChangeComplete` fires too often and the MapView is in a hybrid state

**Location:** `map.tsx:417-418`

```jsx
initialRegion={initialRegion}
onRegionChangeComplete={setRegion}
```

The MapView uses `initialRegion` (uncontrolled), but `setRegion` updates React state on every pan stop. This state is used for:
- `visibleVenues` viewport filter (immediate re-render)
- `isDistrictZoom` / `isNeighborhoodZoom` (immediate re-render)
- `stableCellSize` (immediate re-render)
- `debouncedRegion` → fetch trigger (delayed)

Every `onRegionChangeComplete` → `setRegion` → full component re-render → cascade of memo recomputations → markers change → blink. The component is doing way too much work per region change.

Additionally, `onRegionChangeComplete` on iOS fires not just for user gestures but also for programmatic animations (`animateToRegion`). So `handleMarkerPress`, `handleClusterPress`, `centerOnUser`, etc. all trigger the same cascade.

---

### Problem 6: Fetch center lags behind viewport — pins appear off-center

**Location:** `map.tsx:278-286`

```js
useEffect(() => {
  const { latitude, longitude, latitudeDelta, longitudeDelta } = debouncedRegion;
  if (latitudeDelta < 0.08) {
    countNearbyScraped(latitude, longitude, latitudeDelta, longitudeDelta);
  }
  if (latitudeDelta < 0.05) {
    fetchNearbyScraped(latitude, longitude, latitudeDelta, longitudeDelta);
  }
}, [debouncedRegion]);
```

Timeline when user pans far:
1. **t=0ms**: User stops panning. `region` = new position. Old `nearbyScrapedVenues` still displayed (from old position).
2. **t=0ms**: Viewport filter runs with new `region` against old venues. Removes many old venues (they're outside new viewport). Remaining old venues cluster on one edge. **User sees pins on edge.**
3. **t=500ms**: Debounce fires. `debouncedRegion` catches up. Fetch starts with correct center.
4. **t=700-1200ms**: Network response arrives. `nearbyScrapedVenues` updates in store. `visibleVenues` recomputes with fresh data. **Pins finally appear centered.** But another blink happens because all markers change.

The 3x fetch buffer (`venueStore.ts:321-322`) helps if the pan is small, but for large pans the buffer is exhausted and the user sees the full lag cycle.

---

## Summary: The Core Architecture Flaw

The fundamental problem is that **scraped venue display depends on TWO async/lagging sources that are always out of sync**:

1. `region` (current map position — updates synchronously on pan stop)
2. `nearbyScrapedVenues` (fetched data — updates after debounce + network latency)

Every attempt to reconcile them (viewport filter, debounce, buffer) introduces new side effects (blinking, edge clustering, re-renders).

The viewport filter in `visibleVenues` is the worst offender: it makes the render output dependent on `region`, causing the entire marker tree to rebuild on every pan stop. Without it, markers would be stable (just geographically stale). With it, they blink AND are stale.
