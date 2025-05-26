const Database = require('../database/database');

const db = new Database();

// Initialize database connection
db.connect().catch(console.error);

// Middleware to check if site is in maintenance mode
const checkMaintenanceMode = async (req, res, next) => {
    try {
        // Check if maintenance mode is enabled
        const isMaintenanceMode = await db.isMaintenanceMode();
        
        if (!isMaintenanceMode) {
            return next();
        }

        // Allow admin users to bypass maintenance mode
        if (req.user && req.user.is_admin) {
            return next();
        }

        // Allow access to certain routes during maintenance
        const allowedPaths = [
            '/health',
            '/api/health',
            '/auth/login',
            '/auth/logout',
            '/admin',
            '/maintenance',
            // Static assets
            '/css/',
            '/js/',
            '/images/',
            '/uploads/',
            '/favicon.ico'
        ];

        // Check if current path is allowed
        const isAllowedPath = allowedPaths.some(path => {
            if (path.endsWith('/')) {
                return req.path.startsWith(path);
            }
            return req.path === path || req.path.startsWith(path + '/');
        });

        if (isAllowedPath) {
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

        // For web requests, render maintenance page
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
