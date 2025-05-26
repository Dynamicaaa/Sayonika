const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Database = require('../../database/database');

const db = new Database();
db.connect().catch(console.error);

// Get user avatar
router.get('/avatar/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { size = '64' } = req.query; // Default size 64x64

        // Find the user
        const user = await db.getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user has an avatar (including default picsum.photos ones)
        if (user.avatar_url) {
            let avatarPath;

            // Handle different avatar types
            if (user.avatar_url.startsWith('http')) {
                // External avatar (Discord, GitHub, etc.) - redirect
                return res.redirect(user.avatar_url);
            } else if (user.avatar_url.startsWith('/')) {
                // Local avatar file - remove leading slash and join with project root
                avatarPath = path.join(__dirname, '../..', user.avatar_url.substring(1));
            } else {
                // Relative path
                avatarPath = path.join(__dirname, '../..', user.avatar_url);
            }

            // Check if file exists
            if (fs.existsSync(avatarPath)) {
                // Set appropriate headers
                res.set({
                    'Content-Type': getImageContentType(avatarPath),
                    'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
                    'ETag': `"${user.id}-${user.updated_at || user.created_at}"`
                });

                return res.sendFile(avatarPath);
            }
        }

        // If no custom avatar found, user should have a default picsum.photos avatar
        // This should have been created when the account was made
        console.warn(`User ${userId} has no avatar_url set, this should not happen for properly created accounts`);

        // Generate fallback SVG as last resort
        const defaultAvatar = generateDefaultAvatar(user, size);
        res.set({
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            'ETag': `"fallback-${user.id}-${size}"`
        });

        res.send(defaultAvatar);

    } catch (error) {
        console.error('Error serving avatar:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get mod thumbnail
router.get('/thumbnail/:modId', async (req, res) => {
    try {
        const { modId } = req.params;
        const { size = '300x200' } = req.query; // Default size 300x200

        // Find the mod
        const mod = await db.getModById(modId);
        if (!mod) {
            return res.status(404).json({ error: 'Mod not found' });
        }

        // Check if mod has a custom thumbnail
        if (mod.thumbnail_url) {
            let thumbnailPath;

            // Handle different thumbnail types
            if (mod.thumbnail_url.startsWith('http')) {
                // External thumbnail - redirect
                return res.redirect(mod.thumbnail_url);
            } else if (mod.thumbnail_url.startsWith('/')) {
                // Local thumbnail file - remove leading slash and join with project root
                thumbnailPath = path.join(__dirname, '../..', mod.thumbnail_url.substring(1));
            } else {
                // Relative path
                thumbnailPath = path.join(__dirname, '../..', mod.thumbnail_url);
            }

            // Check if file exists
            if (fs.existsSync(thumbnailPath)) {
                // Set appropriate headers
                res.set({
                    'Content-Type': getImageContentType(thumbnailPath),
                    'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
                    'ETag': `"${mod.id}-${mod.updated_at || mod.created_at}"`
                });

                return res.sendFile(thumbnailPath);
            }
        }

        // Generate default thumbnail
        const defaultThumbnail = generateDefaultThumbnail(mod, size);
        res.set({
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            'ETag': `"default-${mod.id}-${size}"`
        });

        res.send(defaultThumbnail);

    } catch (error) {
        console.error('Error serving thumbnail:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper function to get content type based on file extension
function getImageContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.gif':
            return 'image/gif';
        case '.webp':
            return 'image/webp';
        case '.svg':
            return 'image/svg+xml';
        default:
            return 'image/png';
    }
}

// Generate default avatar SVG
function generateDefaultAvatar(user, size) {
    const sizeNum = parseInt(size) || 64;
    const initials = getInitials(user.display_name || user.username);
    const backgroundColor = generateColorFromString(user.username);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${sizeNum}" height="${sizeNum}" viewBox="0 0 ${sizeNum} ${sizeNum}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${sizeNum/2}" cy="${sizeNum/2}" r="${sizeNum/2}" fill="${backgroundColor}"/>
  <text x="${sizeNum/2}" y="${sizeNum/2 + sizeNum/8}" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="${sizeNum/3}" font-weight="bold">${initials}</text>
</svg>`;
}

// Generate default thumbnail SVG
function generateDefaultThumbnail(mod, size) {
    const [width, height] = size.split('x').map(s => parseInt(s) || 300);
    const backgroundColor = generateColorFromString(mod.title);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${backgroundColor}"/>
  <rect x="20" y="20" width="${width-40}" height="${height-40}" fill="rgba(0,0,0,0.1)" rx="10"/>
  <text x="${width/2}" y="${height/2 - 20}" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="18" font-weight="bold">DDLC MOD</text>
  <text x="${width/2}" y="${height/2 + 10}" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="Arial, sans-serif" font-size="14">${mod.title.length > 20 ? mod.title.substring(0, 20) + '...' : mod.title}</text>
</svg>`;
}

// Get initials from name
function getInitials(name) {
    return name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');
}

// Generate consistent color from string
function generateColorFromString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Generate a pleasant color
    const hue = Math.abs(hash) % 360;
    const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
    const lightness = 45 + (Math.abs(hash) % 15); // 45-60%

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

module.exports = router;
