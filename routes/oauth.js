const express = require('express');
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const router = express.Router();

// GitHub OAuth routes
router.get('/github', optionalAuth, async (req, res, next) => {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
        return res.status(400).json({ error: 'GitHub OAuth not configured' });
    }

    // Check if user is already logged in and this is not a linking request
    if (req.user && req.query.link !== 'true') {
        console.log('User already logged in, redirecting to merge page for GitHub');
        // Store the OAuth provider they're trying to connect
        req.session.pendingOAuthProvider = 'github';
        req.session.pendingOAuthAction = 'merge';
        return res.redirect('/merge-accounts?provider=github');
    }

    // Store remember me preference in session
    if (req.query.remember === 'true') {
        req.session.rememberMe = true;
    }

    // Store linking information if this is a link request
    if (req.query.link === 'true') {
        console.log('GitHub OAuth link request detected');

        // Check for link token in query params
        if (req.query.token) {
            try {
                const decoded = jwt.verify(req.query.token, process.env.JWT_SECRET || 'your-secret-key');
                console.log('Valid link token found:', {
                    linkUserId: decoded.linkUserId,
                    linkProvider: decoded.linkProvider,
                    timestamp: decoded.timestamp
                });

                // Store linking information in session with explicit save
                req.session.linkUserId = decoded.linkUserId;
                req.session.linkProvider = decoded.linkProvider;
                req.session.linkTimestamp = Date.now();

                console.log('Storing link data in session:', {
                    linkUserId: req.session.linkUserId,
                    linkProvider: req.session.linkProvider,
                    sessionId: req.sessionID
                });

                // Force session save and wait for it to complete
                req.session.save((err) => {
                    if (err) {
                        console.error('Session save error before GitHub OAuth:', err);
                        return res.redirect('/profile?error=session_save_failed');
                    }

                    console.log('Session saved successfully, proceeding with GitHub OAuth');
                    passport.authenticate('github', {
                        scope: ['user:email']
                    })(req, res, next);
                });
                return; // Important: return here to prevent the code below from executing
            } catch (error) {
                console.error('Invalid link token:', error);
                return res.redirect('/profile?error=invalid_link_token');
            }
        } else {
            console.log('Warning: Link request without token');
            return res.redirect('/profile?error=missing_link_token');
        }
    }

    passport.authenticate('github', {
        scope: ['user:email']
    })(req, res, next);
});

router.get('/github/callback', (req, res, next) => {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
        return res.redirect('/login?error=github_not_configured');
    }

    passport.authenticate('github', {
        failureRedirect: '/login?error=github_auth_failed',
        failureFlash: false
    }, (err, user, info) => {
        if (err) {
            console.error('GitHub OAuth authentication error:', err);

            // Check if this was a linking error with detailed message
            if (err.message && err.message.includes('already linked')) {
                // Encode the detailed error message for URL
                const encodedMessage = encodeURIComponent(err.message);
                return res.redirect(`/profile?error=account_already_linked&provider=github&message=${encodedMessage}`);
            }

            return res.redirect('/login?error=github_auth_error');
        }

        if (!user) {
            console.error('GitHub OAuth failed - no user returned:', info);
            return res.redirect('/login?error=github_auth_failed');
        }

        // Check if this was a linking request
        const wasLinking = req.session.linkProvider === 'github';

        if (wasLinking) {
            // For linking requests, don't log in - just redirect to profile
            console.log('GitHub account linking completed, redirecting to profile');

            // Clean up session data
            delete req.session.returnTo;
            delete req.session.rememberMe;
            delete req.session.linkUserId;
            delete req.session.linkProvider;

            return res.redirect('/profile?success=github_linked');
        }

        // For normal login (not linking), log the user in
        req.logIn(user, (err) => {
            if (err) {
                console.error('GitHub OAuth login error:', err);
                return res.redirect('/login?error=github_login_failed');
            }

            try {
                // Check if remember me was requested (from session or query param)
                const rememberMe = req.session.rememberMe || req.query.remember === 'true';
                const expiresIn = rememberMe ? '30d' : '24h';
                const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

                // Generate JWT token
                const token = jwt.sign(
                    {
                        userId: user.id,
                        username: user.username
                    },
                    process.env.JWT_SECRET || 'your-secret-key',
                    { expiresIn }
                );

                // Set token in cookie for web interface
                res.cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    maxAge,
                    sameSite: 'lax'
                });

                // Normal login, redirect to intended page or home
                const redirectUrl = req.session.returnTo || '/';

                // Clean up session data
                delete req.session.returnTo;
                delete req.session.rememberMe;
                delete req.session.linkUserId;
                delete req.session.linkProvider;

                // Properly construct redirect URL with auth=success parameter
                console.log('GitHub OAuth - Original redirectUrl:', redirectUrl);
                console.log('GitHub OAuth - Request protocol:', req.protocol);
                console.log('GitHub OAuth - Request host:', req.get('host'));

                const finalUrl = new URL(redirectUrl, `${req.protocol}://${req.get('host')}`);
                finalUrl.searchParams.set('auth', 'success');
                const redirectPath = finalUrl.pathname + finalUrl.search;

                console.log('GitHub OAuth - Final URL object:', finalUrl.toString());
                console.log('GitHub OAuth - Redirect path:', redirectPath);
                res.redirect(redirectPath);
            } catch (error) {
                console.error('GitHub OAuth token generation error:', error);
                res.redirect('/login?error=token_generation_failed');
            }
        });
    })(req, res, next);
});

// Discord OAuth routes
router.get('/discord', optionalAuth, async (req, res, next) => {
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
        return res.status(400).json({ error: 'Discord OAuth not configured' });
    }

    console.log('Discord OAuth initiated with Client ID:', process.env.DISCORD_CLIENT_ID);
    console.log('Discord Callback URL:', process.env.DISCORD_CALLBACK_URL);
    console.log('Request query params:', req.query);
    console.log('Session ID:', req.sessionID);
    console.log('Session before Discord OAuth:', req.session);
    console.log('Session linking data check:', {
        linkUserId: req.session.linkUserId,
        linkProvider: req.session.linkProvider,
        hasUser: !!req.session.user
    });

    // Check if user is already logged in and this is not a linking request
    if (req.user && req.query.link !== 'true') {
        console.log('User already logged in, redirecting to merge page for Discord');
        // Store the OAuth provider they're trying to connect
        req.session.pendingOAuthProvider = 'discord';
        req.session.pendingOAuthAction = 'merge';
        return res.redirect('/merge-accounts?provider=discord');
    }

    // Store remember me preference in session
    if (req.query.remember === 'true') {
        req.session.rememberMe = true;
    }

    // Store linking information if this is a link request
    if (req.query.link === 'true') {
        console.log('Discord OAuth link request detected');

        // Check for link token in query params
        if (req.query.token) {
            try {
                const decoded = jwt.verify(req.query.token, process.env.JWT_SECRET || 'your-secret-key');
                console.log('Valid link token found:', {
                    linkUserId: decoded.linkUserId,
                    linkProvider: decoded.linkProvider,
                    timestamp: decoded.timestamp
                });

                // Store linking information in session with explicit save
                req.session.linkUserId = decoded.linkUserId;
                req.session.linkProvider = decoded.linkProvider;
                req.session.linkTimestamp = Date.now();

                console.log('Storing link data in session:', {
                    linkUserId: req.session.linkUserId,
                    linkProvider: req.session.linkProvider,
                    sessionId: req.sessionID
                });

                // Force session save and wait for it to complete
                req.session.save((err) => {
                    if (err) {
                        console.error('Session save error before Discord OAuth:', err);
                        return res.redirect('/profile?error=session_save_failed');
                    }

                    console.log('Session saved successfully, proceeding with Discord OAuth');
                    // Pass the link token as state parameter for Discord OAuth
                    passport.authenticate('discord', {
                        state: req.query.token
                    })(req, res, next);
                });
                return; // Important: return here to prevent the code below from executing
            } catch (error) {
                console.error('Invalid link token:', error);
                return res.redirect('/profile?error=invalid_link_token');
            }
        } else {
            console.log('Warning: Link request without token');
            return res.redirect('/profile?error=missing_link_token');
        }
    }

    passport.authenticate('discord')(req, res, next);
});

router.get('/discord/callback', (req, res, next) => {
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
        return res.redirect('/login?error=discord_not_configured');
    }

    console.log('Discord OAuth callback received');
    console.log('Query params:', req.query);
    console.log('Session data:', req.session);

    passport.authenticate('discord', {
        failureRedirect: '/login?error=discord_auth_failed',
        failureFlash: false
    }, (err, user, info) => {
        if (err) {
            console.error('Discord OAuth authentication error:', err);

            // Check if this was a linking error with detailed message
            if (err.message && err.message.includes('already linked')) {
                // Encode the detailed error message for URL
                const encodedMessage = encodeURIComponent(err.message);
                return res.redirect(`/profile?error=account_already_linked&provider=discord&message=${encodedMessage}`);
            }

            return res.redirect('/login?error=discord_auth_error');
        }

        if (!user) {
            console.error('Discord OAuth failed - no user returned:', info);
            return res.redirect('/login?error=discord_auth_failed');
        }

        // Check if this was a linking request - check both session and state parameter
        let wasLinking = req.session.linkProvider === 'discord';

        // If session doesn't indicate linking, check state parameter
        if (!wasLinking && req.query.state) {
            try {
                const decoded = jwt.verify(req.query.state, process.env.JWT_SECRET || 'your-secret-key');
                wasLinking = decoded.linkProvider === 'discord';
            } catch (error) {
                console.log('Could not decode state parameter in callback:', error.message);
            }
        }

        if (wasLinking) {
            // For linking requests, don't log in - just redirect to profile
            console.log('Discord account linking completed, redirecting to profile');

            // Clean up session data
            delete req.session.returnTo;
            delete req.session.rememberMe;
            delete req.session.linkUserId;
            delete req.session.linkProvider;

            return res.redirect('/profile?success=discord_linked');
        }

        // For normal login (not linking), log the user in
        req.logIn(user, (err) => {
            if (err) {
                console.error('Discord OAuth login error:', err);
                return res.redirect('/login?error=discord_login_failed');
            }

            try {
                // Check if remember me was requested (from session or query param)
                const rememberMe = req.session.rememberMe || req.query.remember === 'true';
                const expiresIn = rememberMe ? '30d' : '24h';
                const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

                // Generate JWT token
                const token = jwt.sign(
                    {
                        userId: user.id,
                        username: user.username
                    },
                    process.env.JWT_SECRET || 'your-secret-key',
                    { expiresIn }
                );

                // Set token in cookie for web interface
                res.cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    maxAge,
                    sameSite: 'lax'
                });

                // Normal login, redirect to intended page or home
                const redirectUrl = req.session.returnTo || '/';

                // Clean up session data
                delete req.session.returnTo;
                delete req.session.rememberMe;
                delete req.session.linkUserId;
                delete req.session.linkProvider;

                // Properly construct redirect URL with auth=success parameter
                console.log('Discord OAuth - Original redirectUrl:', redirectUrl);
                console.log('Discord OAuth - Request protocol:', req.protocol);
                console.log('Discord OAuth - Request host:', req.get('host'));

                const finalUrl = new URL(redirectUrl, `${req.protocol}://${req.get('host')}`);
                finalUrl.searchParams.set('auth', 'success');
                const redirectPath = finalUrl.pathname + finalUrl.search;

                console.log('Discord OAuth - Final URL object:', finalUrl.toString());
                console.log('Discord OAuth - Redirect path:', redirectPath);
                res.redirect(redirectPath);
            } catch (error) {
                console.error('Discord OAuth callback error:', error);
                res.redirect('/login?error=auth_failed');
            }
        });
    })(req, res, next);
});

// Link existing account with OAuth provider
router.post('/link/github', requireAuth, async (req, res) => {
    try {
        // Create a temporary JWT token to store linking information
        const linkToken = jwt.sign(
            {
                linkUserId: req.user.id,
                linkProvider: 'github',
                timestamp: Date.now()
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '10m' } // 10 minutes should be enough for OAuth flow
        );

        console.log('Created GitHub link token for user:', req.user.id);

        res.json({
            success: true,
            redirectUrl: `/auth/github?link=true&token=${linkToken}`
        });
    } catch (error) {
        console.error('GitHub link token creation error:', error);
        res.status(500).json({ error: 'Failed to create link token' });
    }
});

router.post('/link/discord', requireAuth, async (req, res) => {
    try {
        // Create a temporary JWT token to store linking information
        const linkToken = jwt.sign(
            {
                linkUserId: req.user.id,
                linkProvider: 'discord',
                timestamp: Date.now()
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '10m' } // 10 minutes should be enough for OAuth flow
        );

        console.log('Created Discord link token for user:', req.user.id);

        res.json({
            success: true,
            redirectUrl: `/auth/discord?link=true&token=${linkToken}`
        });
    } catch (error) {
        console.error('Discord link token creation error:', error);
        res.status(500).json({ error: 'Failed to create link token' });
    }
});

// Unlink OAuth provider
router.post('/unlink/github', requireAuth, async (req, res) => {

    try {
        const Database = require('../database/database');
        const db = new Database();
        await db.connect();

        // Check if user has password or another OAuth method
        const user = await db.get('SELECT password_hash, discord_id FROM users WHERE id = ?', [req.user.id]);

        if (!user.password_hash && !user.discord_id) {
            return res.status(400).json({
                error: 'Cannot unlink GitHub account. Please set a password or link another account first.'
            });
        }

        // Remove GitHub linking
        await db.run(
            'UPDATE users SET github_id = NULL, github_username = NULL WHERE id = ?',
            [req.user.id]
        );

        res.json({ success: true, message: 'GitHub account unlinked successfully' });
    } catch (error) {
        console.error('GitHub unlink error:', error);
        res.status(500).json({ error: 'Failed to unlink GitHub account' });
    }
});

router.post('/unlink/discord', requireAuth, async (req, res) => {

    try {
        const Database = require('../database/database');
        const db = new Database();
        await db.connect();

        // Check if user has password or another OAuth method
        const user = await db.get('SELECT password_hash, github_id FROM users WHERE id = ?', [req.user.id]);

        if (!user.password_hash && !user.github_id) {
            return res.status(400).json({
                error: 'Cannot unlink Discord account. Please set a password or link another account first.'
            });
        }

        // Remove Discord linking
        await db.run(
            'UPDATE users SET discord_id = NULL, discord_username = NULL, discord_discriminator = NULL WHERE id = ?',
            [req.user.id]
        );

        res.json({ success: true, message: 'Discord account unlinked successfully' });
    } catch (error) {
        console.error('Discord unlink error:', error);
        res.status(500).json({ error: 'Failed to unlink Discord account' });
    }
});

// Get OAuth connection status
router.get('/status', requireAuth, async (req, res) => {

    try {
        const Database = require('../database/database');
        const db = new Database();
        await db.connect();

        const user = await db.get(
            'SELECT github_id, github_username, discord_id, discord_username, discord_discriminator, password_hash FROM users WHERE id = ?',
            [req.user.id]
        );

        // Calculate which accounts can be safely unlinked
        const hasPassword = !!user.password_hash;
        const hasGitHub = !!user.github_id;
        const hasDiscord = !!user.discord_id;

        // Count total authentication methods
        const authMethodCount = (hasPassword ? 1 : 0) + (hasGitHub ? 1 : 0) + (hasDiscord ? 1 : 0);

        // Can only unlink if user has more than one auth method
        const canUnlinkGitHub = hasGitHub && authMethodCount > 1;
        const canUnlinkDiscord = hasDiscord && authMethodCount > 1;

        res.json({
            github: {
                connected: hasGitHub,
                username: user.github_username,
                canUnlink: canUnlinkGitHub
            },
            discord: {
                connected: hasDiscord,
                username: user.discord_username,
                discriminator: user.discord_discriminator,
                canUnlink: canUnlinkDiscord
            },
            hasPassword,
            authMethodCount
        });
    } catch (error) {
        console.error('OAuth status error:', error);
        res.status(500).json({ error: 'Failed to get OAuth status' });
    }
});

// Debug endpoint to test Discord OAuth URL generation
router.get('/debug/discord-url', (req, res) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.DISCORD_CALLBACK_URL || `${process.env.BASE_URL || 'http://localhost:3000'}/auth/discord/callback`);
    const scope = encodeURIComponent('identify email');

    const discordUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;

    res.json({
        clientId,
        redirectUri: process.env.DISCORD_CALLBACK_URL || `${process.env.BASE_URL || 'http://localhost:3000'}/auth/discord/callback`,
        scope: 'identify email',
        generatedUrl: discordUrl,
        testUrl: `<a href="${discordUrl}" target="_blank">Test Discord OAuth</a>`
    });
});

module.exports = router;
