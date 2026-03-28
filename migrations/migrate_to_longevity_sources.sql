-- =====================================================
-- Migrate longevity_articles + longevity_media
-- into unified longevity_sources table
-- =====================================================

-- 1. Create unified table
CREATE TABLE IF NOT EXISTS longevity_sources (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  node_id     text NOT NULL,
  type        text NOT NULL CHECK (type IN ('article', 'video', 'audio', 'pdf', 'md', 'image')),
  title       text NOT NULL,
  url         text NOT NULL,
  summary     text,
  tags        text[],
  script_cz   text,          -- TTS script (mainly for audio/video)
  journal     text,          -- e.g. "Nature Medicine"
  year        int,           -- publication year
  med_id      text,          -- PubMed ID / DOI / external ref
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- 2. Migrate from longevity_articles
INSERT INTO longevity_sources (node_id, type, title, url, summary, tags, active)
SELECT
  node_id,
  'article',
  title,
  url,
  summary,
  tags,
  true
FROM longevity_articles
WHERE url IS NOT NULL;

-- 3. Migrate from longevity_media
INSERT INTO longevity_sources (node_id, type, title, url, summary, tags, script_cz, active)
SELECT
  node_id,
  CASE
    WHEN type IN ('video')              THEN 'video'
    WHEN type IN ('audio', 'podcast')   THEN 'audio'
    WHEN type IN ('pdf')                THEN 'pdf'
    WHEN type IN ('md', 'markdown')     THEN 'md'
    WHEN type IN ('image', 'gif')       THEN 'image'
    ELSE 'video'
  END,
  title,
  url,
  summary,
  tags,
  script_cz,
  true
FROM longevity_media
WHERE url IS NOT NULL;

-- 4. Index for fast node lookups
CREATE INDEX IF NOT EXISTS idx_longevity_sources_node_id ON longevity_sources(node_id);
CREATE INDEX IF NOT EXISTS idx_longevity_sources_type    ON longevity_sources(type);
CREATE INDEX IF NOT EXISTS idx_longevity_sources_active  ON longevity_sources(active);

-- 5. Row Level Security (same pattern as other tables)
ALTER TABLE longevity_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON longevity_sources FOR SELECT USING (true);
