const jwt = require('jsonwebtoken');
const Database = require('../database/database');

const db = new Database();

// Initialize database connection
db.connect().catch(console.error);

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    let token = null;

    // Extract token from Authorization header if present
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    // Fall back to cookie token if no valid header token
    if (!token && req.cookies?.token) {
        token = req.cookies.token;
    }

    if (!token || !token.trim()) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await db.getUserById(decoded.userId);

        if (!user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Middleware to check if user is owner
const requireOwner = (req, res, next) => {
    if (!req.user || !req.user.is_owner) {
        return res.status(403).json({ error: 'Owner access required' });
    }
    next();
};

// Middleware to check if user is verified
const requireVerified = (req, res, next) => {
    if (!req.user || !req.user.is_verified) {
        return res.status(403).json({ error: 'Verified account required' });
    }
    next();
};

// Required authentication - fails if no valid token or session
const requireAuth = async (req, res, next) => {
    try {
        // Check for session-based authentication first (OAuth)
        if (req.user) {
            return next();
        }

        // Check for JWT token in header or cookie
        const authHeader = req.headers['authorization'];
        let token = null;

        // Extract token from Authorization header if present
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }

        // Fall back to cookie token if no valid header token
        if (!token && req.cookies?.token) {
            token = req.cookies.token;
        }

        if (!token || !token.trim()) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await db.getUserById(decoded.userId);

        if (!user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
    try {
        // Check for session-based authentication first (OAuth)
        if (req.user) {
            return next();
        }

        // Check for JWT token in header or cookie
        const authHeader = req.headers['authorization'];
        let token = null;

        // Extract token from Authorization header if present
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }

        // Fall back to cookie token if no valid header token
        if (!token && req.cookies?.token) {
            token = req.cookies.token;
        }

        if (token && token.trim()) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
                const user = await db.getUserById(decoded.userId);
                if (user) {
                    req.user = user;
                    // Also set in session for consistency with OAuth
                    if (req.session) {
                        req.session.user = user;
                    }
                }
            } catch (error) {
                // Clear invalid token cookie
                if (req.cookies?.token) {
                    res.clearCookie('token');
                }
                // Ignore token errors for optional auth
            }
        }
    } catch (error) {
        // Ignore all errors for optional auth
    }

    next();
};

module.exports = {
    authenticateToken,
    requireAuth,
    requireAdmin,
    requireOwner,
    requireVerified,
    optionalAuth
};
