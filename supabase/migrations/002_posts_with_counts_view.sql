-- ==========================================
-- posts_with_counts VIEW
-- Eliminates N+2 query problem in feedStore
-- by joining likes/comments counts via subqueries
-- ==========================================

CREATE OR REPLACE VIEW posts_with_counts AS
SELECT
  p.*,
  COALESCE(lc.likes_count, 0)    AS likes_count,
  COALESCE(cc.comments_count, 0) AS comments_count
FROM posts p
LEFT JOIN (
  SELECT post_id, COUNT(*) AS likes_count
  FROM likes
  GROUP BY post_id
) lc ON lc.post_id = p.id
LEFT JOIN (
  SELECT post_id, COUNT(*) AS comments_count
  FROM comments
  GROUP BY post_id
) cc ON cc.post_id = p.id;
