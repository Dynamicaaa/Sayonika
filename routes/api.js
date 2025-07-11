const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { body, validationResult, query } = require('express-validator');
const Database = require('../database/database');
const { authenticateToken, requireAuth, requireAdmin, requireOwner, requireEmailVerified, optionalAuth } = require('../middleware/auth');
const { detectReverseProxy, getEffectiveFileLimit, getFileLimitMB } = require('../middleware/proxy-detection');
const { deleteAvatarFile, generateDefaultThumbnail } = require('../utils/helpers');
const emailService = require('../utils/emailService');

const router = express.Router();
const db = new Database();

// Import image routes and auth routes
const imageRoutes = require('./api/images');
const authRoutes = require('./auth');
router.use('/images', imageRoutes);
router.use('/auth', authRoutes);

// Initialize database connection
db.connect().catch(console.error);

// Root API endpoint - list available endpoints
router.get('/', (req, res) => {
    res.json({
        message: 'Sayonika API',
        version: '1.0.0',
        description: 'Complete API for the Sayonika mod platform with comprehensive documentation',
        base_url: '/api',
        documentation: {
            note: 'All GET endpoints provide usage documentation for their corresponding POST endpoints',
            authentication: 'Many endpoints require authentication - see auth_endpoints section',
            pagination: 'List endpoints support pagination with page and per_page parameters'
        },
        endpoints: {
            // Mod Management
            'GET /mods': 'Get all mods with pagination and filtering',
            'GET /mods/:id': 'Get specific mod by ID or slug',
            'POST /mods': 'Create new mod (requires auth)',
            'GET /mods/:id/download': 'Download mod file',
            'PATCH /user/mods/:id': 'Update user\'s mod (requires auth)',
            
            // Categories and Settings
            'GET /categories': 'Get all mod categories',
            'GET /settings/public': 'Get public site settings (file limits, etc.)',
            
            // User Management
            'GET /user/mods': 'Get current user\'s mods (requires auth)',
            'GET /leaderboard': 'Get user leaderboard',
            
            // Comments and Interactions
            'GET /mods/:id/comments': 'Get mod comments with documentation',
            'POST /mods/:id/comments': 'Add comment to mod (requires auth)',
            
            // Notifications
            'GET /notifications/:id/read': 'Mark notification read endpoint documentation',
            'POST /notifications/:id/read': 'Mark specific notification as read (requires auth)',
            'POST /notifications/mark-all-read': 'Mark all notifications as read (requires auth)',
            
            // Support System
            'GET /support/ticket': 'Support ticket creation documentation',
            'POST /support/ticket': 'Create support ticket',
            
            // Image Handling
            'GET /images/*': 'Image serving and manipulation endpoints',
            
            // Admin Endpoints
            'GET /admin/mods': 'Get all mods for admin (requires admin)',
            'PATCH /admin/mods/:id': 'Update mod as admin (requires admin)',
            'DELETE /admin/mods/:id': 'Delete mod as admin (requires admin)',
            'POST /admin/mods/:id/approve': 'Approve mod (requires admin)',
            'POST /admin/mods/:id/reject': 'Reject mod (requires admin)',
            'GET /admin/users': 'Get all users (requires admin)',
            'PATCH /admin/users/:id/role': 'Update user role (requires admin)',
            'GET /admin/support/tickets': 'Get support tickets (requires admin)',
            'GET /admin/support/tickets/:id': 'Get specific support ticket (requires admin)',
            'PATCH /admin/support/tickets/:id/status': 'Update ticket status (requires admin)',
            'PATCH /admin/support/tickets/:id/priority': 'Update ticket priority (requires admin)',
            'DELETE /admin/support/tickets/:id': 'Delete support ticket (requires admin)',
            'POST /admin/logs': 'Receive frontend logs (requires admin)'
        },
        auth_endpoints: {
            'GET /auth': 'Authentication API documentation',
            
            // Account Management
            'GET /auth/check-username': 'Check username availability',
            'GET /auth/check-email': 'Check email availability',
            'GET /auth/register': 'Registration endpoint documentation',
            'POST /auth/register': 'Register new user account',
            
            // Authentication
            'GET /auth/login': 'Login endpoint documentation',
            'POST /auth/login': 'Login with username/email and password',
            'GET /auth/admin-login': 'Admin login documentation',
            'POST /auth/admin-login': 'Admin login with enhanced validation',
            'GET /auth/logout': 'Logout endpoint documentation',
            'POST /auth/logout': 'Logout current user',
            
            // Password Management
            'GET /auth/forgot-password': 'Forgot password documentation',
            'POST /auth/forgot-password': 'Request password reset email',
            'GET /auth/reset-password': 'Reset password documentation',
            'POST /auth/reset-password': 'Reset password with token',
            'GET /auth/change-password': 'Change password documentation',
            'POST /auth/change-password': 'Change password (requires auth)',
            
            // Profile Management
            'GET /auth/me': 'Get current user information (requires auth)',
            'PUT /auth/profile': 'Update user profile (requires auth)',
            'GET /auth/upload-avatar': 'Avatar upload documentation (redirects to profile/avatar)',
            'GET /auth/profile/avatar': 'Profile avatar endpoint documentation',
            'POST /auth/profile/avatar': 'Upload user avatar (requires auth)',
            'DELETE /auth/profile/avatar': 'Remove user avatar (requires auth)',
            
            // Preferences
            'GET /auth/email-preferences': 'Get email preferences (requires auth)',
            'PUT /auth/email-preferences': 'Update email preferences (requires auth)',
            'POST /auth/resend-verification': 'Resend email verification (requires auth)'
        },
        oauth_endpoints: {
            note: 'OAuth endpoints are available at /auth (not /api/auth)',
            'GET /auth': 'OAuth providers documentation',
            'GET /auth/github': 'GitHub OAuth login',
            'GET /auth/github/callback': 'GitHub OAuth callback',
            'GET /auth/discord': 'Discord OAuth login',
            'GET /auth/discord/callback': 'Discord OAuth callback',
            'POST /auth/link/github': 'Generate GitHub account linking token',
            'POST /auth/link/discord': 'Generate Discord account linking token'
        },
        response_format: {
            success: 'All successful responses return JSON with appropriate data',
            error: 'Error responses include error message and status code',
            pagination: 'Paginated responses include pagination metadata'
        }
    });
});

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

// Create upload middleware with very high limit - we'll check file size manually
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 * 1024 // 10GB limit to allow any reasonable file size
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
        } else if (file.fieldname.startsWith('screenshot_')) {
            const allowedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            if (allowedImageTypes.includes(ext)) {
                cb(null, true);
            } else {
                cb(new Error('Only image files (JPG, JPEG, PNG, GIF, WebP) are allowed for screenshots'));
            }
        } else {
            cb(new Error('Unexpected field'));
        }
    }
});

// Get all mods
router.get('/mods', [
    query('category').optional().isInt().withMessage('Category must be a number'),
    query('search').optional().isLength({ max: 100 }).withMessage('Search term too long'),
    query('featured').optional().isBoolean().withMessage('Featured must be boolean'),
    query('per_page').optional().isInt({ min: 1, max: 100 }).withMessage('Per page must be between 1 and 100'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive number'),
    query('sort').optional().isIn(['created_at', 'updated_at', 'downloads', 'rating', 'title']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Invalid sort order')
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
            sort: req.query.sort || 'created_at',
            order: req.query.order || 'desc'
        };

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.per_page) || 20;
        const offset = (page - 1) * perPage;

        filters.limit = perPage;
        filters.offset = offset;

        const [mods, totalCount] = await Promise.all([
            db.getMods(filters),
            db.getModCount(filters)
        ]);

        // Parse JSON fields
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
                per_page: perPage,
                total: totalCount,
                total_pages: Math.ceil(totalCount / perPage),
                has_next: page < Math.ceil(totalCount / perPage),
                has_prev: page > 1
            }
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

// Create new mod
router.post('/mods', requireAuth, requireEmailVerified, detectReverseProxy, (req, res, next) => {
    upload.any()(req, res, (err) => {
        if (err) {
            console.error('Multer upload error:', err);
            return res.status(400).json({ error: `File upload error: ${err.message}` });
        }
        next();
    });
}, [
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

        const uploadMethod = req.body.uploadMethod || 'file';
        const externalUrl = req.body.externalUrl;

        // Validate that either file upload or external URL is provided
        if (uploadMethod === 'file') {
            const modFileExists = req.files && req.files.find(f => f.fieldname === 'modFile');
            if (!modFileExists) {
                return res.status(400).json({ error: 'Mod file is required when using file upload method' });
            }
        } else if (uploadMethod === 'url') {
            if (!externalUrl || !externalUrl.trim()) {
                return res.status(400).json({ error: 'External URL is required when using URL upload method' });
            }

            // Validate external URL format
            try {
                const url = new URL(externalUrl);
                if (!['http:', 'https:'].includes(url.protocol)) {
                    return res.status(400).json({ error: 'External URL must use HTTP or HTTPS protocol' });
                }

                // Check if URL ends with supported file extensions
                const supportedExtensions = ['.zip', '.rar', '.7z'];
                const hasValidExtension = supportedExtensions.some(ext =>
                    url.pathname.toLowerCase().endsWith(ext)
                );

                if (!hasValidExtension) {
                    return res.status(400).json({ error: 'External URL must point to a valid mod file (.zip, .rar, or .7z)' });
                }
            } catch (error) {
                return res.status(400).json({ error: 'Invalid external URL format' });
            }
        } else {
            return res.status(400).json({ error: 'Invalid upload method. Must be "file" or "url"' });
        }

        // Process uploaded files
        const modFile = (uploadMethod === 'file' && req.files) ? req.files.find(f => f.fieldname === 'modFile') : null;
        const thumbnailFile = req.files ? req.files.find(f => f.fieldname === 'thumbnail') : null;
        const screenshotFiles = req.files ? req.files.filter(f => f.fieldname.startsWith('screenshot_')) : [];

        // Debug logging for file processing
        console.log('Processing uploaded files:');
        console.log('- Total files received:', req.files ? req.files.length : 0);
        console.log('- Mod file:', modFile ? `${modFile.originalname} (${modFile.size} bytes)` : 'None');
        console.log('- Thumbnail file:', thumbnailFile ? `${thumbnailFile.originalname} (${thumbnailFile.size} bytes)` : 'None');
        console.log('- Screenshot files:', screenshotFiles.length);
        screenshotFiles.forEach((file, index) => {
            console.log(`  Screenshot ${index}: ${file.fieldname} -> ${file.originalname} (${file.size} bytes)`);
        });

        // Check file size against database setting (only for file uploads)
        if (uploadMethod === 'file' && modFile) {
            const maxFileSizeMB = await db.getSiteSetting('max_file_size_mb');

            if (maxFileSizeMB === null || maxFileSizeMB === undefined) {
                console.error('[Upload] max_file_size_mb setting not found in database');
                return res.status(500).json({
                    error: 'File size limit setting not configured. Please contact administrator.'
                });
            }

            const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

            console.log(`[Upload] File size check - File: ${(modFile.size / 1024 / 1024).toFixed(2)}MB, Limit: ${maxFileSizeMB}MB`);

            if (modFile.size > maxFileSizeBytes) {
                console.log(`[Upload] File size exceeded limit - rejecting upload`);
                // Delete the uploaded file since it exceeds the limit
                try {
                    await fs.unlink(modFile.path);
                } catch (unlinkError) {
                    console.error('Error deleting oversized file:', unlinkError);
                }
                return res.status(400).json({
                    error: `File size exceeds the maximum limit of ${maxFileSizeMB}MB`
                });
            }

            console.log(`[Upload] File size check passed - proceeding with upload`);
        }

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

        // Validate screenshot file sizes
        const maxScreenshotSizeMB = await db.getSiteSetting('max_screenshot_size_mb') || 5;
        const maxScreenshotSizeBytes = maxScreenshotSizeMB * 1024 * 1024;

        for (const screenshotFile of screenshotFiles) {
            if (screenshotFile.size > maxScreenshotSizeBytes) {
                console.log(`Screenshot file ${screenshotFile.originalname} exceeds size limit: ${(screenshotFile.size / 1024 / 1024).toFixed(2)}MB > ${maxScreenshotSizeMB}MB`);
                // Delete the uploaded file
                try {
                    await fs.unlink(screenshotFile.path);
                } catch (unlinkError) {
                    console.error('Error deleting oversized screenshot file:', unlinkError);
                }
                return res.status(400).json({
                    error: `Screenshot file "${screenshotFile.originalname}" exceeds the maximum size limit of ${maxScreenshotSizeMB}MB`
                });
            }
        }

        // Handle screenshots
        const screenshots = screenshotFiles.map(file => `/uploads/mods/${file.filename}`);
        console.log(`Processed ${screenshots.length} screenshots:`, screenshots);

        const modData = {
            title,
            slug,
            description,
            short_description: short_description || description.substring(0, 500),
            author_id: req.user.id,
            category_id: parseInt(category_id),
            version,
            file_path: uploadMethod === 'file' && modFile ? modFile.path : null,
            file_size: uploadMethod === 'file' && modFile ? modFile.size : null,
            external_url: uploadMethod === 'url' ? externalUrl : null,
            thumbnail_url: thumbnailUrl,
            screenshots: screenshots,
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

        // Record download before redirecting or serving file
        await db.incrementDownloadCount(mod.id);
        await db.recordDownload(
            mod.id,
            req.user ? req.user.id : null,
            req.ip,
            req.get('User-Agent')
        );

        // Check if mod has external URL
        if (mod.external_url) {
            // Redirect to external URL
            return res.redirect(mod.external_url);
        }

        // Handle local file download
        if (!mod.file_path) {
            return res.status(404).json({ error: 'No download available for this mod' });
        }

        // Check if file exists
        try {
            await fs.access(mod.file_path);
        } catch (error) {
            return res.status(404).json({ error: 'Mod file not found' });
        }

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
router.get('/settings/public', detectReverseProxy, async (req, res) => {
    try {
        // Get proxy-aware file size limit
        const effectiveFileLimitMB = getFileLimitMB(req);
        const maxThumbnailSizeMB = await db.getSiteSetting('max_thumbnail_size_mb');
        const maxScreenshotSizeMB = await db.getSiteSetting('max_screenshot_size_mb');

        // Check if thumbnail and screenshot settings exist
        const missingSettings = [];
        if (maxThumbnailSizeMB === null || maxThumbnailSizeMB === undefined) {
            missingSettings.push('max_thumbnail_size_mb');
        }
        if (maxScreenshotSizeMB === null || maxScreenshotSizeMB === undefined) {
            missingSettings.push('max_screenshot_size_mb');
        }

        if (missingSettings.length > 0) {
            console.error(`[API] Missing file size settings in database: ${missingSettings.join(', ')}`);
            return res.status(500).json({
                error: `File size limit settings not found in database: ${missingSettings.join(', ')}. Please contact administrator.`
            });
        }

        const response = {
            max_file_size_mb: effectiveFileLimitMB,
            max_thumbnail_size_mb: maxThumbnailSizeMB,
            max_screenshot_size_mb: maxScreenshotSizeMB
        };

        // Include proxy information for debugging
        if (req.proxyInfo.isReverseProxy) {
            response.proxy_info = {
                is_cloudflare: req.proxyInfo.isCloudflare,
                is_nginx: req.proxyInfo.isNginx,
                detected_headers: req.proxyInfo.detectedHeaders
            };
        }

        console.log(`[API] Retrieved file size limits - Mod: ${effectiveFileLimitMB}MB (proxy-aware), Thumbnail: ${maxThumbnailSizeMB}MB, Screenshot: ${maxScreenshotSizeMB}MB`);
        res.json(response);
    } catch (error) {
        console.error('[API] Get public settings error:', error);
        res.status(500).json({
            error: 'Failed to retrieve settings from database. Please try again or contact support.'
        });
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
router.patch('/user/mods/:id', requireAuth, requireEmailVerified, detectReverseProxy, upload.any(), [
    body('title').optional().isLength({ min: 1, max: 255 }).withMessage('Title must be 1-255 characters'),
    body('description').optional().isLength({ min: 1 }).withMessage('Description is required'),
    body('short_description').optional().isLength({ max: 500 }).withMessage('Short description must be less than 500 characters'),
    body('category_id').optional().isInt().withMessage('Category ID must be integer'),
    body('version').optional().isLength({ min: 1, max: 20 }).withMessage('Version must be 1-20 characters'),
    body('is_nsfw').optional().isIn(['true', 'false', true, false]).withMessage('NSFW flag must be boolean'),
    body('tags').optional().isJSON().withMessage('Tags must be valid JSON array'),
    body('changelog').optional().isLength({ max: 2000 }).withMessage('Changelog must be less than 2000 characters'),
    body('externalUrl').optional().isURL().withMessage('External URL must be valid'),
    body('removedScreenshots').optional().isJSON().withMessage('Removed screenshots must be valid JSON array')
], async (req, res) => {
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

        // Handle file uploads
        const modFile = req.files ? req.files.find(f => f.fieldname === 'modFile') : null;
        const thumbnailFile = req.files ? req.files.find(f => f.fieldname === 'thumbnail') : null;
        const screenshotFiles = req.files ? req.files.filter(f => f.fieldname.startsWith('screenshot_')) : [];

        // Check file size against proxy-aware limits (only for file uploads)
        if (modFile) {
            const effectiveLimit = getEffectiveFileLimit(req);
            const limitMB = getFileLimitMB(req);

            if (modFile.size > effectiveLimit) {
                // Delete the uploaded file since it exceeds the limit
                try {
                    await fs.unlink(modFile.path);
                } catch (unlinkError) {
                    console.error('Error deleting oversized file:', unlinkError);
                }

                const proxyType = req.proxyInfo.isCloudflare ? 'Cloudflare' :
                                 req.proxyInfo.isNginx ? 'reverse proxy' : 'system';

                return res.status(400).json({
                    error: `File size exceeds the maximum limit of ${limitMB}MB (enforced by ${proxyType})`
                });
            }
        }

        // Handle thumbnail upload
        let thumbnailUrl = mod.thumbnail_url;
        if (thumbnailFile) {
            thumbnailUrl = `/uploads/mods/${thumbnailFile.filename}`;
        }

        // Parse tags if provided
        let tags = mod.tags ? JSON.parse(mod.tags) : [];
        if (req.body.tags) {
            try {
                tags = JSON.parse(req.body.tags);
            } catch (e) {
                return res.status(400).json({ error: 'Invalid tags format' });
            }
        }

        // Handle removed screenshots
        let screenshots = mod.screenshots ? JSON.parse(mod.screenshots) : [];
        if (req.body.removedScreenshots) {
            try {
                const removedScreenshots = JSON.parse(req.body.removedScreenshots);
                screenshots = screenshots.filter(screenshot => !removedScreenshots.includes(screenshot));
            } catch (e) {
                return res.status(400).json({ error: 'Invalid removed screenshots format' });
            }
        }

        // Handle new screenshot uploads
        const newScreenshots = screenshotFiles.map(file => `/uploads/mods/${file.filename}`);
        screenshots = screenshots.concat(newScreenshots);
        console.log(`Processed ${newScreenshots.length} new screenshots for mod edit`);

        const updateData = {
            title: req.body.title || mod.title,
            description: req.body.description || mod.description,
            short_description: req.body.short_description || mod.short_description,
            category_id: req.body.category_id || mod.category_id,
            version: req.body.version || mod.version,
            is_nsfw: req.body.is_nsfw !== undefined ? (req.body.is_nsfw === 'true' || req.body.is_nsfw === true) : mod.is_nsfw,
            tags: tags,
            requirements: mod.requirements ? JSON.parse(mod.requirements) : {},
            changelog: req.body.changelog || mod.changelog,
            thumbnail_url: thumbnailUrl,
            screenshots: screenshots
        };

        // Handle file updates
        if (modFile) {
            updateData.file_path = modFile.path;
            updateData.file_size = modFile.size;
            updateData.external_url = null; // Clear external URL if uploading new file
        } else if (req.body.externalUrl) {
            updateData.external_url = req.body.externalUrl;
            // Keep existing file_path and file_size if switching to external URL
        }

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

// Mark notification as read endpoint info (GET)
router.get('/notifications/:id/read', (req, res) => {
    res.json({
        message: 'Mark notification as read endpoint',
        method: 'POST',
        url: '/api/notifications/:id/read',
        authentication: 'Required - must be logged in',
        description: 'Mark a specific notification as read',
        note: 'Replace :id with notification ID'
    });
});

// Mark notification as read (POST)
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

        console.log(`[Admin] Settings update requested by admin ${req.user.username}:`, settings);

        // Validate specific settings
        if ('max_file_size_mb' in settings) {
            const maxFileSize = parseInt(settings.max_file_size_mb);
            if (isNaN(maxFileSize) || maxFileSize < 1) {
                return res.status(400).json({ error: 'Maximum file size must be a positive number' });
            }
            settings.max_file_size_mb = maxFileSize;
        }

        if ('max_thumbnail_size_mb' in settings) {
            const maxThumbnailSize = parseInt(settings.max_thumbnail_size_mb);
            if (isNaN(maxThumbnailSize) || maxThumbnailSize < 1) {
                return res.status(400).json({ error: 'Maximum thumbnail size must be a positive number' });
            }
            settings.max_thumbnail_size_mb = maxThumbnailSize;
        }

        if ('max_screenshot_size_mb' in settings) {
            const maxScreenshotSize = parseInt(settings.max_screenshot_size_mb);
            if (isNaN(maxScreenshotSize) || maxScreenshotSize < 1) {
                return res.status(400).json({ error: 'Maximum screenshot size must be a positive number' });
            }
            settings.max_screenshot_size_mb = maxScreenshotSize;
        }

        if ('maintenance_message' in settings) {
            if (!settings.maintenance_message || settings.maintenance_message.trim() === '') {
                return res.status(400).json({ error: 'Maintenance message cannot be empty' });
            }
            settings.maintenance_message = settings.maintenance_message.trim();
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

            console.log(`[Admin] Updating setting ${key} = ${value} (type: ${type})`);
            await db.setSiteSetting(key, value, type);
        }

        // Log specific setting changes
        if ('maintenance_mode' in settings) {
            console.log(`[Admin] Maintenance mode ${settings.maintenance_mode ? 'enabled' : 'disabled'} by admin ${req.user.username}`);
        }

        if ('maintenance_message' in settings) {
            console.log(`[Admin] Maintenance message updated by admin ${req.user.username}: "${settings.maintenance_message}"`);
        }

        if ('max_file_size_mb' in settings) {
            console.log(`[Admin] Maximum file size limit updated to ${settings.max_file_size_mb}MB by admin ${req.user.username}`);
        }

        if ('max_thumbnail_size_mb' in settings) {
            console.log(`[Admin] Maximum thumbnail size limit updated to ${settings.max_thumbnail_size_mb}MB by admin ${req.user.username}`);
        }

        if ('max_screenshot_size_mb' in settings) {
            console.log(`[Admin] Maximum screenshot size limit updated to ${settings.max_screenshot_size_mb}MB by admin ${req.user.username}`);
        }

        console.log(`[Admin] All settings updated successfully by admin ${req.user.username}`);
        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('[Admin] Update site settings error:', error);
        res.status(500).json({ error: 'Failed to update settings. Please try again.' });
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

// Mod comments endpoint info (GET)
router.get('/mods/:identifier/comments', (req, res) => {
    res.json({
        message: 'Mod comments endpoint',
        methods: {
            'GET': 'Get comments for this mod (this endpoint)',
            'POST': 'Add a comment to this mod'
        },
        post_info: {
            url: '/api/mods/:identifier/comments',
            method: 'POST',
            authentication: 'Required - must be logged in',
            required_fields: ['content'],
            max_length: 2000,
            example: {
                content: 'Great mod! Thanks for sharing.'
            }
        },
        note: 'Replace :identifier with mod ID or slug'
    });
});

// Add mod comment (POST)
router.post('/mods/:identifier/comments', [
    body('content').isLength({ min: 1, max: 2000 }).withMessage('Comment content is required and must be less than 2000 characters'),
    body('parent_id').optional().isInt().withMessage('Parent ID must be a number')
], requireAuth, requireEmailVerified, async (req, res) => {
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
], requireAuth, requireEmailVerified, async (req, res) => {
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

router.delete('/comments/:commentId', requireAuth, requireEmailVerified, async (req, res) => {
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
// Support ticket endpoint info (GET)
router.get('/support/ticket', (req, res) => {
    res.json({
        message: 'Support ticket endpoint',
        method: 'POST',
        url: '/api/support/ticket',
        required_fields: ['name', 'email', 'subject', 'message'],
        optional_fields: ['priority'],
        description: 'Create a new support ticket',
        priority_options: ['low', 'medium', 'high', 'urgent'],
        example: {
            name: 'Your Name',
            email: 'your@email.com',
            subject: 'Support Request Subject',
            message: 'Detailed description of your issue or request',
            priority: 'medium'
        }
    });
});

// Create support ticket (POST)
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
    query('status').optional({ values: 'falsy' }).isIn(['open', 'in_progress', 'resolved', 'closed']).withMessage('Invalid status filter'),
    query('priority').optional({ values: 'falsy' }).isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority filter'),
    query('search').optional({ values: 'falsy' }).isLength({ max: 100 }).withMessage('Search term too long'),
    query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], requireAuth, requireAdmin, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('Support tickets validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const filters = {
            status: req.query.status && req.query.status.trim() !== '' ? req.query.status : undefined,
            priority: req.query.priority && req.query.priority.trim() !== '' ? req.query.priority : undefined,
            search: req.query.search && req.query.search.trim() !== '' ? req.query.search : undefined,
            limit: parseInt(req.query.limit) || 50
        };

        console.log('Support tickets filters:', filters);
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
