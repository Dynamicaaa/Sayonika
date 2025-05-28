const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { body, query, validationResult } = require('express-validator');
const Database = require('../database/database');
const { authenticateToken, requireAuth } = require('../middleware/auth');
const { generateDefaultAvatar, deleteAvatarFile } = require('../utils/helpers');
const emailService = require('../utils/emailService');

const router = express.Router();
const db = new Database();

// Initialize database connection
db.connect().catch(console.error);

// Check username availability endpoint
router.get('/check-username', [
    query('username')
        .isLength({ min: 3, max: 50 })
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username must be 3-50 characters and contain only letters, numbers, underscores, and hyphens')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username } = req.query;

        // Check if username exists
        const existingUser = await db.getUserByUsername(username);
        if (existingUser) {
            return res.status(409).json({ error: 'Username is already taken' });
        }

        res.json({ available: true, message: 'Username is available' });
    } catch (error) {
        console.error('Username check error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Check email availability endpoint
router.get('/check-email', [
    query('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email } = req.query;

        // Check if email exists
        const existingUser = await db.getUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ error: 'Email is already registered' });
        }

        res.json({ available: true, message: 'Email is available' });
    } catch (error) {
        console.error('Email check error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/avatars');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const avatarUpload = multer({
    storage: avatarStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (JPG, JPEG, PNG, GIF, WebP) are allowed'));
        }
    }
});

// Register endpoint
router.post('/register', [
    body('username')
        .isLength({ min: 3, max: 50 })
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username must be 3-50 characters and contain only letters, numbers, underscores, and hyphens'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('display_name')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Display name must be less than 100 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, password, display_name } = req.body;

        // Check if user already exists
        const existingUser = await db.getUserByUsername(username);
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const existingEmail = await db.getUserByEmail(email);
        if (existingEmail) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Check if this is the first user (should be admin)
        const userCount = await db.get('SELECT COUNT(*) as count FROM users');
        const isFirstUser = userCount.count === 0;

        // Create user first to get the user ID
        const result = await db.createUser({
            username,
            email,
            password_hash,
            display_name: display_name || username,
            is_admin: isFirstUser
        });

        // Generate and save default avatar after user creation
        try {
            const avatarUrl = await generateDefaultAvatar(result.id);
            if (avatarUrl) {
                await db.run(
                    'UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [avatarUrl, result.id]
                );
                console.log(`Generated default avatar for user ${result.id}: ${avatarUrl}`);
            } else {
                console.log(`Failed to generate default avatar for user ${result.id}, using fallback`);
            }
        } catch (avatarError) {
            console.error('Error generating default avatar:', avatarError);
            // Continue with registration even if avatar generation fails
        }

        // Send verification email for new users (except first user who is auto-verified)
        if (!isFirstUser) {
            try {
                await db.sendVerificationEmail(result.id);
                console.log(`Verification email sent to ${email}`);
            } catch (emailError) {
                console.error('Failed to send verification email:', emailError);
                // Continue with registration even if email fails
            }
        }

        // Only generate JWT token for first user (admin) - others must verify email first
        let token = null;
        if (isFirstUser) {
            token = jwt.sign(
                { userId: result.id, username },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '24h' }
            );

            // Set token as httpOnly cookie for persistence across server restarts
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
                sameSite: 'lax'
            });
        }

        const message = isFirstUser
            ? 'Welcome! You are now the site administrator.'
            : 'Registration successful! Please check your email and click the verification link to complete your account setup.';

        const responseData = {
            message,
            user: {
                id: result.id,
                username,
                email,
                display_name: display_name || username,
                is_admin: isFirstUser,
                email_verified: isFirstUser // First user is auto-verified
            },
            requiresEmailVerification: !isFirstUser
        };

        // Only include token for first user
        if (isFirstUser) {
            responseData.token = token;
        }

        res.status(201).json(responseData);
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login endpoint
router.post('/login', [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password, remember } = req.body;

        // Find user by username or email
        let user = await db.getUserByUsername(username);
        if (!user) {
            // Normalize email for lookup if username is an email
            const normalizedEmail = username.toLowerCase().trim();
            user = await db.getUserByEmail(normalizedEmail);
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if user has a password hash (OAuth users might not have one)
        if (!user.password_hash || typeof user.password_hash !== 'string') {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check email verification (except for first user/admin or OAuth users without email)
        const isFirstUser = user.is_admin && user.is_owner;
        const hasEmail = user.email && user.email.trim();

        if (hasEmail && !isFirstUser && !user.email_verified) {
            return res.status(403).json({
                error: 'Email verification required',
                code: 'EMAIL_NOT_VERIFIED',
                message: 'Please verify your email address before logging in. Check your email for the verification link.',
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    email_verified: false
                }
            });
        }

        // Update last login
        await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        // Generate JWT token with different expiration based on remember me
        const expiresIn = remember ? '30d' : '24h'; // 30 days if remember me, 24 hours otherwise
        const maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

        const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn }
        );

        // Set token as httpOnly cookie for persistence across server restarts
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge,
            sameSite: 'lax'
        });

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                display_name: user.display_name,
                is_admin: user.is_admin,
                is_verified: user.is_verified,
                email_verified: user.email_verified,
                avatar_url: user.avatar_url
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin login endpoint - validates admin status after login
router.post('/admin-login', [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password, remember } = req.body;

        // Find user by username or email
        let user = await db.getUserByUsername(username);
        if (!user) {
            // Normalize email for lookup if username is an email
            const normalizedEmail = username.toLowerCase().trim();
            user = await db.getUserByEmail(normalizedEmail);
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const bcrypt = require('bcrypt');
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if user is admin - this is the key difference from regular login
        if (!user.is_admin) {
            // Log out any existing session and clear cookies
            req.session.destroy((err) => {
                if (err) {
                    console.error('Session destruction error:', err);
                }
            });
            res.clearCookie('token');
            res.clearCookie('connect.sid');

            return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
        }

        // Update last login
        await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        // Generate JWT token with different expiration based on remember me
        const expiresIn = remember ? '30d' : '24h'; // 30 days if remember me, 24 hours otherwise
        const maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

        const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn }
        );

        // Set token as httpOnly cookie for persistence across server restarts
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge,
            sameSite: 'lax'
        });

        // Store user in session for consistency with OAuth
        req.session.user = user;

        res.json({
            message: 'Admin login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                display_name: user.display_name,
                avatar_url: user.avatar_url,
                is_admin: user.is_admin,
                is_verified: user.is_verified,
                is_owner: user.is_owner
            }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Forgot password endpoint
router.post('/forgot-password', [
    body('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email } = req.body;

        // Normalize email to lowercase for consistent lookup
        const normalizedEmail = email.toLowerCase().trim();

        // Find user by email
        const user = await db.getUserByEmail(normalizedEmail);
        if (!user) {
            // Don't reveal if email exists or not for security
            return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
        }

        // Generate reset token
        const crypto = require('crypto');
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

        // Store reset token in database
        await db.run(
            'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
            [resetToken, resetTokenExpiry.toISOString(), user.id]
        );

        // Send email using EmailService
        try {
            const result = await emailService.sendEmail(normalizedEmail, 'password_reset', {
                username: user.username,
                resetToken: resetToken
            });

            if (result.success) {
                res.json({ message: 'Password reset email sent successfully!' });
            } else {
                console.log('Email not configured, reset token:', resetToken);
                res.json({
                    message: 'Password reset requested. Check server logs for reset token (email not configured).',
                    resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
                });
            }
        } catch (emailError) {
            console.error('Email sending error:', emailError);
            // Still return success to not reveal if email exists
            res.json({
                message: 'Password reset requested. If email service is available, an email has been sent.',
                resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
            });
        }

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset password endpoint
router.post('/reset-password', [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { token, password } = req.body;

        // Find user by reset token
        const user = await db.get(
            'SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > ?',
            [token, new Date().toISOString()]
        );

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        // Hash new password
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(password, 12);

        // Update password and clear reset token
        await db.run(
            'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
            [hashedPassword, user.id]
        );

        res.json({ message: 'Password reset successfully!' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            bio: user.bio,
            is_admin: user.is_admin,
            is_verified: user.is_verified,
            created_at: user.created_at,
            last_login: user.last_login
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user profile
router.put('/profile', authenticateToken, [
    body('display_name')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Display name must be less than 100 characters'),
    body('bio')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Bio must be less than 1000 characters'),
    body('avatar_url')
        .optional()
        .custom((value) => {
            if (value === null || value === '') return true; // Allow null/empty for removal
            if (typeof value === 'string' && value.match(/^https?:\/\/.+/)) return true; // Valid URL
            throw new Error('Avatar URL must be a valid URL or empty to remove');
        })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { display_name, bio, avatar_url } = req.body;
        const userId = req.user.id;

        // If avatar_url is being changed, clean up old avatar file
        if (avatar_url !== undefined) {
            const currentUser = await db.get('SELECT avatar_url FROM users WHERE id = ?', [userId]);
            if (currentUser.avatar_url && currentUser.avatar_url !== avatar_url) {
                await deleteAvatarFile(currentUser.avatar_url, 'profile update avatar change');
            }
        }

        await db.run(
            'UPDATE users SET display_name = ?, bio = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [display_name, bio, avatar_url, userId]
        );

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Upload profile picture
router.post('/profile/avatar', authenticateToken, avatarUpload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const userId = req.user.id;
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;

        // Delete old avatar file if it exists (including default avatars)
        const currentUser = await db.get('SELECT avatar_url FROM users WHERE id = ?', [userId]);
        if (currentUser.avatar_url) {
            await deleteAvatarFile(currentUser.avatar_url, 'avatar upload replacement');
        }

        await db.run(
            'UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [avatarUrl, userId]
        );

        res.json({
            message: 'Profile picture uploaded successfully',
            avatar_url: avatarUrl
        });
    } catch (error) {
        console.error('Avatar upload error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove profile picture
router.delete('/profile/avatar', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get current avatar to delete file if it's uploaded
        const currentUser = await db.get('SELECT avatar_url FROM users WHERE id = ?', [userId]);
        if (currentUser.avatar_url) {
            await deleteAvatarFile(currentUser.avatar_url, 'avatar removal');
        }

        // Generate a new default avatar instead of setting to NULL
        let newAvatarUrl = null;
        try {
            newAvatarUrl = await generateDefaultAvatar(userId);
            if (newAvatarUrl) {
                console.log(`Generated new default avatar for user ${userId}: ${newAvatarUrl}`);
            }
        } catch (avatarError) {
            console.error('Error generating new default avatar:', avatarError);
            // Continue with NULL if avatar generation fails
        }

        await db.run(
            'UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newAvatarUrl, userId]
        );

        res.json({
            message: 'Profile picture removed successfully',
            avatar_url: newAvatarUrl
        });
    } catch (error) {
        console.error('Avatar removal error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify token endpoint
router.get('/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// Logout endpoint
router.post('/logout', (req, res) => {
    try {
        // Clear JWT token cookie
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        // Clear session if it exists (for OAuth users)
        if (req.session) {
            req.session.destroy((err) => {
                if (err) {
                    console.error('Session destruction error:', err);
                }
            });
        }

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user status (for frontend to check if logged in)
router.get('/me', (req, res) => {
    if (req.user) {
        res.json({
            authenticated: true,
            user: {
                id: req.user.id,
                username: req.user.username,
                email: req.user.email,
                display_name: req.user.display_name,
                avatar_url: req.user.avatar_url,
                is_admin: req.user.is_admin,
                is_verified: req.user.is_verified
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Auth status endpoint (for mod manager integration)
router.get('/status', (req, res) => {
    if (req.user) {
        res.json({
            authenticated: true,
            user: {
                id: req.user.id,
                username: req.user.username,
                email: req.user.email,
                display_name: req.user.display_name,
                avatar_url: req.user.avatar_url,
                is_admin: req.user.is_admin,
                is_verified: req.user.is_verified,
                is_owner: req.user.is_owner
            }
        });
    } else {
        res.json({ authenticated: false, user: null });
    }
});


// Change password
router.post('/change-password', requireAuth, [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            errors: errors.array()
        });
    }

    const { currentPassword, newPassword } = req.body;

    try {
        // Get current user with password
        const user = await db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);

        if (!user.password_hash || typeof user.password_hash !== 'string') {
            return res.status(400).json({ error: 'No password set. Please set a password first.' });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        await db.run(
            'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hashedPassword, req.user.id]
        );

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// Delete account
router.delete('/account', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get user's avatar for cleanup
        const user = await db.get('SELECT avatar_url FROM users WHERE id = ?', [userId]);

        // Delete user's avatar file if it exists
        if (user && user.avatar_url) {
            await deleteAvatarFile(user.avatar_url, 'account deletion');
        }

        // Delete user's mods first (cascade)
        await db.run('DELETE FROM mods WHERE author_id = ?', [userId]);

        // Delete user
        await db.run('DELETE FROM users WHERE id = ?', [userId]);

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Email verification routes
router.post('/resend-verification', requireAuth, async (req, res) => {
    try {
        const user = req.user;

        if (user.email_verified) {
            return res.status(400).json({ error: 'Email is already verified' });
        }

        if (!user.email) {
            return res.status(400).json({ error: 'No email address associated with this account' });
        }

        const result = await db.sendVerificationEmail(user.id);

        if (result.success) {
            res.json({ message: 'Verification email sent successfully' });
        } else {
            res.status(500).json({ error: result.error || 'Failed to send verification email' });
        }
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Email notification preferences
router.get('/email-preferences', requireAuth, async (req, res) => {
    try {
        const preferences = await db.getUserEmailPreferences(req.user.id);
        res.json(preferences);
    } catch (error) {
        console.error('Get email preferences error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/email-preferences', requireAuth, [
    body('email_notifications_enabled').isBoolean().withMessage('Email notifications enabled must be boolean'),
    body('email_mod_approved').isBoolean().withMessage('Mod approval emails must be boolean'),
    body('email_achievements').isBoolean().withMessage('Achievement emails must be boolean'),
    body('email_comments').isBoolean().withMessage('Comment emails must be boolean')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const preferences = {
            email_notifications_enabled: req.body.email_notifications_enabled,
            email_mod_approved: req.body.email_mod_approved,
            email_achievements: req.body.email_achievements,
            email_comments: req.body.email_comments
        };

        await db.updateEmailPreferences(req.user.id, preferences);
        res.json({ message: 'Email preferences updated successfully' });
    } catch (error) {
        console.error('Update email preferences error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
