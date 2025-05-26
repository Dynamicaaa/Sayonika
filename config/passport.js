const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const DiscordStrategy = require('passport-discord');
const Database = require('../database/database');
const { deleteAvatarFile, getDiscordAvatarUrl } = require('../utils/helpers');

const db = new Database();

// Initialize database connection and ensure it's ready
async function initializeDatabase() {
    try {
        await db.connect();
        console.log('Database connected for OAuth');
        return true;
    } catch (error) {
        console.error('Database connection error in OAuth:', error);
        return false;
    }
}

// Ensure database is connected before any operations
async function ensureDbConnection() {
    if (!db.db) {
        console.log('Database not connected, attempting to connect...');
        await initializeDatabase();
    }
    return db.db !== null;
}

// Initialize database connection
initializeDatabase();

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        await ensureDbConnection();
        const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
        done(null, user);
    } catch (error) {
        console.error('Error deserializing user:', error);
        done(error, null);
    }
});

// GitHub OAuth Strategy
console.log('GitHub Client ID:', process.env.GITHUB_CLIENT_ID ? 'Set' : 'Not set');
console.log('GitHub Client Secret:', process.env.GITHUB_CLIENT_SECRET ? 'Set' : 'Not set');
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    console.log('Configuring GitHub OAuth strategy');
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || '/auth/github/callback',
        scope: ['user:email'],
        passReqToCallback: true
    }, async (req, accessToken, refreshToken, profile, done) => {
        try {
            console.log('GitHub OAuth callback - Profile:', JSON.stringify(profile, null, 2));
            console.log('GitHub OAuth session data:', {
                linkUserId: req.session.linkUserId,
                linkProvider: req.session.linkProvider
            });

            // Ensure database connection is available
            const dbConnected = await ensureDbConnection();
            if (!dbConnected) {
                console.error('GitHub OAuth: Database connection failed');
                return done(new Error('Database connection failed'), null);
            }

            // Check if this is a linking request (user is already logged in and wants to link GitHub)
            if (req.session.linkUserId && req.session.linkProvider === 'github') {
                console.log('GitHub OAuth linking request detected for user:', req.session.linkUserId);

                // Check if this GitHub account is already linked to another user
                const existingUser = await db.get(
                    'SELECT * FROM users WHERE github_id = ?',
                    [profile.id]
                );

                if (existingUser && existingUser.id !== req.session.linkUserId) {
                    console.log('GitHub account already linked to another user:', existingUser.username);
                    const errorMessage = `This GitHub account is already linked to another user: ${existingUser.display_name || existingUser.username} (@${existingUser.username}). Please unlink it from that account first, or contact support if this is your account.`;
                    return done(new Error(errorMessage), null);
                }

                // Get current user data to preserve existing avatar if it's not a default one
                const currentUser = await db.get('SELECT avatar_url FROM users WHERE id = ?', [req.session.linkUserId]);
                const shouldUpdateAvatar = !currentUser.avatar_url ||
                    currentUser.avatar_url.includes('picsum.photos') ||
                    currentUser.avatar_url.includes('default-avatar-');

                // Link GitHub account to the current user
                if (shouldUpdateAvatar) {
                    // Clean up old local avatar file before updating
                    if (currentUser.avatar_url) {
                        await deleteAvatarFile(currentUser.avatar_url, 'GitHub OAuth avatar replacement');
                    }

                    await db.run(
                        `UPDATE users SET
                         github_id = ?,
                         github_username = ?,
                         avatar_url = ?,
                         last_login = CURRENT_TIMESTAMP
                         WHERE id = ?`,
                        [profile.id, profile.username, profile.photos[0]?.value, req.session.linkUserId]
                    );
                } else {
                    await db.run(
                        `UPDATE users SET
                         github_id = ?,
                         github_username = ?,
                         last_login = CURRENT_TIMESTAMP
                         WHERE id = ?`,
                        [profile.id, profile.username, req.session.linkUserId]
                    );
                }

                // Get the updated user
                const linkedUser = await db.get('SELECT * FROM users WHERE id = ?', [req.session.linkUserId]);

                // Clean up session data
                delete req.session.linkUserId;
                delete req.session.linkProvider;

                console.log('GitHub account successfully linked to user:', linkedUser.id);
                return done(null, linkedUser);
            }

            // Check if user already exists with this GitHub ID
            let user = await db.get(
                'SELECT * FROM users WHERE github_id = ?',
                [profile.id]
            );

            if (user) {
                // Check if we should update avatar (only if it's a default one)
                const shouldUpdateAvatar = !user.avatar_url ||
                    user.avatar_url.includes('picsum.photos') ||
                    user.avatar_url.includes('default-avatar-');

                if (shouldUpdateAvatar) {
                    // Clean up old local avatar file before updating
                    if (user.avatar_url) {
                        await deleteAvatarFile(user.avatar_url, 'GitHub OAuth existing user avatar replacement');
                    }

                    // Update user's GitHub info including avatar
                    await db.run(
                        `UPDATE users SET
                         github_username = ?,
                         avatar_url = ?,
                         last_login = CURRENT_TIMESTAMP
                         WHERE id = ?`,
                        [profile.username, profile.photos[0]?.value, user.id]
                    );
                    user.avatar_url = profile.photos[0]?.value;
                } else {
                    // Update user's GitHub info without changing avatar
                    await db.run(
                        `UPDATE users SET
                         github_username = ?,
                         last_login = CURRENT_TIMESTAMP
                         WHERE id = ?`,
                        [profile.username, user.id]
                    );
                }

                user.github_username = profile.username;
                return done(null, user);
            }

            // Check if user exists with same email
            console.log('GitHub emails:', profile.emails);
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
            console.log('Extracted email:', email);
            if (email) {
                user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
                if (user) {
                    // Check if we should update avatar (only if it's a default one)
                    const shouldUpdateAvatar = !user.avatar_url ||
                        user.avatar_url.includes('picsum.photos') ||
                        user.avatar_url.includes('default-avatar-');

                    if (shouldUpdateAvatar) {
                        // Clean up old local avatar file before updating
                        if (user.avatar_url) {
                            await deleteAvatarFile(user.avatar_url, 'GitHub OAuth email-based user avatar replacement');
                        }

                        // Link GitHub account to existing user with avatar
                        await db.run(
                            `UPDATE users SET
                             github_id = ?,
                             github_username = ?,
                             avatar_url = ?,
                             last_login = CURRENT_TIMESTAMP
                             WHERE id = ?`,
                            [profile.id, profile.username, profile.photos[0]?.value, user.id]
                        );
                        user.avatar_url = profile.photos[0]?.value;
                    } else {
                        // Link GitHub account to existing user without changing avatar
                        await db.run(
                            `UPDATE users SET
                             github_id = ?,
                             github_username = ?,
                             last_login = CURRENT_TIMESTAMP
                             WHERE id = ?`,
                            [profile.id, profile.username, user.id]
                        );
                    }

                    user.github_id = profile.id;
                    user.github_username = profile.username;
                    return done(null, user);
                }
            }

            // Check if this is the first user (should be admin)
            const userCount = await db.get('SELECT COUNT(*) as count FROM users');
            const isFirstUser = userCount.count === 0;

            // Create new user
            const username = await generateUniqueUsername(profile.username || profile.displayName);
            console.log('Creating new GitHub user with data:', {
                username,
                email,
                display_name: profile.displayName || profile.username,
                github_id: profile.id,
                github_username: profile.username,
                avatar_url: profile.photos[0]?.value,
                is_admin: isFirstUser
            });

            const result = await db.run(
                `INSERT INTO users (
                    username,
                    email,
                    display_name,
                    github_id,
                    github_username,
                    avatar_url,
                    is_admin,
                    is_owner,
                    is_verified,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
                [
                    username,
                    email,
                    profile.displayName || profile.username,
                    profile.id,
                    profile.username,
                    profile.photos[0]?.value,
                    isFirstUser,
                    isFirstUser
                ]
            );

            console.log('User creation result:', result);
            user = await db.get('SELECT * FROM users WHERE id = ?', [result.id]);
            console.log('Created user:', user);
            return done(null, user);

        } catch (error) {
            console.error('GitHub OAuth error:', error.message);
            console.error('Error stack:', error.stack);
            console.error('Error details:', {
                name: error.name,
                code: error.code,
                errno: error.errno,
                syscall: error.syscall
            });

            // If it's a database constraint error, provide more specific feedback
            if (error.message && error.message.includes('UNIQUE constraint failed')) {
                console.error('Database constraint error - user might already exist');
                // Try to find the existing user and return it
                try {
                    if (error.message.includes('users.email')) {
                        const existingUser = await db.get('SELECT * FROM users WHERE email = ?', [profile.emails[0]?.value]);
                        if (existingUser) {
                            console.log('Found existing user by email, linking GitHub account');
                            await db.run(
                                `UPDATE users SET
                                 github_id = ?,
                                 github_username = ?,
                                 avatar_url = ?,
                                 last_login = CURRENT_TIMESTAMP
                                 WHERE id = ?`,
                                [profile.id, profile.username, profile.photos[0]?.value, existingUser.id]
                            );
                            existingUser.github_id = profile.id;
                            existingUser.github_username = profile.username;
                            existingUser.avatar_url = profile.photos[0]?.value;
                            return done(null, existingUser);
                        }
                    }
                } catch (recoveryError) {
                    console.error('Error during recovery attempt:', recoveryError);
                }
            }

            return done(error, null);
        }
    }));
} else {
    console.log('GitHub OAuth not configured - skipping GitHub strategy');
}

// Discord OAuth Strategy
console.log('Discord Client ID:', process.env.DISCORD_CLIENT_ID ? 'Set' : 'Not set');
console.log('Discord Client Secret:', process.env.DISCORD_CLIENT_SECRET ? 'Set' : 'Not set');
if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    console.log('Configuring Discord OAuth strategy');
    passport.use(new DiscordStrategy({
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: process.env.DISCORD_CALLBACK_URL || '/auth/discord/callback',
        scope: ['identify', 'email'],
        authorizationURL: 'https://discord.com/oauth2/authorize',
        tokenURL: 'https://discord.com/api/oauth2/token',
        passReqToCallback: true
    }, async (req, accessToken, refreshToken, profile, done) => {
        try {
            console.log('Discord OAuth callback - Profile:', JSON.stringify(profile, null, 2));
            console.log('Discord OAuth session data:', {
                linkUserId: req.session.linkUserId,
                linkProvider: req.session.linkProvider
            });

            // Debug avatar information
            console.log('Discord Avatar Debug:', {
                'profile.avatar': profile.avatar,
                'profile.photos': profile.photos,
                'profile._json': profile._json ? {
                    avatar: profile._json.avatar,
                    id: profile._json.id
                } : 'not available'
            });

            // Ensure database connection is available
            const dbConnected = await ensureDbConnection();
            if (!dbConnected) {
                console.error('Discord OAuth: Database connection failed');
                return done(new Error('Database connection failed'), null);
            }

            // Check if this is a linking request (user is already logged in and wants to link Discord)
            if (req.session.linkUserId && req.session.linkProvider === 'discord') {
                console.log('Discord OAuth linking request detected for user:', req.session.linkUserId);

                // Check if this Discord account is already linked to another user
                const existingUser = await db.get(
                    'SELECT * FROM users WHERE discord_id = ?',
                    [profile.id]
                );

                if (existingUser && existingUser.id !== req.session.linkUserId) {
                    console.log('Discord account already linked to another user:', existingUser.username);
                    const errorMessage = `This Discord account is already linked to another user: ${existingUser.display_name || existingUser.username} (@${existingUser.username}). Please unlink it from that account first, or contact support if this is your account.`;
                    return done(new Error(errorMessage), null);
                }

                // Get current user data to check if they have a profile picture
                const currentUser = await db.get('SELECT avatar_url FROM users WHERE id = ?', [req.session.linkUserId]);

                // Only update avatar if user doesn't have one (null, empty, or default avatars)
                const shouldUpdateAvatar = !currentUser.avatar_url ||
                    currentUser.avatar_url.includes('picsum.photos') ||
                    currentUser.avatar_url.includes('default-avatar-');

                // Link Discord account to the current user
                if (shouldUpdateAvatar) {
                    console.log('User is linking Discord and has no profile picture - setting Discord avatar');

                    // Clean up old local avatar file before updating
                    if (currentUser.avatar_url) {
                        await deleteAvatarFile(currentUser.avatar_url, 'Discord OAuth avatar replacement');
                    }

                    // Get proper Discord avatar URL
                    const discordAvatarUrl = getDiscordAvatarUrl(profile);

                    await db.run(
                        `UPDATE users SET
                         discord_id = ?,
                         discord_username = ?,
                         discord_discriminator = ?,
                         avatar_url = ?,
                         last_login = CURRENT_TIMESTAMP
                         WHERE id = ?`,
                        [profile.id, profile.username, profile.discriminator, discordAvatarUrl, req.session.linkUserId]
                    );
                } else {
                    console.log('User is linking Discord but already has a profile picture - preserving existing avatar');

                    await db.run(
                        `UPDATE users SET
                         discord_id = ?,
                         discord_username = ?,
                         discord_discriminator = ?,
                         last_login = CURRENT_TIMESTAMP
                         WHERE id = ?`,
                        [profile.id, profile.username, profile.discriminator, req.session.linkUserId]
                    );
                }

                // Get the updated user
                const linkedUser = await db.get('SELECT * FROM users WHERE id = ?', [req.session.linkUserId]);

                // Clean up session data
                delete req.session.linkUserId;
                delete req.session.linkProvider;

                console.log('Discord account successfully linked to user:', linkedUser.id);
                return done(null, linkedUser);
            }

            // Check if user already exists with this Discord ID
            let user = await db.get(
                'SELECT * FROM users WHERE discord_id = ?',
                [profile.id]
            );

            if (user) {
                console.log('Existing Discord user logging in - NOT updating avatar (preserving existing profile picture)');

                // For existing Discord users, never update the avatar
                // This preserves whatever profile picture they currently have
                await db.run(
                    `UPDATE users SET
                     discord_username = ?,
                     discord_discriminator = ?,
                     last_login = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [profile.username, profile.discriminator, user.id]
                );

                user.discord_username = profile.username;
                user.discord_discriminator = profile.discriminator;
                return done(null, user);
            }

            // Check if user exists with same email
            const email = profile.email;
            if (email) {
                user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
                if (user) {
                    console.log('Linking Discord to existing email-based user');

                    // Check if we should update avatar (only if they don't have one)
                    const shouldUpdateAvatar = !user.avatar_url ||
                        user.avatar_url.includes('picsum.photos') ||
                        user.avatar_url.includes('default-avatar-');

                    if (shouldUpdateAvatar) {
                        console.log('User has no profile picture - setting Discord avatar');

                        // Clean up old local avatar file before updating
                        if (user.avatar_url) {
                            await deleteAvatarFile(user.avatar_url, 'Discord OAuth email-based user avatar replacement');
                        }

                        // Get proper Discord avatar URL
                        const discordAvatarUrl = getDiscordAvatarUrl(profile);

                        // Link Discord account to existing user with avatar
                        await db.run(
                            `UPDATE users SET
                             discord_id = ?,
                             discord_username = ?,
                             discord_discriminator = ?,
                             avatar_url = ?,
                             last_login = CURRENT_TIMESTAMP
                             WHERE id = ?`,
                            [profile.id, profile.username, profile.discriminator, discordAvatarUrl, user.id]
                        );
                        user.avatar_url = discordAvatarUrl;
                    } else {
                        console.log('User already has a profile picture - preserving existing avatar');

                        // Link Discord account to existing user without changing avatar
                        await db.run(
                            `UPDATE users SET
                             discord_id = ?,
                             discord_username = ?,
                             discord_discriminator = ?,
                             last_login = CURRENT_TIMESTAMP
                             WHERE id = ?`,
                            [profile.id, profile.username, profile.discriminator, user.id]
                        );
                    }

                    user.discord_id = profile.id;
                    user.discord_username = profile.username;
                    user.discord_discriminator = profile.discriminator;
                    return done(null, user);
                }
            }

            // Check if this is the first user (should be admin)
            const userCount = await db.get('SELECT COUNT(*) as count FROM users');
            const isFirstUser = userCount.count === 0;

            // Create new user
            const username = await generateUniqueUsername(profile.username || profile.global_name);
            const displayName = profile.global_name || profile.username;

            // Get proper Discord avatar URL for new Discord accounts
            const discordAvatarUrl = getDiscordAvatarUrl(profile);

            console.log('Creating new Discord user WITH Discord avatar (new account gets Discord profile picture)');

            console.log('Creating new Discord user with data:', {
                username,
                email,
                display_name: displayName,
                discord_id: profile.id,
                discord_username: profile.username,
                discord_discriminator: profile.discriminator,
                avatar_url: discordAvatarUrl, // New Discord accounts get Discord avatar
                is_admin: isFirstUser
            });

            const result = await db.run(
                `INSERT INTO users (
                    username,
                    email,
                    display_name,
                    discord_id,
                    discord_username,
                    discord_discriminator,
                    avatar_url,
                    is_admin,
                    is_owner,
                    is_verified,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
                [
                    username,
                    email,
                    displayName,
                    profile.id,
                    profile.username,
                    profile.discriminator,
                    discordAvatarUrl, // New Discord accounts get Discord avatar
                    isFirstUser,
                    isFirstUser
                ]
            );

            console.log('Discord user creation result:', result);
            user = await db.get('SELECT * FROM users WHERE id = ?', [result.id]);
            console.log('Created Discord user:', user);
            return done(null, user);

        } catch (error) {
            console.error('Discord OAuth error:', error.message);
            console.error('Error stack:', error.stack);
            console.error('Error details:', {
                name: error.name,
                code: error.code,
                errno: error.errno,
                syscall: error.syscall
            });

            // If it's a database constraint error, provide more specific feedback
            if (error.message && error.message.includes('UNIQUE constraint failed')) {
                console.error('Database constraint error - user might already exist');
                // Try to find the existing user and return it
                try {
                    if (error.message.includes('users.email')) {
                        const existingUser = await db.get('SELECT * FROM users WHERE email = ?', [profile.email]);
                        if (existingUser) {
                            console.log('Found existing user by email, linking Discord account');

                            // This is linking Discord to an existing email-based user
                            // Check if we should update avatar (only if they don't have one)
                            const shouldUpdateAvatar = !existingUser.avatar_url ||
                                existingUser.avatar_url.includes('picsum.photos') ||
                                existingUser.avatar_url.includes('default-avatar-');

                            if (shouldUpdateAvatar) {
                                console.log('User has no profile picture - setting Discord avatar');

                                // Get proper Discord avatar URL
                                const discordAvatarUrl = getDiscordAvatarUrl(profile);

                                await db.run(
                                    `UPDATE users SET
                                     discord_id = ?,
                                     discord_username = ?,
                                     discord_discriminator = ?,
                                     avatar_url = ?,
                                     last_login = CURRENT_TIMESTAMP
                                     WHERE id = ?`,
                                    [profile.id, profile.username, profile.discriminator, discordAvatarUrl, existingUser.id]
                                );
                                existingUser.avatar_url = discordAvatarUrl;
                            } else {
                                console.log('User already has a profile picture - preserving existing avatar');

                                await db.run(
                                    `UPDATE users SET
                                     discord_id = ?,
                                     discord_username = ?,
                                     discord_discriminator = ?,
                                     last_login = CURRENT_TIMESTAMP
                                     WHERE id = ?`,
                                    [profile.id, profile.username, profile.discriminator, existingUser.id]
                                );
                            }

                            existingUser.discord_id = profile.id;
                            existingUser.discord_username = profile.username;
                            existingUser.discord_discriminator = profile.discriminator;
                            return done(null, existingUser);
                        }
                    }
                } catch (recoveryError) {
                    console.error('Error during Discord recovery attempt:', recoveryError);
                }
            }

            return done(error, null);
        }
    }));
} else {
    console.log('Discord OAuth not configured - skipping Discord strategy');
}

// Helper function to generate unique username
async function generateUniqueUsername(baseUsername) {
    try {
        await ensureDbConnection();

        if (!baseUsername) {
            baseUsername = 'user';
        }

        // Clean username (remove special characters, limit length)
        let username = baseUsername
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '')
            .substring(0, 30);

        if (username.length < 3) {
            username = 'user' + username;
        }

        // Check if username exists
        let existingUser = await db.get('SELECT id FROM users WHERE username = ?', [username]);

        if (!existingUser) {
            return username;
        }

        // If username exists, append numbers until we find a unique one
        let counter = 1;
        let newUsername;

        do {
            newUsername = `${username}${counter}`;
            existingUser = await db.get('SELECT id FROM users WHERE username = ?', [newUsername]);
            counter++;
        } while (existingUser && counter < 1000);

        return newUsername;
    } catch (error) {
        console.error('Error generating unique username:', error);
        // Fallback to a random username if database operations fail
        return 'user' + Math.random().toString(36).substring(2, 8);
    }
}

module.exports = passport;
