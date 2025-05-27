const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { body, validationResult, query } = require('express-validator');
const Database = require('../database/database');
const { authenticateToken, requireAuth, requireAdmin, requireOwner, optionalAuth } = require('../middleware/auth');
const { deleteAvatarFile, generateDefaultThumbnail } = require('../utils/helpers');
const emailService = require('../utils/emailService');

const router = express.Router();
const db = new Database();

// Import image routes
const imageRoutes = require('./api/images');
router.use('/images', imageRoutes);

// Initialize database connection
db.connect().catch(console.error);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/mods');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Create dynamic multer upload middleware
const createUploadMiddleware = async () => {
    try {
        const maxFileSizeMB = await db.getSiteSetting('max_file_size_mb') || 100;
        const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

        return multer({
            storage: storage,
            limits: {
                fileSize: maxFileSizeBytes
            },
            fileFilter: (req, file, cb) => {
                const ext = path.extname(file.originalname).toLowerCase();

                if (file.fieldname === 'modFile') {
                    const allowedModTypes = ['.zip', '.rar', '.7z'];
                    if (allowedModTypes.includes(ext)) {
                        cb(null, true);
                    } else {
                        cb(new Error('Only .zip, .rar, and .7z files are allowed for mod files'));
                    }
                } else if (file.fieldname === 'thumbnail') {
                    const allowedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
                    if (allowedImageTypes.includes(ext)) {
                        cb(null, true);
                    } else {
                        cb(new Error('Only image files (JPG, JPEG, PNG, GIF, WebP) are allowed for thumbnails'));
                    }
                } else {
                    cb(new Error('Unexpected field'));
                }
            }
        });
    } catch (error) {
        console.error('Error creating upload middleware:', error);
        // Fallback to default 100MB limit
        return multer({
            storage: storage,
            limits: {
                fileSize: 100 * 1024 * 1024 // 100MB fallback limit
            },
            fileFilter: (req, file, cb) => {
                const ext = path.extname(file.originalname).toLowerCase();

                if (file.fieldname === 'modFile') {
                    const allowedModTypes = ['.zip', '.rar', '.7z'];
                    if (allowedModTypes.includes(ext)) {
                        cb(null, true);
                    } else {
                        cb(new Error('Only .zip, .rar, and .7z files are allowed for mod files'));
                    }
                } else if (file.fieldname === 'thumbnail') {
                    const allowedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
                    if (allowedImageTypes.includes(ext)) {
                        cb(null, true);
                    } else {
                        cb(new Error('Only image files (JPG, JPEG, PNG, GIF, WebP) are allowed for thumbnails'));
                    }
                } else {
                    cb(new Error('Unexpected field'));
                }
            }
        });
    }
};

// Get all mods
router.get('/mods', [
    query('category').optional().isInt().withMessage('Category must be a number'),
    query('search').optional().isLength({ max: 100 }).withMessage('Search term too long'),
    query('featured').optional().isBoolean().withMessage('Featured must be boolean'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive number')
], optionalAuth, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const filters = {
            category_id: req.query.category,
            search: req.query.search,
            featured: req.query.featured === 'true',
            limit: parseInt(req.query.limit) || 20
        };

        const mods = await db.getMods(filters);

        // Parse JSON fields
        const processedMods = mods.map(mod => ({
            ...mod,
            screenshots: mod.screenshots ? JSON.parse(mod.screenshots) : [],
            tags: mod.tags ? JSON.parse(mod.tags) : [],
            requirements: mod.requirements ? JSON.parse(mod.requirements) : {}
        }));

        res.json({
            mods: processedMods,
            total: processedMods.length
        });
    } catch (error) {
        console.error('Get mods error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get specific mod by ID or slug
router.get('/mods/:identifier', optionalAuth, async (req, res) => {
    try {
        const { identifier } = req.params;
        let mod;

        // Check if identifier is numeric (ID) or string (slug)
        if (/^\d+$/.test(identifier)) {
            mod = await db.getModById(parseInt(identifier));
        } else {
            mod = await db.getModBySlug(identifier);
        }

        if (!mod) {
            return res.status(404).json({ error: 'Mod not found' });
        }

        // Parse JSON fields
        mod.screenshots = mod.screenshots ? JSON.parse(mod.screenshots) : [];
        mod.tags = mod.tags ? JSON.parse(mod.tags) : [];
        mod.requirements = mod.requirements ? JSON.parse(mod.requirements) : {};

        res.json(mod);
    } catch (error) {
        console.error('Get mod error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Dynamic upload middleware for mod creation
const dynamicUploadMiddleware = async (req, res, next) => {
    try {
        const upload = await createUploadMiddleware();
        const uploadFields = upload.fields([
            { name: 'modFile', maxCount: 1 },
            { name: 'thumbnail', maxCount: 1 }
        ]);
        uploadFields(req, res, next);
    } catch (error) {
        console.error('Dynamic upload middleware error:', error);
        res.status(500).json({ error: 'Upload configuration error' });
    }
};

// Create new mod
router.post('/mods', requireAuth, dynamicUploadMiddleware, [
    body('title').isLength({ min: 1, max: 255 }).withMessage('Title is required and must be less than 255 characters'),
    body('description').isLength({ min: 1 }).withMessage('Description is required'),
    body('short_description').optional().isLength({ max: 500 }).withMessage('Short description must be less than 500 characters'),
    body('category_id').isInt({ min: 1 }).withMessage('Category ID is required and must be a positive integer'),
    body('version').isLength({ min: 1, max: 20 }).withMessage('Version is required and must be less than 20 characters'),
    body('tags').optional().isJSON().withMessage('Tags must be valid JSON array'),
    body('is_nsfw').optional().isIn(['true', 'false', true, false]).withMessage('NSFW flag must be boolean')
], async (req, res) => {
    try {
        // Debug logging
        console.log('Upload request body:', req.body);
        console.log('Upload request files:', req.files);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        if (!req.files || !req.files.modFile || req.files.modFile.length === 0) {
            return res.status(400).json({ error: 'Mod file is required' });
        }

        const modFile = req.files.modFile[0];
        const thumbnailFile = req.files.thumbnail ? req.files.thumbnail[0] : null;

        const {
            title, description, short_description, category_id,
            version, tags, is_nsfw
        } = req.body;

        // Generate slug from title
        const slug = title.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');

        // Check if slug already exists
        const existingMod = await db.getModBySlug(slug);
        if (existingMod) {
            return res.status(400).json({ error: 'A mod with this title already exists' });
        }

        // Handle thumbnail - use uploaded file or generate default
        let thumbnailUrl = null;
        if (thumbnailFile) {
            thumbnailUrl = `/uploads/mods/${thumbnailFile.filename}`;
            console.log(`Using uploaded thumbnail: ${thumbnailUrl}`);
        }

        const modData = {
            title,
            slug,
            description,
            short_description: short_description || description.substring(0, 500),
            author_id: req.user.id,
            category_id: parseInt(category_id),
            version,
            file_path: modFile.path,
            file_size: modFile.size,
            thumbnail_url: thumbnailUrl,
            screenshots: [],
            tags: tags ? JSON.parse(tags) : [],
            requirements: {},
            is_nsfw: is_nsfw === 'true'
        };

        const result = await db.createMod(modData);

        // Generate default thumbnail if none was uploaded
        if (!thumbnailFile) {
            try {
                console.log(`No thumbnail uploaded for mod ${result.id}, generating default thumbnail...`);
                const defaultThumbnailUrl = await generateDefaultThumbnail(result.id, 300, 200);

                if (defaultThumbnailUrl) {
                    // Update the mod with the default thumbnail
                    await db.run(
                        'UPDATE mods SET thumbnail_url = ? WHERE id = ?',
                        [defaultThumbnailUrl, result.id]
                    );
                    console.log(`Default thumbnail generated and saved for mod ${result.id}: ${defaultThumbnailUrl}`);
                } else {
                    console.warn(`Failed to generate default thumbnail for mod ${result.id}`);
                }
            } catch (error) {
                console.error(`Error generating default thumbnail for mod ${result.id}:`, error);
                // Don't fail the mod creation if thumbnail generation fails
            }
        }

        res.status(201).json({
            message: 'Mod created successfully',
            mod_id: result.id,
            slug: slug
        });
    } catch (error) {
        console.error('Create mod error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download mod
router.get('/mods/:identifier/download', optionalAuth, async (req, res) => {
    try {
        const { identifier } = req.params;
        let mod;

        // Check if identifier is numeric (ID) or string (slug)
        if (/^\d+$/.test(identifier)) {
            mod = await db.getModById(parseInt(identifier));
        } else {
            mod = await db.getModBySlug(identifier);
        }

        if (!mod) {
            return res.status(404).json({ error: 'Mod not found' });
        }

        if (!mod.is_published) {
            return res.status(403).json({ error: 'Mod is not published' });
        }

        // Check if file exists
        try {
            await fs.access(mod.file_path);
        } catch (error) {
            return res.status(404).json({ error: 'Mod file not found' });
        }

        // Record download
        await db.incrementDownloadCount(mod.id);
        await db.recordDownload(
            mod.id,
            req.user ? req.user.id : null,
            req.ip,
            req.get('User-Agent')
        );

        // Send file
        res.download(mod.file_path, `${mod.slug}-${mod.version}.zip`);
    } catch (error) {
        console.error('Download mod error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get categories
router.get('/categories', async (req, res) => {
    try {
        const categories = await db.getCategories();
        res.json(categories);
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get public site settings (for file size limits, etc.)
router.get('/settings/public', async (req, res) => {
    try {
        const maxFileSizeMB = await db.getSiteSetting('max_file_size_mb') || 100;
        res.json({
            max_file_size_mb: maxFileSizeMB
        });
    } catch (error) {
        console.error('Get public settings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User: Get own mods
router.get('/user/mods', requireAuth, async (req, res) => {
    try {
        const filters = {
            status: req.query.status
        };

        const mods = await db.getUserModsWithDetails(req.user.id, filters);

        // Process mods data
        const processedMods = mods.map(mod => ({
            ...mod,
            screenshots: mod.screenshots ? JSON.parse(mod.screenshots) : [],
            tags: mod.tags ? JSON.parse(mod.tags) : [],
            requirements: mod.requirements ? JSON.parse(mod.requirements) : {}
        }));

        res.json(processedMods);
    } catch (error) {
        console.error('Get user mods error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User: Update own mod
router.patch('/user/mods/:id', [
    body('title').optional().isLength({ min: 1, max: 255 }).withMessage('Title must be 1-255 characters'),
    body('description').optional().isLength({ min: 1 }).withMessage('Description is required'),
    body('short_description').optional().isLength({ max: 500 }).withMessage('Short description must be less than 500 characters'),
    body('category_id').optional().isInt().withMessage('Category ID must be integer'),
    body('version').optional().isLength({ min: 1, max: 20 }).withMessage('Version must be 1-20 characters'),
    body('is_nsfw').optional().isBoolean().withMessage('NSFW flag must be boolean'),
    body('tags').optional().isArray().withMessage('Tags must be array'),
    body('requirements').optional().isObject().withMessage('Requirements must be object')
], requireAuth, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const modId = parseInt(id);

        // Check if mod exists and belongs to user
        const mod = await db.getModById(modId);
        if (!mod) {
            return res.status(404).json({ error: 'Mod not found' });
        }

        if (mod.author_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only edit your own mods' });
        }

        const updateData = {
            title: req.body.title || mod.title,
            description: req.body.description || mod.description,
            short_description: req.body.short_description || mod.short_description,
            category_id: req.body.category_id || mod.category_id,
            version: req.body.version || mod.version,
            is_nsfw: req.body.is_nsfw !== undefined ? req.body.is_nsfw : mod.is_nsfw,
            tags: req.body.tags || (mod.tags ? JSON.parse(mod.tags) : []),
            requirements: req.body.requirements || (mod.requirements ? JSON.parse(mod.requirements) : {})
        };

        await db.updateMod(modId, updateData);

        res.json({ message: 'Mod updated successfully' });
    } catch (error) {
        console.error('Update user mod error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User: Delete own mod
router.delete('/user/mods/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const modId = parseInt(id);

        // Check if mod exists and belongs to user
        const mod = await db.getModById(modId);
        if (!mod) {
            return res.status(404).json({ error: 'Mod not found' });
        }

        if (mod.author_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only delete your own mods' });
        }

        await db.deleteMod(modId);

        res.json({ message: 'Mod deleted successfully' });
    } catch (error) {
        console.error('Delete user mod error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Publish/unpublish mod
router.patch('/mods/:id/publish', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_published } = req.body;

        await db.run(
            'UPDATE mods SET is_published = ?, published_at = ? WHERE id = ?',
            [is_published, is_published ? new Date().toISOString() : null, id]
        );

        res.json({ message: `Mod ${is_published ? 'published' : 'unpublished'} successfully` });
    } catch (error) {
        console.error('Publish mod error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Feature/unfeature mod
router.patch('/mods/:id/feature', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_featured } = req.body;

        await db.run('UPDATE mods SET is_featured = ? WHERE id = ?', [is_featured, id]);

        res.json({ message: `Mod ${is_featured ? 'featured' : 'unfeatured'} successfully` });
    } catch (error) {
        console.error('Feature mod error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Get pending mods for review
router.get('/admin/mods/pending', requireAuth, requireAdmin, async (req, res) => {
    console.log(`[API] Fetching pending mods for admin ${req.user.id}`);

    try {
        const pendingMods = await db.getPendingMods();
        console.log(`[API] Retrieved ${pendingMods.length} pending mods`);

        // Process mods data
        const processedMods = pendingMods.map(mod => ({
            ...mod,
            screenshots: mod.screenshots ? JSON.parse(mod.screenshots) : [],
            tags: mod.tags ? JSON.parse(mod.tags) : [],
            requirements: mod.requirements ? JSON.parse(mod.requirements) : {}
        }));

        console.log(`[API] Returning processed pending mods data`);
        res.json(processedMods);
    } catch (error) {
        console.error('[API] Get pending mods error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Debug endpoint: Get pending mods count
router.get('/admin/mods/pending/count', requireAuth, requireAdmin, async (req, res) => {
    console.log(`[API] Fetching pending mods count for admin ${req.user.id}`);

    try {
        const pendingMods = await db.getPendingMods();
        const count = pendingMods.length;

        console.log(`[API] Pending mods count: ${count}`);
        res.json({ count, mods: pendingMods.map(m => ({ id: m.id, title: m.title, created_at: m.created_at })) });
    } catch (error) {
        console.error('[API] Get pending mods count error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Receive frontend logs
router.post('/admin/logs', requireAuth, requireAdmin, [
    body('level').isIn(['info', 'warn', 'error', 'debug']).withMessage('Invalid log level'),
    body('message').isLength({ min: 1, max: 1000 }).withMessage('Message must be 1-1000 characters'),
    body('source').optional().isLength({ max: 100 }).withMessage('Source must be less than 100 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { level, message, data, timestamp, source } = req.body;
        const adminId = req.user.id;
        const adminUsername = req.user.username;

        // Format log message for server console
        const logPrefix = `[${source || 'Frontend'}] [${adminUsername}]`;
        const logMessage = `${logPrefix} ${message}`;

        // Log to server console based on level
        switch (level) {
            case 'error':
                console.error(logMessage, data || '');
                break;
            case 'warn':
                console.warn(logMessage, data || '');
                break;
            case 'debug':
                console.debug(logMessage, data || '');
                break;
            case 'info':
            default:
                console.log(logMessage, data || '');
                break;
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('[API] Frontend logging error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Notifications API
router.get('/notifications', requireAuth, async (req, res) => {
    try {
        const notifications = await db.getUserNotifications(req.user.id);
        res.json(notifications);
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/notifications/unread-count', requireAuth, async (req, res) => {
    try {
        const count = await db.getUnreadNotificationCount(req.user.id);
        res.json({ count });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/notifications/:id/read', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify notification belongs to user
        const notification = await db.get('SELECT * FROM notifications WHERE id = ? AND user_id = ?', [id, req.user.id]);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        await db.markNotificationAsRead(id);
        res.json({ success: true });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/notifications/mark-all-read', requireAuth, async (req, res) => {
    try {
        await db.markAllNotificationsAsRead(req.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/notifications/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify notification belongs to user
        const notification = await db.get('SELECT * FROM notifications WHERE id = ? AND user_id = ?', [id, req.user.id]);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        await db.deleteNotification(id);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Approve mod
router.post('/admin/mods/:id/approve', requireAuth, requireAdmin, [
    body('reason').optional().isLength({ max: 1000 }).withMessage('Reason must be less than 1000 characters')
], async (req, res) => {
    const modId = req.params.id;
    const adminId = req.user.id;

    console.log(`[API] Mod approval request - Mod ID: ${modId}, Admin ID: ${adminId}`);

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log(`[API] Validation errors for mod approval:`, errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { reason } = req.body;
        console.log(`[API] Approval reason provided: ${reason ? 'Yes' : 'No'}`);

        // Check if mod exists
        const mod = await db.getModById(parseInt(modId));
        if (!mod) {
            console.log(`[API] Mod not found for approval - ID: ${modId}`);
            return res.status(404).json({ error: 'Mod not found' });
        }

        console.log(`[API] Found mod for approval: ${mod.title} (ID: ${modId})`);
        console.log(`[API] Current mod status - Published: ${mod.is_published}`);

        await db.approveModReview(parseInt(modId), adminId, reason);

        console.log(`[API] Mod ${modId} approved successfully by admin ${adminId}`);
        res.json({ message: 'Mod approved successfully' });
    } catch (error) {
        console.error(`[API] Approve mod error for mod ${modId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Reject mod
router.post('/admin/mods/:id/reject', requireAuth, requireAdmin, [
    body('reason').optional().isLength({ max: 1000 }).withMessage('Reason must be less than 1000 characters')
], async (req, res) => {
    const modId = req.params.id;
    const adminId = req.user.id;

    console.log(`[API] Mod rejection request - Mod ID: ${modId}, Admin ID: ${adminId}`);

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log(`[API] Validation errors for mod rejection:`, errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { reason } = req.body;
        console.log(`[API] Rejection reason provided: ${reason ? 'Yes' : 'No'}`);

        // Check if mod exists
        const mod = await db.getModById(parseInt(modId));
        if (!mod) {
            console.log(`[API] Mod not found for rejection - ID: ${modId}`);
            return res.status(404).json({ error: 'Mod not found' });
        }

        console.log(`[API] Found mod for rejection: ${mod.title} (ID: ${modId})`);
        console.log(`[API] Current mod status - Published: ${mod.is_published}`);

        const result = await db.rejectModReview(parseInt(modId), adminId, reason);

        console.log(`[API] Mod ${modId} rejected and removed successfully by admin ${adminId}`);
        res.json({ message: 'Mod rejected and removed successfully' });
    } catch (error) {
        console.error(`[API] Reject mod error for mod ${modId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Get mod reviews
router.get('/admin/mods/:id/reviews', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const reviews = await db.getModReviews(parseInt(id));
        res.json(reviews);
    } catch (error) {
        console.error('Get mod reviews error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Get all mods with filtering and pagination
router.get('/admin/mods', [
    query('search').optional().isLength({ max: 100 }).withMessage('Search term too long'),
    query('status').optional().isIn(['published', 'pending']).withMessage('Invalid status filter'),
    query('featured').optional().isIn(['true', 'false']).withMessage('Invalid featured filter'),
    query('category_id').optional().isInt().withMessage('Category ID must be integer'),
    query('author_id').optional().isInt().withMessage('Author ID must be integer'),
    query('sort_by').optional().isIn(['created_at', 'title', 'download_count', 'rating_average']).withMessage('Invalid sort field'),
    query('sort_order').optional().isIn(['asc', 'desc']).withMessage('Invalid sort order'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], requireAuth, requireAdmin, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const filters = {
            search: req.query.search,
            status: req.query.status,
            featured: req.query.featured,
            category_id: req.query.category_id,
            author_id: req.query.author_id,
            sort_by: req.query.sort_by || 'created_at',
            sort_order: req.query.sort_order || 'desc'
        };

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        filters.limit = limit;
        filters.offset = offset;

        // Get mods and total count
        const [mods, totalCount] = await Promise.all([
            db.getAllModsForAdmin(filters),
            db.getModCountForAdmin(filters)
        ]);

        // Process mods data
        const processedMods = mods.map(mod => ({
            ...mod,
            screenshots: mod.screenshots ? JSON.parse(mod.screenshots) : [],
            tags: mod.tags ? JSON.parse(mod.tags) : [],
            requirements: mod.requirements ? JSON.parse(mod.requirements) : {}
        }));

        res.json({
            mods: processedMods,
            pagination: {
                page,
                limit,
                total: totalCount,
                pages: Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        console.error('Get admin mods error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Delete mod
router.delete('/admin/mods/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const modId = parseInt(id);

        // Check if mod exists
        const mod = await db.getModById(modId);
        if (!mod) {
            return res.status(404).json({ error: 'Mod not found' });
        }

        await db.deleteMod(modId);

        res.json({ message: 'Mod deleted successfully' });
    } catch (error) {
        console.error('Delete mod error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Update mod
router.patch('/admin/mods/:id', [
    body('title').optional().isLength({ min: 1, max: 255 }).withMessage('Title must be 1-255 characters'),
    body('description').optional().isLength({ min: 1 }).withMessage('Description is required'),
    body('short_description').optional().isLength({ max: 500 }).withMessage('Short description must be less than 500 characters'),
    body('category_id').optional().isInt().withMessage('Category ID must be integer'),
    body('version').optional().isLength({ min: 1, max: 20 }).withMessage('Version must be 1-20 characters'),
    body('is_nsfw').optional().isBoolean().withMessage('NSFW flag must be boolean'),
    body('tags').optional().isArray().withMessage('Tags must be array'),
    body('requirements').optional().isObject().withMessage('Requirements must be object')
], requireAuth, requireAdmin, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const modId = parseInt(id);

        // Check if mod exists
        const mod = await db.getModById(modId);
        if (!mod) {
            return res.status(404).json({ error: 'Mod not found' });
        }

        const updateData = {
            title: req.body.title || mod.title,
            description: req.body.description || mod.description,
            short_description: req.body.short_description || mod.short_description,
            category_id: req.body.category_id || mod.category_id,
            version: req.body.version || mod.version,
            is_nsfw: req.body.is_nsfw !== undefined ? req.body.is_nsfw : mod.is_nsfw,
            tags: req.body.tags || (mod.tags ? JSON.parse(mod.tags) : []),
            requirements: req.body.requirements || (mod.requirements ? JSON.parse(mod.requirements) : {})
        };

        await db.updateMod(modId, updateData);

        res.json({ message: 'Mod updated successfully' });
    } catch (error) {
        console.error('Update mod error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Get admin stats
router.get('/admin/stats', requireAuth, requireAdmin, async (req, res) => {
    try {
        const stats = await db.getAdminStats();
        res.json(stats);
    } catch (error) {
        console.error('Get admin stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Get site settings
router.get('/admin/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
        const settings = await db.getAllSiteSettings();
        res.json(settings);
    } catch (error) {
        console.error('Get site settings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Update site settings
router.put('/admin/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { settings } = req.body;

        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Settings object is required' });
        }

        // Update each setting
        for (const [key, value] of Object.entries(settings)) {
            let type = 'string';

            // Determine type based on value
            if (typeof value === 'boolean') {
                type = 'boolean';
            } else if (typeof value === 'number') {
                type = 'number';
            } else if (typeof value === 'object') {
                type = 'json';
            }

            await db.setSiteSetting(key, value, type);
        }

        // Log maintenance mode changes
        if ('maintenance_mode' in settings) {
            console.log(`[Admin] Maintenance mode ${settings.maintenance_mode ? 'enabled' : 'disabled'} by admin ${req.user.username}`);
        }

        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Update site settings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Get users
router.get('/admin/users', [
    query('search').optional().isLength({ max: 100 }).withMessage('Search term too long'),
    query('role').optional().isIn(['admin', 'verified', 'regular']).withMessage('Invalid role filter'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], requireAuth, requireAdmin, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { search, role, limit } = req.query;
        const filters = {};

        if (search) filters.search = search;
        if (role) filters.role = role;
        if (limit) filters.limit = parseInt(limit);

        const users = await db.getUsers(filters);

        // Add user stats for each user
        const usersWithStats = await Promise.all(users.map(async (user) => {
            const stats = await db.getUserStats(user.id);
            return { ...user, stats };
        }));

        res.json(usersWithStats);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Update user role
router.patch('/admin/users/:id/role', [
    body('is_admin').isBoolean().withMessage('is_admin must be boolean'),
    body('is_verified').isBoolean().withMessage('is_verified must be boolean')
], requireAuth, requireAdmin, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { is_admin, is_verified } = req.body;
        const targetUserId = parseInt(id);

        // Get target user
        const targetUser = await db.getUserById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent non-owners from modifying admins
        if (targetUser.is_admin && !req.user.is_owner) {
            return res.status(403).json({ error: 'Only the owner can modify admin users' });
        }

        // Prevent users from modifying themselves
        if (targetUserId === req.user.id) {
            return res.status(403).json({ error: 'Cannot modify your own role' });
        }

        // Prevent removing owner status
        if (targetUser.is_owner) {
            return res.status(403).json({ error: 'Cannot modify the site owner' });
        }

        await db.updateUserRole(targetUserId, { is_admin, is_verified });

        res.json({ message: 'User role updated successfully' });
    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Owner: Delete user
router.delete('/admin/users/:id', requireAuth, requireOwner, async (req, res) => {
    try {
        const { id } = req.params;
        const targetUserId = parseInt(id);

        // Get target user
        const targetUser = await db.getUserById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent deleting yourself
        if (targetUserId === req.user.id) {
            return res.status(403).json({ error: 'Cannot delete yourself' });
        }

        // Prevent deleting the owner
        if (targetUser.is_owner) {
            return res.status(403).json({ error: 'Cannot delete the site owner' });
        }

        // Delete user's avatar file if it exists
        if (targetUser.avatar_url) {
            await deleteAvatarFile(targetUser.avatar_url, 'admin user deletion');
        }

        await db.deleteUser(targetUserId);

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        if (error.message === 'Cannot delete the site owner') {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Achievement routes
router.get('/achievements', async (req, res) => {
    try {
        const achievements = await db.getAchievements();
        res.json(achievements);
    } catch (error) {
        console.error('Get achievements error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/users/:userId/achievements', async (req, res) => {
    try {
        const { userId } = req.params;
        const achievements = await db.getUserAchievements(parseInt(userId));
        res.json(achievements);
    } catch (error) {
        console.error('Get user achievements error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/users/:userId/stats', async (req, res) => {
    try {
        const { userId } = req.params;
        const stats = await db.getUserGameStats(parseInt(userId));
        res.json(stats);
    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/leaderboard', [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('sortBy').optional().isIn(['achievement_points', 'user_level', 'created_at']).withMessage('Invalid sort field')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const limit = parseInt(req.query.limit) || 10;
        const sortBy = req.query.sortBy || 'achievement_points';

        const leaderboard = await db.getTopUsers(limit, sortBy);
        res.json(leaderboard);
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Comment routes
router.get('/mods/:identifier/comments', async (req, res) => {
    try {
        const { identifier } = req.params;
        let mod;

        // Check if identifier is numeric (ID) or string (slug)
        if (/^\d+$/.test(identifier)) {
            mod = await db.getModById(parseInt(identifier));
        } else {
            mod = await db.getModBySlug(identifier);
        }

        if (!mod) {
            return res.status(404).json({ error: 'Mod not found' });
        }

        const comments = await db.getModComments(mod.id);

        // Organize comments into threaded structure
        const commentMap = new Map();
        const rootComments = [];

        // First pass: create comment objects with replies array
        comments.forEach(comment => {
            comment.replies = [];
            commentMap.set(comment.id, comment);
        });

        // Second pass: organize into tree structure
        comments.forEach(comment => {
            if (comment.parent_id) {
                const parent = commentMap.get(comment.parent_id);
                if (parent) {
                    parent.replies.push(comment);
                }
            } else {
                rootComments.push(comment);
            }
        });

        res.json(rootComments);
    } catch (error) {
        console.error('Get mod comments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/mods/:identifier/comments', [
    body('content').isLength({ min: 1, max: 2000 }).withMessage('Comment content is required and must be less than 2000 characters'),
    body('parent_id').optional().isInt().withMessage('Parent ID must be a number')
], requireAuth, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { identifier } = req.params;
        const { content, parent_id } = req.body;

        let mod;
        // Check if identifier is numeric (ID) or string (slug)
        if (/^\d+$/.test(identifier)) {
            mod = await db.getModById(parseInt(identifier));
        } else {
            mod = await db.getModBySlug(identifier);
        }

        if (!mod) {
            return res.status(404).json({ error: 'Mod not found' });
        }

        // Verify parent comment exists if specified
        if (parent_id) {
            const parentComment = await db.get('SELECT id FROM mod_comments WHERE id = ? AND mod_id = ?', [parent_id, mod.id]);
            if (!parentComment) {
                return res.status(400).json({ error: 'Parent comment not found' });
            }
        }

        const result = await db.createComment(mod.id, req.user.id, content, parent_id || null);

        // Get the created comment with user info
        const comment = await db.get(`
            SELECT mc.*, u.username, u.display_name, u.avatar_url, u.user_title, u.user_level
            FROM mod_comments mc
            INNER JOIN users u ON mc.user_id = u.id
            WHERE mc.id = ?
        `, [result.id]);

        res.status(201).json(comment);
    } catch (error) {
        console.error('Create comment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/comments/:commentId', [
    body('content').isLength({ min: 1, max: 2000 }).withMessage('Comment content is required and must be less than 2000 characters')
], requireAuth, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { commentId } = req.params;
        const { content } = req.body;

        const result = await db.updateComment(parseInt(commentId), req.user.id, content);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Comment not found or you do not have permission to edit it' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Update comment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/comments/:commentId', requireAuth, async (req, res) => {
    try {
        const { commentId } = req.params;

        const result = await db.deleteComment(parseInt(commentId), req.user.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Comment not found or you do not have permission to delete it' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Support ticket routes
router.post('/support/ticket', [
    body('name').isLength({ min: 1, max: 255 }).withMessage('Name is required and must be less than 255 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('subject').isLength({ min: 1, max: 255 }).withMessage('Subject is required and must be less than 255 characters'),
    body('message').isLength({ min: 1, max: 5000 }).withMessage('Message is required and must be less than 5000 characters'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority level')
], requireAuth, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, subject, message, priority = 'medium' } = req.body;

        // Create ticket data using authenticated user's information
        const ticketData = {
            user_id: req.user.id,
            name: name || req.user.display_name || req.user.username,
            email: email || req.user.email,
            subject,
            message,
            priority
        };

        // Create the support ticket
        const result = await db.createSupportTicket(ticketData);
        const ticketId = result.id;

        console.log(`[API] Support ticket created: ID ${ticketId}, Subject: ${subject}`);

        // Get admin emails
        const adminEmails = await db.getAdminEmails();

        if (adminEmails.length > 0) {
            // Prepare email data
            const emailData = {
                ticketId,
                name: ticketData.name,
                email: ticketData.email,
                subject,
                message,
                priority,
                username: req.user.username
            };

            // Send consolidated email to all admins
            const emailResult = await emailService.sendSupportTicketEmail(adminEmails, emailData);

            if (emailResult.success) {
                console.log(`[API] Support ticket email sent to ${adminEmails.length} admins`);
            } else {
                console.error(`[API] Failed to send support ticket email:`, emailResult.error);
            }
        } else {
            console.warn(`[API] No admin emails found for support ticket notification`);
        }

        res.status(201).json({
            success: true,
            message: 'Support ticket created successfully',
            ticketId: ticketId
        });
    } catch (error) {
        console.error('Create support ticket error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Get support tickets
router.get('/admin/support/tickets', [
    query('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']).withMessage('Invalid status filter'),
    query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority filter'),
    query('search').optional().isLength({ max: 100 }).withMessage('Search term too long'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], requireAuth, requireAdmin, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const filters = {
            status: req.query.status,
            priority: req.query.priority,
            search: req.query.search,
            limit: parseInt(req.query.limit) || 50
        };

        const tickets = await db.getSupportTickets(filters);
        res.json(tickets);
    } catch (error) {
        console.error('Get support tickets error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Get specific support ticket
router.get('/admin/support/tickets/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const ticket = await db.getSupportTicketById(parseInt(id));

        if (!ticket) {
            return res.status(404).json({ error: 'Support ticket not found' });
        }

        res.json(ticket);
    } catch (error) {
        console.error('Get support ticket error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Update support ticket status
router.patch('/admin/support/tickets/:id/status', [
    body('status').isIn(['open', 'in_progress', 'resolved', 'closed']).withMessage('Invalid status')
], requireAuth, requireAdmin, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { status } = req.body;

        const result = await db.updateSupportTicketStatus(parseInt(id), status);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Support ticket not found' });
        }

        res.json({ message: 'Support ticket status updated successfully' });
    } catch (error) {
        console.error('Update support ticket status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Update support ticket priority
router.patch('/admin/support/tickets/:id/priority', [
    body('priority').isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority')
], requireAuth, requireAdmin, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { priority } = req.body;

        const result = await db.updateSupportTicketPriority(parseInt(id), priority);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Support ticket not found' });
        }

        res.json({ message: 'Support ticket priority updated successfully' });
    } catch (error) {
        console.error('Update support ticket priority error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Delete support ticket
router.delete('/admin/support/tickets/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.deleteSupportTicket(parseInt(id));

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Support ticket not found' });
        }

        res.json({ message: 'Support ticket deleted successfully' });
    } catch (error) {
        console.error('Delete support ticket error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



module.exports = router;
