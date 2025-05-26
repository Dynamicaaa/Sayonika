const express = require('express');
const Database = require('../database/database');
const { isDefaultAvatar } = require('../utils/helpers');

const router = express.Router();
const db = new Database();

// Initialize database connection
db.connect().catch(console.error);

// Home page
router.get('/', async (req, res) => {
    try {
        // Get featured mods
        const featuredMods = await db.getMods({ featured: true, limit: 6 });

        // Get recent mods
        const recentMods = await db.getMods({ limit: 8 });

        // Get categories
        const categories = await db.getCategories();

        // Process mods data
        const processedFeatured = featuredMods.map(mod => ({
            ...mod,
            screenshots: mod.screenshots ? JSON.parse(mod.screenshots) : [],
            tags: mod.tags ? JSON.parse(mod.tags) : []
        }));

        const processedRecent = recentMods.map(mod => ({
            ...mod,
            screenshots: mod.screenshots ? JSON.parse(mod.screenshots) : [],
            tags: mod.tags ? JSON.parse(mod.tags) : []
        }));

        res.render('index', {
            title: 'Sayonika - DDLC Mod Store',
            user: req.user,
            featuredMods: processedFeatured,
            recentMods: processedRecent,
            categories
        });
    } catch (error) {
        console.error('Home page error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Internal server error',
            user: req.user,
            currentPath: req.path
        });
    }
});

// Browse mods page
router.get('/browse', async (req, res) => {
    try {
        const filters = {
            category_id: req.query.category,
            search: req.query.search,
            limit: parseInt(req.query.limit) || 20
        };

        const mods = await db.getMods(filters);
        const categories = await db.getCategories();

        // Process mods data
        const processedMods = mods.map(mod => ({
            ...mod,
            screenshots: mod.screenshots ? JSON.parse(mod.screenshots) : [],
            tags: mod.tags ? JSON.parse(mod.tags) : []
        }));

        res.render('browse', {
            title: 'Browse Mods - Sayonika',
            user: req.user,
            mods: processedMods,
            categories,
            currentCategory: req.query.category,
            searchQuery: req.query.search
        });
    } catch (error) {
        console.error('Browse page error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Internal server error',
            user: req.user,
            currentPath: req.path
        });
    }
});

// Mod detail page - supports both slugs and IDs, with preview mode
router.get('/mod/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        const isPreview = req.query.preview === 'true';
        let mod;

        // Check if identifier is numeric (ID) or string (slug)
        if (/^\d+$/.test(identifier)) {
            mod = await db.getModById(parseInt(identifier));
        } else {
            mod = await db.getModBySlug(identifier);
        }

        if (!mod) {
            return res.status(404).render('error', {
                title: 'Mod Not Found',
                message: 'The requested mod could not be found.',
                user: req.user,
                currentPath: req.path
            });
        }

        // Handle access permissions
        if (!mod.is_published) {
            // For unpublished mods, check if user has permission to view
            if (!req.user) {
                return res.status(403).render('error', {
                    title: 'Access Denied',
                    message: 'This mod is not published yet.',
                    user: req.user,
                    currentPath: req.path
                });
            }

            // Allow access for mod author, admins, or when in preview mode
            const canView = req.user.id === mod.author_id || req.user.is_admin || isPreview;
            if (!canView) {
                return res.status(403).render('error', {
                    title: 'Access Denied',
                    message: 'This mod is not published yet.',
                    user: req.user,
                    currentPath: req.path
                });
            }
        }

        // Parse JSON fields
        mod.screenshots = mod.screenshots ? JSON.parse(mod.screenshots) : [];
        mod.tags = mod.tags ? JSON.parse(mod.tags) : [];
        mod.requirements = mod.requirements ? JSON.parse(mod.requirements) : {};

        // Add preview mode flag to template data
        res.render('mod-detail', {
            title: `${mod.title} - Sayonika`,
            user: req.user,
            mod,
            isPreview
        });
    } catch (error) {
        console.error('Mod detail error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Internal server error',
            user: req.user,
            currentPath: req.path
        });
    }
});

// Login page
router.get('/login', (req, res) => {
    if (req.user) {
        return res.redirect('/');
    }

    res.render('auth/login', {
        title: 'Login - Sayonika',
        user: null
    });
});

// Register page
router.get('/register', (req, res) => {
    if (req.user) {
        return res.redirect('/');
    }

    res.render('auth/register', {
        title: 'Register - Sayonika',
        user: null
    });
});

// User profile page
router.get('/profile', async (req, res) => {
    if (!req.user) {
        return res.redirect('/login');
    }

    try {
        // Get user's mods
        const userMods = await db.all(
            `SELECT m.*, c.name as category_name
             FROM mods m
             LEFT JOIN categories c ON m.category_id = c.id
             WHERE m.author_id = ?
             ORDER BY m.created_at DESC`,
            [req.user.id]
        );

        // Get user achievements
        const userAchievements = await db.getUserAchievements(req.user.id);

        // Get user game stats
        const userStats = await db.getUserGameStats(req.user.id);

        // Get recent achievements (last 5)
        const recentAchievements = userAchievements.slice(0, 5);

        // Check if user has a default avatar
        const hasDefaultAvatar = isDefaultAvatar(req.user.avatar_url);

        res.render('profile', {
            title: 'Profile - Sayonika',
            user: req.user,
            userMods,
            userAchievements,
            userStats,
            recentAchievements,
            currentPath: req.path,
            error: req.query.error,
            errorMessage: req.query.message ? decodeURIComponent(req.query.message) : null,
            success: req.query.success,
            hasDefaultAvatar
        });
    } catch (error) {
        console.error('Profile page error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Internal server error',
            user: req.user,
            currentPath: req.path
        });
    }
});

// Upload mod page
router.get('/upload', async (req, res) => {
    if (!req.user) {
        return res.redirect('/login');
    }

    try {
        const categories = await db.getCategories();

        res.render('upload', {
            title: 'Upload Mod - Sayonika',
            user: req.user,
            categories
        });
    } catch (error) {
        console.error('Upload page error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Internal server error',
            user: req.user,
            currentPath: req.path
        });
    }
});

// Admin dashboard
router.get('/admin', async (req, res) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).render('error', {
            title: 'Access Denied',
            message: 'Admin access required.',
            user: req.user,
            currentPath: req.path
        });
    }

    try {
        // Get admin statistics using new method
        const stats = await db.getAdminStats();

        // Get pending mods for review using new method
        const pendingMods = await db.getPendingMods();

        // Process pending mods data
        const processedPendingMods = pendingMods.map(mod => ({
            ...mod,
            screenshots: mod.screenshots ? JSON.parse(mod.screenshots) : [],
            tags: mod.tags ? JSON.parse(mod.tags) : [],
            requirements: mod.requirements ? JSON.parse(mod.requirements) : {}
        }));

        res.render('admin/dashboard', {
            title: 'Admin Dashboard - Sayonika',
            user: req.user,
            pendingMods: processedPendingMods,
            stats
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Internal server error',
            user: req.user,
            currentPath: req.path
        });
    }
});

// Admin ticket detail page
router.get('/admin/tickets/:id', async (req, res) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).render('error', {
            title: 'Access Denied',
            message: 'Admin access required.',
            user: req.user,
            currentPath: req.path
        });
    }

    try {
        const { id } = req.params;
        const ticket = await db.getSupportTicketById(parseInt(id));

        if (!ticket) {
            return res.status(404).render('error', {
                title: 'Ticket Not Found',
                message: 'The requested support ticket could not be found.',
                user: req.user,
                currentPath: req.path
            });
        }

        res.render('admin/ticket-detail', {
            title: `Support Ticket #${ticket.id} - Sayonika`,
            user: req.user,
            ticket,
            currentPath: req.path
        });
    } catch (error) {
        console.error('Admin ticket detail error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Internal server error',
            user: req.user,
            currentPath: req.path
        });
    }
});

// Maintenance page route
router.get('/maintenance', async (req, res) => {
    try {
        const maintenanceMessage = await db.getSiteSetting('maintenance_message') ||
            'Sayonika is currently undergoing maintenance. Please check back later!';

        res.render('maintenance', {
            title: 'Maintenance Mode - Sayonika',
            message: maintenanceMessage,
            user: req.user,
            currentPath: req.path
        });
    } catch (error) {
        console.error('Error loading maintenance page:', error);
        res.render('maintenance', {
            title: 'Maintenance Mode - Sayonika',
            message: 'Sayonika is currently undergoing maintenance. Please check back later!',
            user: req.user,
            currentPath: req.path
        });
    }
});

// Settings page
router.get('/settings', (req, res) => {
    if (!req.user) {
        return res.redirect('/login?redirect=' + encodeURIComponent('/settings'));
    }

    // Check if user has a default avatar
    const hasDefaultAvatar = isDefaultAvatar(req.user.avatar_url);

    res.render('settings', {
        title: 'Account Settings - Sayonika',
        user: req.user,
        hasDefaultAvatar
    });
});

// Legal pages
router.get('/terms', (req, res) => {
    res.render('legal/terms', {
        title: 'Terms of Service - Sayonika',
        user: req.user
    });
});

router.get('/privacy', (req, res) => {
    res.render('legal/privacy', {
        title: 'Privacy Policy - Sayonika',
        user: req.user
    });
});

router.get('/guidelines', (req, res) => {
    res.render('legal/guidelines', {
        title: 'Community Guidelines - Sayonika',
        user: req.user
    });
});

// Documentation routes (handled by docs router)
// This is now handled by the /docs routes in docs.js

// Redirect old api-docs route to new docs route for backward compatibility
router.get('/api-docs', (req, res) => {
    res.redirect(301, '/docs');
});

// Merge accounts page
router.get('/merge-accounts', (req, res) => {
    if (!req.user) {
        return res.redirect('/login');
    }

    const provider = req.query.provider;
    if (!provider || !['github', 'discord'].includes(provider)) {
        return res.redirect('/settings');
    }

    res.render('merge-accounts', {
        title: 'Merge Accounts - Sayonika',
        user: req.user,
        provider: provider,
        currentPath: req.path
    });
});

// Help Center page
router.get('/help', (req, res) => {
    res.render('help', {
        title: 'Help Center - Sayonika',
        user: req.user,
        currentPath: req.path
    });
});

// Contact Us page
router.get('/contact', (req, res) => {
    res.render('contact', {
        title: 'Contact Us - Sayonika',
        user: req.user,
        currentPath: req.path
    });
});

// Email verification page
router.get('/verify-email', async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.render('auth/verify-email', {
            title: 'Email Verification - Sayonika',
            user: req.user,
            success: false,
            error: 'No verification token provided'
        });
    }

    try {
        const user = await db.verifyEmailToken(token);

        if (user) {
            res.render('auth/verify-email', {
                title: 'Email Verification - Sayonika',
                user: req.user,
                success: true,
                message: 'Email verified successfully! You can now receive email notifications.'
            });
        } else {
            res.render('auth/verify-email', {
                title: 'Email Verification - Sayonika',
                user: req.user,
                success: false,
                error: 'Invalid or expired verification token'
            });
        }
    } catch (error) {
        console.error('Email verification error:', error);
        res.render('auth/verify-email', {
            title: 'Email Verification - Sayonika',
            user: req.user,
            success: false,
            error: 'An error occurred during verification'
        });
    }
});

// Notifications page
router.get('/notifications', async (req, res) => {
    if (!req.user) {
        return res.redirect('/login?redirect=' + encodeURIComponent('/notifications'));
    }

    try {
        const notifications = await db.getUserNotifications(req.user.id);
        const unreadCount = await db.getUnreadNotificationCount(req.user.id);

        res.render('notifications', {
            title: 'Notifications - Sayonika',
            user: req.user,
            currentPath: req.path,
            notifications,
            unreadCount
        });
    } catch (error) {
        console.error('Notifications page error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Internal server error',
            user: req.user,
            currentPath: req.path
        });
    }
});

// Achievements page
router.get('/achievements', async (req, res) => {
    try {
        const achievements = await db.getAchievements();

        // Group achievements by category
        const achievementsByCategory = achievements.reduce((acc, achievement) => {
            if (!acc[achievement.category]) {
                acc[achievement.category] = [];
            }
            acc[achievement.category].push(achievement);
            return acc;
        }, {});

        // Get user achievements if logged in
        let userAchievements = [];
        if (req.user) {
            userAchievements = await db.getUserAchievements(req.user.id);
        }

        const earnedAchievementIds = new Set(userAchievements.map(ua => ua.id));

        res.render('achievements', {
            title: 'Achievements - Sayonika',
            user: req.user,
            achievementsByCategory,
            earnedAchievementIds,
            userAchievements
        });
    } catch (error) {
        console.error('Achievements page error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Internal server error',
            user: req.user,
            currentPath: req.path
        });
    }
});

// Leaderboard page
router.get('/leaderboard', async (req, res) => {
    try {
        const sortBy = req.query.sort || 'achievement_points';
        const topUsers = await db.getTopUsers(20, sortBy);

        res.render('leaderboard', {
            title: 'Leaderboard - Sayonika',
            user: req.user,
            topUsers,
            currentSort: sortBy
        });
    } catch (error) {
        console.error('Leaderboard page error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Internal server error',
            user: req.user,
            currentPath: req.path
        });
    }
});

module.exports = router;
