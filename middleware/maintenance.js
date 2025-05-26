const Database = require('../database/database');

const db = new Database();

// Initialize database connection
db.connect().catch(console.error);

// Middleware to check if site is in maintenance mode
const checkMaintenanceMode = async (req, res, next) => {
    try {
        // Check if maintenance mode is enabled
        const isMaintenanceMode = await db.isMaintenanceMode();

        // Debug logging
        if (process.env.NODE_ENV === 'development') {
            console.log(`[Maintenance Check] Path: ${req.path}, Maintenance Mode: ${isMaintenanceMode}, User: ${req.user ? req.user.username : 'none'}`);
        }

        if (!isMaintenanceMode) {
            return next();
        }

        // Allow admin users to bypass maintenance mode
        if (req.user && req.user.is_admin) {
            return next();
        }

        // Only allow essential routes and mod browsing during maintenance
        const allowedPaths = [
            // Essential system routes
            '/health',
            '/api/health',
            '/maintenance',

            // Admin access (only for already logged in admins)
            '/admin',

            // Mod browsing (read-only) - NOW INCLUDING home page with warning
            '/',
            '/browse',
            '/mod/',

            // Static assets
            '/css/',
            '/js/',
            '/images/',
            '/uploads/',
            '/favicon.ico'
        ];

        // Allowed API routes (read-only for mod browsing)
        const allowedApiRoutes = [
            '/api/health',
            '/api/mods',      // GET only for browsing
            '/api/categories', // GET only for browsing
            '/api/admin'      // Admin routes
        ];

        // Check if current path is allowed
        const isAllowedPath = allowedPaths.some(path => {
            if (path.endsWith('/')) {
                return req.path.startsWith(path);
            }
            return req.path === path || req.path.startsWith(path + '/');
        });

        // Debug logging
        if (process.env.NODE_ENV === 'development') {
            console.log(`[Maintenance Check] Path: ${req.path}, Allowed: ${isAllowedPath}, Matched paths: ${allowedPaths.filter(path => {
                if (path.endsWith('/')) {
                    return req.path.startsWith(path);
                }
                return req.path === path || req.path.startsWith(path + '/');
            })}`);
        }

        // For API routes, check if it's an allowed API route and method
        if (req.path.startsWith('/api/')) {
            const isAllowedApiRoute = allowedApiRoutes.some(route => {
                return req.path === route || req.path.startsWith(route + '/');
            });

            if (isAllowedApiRoute) {
                // For mod and category APIs, only allow GET requests
                if ((req.path.startsWith('/api/mods') || req.path.startsWith('/api/categories')) && req.method !== 'GET') {
                    return res.status(503).json({
                        error: 'Service Unavailable',
                        message: 'Write operations are temporarily unavailable due to maintenance.',
                        maintenance: true
                    });
                }
                return next();
            } else {
                return res.status(503).json({
                    error: 'Service Unavailable',
                    message: 'This API endpoint is temporarily unavailable due to maintenance.',
                    maintenance: true
                });
            }
        }

        if (isAllowedPath) {
            // For allowed paths, add maintenance mode info to response locals
            const maintenanceMessage = await db.getSiteSetting('maintenance_message') ||
                'Sayonika is currently undergoing maintenance. Please check back later!';

            res.locals.maintenanceMode = true;
            res.locals.maintenanceMessage = maintenanceMessage;
            return next();
        }

        // For API requests, return JSON response
        if (req.path.startsWith('/api/')) {
            return res.status(503).json({
                error: 'Service Unavailable',
                message: 'The site is currently undergoing maintenance. Please try again later.',
                maintenance: true
            });
        }

        // For web requests that are not allowed, render maintenance page
        const maintenanceMessage = await db.getSiteSetting('maintenance_message') ||
            'Sayonika is currently undergoing maintenance. Please check back later!';

        return res.status(503).render('maintenance', {
            title: 'Maintenance Mode - Sayonika',
            message: maintenanceMessage,
            user: req.user,
            currentPath: req.path
        });

    } catch (error) {
        console.error('Maintenance mode check error:', error);
        // If there's an error checking maintenance mode, allow the request to continue
        // to prevent the site from being completely inaccessible
        next();
    }
};

module.exports = {
    checkMaintenanceMode
};
