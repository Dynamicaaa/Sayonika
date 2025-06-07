require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const cookieParser = require('cookie-parser');
const passport = require('./config/passport');

const Database = require('./database/database');
const { optionalAuth } = require('./middleware/auth');
const { checkMaintenanceMode } = require('./middleware/maintenance');
const helpers = require('./utils/helpers');

// Import routes
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const webRoutes = require('./routes/web');
const oauthRoutes = require('./routes/oauth');
const docsRoutes = require('./routes/docs');

const app = express();
const PORT = process.env.PORT || 3000;

// Debug middleware to log all requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Static files FIRST - before any other middleware that might interfere
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        console.log(`Serving static file: ${filePath}`);
        // Set proper MIME types and cache headers
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png');
        } else if (filePath.endsWith('.ico')) {
            res.setHeader('Content-Type', 'image/x-icon');
        }

        // Add cache headers for static assets in production
        if (process.env.NODE_ENV !== 'development') {
            res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
        }
    }
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, filePath) => {
        // Set proper cache headers for uploads
        if (process.env.NODE_ENV !== 'development') {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
        }
    }
}));

// Initialize database
const db = new Database();

async function initializeServer() {
    try {
        await db.initialize();
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    }
}

// Security middleware - different configs for development vs production
const isDevelopment = process.env.NODE_ENV === 'development';

if (isDevelopment) {
    // More relaxed security for development - disable problematic headers for HTTP
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                scriptSrcAttr: ["'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:", "http:"],
                fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
                connectSrc: ["'self'"]
            }
        },
        crossOriginOpenerPolicy: false, // Disable for HTTP development
        originAgentCluster: false, // Disable for HTTP development
        permissionsPolicy: false, // Disable permissions policy in development
        hsts: false // Disable HSTS in development
    }));
} else {
    // Strict security for production
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
                scriptSrcAttr: ["'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
                fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
                connectSrc: ["'self'"]
            }
        },
        permissionsPolicy: {
            features: {
                camera: ['none'],
                microphone: ['none'],
                geolocation: ['none']
            }
        }
    }));
}

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // Use env var or default to 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Use env var or default to 100 requests
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // Use env var or default to 15 minutes
    max: isDevelopment ? 50 : (parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5), // More lenient in development, use env var in production
    message: { error: 'Too many authentication attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/auth', authLimiter);
app.use(limiter);

// Development IP access logging - log IP access for debugging
if (isDevelopment) {
    app.use((req, res, next) => {
        const host = req.get('host');
        if (host && (host.includes('192.168.') || host.includes('67.183.50.4'))) {
            console.log(`IP access detected from: ${host}${req.url}`);
            console.log(`Cookies:`, req.cookies);
            console.log(`Session ID:`, req.sessionID);
        }
        next();
    });
}

// CORS - automatically handle HTTP/HTTPS variants
const getAllowedOrigins = () => {
    const baseOrigins = process.env.ALLOWED_ORIGINS ?
        process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) :
        [process.env.BASE_URL || 'https://localhost:3000'];

    // Automatically add HTTP/HTTPS variants and common localhost variations
    const expandedOrigins = new Set();

    baseOrigins.forEach(origin => {
        expandedOrigins.add(origin);

        // Add HTTP/HTTPS variants
        if (origin.startsWith('https://')) {
            expandedOrigins.add(origin.replace('https://', 'http://'));
        } else if (origin.startsWith('http://')) {
            expandedOrigins.add(origin.replace('http://', 'https://'));
        }

        // Add localhost variants for development
        if (isDevelopment) {
            const url = new URL(origin);
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
                expandedOrigins.add(`http://localhost:${url.port || '3000'}`);
                expandedOrigins.add(`https://localhost:${url.port || '3000'}`);
                expandedOrigins.add(`http://127.0.0.1:${url.port || '3000'}`);
                expandedOrigins.add(`https://127.0.0.1:${url.port || '3000'}`);
            }
        }
    });

    return Array.from(expandedOrigins);
};

if (isDevelopment) {
    app.use(cors({
        origin: true, // Allow all origins in development
        credentials: true
    }));
} else {
    app.use(cors({
        origin: getAllowedOrigins(),
        credentials: true
    }));
}

// Compression
app.use(compression());

// Logging
app.use(morgan('combined'));

// Cookie parsing middleware
app.use(cookieParser());

// Session configuration with persistent SQLite store
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: './database',
        table: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'your-session-secret-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.ENABLE_HTTPS === 'true', // Require HTTPS when SSL is enabled
        httpOnly: true, // Prevent XSS attacks
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for persistent sessions
        sameSite: 'lax' // Use 'lax' for better compatibility with IP access
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Body parsing middleware with high limits for file uploads
app.use(express.json({ limit: '10gb' }));
app.use(express.urlencoded({ extended: true, limit: '10gb' }));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Apply authentication middleware globally - AFTER static files
app.use(optionalAuth);

// Apply maintenance mode middleware - AFTER authentication
app.use(checkMaintenanceMode);

// Make user and helpers available in all templates
app.use((req, res, next) => {
    res.locals.user = req.user;
    res.locals.currentPath = req.path;
    res.locals.helpers = helpers;

    // Debug logging for authentication status
    if (isDevelopment && req.get('host') && (req.get('host').includes('192.168.') || req.get('host').includes('67.183.50.4'))) {
        console.log(`Auth status for ${req.get('host')}${req.path}: user=${req.user ? req.user.username : 'none'}`);
    }

    next();
});

// Favicon handler
app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // No content for favicon if not found
});

// Routes
app.use('/api', apiRoutes);
app.use('/auth', oauthRoutes);
app.use('/docs', docsRoutes);
app.use('/', webRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Page Not Found',
        message: 'The page you are looking for could not be found.',
        user: req.user,
        currentPath: req.path
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';

    res.status(err.status || 500);

    if (req.path.startsWith('/api/')) {
        res.json({
            error: isDevelopment ? err.message : 'Internal server error',
            ...(isDevelopment && { stack: err.stack })
        });
    } else {
        res.render('error', {
            title: 'Error',
            message: isDevelopment ? err.message : 'Something went wrong',
            user: req.user,
            currentPath: req.path,
            ...(isDevelopment && { error: err })
        });
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await db.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await db.close();
    process.exit(0);
});

// Start server
initializeServer().then(() => {
    const enableHttps = process.env.ENABLE_HTTPS === 'true';

    if (enableHttps) {
        // HTTPS Server
        try {
            const sslKeyPath = process.env.SSL_KEY_PATH;
            const sslCertPath = process.env.SSL_CERT_PATH;

            if (!sslKeyPath || !sslCertPath) {
                throw new Error('SSL_KEY_PATH and SSL_CERT_PATH must be set when ENABLE_HTTPS=true');
            }

            if (!fs.existsSync(sslKeyPath)) {
                throw new Error(`SSL key file not found: ${sslKeyPath}`);
            }

            if (!fs.existsSync(sslCertPath)) {
                throw new Error(`SSL certificate file not found: ${sslCertPath}`);
            }

            const httpsOptions = {
                key: fs.readFileSync(sslKeyPath),
                cert: fs.readFileSync(sslCertPath)
            };

            https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
                console.log(`Sayonika HTTPS server running on port ${PORT}`);
                console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
                console.log(`Base URL: ${process.env.BASE_URL || `https://localhost:${PORT}`}`);
                console.log(`Visit: https://localhost:${PORT}`);
                console.log(`SSL Key: ${sslKeyPath}`);
                console.log(`SSL Cert: ${sslCertPath}`);
            });
        } catch (error) {
            console.error('Failed to start HTTPS server:', error.message);
            console.log('Falling back to HTTP server...');

            // Fallback to HTTP
            http.createServer(app).listen(PORT, '0.0.0.0', () => {
                console.log(`Sayonika HTTP server running on port ${PORT} (HTTPS failed)`);
                console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
                console.log(`Visit: http://localhost:${PORT}`);
            });
        }
    } else {
        // HTTP Server
        http.createServer(app).listen(PORT, '0.0.0.0', () => {
            console.log(`Sayonika HTTP server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`Base URL: ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
            console.log(`Visit: http://localhost:${PORT}`);
        });
    }
});

module.exports = app;
