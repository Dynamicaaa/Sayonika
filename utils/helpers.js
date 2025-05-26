// Server-side utility functions for EJS templates

/**
 * Format a date string into a relative time format (e.g., "2 days ago")
 * @param {string|Date} dateString - The date to format
 * @returns {string} - Formatted relative time string
 */
function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
    if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
}

/**
 * Format a date string into a readable format
 * @param {string|Date} dateString - The date to format
 * @returns {string} - Formatted date string
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format file size in bytes to human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size string
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Truncate text to a specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} length - Maximum length
 * @returns {string} - Truncated text
 */
function truncateText(text, length = 100) {
    if (!text || text.length <= length) return text;
    return text.substring(0, length).trim() + '...';
}

/**
 * Pluralize a word based on count
 * @param {number} count - The count
 * @param {string} singular - Singular form
 * @param {string} plural - Plural form (optional, defaults to singular + 's')
 * @returns {string} - Pluralized word
 */
function pluralize(count, singular, plural = null) {
    if (count === 1) return singular;
    return plural || (singular + 's');
}

/**
 * Format a number with commas for thousands separator
 * @param {number} num - Number to format
 * @returns {string} - Formatted number string
 */
function formatNumber(num) {
    return num.toLocaleString();
}

/**
 * Generate a slug from a string
 * @param {string} text - Text to convert to slug
 * @returns {string} - URL-friendly slug
 */
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim('-');
}

/**
 * Check if a date is within the last N days
 * @param {string|Date} dateString - Date to check
 * @param {number} days - Number of days
 * @returns {boolean} - True if within the specified days
 */
function isWithinDays(dateString, days) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24));
    return daysDiff <= days;
}

/**
 * Check if an avatar URL is a default avatar
 * @param {string|null} avatarUrl - The avatar URL to check
 * @returns {boolean} - True if it's a default avatar
 */
function isDefaultAvatar(avatarUrl) {
    if (!avatarUrl) return true; // No avatar is considered default

    // Check for picsum.photos URLs (legacy default avatars)
    if (avatarUrl.includes('picsum.photos')) return true;

    // Check for local default avatars
    if (avatarUrl.includes('default-avatar-')) return true;

    return false;
}

/**
 * Construct a proper Discord avatar URL from profile data
 * @param {Object} profile - Discord profile object
 * @returns {string|null} - Full Discord avatar URL or null if no avatar
 */
function getDiscordAvatarUrl(profile) {
    if (!profile || !profile.id) {
        return null;
    }

    // Try to get avatar hash from different possible locations
    let avatarHash = null;

    // Check profile.avatar first
    if (profile.avatar) {
        avatarHash = profile.avatar;
    }
    // Check profile._json.avatar (some Discord OAuth libraries use this)
    else if (profile._json && profile._json.avatar) {
        avatarHash = profile._json.avatar;
    }
    // Check profile.photos array (Passport.js standard)
    else if (profile.photos && profile.photos.length > 0 && profile.photos[0].value) {
        // Extract avatar hash from full Discord URL if provided
        const photoUrl = profile.photos[0].value;
        const match = photoUrl.match(/avatars\/\d+\/([a-f0-9_]+)\.(png|gif|jpg|jpeg)/i);
        if (match) {
            avatarHash = match[1];
        }
    }

    // If user has a custom avatar
    if (avatarHash) {
        // Check if avatar hash indicates an animated avatar (starts with 'a_')
        const format = avatarHash.startsWith('a_') ? 'gif' : 'png';
        return `https://cdn.discordapp.com/avatars/${profile.id}/${avatarHash}.${format}?size=1024`;
    }

    // If user doesn't have a custom avatar, use Discord's default avatar
    // Discord's default avatars are based on the user's discriminator (or user ID for new usernames)
    let defaultAvatarIndex;

    if (profile.discriminator && profile.discriminator !== '0') {
        // Legacy username system (discriminator-based)
        defaultAvatarIndex = parseInt(profile.discriminator) % 5;
    } else {
        // New username system (user ID-based)
        defaultAvatarIndex = (parseInt(profile.id) >> 22) % 6;
    }

    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png?size=1024`;
}

/**
 * Safely delete an avatar file from the filesystem
 * @param {string|null} avatarUrl - The avatar URL to delete
 * @param {string} reason - Reason for deletion (for logging)
 * @returns {Promise<boolean>} - True if file was deleted or didn't exist, false if error
 */
async function deleteAvatarFile(avatarUrl, reason = 'cleanup') {
    if (!avatarUrl) {
        return true; // No file to delete
    }

    // Only delete local avatar files
    if (!avatarUrl.startsWith('/uploads/avatars/')) {
        console.log(`Skipping deletion of non-local avatar: ${avatarUrl} (${reason})`);
        return true;
    }

    const fs = require('fs').promises;
    const path = require('path');

    try {
        const filePath = path.join(__dirname, '..', avatarUrl);
        await fs.unlink(filePath);
        console.log(`Successfully deleted avatar file: ${avatarUrl} (${reason})`);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`Avatar file not found (already deleted): ${avatarUrl} (${reason})`);
            return true; // File doesn't exist, which is fine
        } else {
            console.error(`Failed to delete avatar file: ${avatarUrl} (${reason}) - ${error.message}`);
            return false;
        }
    }
}

/**
 * Safely delete mod files from the filesystem
 * @param {string|null} filePath - The mod file path to delete
 * @param {string|null} thumbnailUrl - The thumbnail URL to delete
 * @param {string} reason - Reason for deletion (for logging)
 * @returns {Promise<boolean>} - True if files were deleted or didn't exist, false if error
 */
async function deleteModFiles(filePath, thumbnailUrl, reason = 'cleanup') {
    const fs = require('fs').promises;
    const path = require('path');
    let success = true;

    // Delete mod file
    if (filePath) {
        try {
            await fs.unlink(filePath);
            console.log(`Successfully deleted mod file: ${filePath} (${reason})`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(`Mod file not found (already deleted): ${filePath} (${reason})`);
            } else {
                console.error(`Failed to delete mod file: ${filePath} (${reason}) - ${error.message}`);
                success = false;
            }
        }
    }

    // Delete thumbnail file
    if (thumbnailUrl) {
        // Only delete local thumbnail files
        if (thumbnailUrl.startsWith('/uploads/mods/')) {
            try {
                const thumbnailPath = path.join(__dirname, '..', thumbnailUrl);
                await fs.unlink(thumbnailPath);
                console.log(`Successfully deleted mod thumbnail: ${thumbnailUrl} (${reason})`);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    console.log(`Mod thumbnail not found (already deleted): ${thumbnailUrl} (${reason})`);
                } else {
                    console.error(`Failed to delete mod thumbnail: ${thumbnailUrl} (${reason}) - ${error.message}`);
                    success = false;
                }
            }
        } else {
            console.log(`Skipping deletion of non-local thumbnail: ${thumbnailUrl} (${reason})`);
        }
    }

    return success;
}

/**
 * Generate and download a default profile picture from picsum.photos
 * @param {number} userId - User ID to generate unique filename
 * @returns {Promise<string|null>} - Returns the local file path or null if failed
 */
async function generateDefaultAvatar(userId) {
    const https = require('https');
    const fs = require('fs').promises;
    const path = require('path');

    try {
        // Create uploads/avatars directory if it doesn't exist
        const uploadsDir = path.join(__dirname, '../uploads/avatars');
        await fs.mkdir(uploadsDir, { recursive: true });

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `default-avatar-${userId}-${timestamp}.jpg`;
        const filePath = path.join(uploadsDir, filename);

        // Download image from picsum.photos with redirect handling
        const imageUrl = 'https://picsum.photos/1024/1024';

        return new Promise((resolve, reject) => {
            const downloadImage = (url, maxRedirects = 5) => {
                if (maxRedirects <= 0) {
                    reject(new Error('Too many redirects'));
                    return;
                }

                const request = https.get(url, (response) => {
                    // Handle redirects
                    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                        console.log(`Following redirect to: ${response.headers.location}`);
                        downloadImage(response.headers.location, maxRedirects - 1);
                        return;
                    }

                    if (response.statusCode !== 200) {
                        reject(new Error(`Failed to download image: ${response.statusCode}`));
                        return;
                    }

                    const fileStream = require('fs').createWriteStream(filePath);
                    response.pipe(fileStream);

                    fileStream.on('finish', () => {
                        fileStream.close();
                        // Return relative path for database storage
                        resolve(`/uploads/avatars/${filename}`);
                    });

                    fileStream.on('error', (error) => {
                        reject(error);
                    });
                });

                request.on('error', (error) => {
                    reject(error);
                });

                request.setTimeout(10000, () => {
                    request.destroy();
                    reject(new Error('Request timeout'));
                });
            };

            downloadImage(imageUrl);
        });

    } catch (error) {
        console.error('Error generating default avatar:', error);
        return null;
    }
}

/**
 * Generate and download a default thumbnail from picsum.photos
 * @param {number} modId - Mod ID to generate unique filename
 * @param {number} width - Image width (default: 300)
 * @param {number} height - Image height (default: 200)
 * @returns {Promise<string|null>} - Returns the local file path or null if failed
 */
async function generateDefaultThumbnail(modId, width = 300, height = 200) {
    const https = require('https');
    const fs = require('fs').promises;
    const path = require('path');

    try {
        // Create uploads/mods directory if it doesn't exist
        const uploadsDir = path.join(__dirname, '../uploads/mods');
        await fs.mkdir(uploadsDir, { recursive: true });

        // Generate unique filename
        const timestamp = Date.now();
        const randomId = Math.round(Math.random() * 1E9);
        const filename = `default-thumbnail-${modId}-${timestamp}-${randomId}.jpg`;
        const filePath = path.join(uploadsDir, filename);

        // Download image from picsum.photos with redirect handling
        const imageUrl = `https://picsum.photos/${width}/${height}`;

        console.log(`Generating default thumbnail for mod ${modId} from: ${imageUrl}`);

        return new Promise((resolve, reject) => {
            const downloadImage = (url, maxRedirects = 5) => {
                if (maxRedirects <= 0) {
                    reject(new Error('Too many redirects'));
                    return;
                }

                const request = https.get(url, (response) => {
                    // Handle redirects
                    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                        console.log(`Following redirect to: ${response.headers.location}`);
                        downloadImage(response.headers.location, maxRedirects - 1);
                        return;
                    }

                    if (response.statusCode !== 200) {
                        reject(new Error(`Failed to download thumbnail: ${response.statusCode}`));
                        return;
                    }

                    const fileStream = require('fs').createWriteStream(filePath);
                    response.pipe(fileStream);

                    fileStream.on('finish', () => {
                        fileStream.close();
                        console.log(`Default thumbnail saved for mod ${modId}: ${filename}`);
                        // Return relative path for database storage
                        resolve(`/uploads/mods/${filename}`);
                    });

                    fileStream.on('error', (error) => {
                        console.error(`Error saving thumbnail for mod ${modId}:`, error);
                        // Clean up partial file
                        fs.unlink(filePath).catch(() => {});
                        reject(error);
                    });
                });

                request.on('error', (error) => {
                    console.error(`Error fetching thumbnail for mod ${modId}:`, error);
                    reject(error);
                });

                request.setTimeout(10000, () => {
                    request.destroy();
                    reject(new Error('Request timeout'));
                });
            };

            downloadImage(imageUrl);
        });

    } catch (error) {
        console.error(`Error generating default thumbnail for mod ${modId}:`, error);
        return null;
    }
}

module.exports = {
    formatRelativeTime,
    formatDate,
    formatFileSize,
    truncateText,
    pluralize,
    formatNumber,
    slugify,
    isWithinDays,
    isDefaultAvatar,
    getDiscordAvatarUrl,
    deleteAvatarFile,
    deleteModFiles,
    generateDefaultAvatar,
    generateDefaultThumbnail
};
