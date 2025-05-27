-- Migration: Add site settings table
-- Created: 2024-01-27

-- Site settings table
CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'string', -- 'string', 'boolean', 'number', 'json'
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default site settings
INSERT OR IGNORE INTO site_settings (setting_key, setting_value, setting_type, description) VALUES
('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode to prevent new uploads and registrations'),
('max_file_size_mb', '1024', 'number', 'Maximum file size for mod uploads in megabytes'),
('featured_mods_count', '6', 'number', 'Number of featured mods to display on the homepage'),
('maintenance_message', 'Sayonika is currently undergoing maintenance. Please check back later!', 'string', 'Message displayed to users during maintenance mode');

-- Indexes for site settings table
CREATE INDEX IF NOT EXISTS idx_site_settings_key ON site_settings(setting_key);
