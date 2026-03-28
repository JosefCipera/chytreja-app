-- Add full markdown content column to longevity_articles
ALTER TABLE longevity_articles
  ADD COLUMN IF NOT EXISTS content TEXT;
