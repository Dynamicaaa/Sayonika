require('dotenv').config();

const express = require('express');
const path = require('path');
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
const helpers = require('./utils/helpers');

// Import routes
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const webRoutes = require('./routes/web');
const oauthRoutes = require('./routes/oauth');
const docsRoutes = require('./routes/docs');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Development redirect middleware - redirect IP access to localhost for better security header support
if (isDevelopment) {
    app.use((req, res, next) => {
        const host = req.get('host');
        if (host && host.includes('192.168.') && !req.url.startsWith('/api/')) {
            const newUrl = `http://localhost:${PORT}${req.url}`;
            console.log(`Redirecting IP access to localhost: ${newUrl}`);
            return res.redirect(302, newUrl);
        }
        next();
    });
}

// CORS - more permissive in development
if (isDevelopment) {
    app.use(cors({
        origin: true, // Allow all origins in development
        credentials: true
    }));
} else {
    app.use(cors({
        origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [process.env.BASE_URL || 'http://localhost:3000'],
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
        secure: process.env.NODE_ENV === 'production', // Only require HTTPS in production
        httpOnly: true, // Prevent XSS attacks
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for persistent sessions
        sameSite: isDevelopment ? 'lax' : 'strict' // More relaxed in development
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files with proper headers
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        // Set proper MIME types and cache headers
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png');
        } else if (path.endsWith('.ico')) {
            res.setHeader('Content-Type', 'image/x-icon');
        }

        // Add cache headers for static assets in production
        if (!isDevelopment) {
            res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
        }
    }
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, path) => {
        // Set proper cache headers for uploads
        if (!isDevelopment) {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
        }
    }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Apply authentication middleware globally
app.use(optionalAuth);

// Make user and helpers available in all templates
app.use((req, res, next) => {
    res.locals.user = req.user;
    res.locals.currentPath = req.path;
    res.locals.helpers = helpers;
    next();
});

// Routes
app.use('/api', apiRoutes);
app.use('/api/auth', authRoutes);
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
    app.listen(PORT, () => {
        console.log(`Sayonika server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`Visit: http://localhost:${PORT}`);
    });
});

module.exports = app;
