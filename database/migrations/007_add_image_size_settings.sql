-- Migration 007: Add image size settings for thumbnails and screenshots
-- This migration adds configurable size limits for thumbnail and screenshot uploads

-- Add new site settings for image file size limits
INSERT OR IGNORE INTO site_settings (setting_key, setting_value, setting_type, description) VALUES
('max_thumbnail_size_mb', '5', 'number', 'Maximum file size for thumbnail images in megabytes'),
('max_screenshot_size_mb', '5', 'number', 'Maximum file size for screenshot images in megabytes');
