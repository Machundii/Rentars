-- Add thumbnail_url column to property_images table for gallery grid performance
ALTER TABLE property_images ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
