-- Migration: Add external_url field to mods table
-- Created: 2024-01-27

-- Add external_url column to mods table
ALTER TABLE mods ADD COLUMN external_url VARCHAR(500);

-- Create index for external_url field
CREATE INDEX IF NOT EXISTS idx_mods_external_url ON mods(external_url);
