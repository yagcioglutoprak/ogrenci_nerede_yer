-- ============================================================
-- 010: Missing RLS Policies & Indexes
-- ============================================================

-- ── Missing RLS Policies ──

-- Posts: allow users to update their own posts
CREATE POLICY "posts_update_own" ON posts
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Venues: allow creators to delete their own venues
CREATE POLICY "venues_delete_own" ON venues
  FOR DELETE USING (auth.uid() = created_by);

-- Post images: allow post owners to delete images
CREATE POLICY "post_images_delete_own" ON post_images
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_images.post_id
        AND p.user_id = auth.uid()
    )
  );

-- ── Missing Indexes ──

-- GIN index for tag-based filtering on venues
CREATE INDEX IF NOT EXISTS idx_venues_tags ON venues USING GIN (tags);

-- Bookmarks user lookup
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);

-- Buddy matches FK indexes for join queries
CREATE INDEX IF NOT EXISTS idx_buddy_matches_requester ON buddy_matches(requester_buddy_id);
CREATE INDEX IF NOT EXISTS idx_buddy_matches_target ON buddy_matches(target_buddy_id);

-- Event attendees composite for capacity checks
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_status ON event_attendees(event_id, status);
