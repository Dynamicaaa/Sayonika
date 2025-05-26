const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { deleteAvatarFile } = require('../utils/helpers');
const fs = require('fs');
const MigrationManager = require('./migrations');
const emailService = require('../utils/emailService');
const crypto = require('crypto');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, 'sayonika.db');
        this.db = null;
        this.migrationManager = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err.message);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.db.run('PRAGMA foreign_keys = ON');
                    resolve();
                }
            });
        });
    }

    async initialize() {
        try {
            await this.connect();

            // Initialize migration manager
            this.migrationManager = new MigrationManager(this);

            // Check if this is a fresh database
            const isFreshDatabase = await this.isFreshDatabase();

            if (isFreshDatabase) {
                console.log('Fresh database detected, running initial schema...');
                // Run the initial schema for fresh databases
                const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

                await new Promise((resolve, reject) => {
                    this.db.exec(schema, (err) => {
                        if (err) {
                            console.error('Error initializing database:', err.message);
                            reject(err);
                        } else {
                            console.log('Initial schema applied successfully');
                            resolve();
                        }
                    });
                });

                // Mark all existing migrations as applied for fresh databases
                await this.migrationManager.initialize();
                await this.markExistingMigrationsAsApplied();
            } else {
                console.log('Existing database detected, running migrations...');
                // For existing databases, just run pending migrations
                await this.migrationManager.runPendingMigrations();
            }

            console.log('Database initialization completed');
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    async isFreshDatabase() {
        try {
            // Check if the users table exists (core table that should always exist)
            const result = await this.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
            );
            return !result;
        } catch (error) {
            // If we can't check, assume it's fresh
            return true;
        }
    }

    async markExistingMigrationsAsApplied() {
        // For fresh databases with initial schema, mark migrations as applied
        // so they don't run again
        const migrationFiles = require('fs').readdirSync(path.join(__dirname, 'migrations'))
            .filter(file => file.endsWith('.sql'))
            .sort();

        for (const filename of migrationFiles) {
            try {
                await this.run(
                    'INSERT OR IGNORE INTO migrations (filename) VALUES (?)',
                    [filename]
                );
            } catch (error) {
                console.warn(`Could not mark migration as applied: ${filename}`, error.message);
            }
        }
    }

    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('Database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    // User methods
    async createUser(userData) {
        const { username, email, password_hash, display_name, is_admin = false, avatar_url = null } = userData;

        // Check if this is the first user (should be owner)
        const userCount = await this.get('SELECT COUNT(*) as count FROM users');
        const isFirstUser = userCount.count === 0;

        const sql = `
            INSERT INTO users (username, email, password_hash, display_name, avatar_url, is_admin, is_owner, is_verified)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        // First user is automatically admin, owner, and verified
        const is_owner = isFirstUser;
        const final_is_admin = isFirstUser || is_admin;
        const is_verified = final_is_admin ? true : false;

        return await this.run(sql, [username, email, password_hash, display_name, avatar_url, final_is_admin, is_owner, is_verified]);
    }

    async getUserByUsername(username) {
        const sql = 'SELECT * FROM users WHERE username = ?';
        return await this.get(sql, [username]);
    }

    async getUserByEmail(email) {
        const sql = 'SELECT * FROM users WHERE email = ?';
        return await this.get(sql, [email]);
    }

    async getUserById(id) {
        const sql = 'SELECT * FROM users WHERE id = ?';
        return await this.get(sql, [id]);
    }

    // User management methods
    async getUsers(filters = {}) {
        let sql = `
            SELECT id, username, email, display_name, avatar_url, bio,
                   is_admin, is_owner, is_verified, created_at, last_login,
                   github_username, discord_username
            FROM users
            WHERE 1=1
        `;
        const params = [];

        if (filters.search) {
            sql += ' AND (username LIKE ? OR email LIKE ? OR display_name LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (filters.role === 'admin') {
            sql += ' AND is_admin = 1';
        } else if (filters.role === 'verified') {
            sql += ' AND is_verified = 1 AND is_admin = 0';
        } else if (filters.role === 'regular') {
            sql += ' AND is_admin = 0 AND is_verified = 0';
        }

        sql += ' ORDER BY created_at DESC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        return await this.all(sql, params);
    }

    async updateUserRole(userId, roleData) {
        const { is_admin, is_verified } = roleData;
        const sql = `
            UPDATE users
            SET is_admin = ?, is_verified = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return await this.run(sql, [is_admin, is_verified, userId]);
    }

    async deleteUser(userId) {
        // Check if user is owner
        const user = await this.getUserById(userId);
        if (user && user.is_owner) {
            throw new Error('Cannot delete the site owner');
        }

        // Clean up user's avatar file if it exists
        if (user && user.avatar_url) {
            await deleteAvatarFile(user.avatar_url, 'database user deletion');
        }

        const sql = 'DELETE FROM users WHERE id = ?';
        return await this.run(sql, [userId]);
    }

    async getUserStats(userId) {
        const stats = {};

        // Get mod count
        const modCount = await this.get('SELECT COUNT(*) as count FROM mods WHERE author_id = ?', [userId]);
        stats.totalMods = modCount.count;

        // Get published mod count
        const publishedCount = await this.get('SELECT COUNT(*) as count FROM mods WHERE author_id = ? AND is_published = 1', [userId]);
        stats.publishedMods = publishedCount.count;

        // Get total downloads
        const downloads = await this.get('SELECT SUM(download_count) as count FROM mods WHERE author_id = ?', [userId]);
        stats.totalDownloads = downloads.count || 0;

        return stats;
    }

    // Mod methods
    async createMod(modData) {
        const {
            title, slug, description, short_description, author_id,
            category_id, version, file_path, file_size, thumbnail_url,
            screenshots, tags, requirements, is_nsfw
        } = modData;

        const sql = `
            INSERT INTO mods (
                title, slug, description, short_description, author_id,
                category_id, version, file_path, file_size, thumbnail_url,
                screenshots, tags, requirements, is_nsfw
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        return await this.run(sql, [
            title, slug, description, short_description, author_id,
            category_id, version, file_path, file_size, thumbnail_url,
            JSON.stringify(screenshots), JSON.stringify(tags),
            JSON.stringify(requirements), is_nsfw
        ]);
    }

    async getModById(id) {
        const sql = `
            SELECT m.*, u.username as author_username, u.display_name as author_display_name,
                   u.avatar_url as author_avatar_url, c.name as category_name, c.color as category_color
            FROM mods m
            LEFT JOIN users u ON m.author_id = u.id
            LEFT JOIN categories c ON m.category_id = c.id
            WHERE m.id = ?
        `;
        return await this.get(sql, [id]);
    }

    async getModBySlug(slug) {
        const sql = `
            SELECT m.*, u.username as author_username, u.display_name as author_display_name,
                   u.avatar_url as author_avatar_url, c.name as category_name, c.color as category_color
            FROM mods m
            LEFT JOIN users u ON m.author_id = u.id
            LEFT JOIN categories c ON m.category_id = c.id
            WHERE m.slug = ?
        `;
        return await this.get(sql, [slug]);
    }

    async getMods(filters = {}) {
        let sql = `
            SELECT m.*, u.username as author_username, u.display_name as author_display_name,
                   u.avatar_url as author_avatar_url, c.name as category_name, c.color as category_color
            FROM mods m
            LEFT JOIN users u ON m.author_id = u.id
            LEFT JOIN categories c ON m.category_id = c.id
            WHERE m.is_published = 1
        `;

        const params = [];

        if (filters.category_id) {
            sql += ' AND m.category_id = ?';
            params.push(filters.category_id);
        }

        if (filters.search) {
            sql += ' AND (m.title LIKE ? OR m.description LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }

        if (filters.featured) {
            sql += ' AND m.is_featured = 1';
        }

        // Default ordering
        sql += ' ORDER BY m.created_at DESC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        return await this.all(sql, params);
    }

    async getCategories() {
        const sql = 'SELECT * FROM categories ORDER BY name';
        return await this.all(sql);
    }

    async incrementDownloadCount(modId) {
        const sql = 'UPDATE mods SET download_count = download_count + 1 WHERE id = ?';
        return await this.run(sql, [modId]);
    }

    async recordDownload(modId, userId = null, ipAddress = null, userAgent = null) {
        const sql = `
            INSERT INTO downloads (mod_id, user_id, ip_address, user_agent)
            VALUES (?, ?, ?, ?)
        `;

        const result = await this.run(sql, [modId, userId, ipAddress, userAgent]);

        // Check for download achievements for the mod author
        const mod = await this.getModById(modId);
        if (mod && mod.author_id) {
            const totalDownloads = await this.get(
                'SELECT SUM(download_count) as total FROM mods WHERE author_id = ? AND is_published = 1',
                [mod.author_id]
            );

            if (totalDownloads && totalDownloads.total) {
                await this.checkAndAwardAchievement(mod.author_id, 'total_downloads', totalDownloads.total);
            }
        }

        return result;
    }

    // Admin methods for mod review
    async getPendingMods() {
        console.log(`[Database] Fetching pending mods`);

        const sql = `
            SELECT DISTINCT m.*, u.username as author_username, u.display_name as author_display_name,
                   u.avatar_url as author_avatar_url, c.name as category_name, c.color as category_color
            FROM mods m
            LEFT JOIN users u ON m.author_id = u.id
            LEFT JOIN categories c ON m.category_id = c.id
            LEFT JOIN mod_reviews mr ON m.id = mr.mod_id
            WHERE m.is_published = 0 AND mr.id IS NULL
            ORDER BY m.created_at ASC
        `;

        const result = await this.all(sql);
        console.log(`[Database] Found ${result.length} pending mods (excluding already reviewed)`);

        if (result.length > 0) {
            console.log(`[Database] First pending mod:`, {
                id: result[0].id,
                title: result[0].title,
                author: result[0].author_username,
                created_at: result[0].created_at
            });
        }

        return result;
    }

    async createModReview(modId, adminId, status, reason = null) {
        console.log(`[Database] Creating mod review - Mod ID: ${modId}, Admin ID: ${adminId}, Status: ${status}`);

        const sql = `
            INSERT INTO mod_reviews (mod_id, admin_id, status, reason)
            VALUES (?, ?, ?, ?)
        `;

        const result = await this.run(sql, [modId, adminId, status, reason]);
        console.log(`[Database] Mod review created with ID: ${result.lastID}`);

        return result;
    }

    async getModReviews(modId) {
        const sql = `
            SELECT mr.*, u.username as admin_username, u.display_name as admin_display_name
            FROM mod_reviews mr
            LEFT JOIN users u ON mr.admin_id = u.id
            WHERE mr.mod_id = ?
            ORDER BY mr.created_at DESC
        `;
        return await this.all(sql, [modId]);
    }

    async approveModReview(modId, adminId, reason = null) {
        console.log(`[Database] Starting mod approval - Mod ID: ${modId}, Admin ID: ${adminId}`);

        try {
            await this.run('BEGIN TRANSACTION');
            console.log(`[Database] Started transaction for mod approval`);

            // Get mod details for notification
            const mod = await this.getModById(modId);
            if (!mod) {
                throw new Error('Mod not found');
            }

            // Update mod to published
            console.log(`[Database] Updating mod ${modId} to published status`);
            const updateResult = await this.run(
                'UPDATE mods SET is_published = 1, published_at = CURRENT_TIMESTAMP WHERE id = ?',
                [modId]
            );
            console.log(`[Database] Mod update result:`, updateResult);

            // Create review record
            console.log(`[Database] Creating approval review record`);
            const reviewResult = await this.createModReview(modId, adminId, 'approved', reason);
            console.log(`[Database] Review record created:`, reviewResult);

            // Check for mod upload achievements
            const userModCount = await this.get(
                'SELECT COUNT(*) as count FROM mods WHERE author_id = ? AND is_published = 1',
                [mod.author_id]
            );
            await this.checkAndAwardAchievement(mod.author_id, 'mod_upload', userModCount.count, false);

            // Create notification for the mod author
            const notificationTitle = `Mod "${mod.title}" Approved!`;
            const notificationMessage = reason
                ? `Your mod has been approved and is now live on Sayonika! Admin note: ${reason}`
                : `Your mod has been approved and is now live on Sayonika!`;

            await this.createNotification(mod.author_id, 'mod_approved', notificationTitle, notificationMessage, modId);
            console.log(`[Database] Approval notification sent to user ${mod.author_id}`);

            // Send email notification if user has email notifications enabled
            const author = await this.getUserById(mod.author_id);
            if (author && author.email && author.email_verified && author.email_mod_approved) {
                try {
                    await emailService.sendModApprovalEmail(
                        author.email,
                        author.username,
                        mod.title,
                        modId,
                        reason
                    );
                    console.log(`[Database] Approval email sent to ${author.email}`);
                } catch (emailError) {
                    console.error(`[Database] Failed to send approval email:`, emailError);
                }
            }

            await this.run('COMMIT');
            console.log(`[Database] Transaction committed successfully for mod ${modId}`);

            return { success: true };
        } catch (error) {
            console.error(`[Database] Error in approveModReview for mod ${modId}:`, error);
            await this.run('ROLLBACK');
            console.log(`[Database] Transaction rolled back due to error`);
            throw error;
        }
    }

    async rejectModReview(modId, adminId, reason = null) {
        console.log(`[Database] Starting mod rejection and removal - Mod ID: ${modId}, Admin ID: ${adminId}`);

        try {
            await this.run('BEGIN TRANSACTION');
            console.log(`[Database] Started transaction for mod rejection and removal`);

            // Get mod details for notification and file cleanup
            const mod = await this.getModById(modId);
            if (!mod) {
                throw new Error('Mod not found');
            }

            // Create notification for the mod author before deletion
            const notificationTitle = `Mod "${mod.title}" Rejected and Removed`;
            const notificationMessage = reason
                ? `Your mod has been rejected and removed from Sayonika. Reason: ${reason}. You can create a new mod submission with the necessary changes.`
                : `Your mod has been rejected and removed from Sayonika. Please review our guidelines and create a new mod submission with necessary changes.`;

            await this.createNotification(mod.author_id, 'mod_rejected', notificationTitle, notificationMessage, null);
            console.log(`[Database] Rejection notification sent to user ${mod.author_id}`);

            // Send email notification if user has email notifications enabled
            const author = await this.getUserById(mod.author_id);
            if (author && author.email && author.email_verified && author.email_mod_approved) {
                try {
                    await emailService.sendModRejectionEmail(
                        author.email,
                        author.username,
                        mod.title,
                        reason
                    );
                    console.log(`[Database] Rejection email sent to ${author.email}`);
                } catch (emailError) {
                    console.error(`[Database] Failed to send rejection email:`, emailError);
                }
            }

            // Delete mod files from filesystem
            const { deleteModFiles } = require('../utils/helpers');
            const fileCleanupSuccess = await deleteModFiles(mod.file_path, mod.thumbnail_url, 'mod rejection');
            if (!fileCleanupSuccess) {
                console.warn(`[Database] Some mod files could not be deleted for mod ${modId}, but continuing with database deletion`);
            }

            // Delete the mod from database (this will cascade delete related records)
            console.log(`[Database] Deleting mod ${modId} from database`);
            const deleteResult = await this.run('DELETE FROM mods WHERE id = ?', [modId]);
            console.log(`[Database] Mod deletion result:`, deleteResult);

            await this.run('COMMIT');
            console.log(`[Database] Transaction committed successfully - mod ${modId} has been completely removed`);

            return { success: true, removed: true };
        } catch (error) {
            console.error(`[Database] Error in rejectModReview for mod ${modId}:`, error);
            await this.run('ROLLBACK');
            console.log(`[Database] Transaction rolled back due to error`);
            throw error;
        }
    }

    // Enhanced mod management methods
    async getAllModsForAdmin(filters = {}) {
        let sql = `
            SELECT m.*, u.username as author_username, u.display_name as author_display_name,
                   u.avatar_url as author_avatar_url, c.name as category_name, c.color as category_color
            FROM mods m
            LEFT JOIN users u ON m.author_id = u.id
            LEFT JOIN categories c ON m.category_id = c.id
            WHERE 1=1
        `;
        const params = [];

        // Apply filters
        if (filters.search) {
            sql += ' AND (m.title LIKE ? OR m.description LIKE ? OR u.username LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (filters.status === 'published') {
            sql += ' AND m.is_published = 1';
        } else if (filters.status === 'pending') {
            sql += ' AND m.is_published = 0';
        }

        if (filters.featured === 'true') {
            sql += ' AND m.is_featured = 1';
        } else if (filters.featured === 'false') {
            sql += ' AND m.is_featured = 0';
        }

        if (filters.category_id) {
            sql += ' AND m.category_id = ?';
            params.push(filters.category_id);
        }

        if (filters.author_id) {
            sql += ' AND m.author_id = ?';
            params.push(filters.author_id);
        }

        // Sorting
        const sortBy = filters.sort_by || 'created_at';
        const sortOrder = filters.sort_order === 'asc' ? 'ASC' : 'DESC';
        sql += ` ORDER BY m.${sortBy} ${sortOrder}`;

        // Pagination
        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(parseInt(filters.limit));

            if (filters.offset) {
                sql += ' OFFSET ?';
                params.push(parseInt(filters.offset));
            }
        }

        return await this.all(sql, params);
    }

    async getModCountForAdmin(filters = {}) {
        let sql = `
            SELECT COUNT(*) as count
            FROM mods m
            LEFT JOIN users u ON m.author_id = u.id
            WHERE 1=1
        `;
        const params = [];

        // Apply same filters as getAllModsForAdmin
        if (filters.search) {
            sql += ' AND (m.title LIKE ? OR m.description LIKE ? OR u.username LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (filters.status === 'published') {
            sql += ' AND m.is_published = 1';
        } else if (filters.status === 'pending') {
            sql += ' AND m.is_published = 0';
        }

        if (filters.featured === 'true') {
            sql += ' AND m.is_featured = 1';
        } else if (filters.featured === 'false') {
            sql += ' AND m.is_featured = 0';
        }

        if (filters.category_id) {
            sql += ' AND m.category_id = ?';
            params.push(filters.category_id);
        }

        if (filters.author_id) {
            sql += ' AND m.author_id = ?';
            params.push(filters.author_id);
        }

        const result = await this.get(sql, params);
        return result.count;
    }

    async updateMod(modId, modData) {
        const {
            title, description, short_description, category_id,
            version, is_nsfw, tags, requirements
        } = modData;

        const sql = `
            UPDATE mods
            SET title = ?, description = ?, short_description = ?, category_id = ?,
                version = ?, is_nsfw = ?, tags = ?, requirements = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        return await this.run(sql, [
            title, description, short_description, category_id,
            version, is_nsfw, JSON.stringify(tags), JSON.stringify(requirements), modId
        ]);
    }

    async deleteMod(modId) {
        // Get mod details for file cleanup
        const mod = await this.getModById(modId);
        if (mod) {
            // Delete mod files from filesystem
            const { deleteModFiles } = require('../utils/helpers');
            await deleteModFiles(mod.file_path, mod.thumbnail_url, 'mod deletion');
        }

        // This will cascade delete related records due to foreign key constraints
        const sql = 'DELETE FROM mods WHERE id = ?';
        return await this.run(sql, [modId]);
    }

    async getUserModsWithDetails(userId, filters = {}) {
        let sql = `
            SELECT m.*, c.name as category_name, c.color as category_color
            FROM mods m
            LEFT JOIN categories c ON m.category_id = c.id
            WHERE m.author_id = ?
        `;
        const params = [userId];

        if (filters.status === 'published') {
            sql += ' AND m.is_published = 1';
        } else if (filters.status === 'pending') {
            sql += ' AND m.is_published = 0';
        }

        sql += ' ORDER BY m.created_at DESC';

        return await this.all(sql, params);
    }

    async getAdminStats() {
        const stats = {};

        // Total mods
        const totalMods = await this.get('SELECT COUNT(*) as count FROM mods');
        stats.totalMods = totalMods.count;

        // Published mods
        const publishedMods = await this.get('SELECT COUNT(*) as count FROM mods WHERE is_published = 1');
        stats.publishedMods = publishedMods.count;

        // Pending mods (excluding already reviewed mods)
        const pendingMods = await this.get(`
            SELECT COUNT(DISTINCT m.id) as count
            FROM mods m
            LEFT JOIN mod_reviews mr ON m.id = mr.mod_id
            WHERE m.is_published = 0 AND mr.id IS NULL
        `);
        stats.pendingMods = pendingMods.count;

        // Total users
        const totalUsers = await this.get('SELECT COUNT(*) as count FROM users');
        stats.totalUsers = totalUsers.count;

        // Total downloads
        const totalDownloads = await this.get('SELECT SUM(download_count) as count FROM mods');
        stats.totalDownloads = totalDownloads.count || 0;

        return stats;
    }

    // Migration management methods
    async runMigrations() {
        if (!this.migrationManager) {
            this.migrationManager = new MigrationManager(this);
        }
        return await this.migrationManager.runPendingMigrations();
    }

    async createMigration(name, sql) {
        if (!this.migrationManager) {
            this.migrationManager = new MigrationManager(this);
        }
        return await this.migrationManager.createMigration(name, sql);
    }

    async listMigrations() {
        if (!this.migrationManager) {
            this.migrationManager = new MigrationManager(this);
        }
        return await this.migrationManager.listMigrations();
    }

    async getSchemaVersion() {
        if (!this.migrationManager) {
            this.migrationManager = new MigrationManager(this);
        }
        return await this.migrationManager.getSchemaVersion();
    }

    async rollbackMigration(filename) {
        if (!this.migrationManager) {
            this.migrationManager = new MigrationManager(this);
        }
        return await this.migrationManager.rollbackMigration(filename);
    }

    // Notification methods
    async createNotification(userId, type, title, message, relatedId = null) {
        console.log(`[Database] Creating notification for user ${userId}: ${type} - ${title}`);

        const sql = `
            INSERT INTO notifications (user_id, type, title, message, related_id)
            VALUES (?, ?, ?, ?, ?)
        `;

        const result = await this.run(sql, [userId, type, title, message, relatedId]);
        console.log(`[Database] Notification created with ID: ${result.lastID}`);

        return result;
    }

    async getUserNotifications(userId, unreadOnly = false) {
        let sql = `
            SELECT * FROM notifications
            WHERE user_id = ?
        `;

        if (unreadOnly) {
            sql += ' AND is_read = 0';
        }

        sql += ' ORDER BY created_at DESC';

        return await this.all(sql, [userId]);
    }

    async getUnreadNotificationCount(userId) {
        const sql = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0';
        const result = await this.get(sql, [userId]);
        return result.count;
    }

    async markNotificationAsRead(notificationId) {
        const sql = 'UPDATE notifications SET is_read = 1 WHERE id = ?';
        return await this.run(sql, [notificationId]);
    }

    async markAllNotificationsAsRead(userId) {
        const sql = 'UPDATE notifications SET is_read = 1 WHERE user_id = ?';
        return await this.run(sql, [userId]);
    }

    async deleteNotification(notificationId) {
        const sql = 'DELETE FROM notifications WHERE id = ?';
        return await this.run(sql, [notificationId]);
    }

    // Achievement methods
    async getAchievements(includeHidden = false) {
        let sql = 'SELECT * FROM achievements';
        if (!includeHidden) {
            sql += ' WHERE is_hidden = 0';
        }
        sql += ' ORDER BY category, points ASC';
        return await this.all(sql);
    }

    async getUserAchievements(userId) {
        const sql = `
            SELECT a.*, ua.earned_at
            FROM achievements a
            INNER JOIN user_achievements ua ON a.id = ua.achievement_id
            WHERE ua.user_id = ?
            ORDER BY ua.earned_at DESC
        `;
        return await this.all(sql, [userId]);
    }

    async checkAndAwardAchievement(userId, achievementType, currentValue, useTransaction = true) {
        console.log(`[Database] Checking achievements for user ${userId}, type: ${achievementType}, value: ${currentValue}`);

        // Get all achievements of this type that the user hasn't earned yet
        const sql = `
            SELECT a.* FROM achievements a
            LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
            WHERE a.requirement_type = ? AND a.requirement_value <= ? AND ua.id IS NULL
            ORDER BY a.requirement_value ASC
        `;

        const eligibleAchievements = await this.all(sql, [userId, achievementType, currentValue]);

        for (const achievement of eligibleAchievements) {
            await this.awardAchievement(userId, achievement.id, useTransaction);
        }

        return eligibleAchievements;
    }

    async awardAchievement(userId, achievementId, useTransaction = true) {
        try {
            if (useTransaction) {
                await this.run('BEGIN TRANSACTION');
            }

            // Award the achievement
            await this.run(
                'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
                [userId, achievementId]
            );

            // Get achievement details
            const achievement = await this.get('SELECT * FROM achievements WHERE id = ?', [achievementId]);

            if (achievement) {
                // Update user's achievement points and level
                await this.run(
                    'UPDATE users SET achievement_points = achievement_points + ? WHERE id = ?',
                    [achievement.points, userId]
                );

                // Calculate new level and title
                await this.updateUserLevel(userId);

                // Create notification
                await this.createNotification(
                    userId,
                    'achievement',
                    `Achievement Unlocked: ${achievement.name}!`,
                    `You've earned "${achievement.name}" - ${achievement.description} (+${achievement.points} points)`,
                    achievementId
                );

                console.log(`[Database] Achievement "${achievement.name}" awarded to user ${userId}`);

                // Send email notification if user has email notifications enabled
                const user = await this.getUserById(userId);
                if (user && user.email && user.email_verified && user.email_achievements) {
                    try {
                        await emailService.sendAchievementEmail(
                            user.email,
                            user.username,
                            achievement.name,
                            achievement.description,
                            achievement.points
                        );
                        console.log(`[Database] Achievement email sent to ${user.email}`);
                    } catch (emailError) {
                        console.error(`[Database] Failed to send achievement email:`, emailError);
                    }
                }
            }

            if (useTransaction) {
                await this.run('COMMIT');
            }
            return { success: true, achievement };
        } catch (error) {
            if (useTransaction) {
                await this.run('ROLLBACK');
            }
            console.error(`[Database] Error awarding achievement:`, error);
            throw error;
        }
    }

    async updateUserLevel(userId) {
        const user = await this.getUserById(userId);
        if (!user) return;

        const points = user.achievement_points;
        const oldLevel = user.user_level;
        const oldTitle = user.user_title;
        let level = 1;
        let title = 'Newcomer';

        // Level calculation based on points
        if (points >= 1000) {
            level = 10;
            title = 'Legendary Modder';
        } else if (points >= 500) {
            level = 9;
            title = 'Master Creator';
        } else if (points >= 300) {
            level = 8;
            title = 'Expert Modder';
        } else if (points >= 200) {
            level = 7;
            title = 'Skilled Creator';
        } else if (points >= 150) {
            level = 6;
            title = 'Experienced Modder';
        } else if (points >= 100) {
            level = 5;
            title = 'Seasoned Creator';
        } else if (points >= 75) {
            level = 4;
            title = 'Rising Modder';
        } else if (points >= 50) {
            level = 3;
            title = 'Active Creator';
        } else if (points >= 25) {
            level = 2;
            title = 'Aspiring Modder';
        }

        await this.run(
            'UPDATE users SET user_level = ?, user_title = ? WHERE id = ?',
            [level, title, userId]
        );

        // Send notification if user leveled up
        if (level > oldLevel) {
            await this.createNotification(
                userId,
                'achievement',
                `Level Up! You're now Level ${level}!`,
                `Congratulations! You've reached Level ${level} and earned the title "${title}". Keep up the great work!`,
                null
            );
            console.log(`[Database] User ${userId} leveled up from ${oldLevel} to ${level}`);
        }
    }

    // Comment methods
    async createComment(modId, userId, content, parentId = null) {
        const sql = `
            INSERT INTO mod_comments (mod_id, user_id, content, parent_id)
            VALUES (?, ?, ?, ?)
        `;

        const result = await this.run(sql, [modId, userId, content, parentId]);

        // Check for comment count achievements
        const commentCount = await this.getUserCommentCount(userId);
        await this.checkAndAwardAchievement(userId, 'comment_count', commentCount);

        return result;
    }

    async getModComments(modId, includeDeleted = false) {
        let sql = `
            SELECT mc.*, u.username, u.display_name, u.avatar_url, u.user_title, u.user_level
            FROM mod_comments mc
            INNER JOIN users u ON mc.user_id = u.id
            WHERE mc.mod_id = ?
        `;

        if (!includeDeleted) {
            sql += ' AND mc.is_deleted = 0';
        }

        sql += ' ORDER BY mc.created_at ASC';

        return await this.all(sql, [modId]);
    }

    async getUserCommentCount(userId) {
        const result = await this.get(
            'SELECT COUNT(*) as count FROM mod_comments WHERE user_id = ? AND is_deleted = 0',
            [userId]
        );
        return result.count;
    }

    async deleteComment(commentId, userId) {
        // Soft delete - mark as deleted instead of removing
        const sql = 'UPDATE mod_comments SET is_deleted = 1 WHERE id = ? AND user_id = ?';
        return await this.run(sql, [commentId, userId]);
    }

    async updateComment(commentId, userId, content) {
        const sql = `
            UPDATE mod_comments
            SET content = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ? AND is_deleted = 0
        `;
        return await this.run(sql, [content, commentId, userId]);
    }

    // Enhanced user stats for gamification
    async getUserGameStats(userId) {
        const stats = await this.getUserStats(userId);

        // Get achievement stats
        const achievementStats = await this.get(`
            SELECT COUNT(*) as earned_count, COALESCE(SUM(a.points), 0) as total_points
            FROM user_achievements ua
            INNER JOIN achievements a ON ua.achievement_id = a.id
            WHERE ua.user_id = ?
        `, [userId]);

        // Get comment count
        const commentCount = await this.getUserCommentCount(userId);

        // Get user level info
        const user = await this.getUserById(userId);

        return {
            ...stats,
            achievementsEarned: achievementStats.earned_count,
            achievementPoints: achievementStats.total_points,
            commentsPosted: commentCount,
            userLevel: user.user_level,
            userTitle: user.user_title
        };
    }

    // Leaderboard methods
    async getTopUsers(limit = 10, sortBy = 'achievement_points') {
        const validSortFields = ['achievement_points', 'user_level', 'created_at'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'achievement_points';

        const sql = `
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.user_level, u.user_title, u.achievement_points,
                   COUNT(DISTINCT m.id) as mod_count,
                   COALESCE(SUM(m.download_count), 0) as total_downloads
            FROM users u
            LEFT JOIN mods m ON u.id = m.author_id AND m.is_published = 1
            WHERE u.is_admin = 0
            GROUP BY u.id
            ORDER BY u.${sortField} DESC
            LIMIT ?
        `;

        return await this.all(sql, [limit]);
    }

    // Email verification methods
    async generateEmailVerificationToken(userId) {
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await this.run(
            'UPDATE users SET email_verification_token = ?, email_verification_expires = ? WHERE id = ?',
            [token, expires.toISOString(), userId]
        );

        return token;
    }

    async verifyEmailToken(token) {
        const user = await this.get(
            'SELECT * FROM users WHERE email_verification_token = ? AND email_verification_expires > ?',
            [token, new Date().toISOString()]
        );

        if (user) {
            await this.run(
                'UPDATE users SET email_verified = 1, email_verification_token = NULL, email_verification_expires = NULL WHERE id = ?',
                [user.id]
            );
            return user;
        }

        return null;
    }

    async sendVerificationEmail(userId) {
        const user = await this.getUserById(userId);
        if (!user || !user.email) {
            return { success: false, error: 'User not found or no email address' };
        }

        if (user.email_verified) {
            return { success: false, error: 'Email already verified' };
        }

        const token = await this.generateEmailVerificationToken(userId);
        return await emailService.sendVerificationEmail(user.email, user.username, token);
    }

    // Email notification preferences
    async updateEmailPreferences(userId, preferences) {
        const sql = `
            UPDATE users SET
                email_notifications_enabled = ?,
                email_mod_approved = ?,
                email_achievements = ?,
                email_comments = ?
            WHERE id = ?
        `;

        return await this.run(sql, [
            preferences.email_notifications_enabled ? 1 : 0,
            preferences.email_mod_approved ? 1 : 0,
            preferences.email_achievements ? 1 : 0,
            preferences.email_comments ? 1 : 0,
            userId
        ]);
    }

    async getUserEmailPreferences(userId) {
        const sql = `
            SELECT email_notifications_enabled, email_mod_approved, email_achievements, email_comments
            FROM users WHERE id = ?
        `;
        return await this.get(sql, [userId]);
    }

    // Support tickets methods
    async createSupportTicket(ticketData) {
        const { user_id, name, email, subject, message, priority = 'medium' } = ticketData;

        const sql = `
            INSERT INTO support_tickets (user_id, name, email, subject, message, priority)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        return await this.run(sql, [user_id, name, email, subject, message, priority]);
    }

    async getSupportTickets(filters = {}) {
        let sql = `
            SELECT st.*, u.username, u.display_name
            FROM support_tickets st
            LEFT JOIN users u ON st.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.status) {
            sql += ' AND st.status = ?';
            params.push(filters.status);
        }

        if (filters.priority) {
            sql += ' AND st.priority = ?';
            params.push(filters.priority);
        }

        if (filters.search) {
            sql += ' AND (st.subject LIKE ? OR st.message LIKE ? OR st.name LIKE ? OR st.email LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY st.created_at DESC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        return await this.all(sql, params);
    }

    async getSupportTicketById(id) {
        const sql = `
            SELECT st.*, u.username, u.display_name, u.avatar_url
            FROM support_tickets st
            LEFT JOIN users u ON st.user_id = u.id
            WHERE st.id = ?
        `;
        return await this.get(sql, [id]);
    }

    async updateSupportTicketStatus(id, status) {
        const sql = 'UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        return await this.run(sql, [status, id]);
    }

    async deleteSupportTicket(id) {
        const sql = 'DELETE FROM support_tickets WHERE id = ?';
        return await this.run(sql, [id]);
    }

    async getAdminEmails() {
        const sql = 'SELECT email FROM users WHERE (is_admin = 1 OR is_owner = 1) AND email IS NOT NULL';
        const admins = await this.all(sql);
        return admins.map(admin => admin.email);
    }

    // Site settings methods
    async getSiteSetting(key) {
        const sql = 'SELECT setting_value, setting_type FROM site_settings WHERE setting_key = ?';
        const result = await this.get(sql, [key]);

        if (!result) {
            return null;
        }

        // Convert value based on type
        switch (result.setting_type) {
            case 'boolean':
                return result.setting_value === 'true';
            case 'number':
                return parseFloat(result.setting_value);
            case 'json':
                try {
                    return JSON.parse(result.setting_value);
                } catch (e) {
                    return result.setting_value;
                }
            default:
                return result.setting_value;
        }
    }

    async setSiteSetting(key, value, type = 'string') {
        let stringValue;

        // Convert value to string based on type
        switch (type) {
            case 'boolean':
                stringValue = value ? 'true' : 'false';
                break;
            case 'number':
                stringValue = value.toString();
                break;
            case 'json':
                stringValue = JSON.stringify(value);
                break;
            default:
                stringValue = value.toString();
        }

        const sql = `
            INSERT OR REPLACE INTO site_settings (setting_key, setting_value, setting_type, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `;

        return await this.run(sql, [key, stringValue, type]);
    }

    async getAllSiteSettings() {
        const sql = 'SELECT setting_key, setting_value, setting_type, description FROM site_settings ORDER BY setting_key';
        const results = await this.all(sql);

        const settings = {};
        for (const result of results) {
            // Convert value based on type
            switch (result.setting_type) {
                case 'boolean':
                    settings[result.setting_key] = result.setting_value === 'true';
                    break;
                case 'number':
                    settings[result.setting_key] = parseFloat(result.setting_value);
                    break;
                case 'json':
                    try {
                        settings[result.setting_key] = JSON.parse(result.setting_value);
                    } catch (e) {
                        settings[result.setting_key] = result.setting_value;
                    }
                    break;
                default:
                    settings[result.setting_key] = result.setting_value;
            }
        }

        return settings;
    }

    async isMaintenanceMode() {
        const maintenanceMode = await this.getSiteSetting('maintenance_mode');
        return maintenanceMode === true;
    }


}

module.exports = Database;
