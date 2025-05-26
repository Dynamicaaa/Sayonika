-- Sayonika Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    bio TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    is_owner BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    -- Gamification fields
    achievement_points INTEGER DEFAULT 0,
    user_level INTEGER DEFAULT 1,
    user_title VARCHAR(100) DEFAULT 'Newcomer',
    -- Email preferences
    email_notifications_enabled BOOLEAN DEFAULT TRUE,
    email_mod_approved BOOLEAN DEFAULT TRUE,
    email_achievements BOOLEAN DEFAULT TRUE,
    email_comments BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    -- OAuth fields
    github_id VARCHAR(50),
    github_username VARCHAR(100),
    discord_id VARCHAR(50),
    discord_username VARCHAR(100),
    discord_discriminator VARCHAR(10)
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7), -- Hex color code
    icon VARCHAR(50), -- FontAwesome icon class
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Mods table
CREATE TABLE IF NOT EXISTS mods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    author_id INTEGER NOT NULL,
    category_id INTEGER,
    version VARCHAR(20) NOT NULL,
    file_path VARCHAR(500),
    file_size INTEGER,
    download_count INTEGER DEFAULT 0,
    rating_average DECIMAL(3,2) DEFAULT 0.00,
    rating_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT FALSE,
    is_nsfw BOOLEAN DEFAULT FALSE,
    thumbnail_url VARCHAR(500),
    screenshots TEXT, -- JSON array of screenshot URLs
    tags TEXT, -- JSON array of tags
    requirements TEXT, -- JSON object with requirements
    changelog TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    published_at DATETIME,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Mod versions table
CREATE TABLE IF NOT EXISTS mod_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mod_id INTEGER NOT NULL,
    version VARCHAR(20) NOT NULL,
    file_path VARCHAR(500),
    file_size INTEGER,
    changelog TEXT,
    download_count INTEGER DEFAULT 0,
    is_current BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mod_id) REFERENCES mods(id) ON DELETE CASCADE
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mod_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    content TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mod_id) REFERENCES mods(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(mod_id, user_id)
);

-- Mod reviews table (admin review decisions)
CREATE TABLE IF NOT EXISTS mod_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mod_id INTEGER NOT NULL,
    admin_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL CHECK(status IN ('approved', 'rejected')),
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mod_id) REFERENCES mods(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for mod_reviews table
CREATE INDEX IF NOT EXISTS idx_mod_reviews_mod_id ON mod_reviews(mod_id);
CREATE INDEX IF NOT EXISTS idx_mod_reviews_admin_id ON mod_reviews(admin_id);
CREATE INDEX IF NOT EXISTS idx_mod_reviews_status ON mod_reviews(status);

-- Downloads table
CREATE TABLE IF NOT EXISTS downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mod_id INTEGER NOT NULL,
    user_id INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mod_id) REFERENCES mods(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Favorites table
CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    mod_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (mod_id) REFERENCES mods(id) ON DELETE CASCADE,
    UNIQUE(user_id, mod_id)
);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    permissions TEXT, -- JSON array of permissions
    last_used DATETIME,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    data TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- OAuth link tokens table (for handling session persistence issues during OAuth flows)
CREATE TABLE IF NOT EXISTS oauth_link_tokens (
    token VARCHAR(500) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    provider VARCHAR(20) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'mod_approved', 'mod_rejected', 'general', 'achievement'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_id INTEGER, -- For mod-related notifications, stores mod_id
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(50), -- FontAwesome icon class
    points INTEGER DEFAULT 0,
    category VARCHAR(50) DEFAULT 'general', -- 'upload', 'download', 'community', 'special'
    requirement_type VARCHAR(50) NOT NULL, -- 'mod_upload', 'download_count', 'comment_count', etc.
    requirement_value INTEGER DEFAULT 1,
    is_hidden BOOLEAN DEFAULT FALSE, -- Hidden achievements
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_id INTEGER NOT NULL,
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
    UNIQUE(user_id, achievement_id)
);

-- Mod comments table
CREATE TABLE IF NOT EXISTS mod_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mod_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    parent_id INTEGER, -- For threaded comments
    content TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT TRUE, -- Auto-approve for now, can be moderated later
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mod_id) REFERENCES mods(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES mod_comments(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_mod_comments_mod_id ON mod_comments(mod_id);
CREATE INDEX IF NOT EXISTS idx_mod_comments_user_id ON mod_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_mod_comments_parent_id ON mod_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_mod_comments_created_at ON mod_comments(created_at);

-- Insert default categories
INSERT OR IGNORE INTO categories (name, description, color, icon) VALUES
('Full Mods', 'Complete modification packages with new stories and characters', '#FF6B9D', 'fas fa-book'),
('Gameplay Mods', 'Modifications that change game mechanics and features', '#4ECDC4', 'fas fa-gamepad'),
('Visual Mods', 'Sprite replacements, backgrounds, and visual enhancements', '#45B7D1', 'fas fa-image'),
('Audio Mods', 'Music replacements and sound effect modifications', '#96CEB4', 'fas fa-music'),
('Tools & Utilities', 'Development tools and utility modifications', '#FFEAA7', 'fas fa-tools'),
('Misc', 'Other modifications that do not fit into specific categories', '#DDA0DD', 'fas fa-puzzle-piece');

-- Insert default achievements
INSERT OR IGNORE INTO achievements (name, description, icon, points, category, requirement_type, requirement_value, is_hidden) VALUES
-- Upload achievements
('First Steps', 'Upload your first mod to Sayonika', 'fas fa-upload', 10, 'upload', 'mod_upload', 1, FALSE),
('Mod Creator', 'Upload 5 mods to the platform', 'fas fa-hammer', 25, 'upload', 'mod_upload', 5, FALSE),
('Prolific Creator', 'Upload 10 mods to the platform', 'fas fa-industry', 50, 'upload', 'mod_upload', 10, FALSE),
('Mod Master', 'Upload 25 mods to the platform', 'fas fa-crown', 100, 'upload', 'mod_upload', 25, FALSE),

-- Download achievements
('Popular Creator', 'Get 100 total downloads across all your mods', 'fas fa-download', 15, 'download', 'total_downloads', 100, FALSE),
('Rising Star', 'Get 500 total downloads across all your mods', 'fas fa-star', 30, 'download', 'total_downloads', 500, FALSE),
('Community Favorite', 'Get 1000 total downloads across all your mods', 'fas fa-heart', 60, 'download', 'total_downloads', 1000, FALSE),
('Legendary Creator', 'Get 5000 total downloads across all your mods', 'fas fa-trophy', 150, 'download', 'total_downloads', 5000, FALSE),

-- Community achievements
('Conversationalist', 'Post 10 comments on mods', 'fas fa-comments', 10, 'community', 'comment_count', 10, FALSE),
('Community Helper', 'Post 50 comments on mods', 'fas fa-hands-helping', 25, 'community', 'comment_count', 50, FALSE),
('Discussion Leader', 'Post 100 comments on mods', 'fas fa-bullhorn', 50, 'community', 'comment_count', 100, FALSE),

-- Special achievements
('Early Adopter', 'One of the first 100 users to join Sayonika', 'fas fa-seedling', 25, 'special', 'user_id', 100, FALSE),
('Veteran', 'Member for over 1 year', 'fas fa-medal', 50, 'special', 'account_age_days', 365, FALSE),
('Perfectionist', 'Have a mod with 5-star average rating (min 10 ratings)', 'fas fa-gem', 75, 'special', 'perfect_rating', 1, FALSE),

-- Hidden achievements
('Bug Hunter', 'Report a critical bug that gets fixed', 'fas fa-bug', 30, 'special', 'manual', 1, TRUE),
('Beta Tester', 'Participate in beta testing new features', 'fas fa-flask', 40, 'special', 'manual', 1, TRUE),
('Community Champion', 'Help moderate the community', 'fas fa-shield-alt', 100, 'special', 'manual', 1, TRUE);
