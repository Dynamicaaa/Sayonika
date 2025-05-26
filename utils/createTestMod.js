const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const Database = require('../database/database');
const { slugify, generateDefaultThumbnail } = require('./helpers');

class TestModCreator {
    constructor() {
        this.db = new Database();
        this.uploadsDir = path.join(__dirname, '..', 'uploads', 'mods');

        // Ensure uploads directory exists
        if (!fs.existsSync(this.uploadsDir)) {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
        }
    }

    /**
     * Predefined test mod templates
     */
    getTestModTemplates() {
        return [
            {
                title: "Doki Doki Test Club",
                description: "A comprehensive test mod featuring new storylines, characters, and gameplay mechanics. This mod serves as a perfect example of what's possible with DDLC modding, including custom sprites, backgrounds, and music tracks.",
                short_description: "A comprehensive test mod with new storylines and characters",
                category_name: "Full Mods",
                version: "1.0.0",
                tags: ["story", "new-characters", "romance", "drama"],
                is_nsfw: false,
                requirements: {
                    "ddlc_version": "1.1.1",
                    "disk_space": "500MB"
                }
            },
            {
                title: "Enhanced Sprites Pack",
                description: "A visual enhancement pack that replaces all character sprites with high-quality alternatives. Features improved expressions, poses, and outfit variations for all main characters.",
                short_description: "High-quality sprite replacements for all characters",
                category_name: "Visual Mods",
                version: "2.1.0",
                tags: ["sprites", "visual", "enhancement", "hd"],
                is_nsfw: false,
                requirements: {
                    "ddlc_version": "1.1.1",
                    "disk_space": "200MB"
                }
            },
            {
                title: "Monika's Reality",
                description: "An immersive mod that explores Monika's perspective and her awareness of the game's nature. Features psychological horror elements and meta-narrative storytelling.",
                short_description: "Explore Monika's perspective in this psychological horror mod",
                category_name: "Full Mods",
                version: "1.5.2",
                tags: ["monika", "psychological", "horror", "meta", "mature"],
                is_nsfw: true,
                requirements: {
                    "ddlc_version": "1.1.1",
                    "disk_space": "750MB",
                    "age_rating": "18+"
                }
            },
            {
                title: "Soundtrack Remaster",
                description: "A complete audio overhaul featuring remastered versions of all original tracks plus new compositions. Includes orchestral arrangements and ambient soundscapes.",
                short_description: "Remastered soundtrack with new compositions",
                category_name: "Audio Mods",
                version: "1.0.3",
                tags: ["music", "audio", "remaster", "orchestral"],
                is_nsfw: false,
                requirements: {
                    "ddlc_version": "1.1.1",
                    "disk_space": "300MB"
                }
            },
            {
                title: "Gameplay Overhaul Plus",
                description: "Revolutionary gameplay changes including new minigames, choice consequences, and interactive elements. Transform DDLC into a more dynamic experience.",
                short_description: "Revolutionary gameplay changes with new mechanics",
                category_name: "Gameplay Mods",
                version: "3.0.0",
                tags: ["gameplay", "mechanics", "minigames", "interactive"],
                is_nsfw: false,
                requirements: {
                    "ddlc_version": "1.1.1",
                    "renpy_version": "7.0.0",
                    "disk_space": "400MB"
                }
            },
            {
                title: "DDLC Development Kit",
                description: "Essential tools and utilities for DDLC mod developers. Includes script templates, asset converters, and debugging utilities.",
                short_description: "Essential development tools for DDLC modders",
                category_name: "Tools & Utilities",
                version: "2.2.1",
                tags: ["development", "tools", "utilities", "scripting"],
                is_nsfw: false,
                requirements: {
                    "ddlc_version": "1.1.1",
                    "disk_space": "100MB"
                }
            }
        ];
    }

    /**
     * Create a basic mod file structure and zip it
     */
    async createModFile(modData) {
        const timestamp = Date.now();
        const randomId = Math.floor(Math.random() * 1000000);
        const filename = `testMod-${timestamp}-${randomId}.zip`;
        const filepath = path.join(this.uploadsDir, filename);

        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(filepath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => {
                const fileSize = archive.pointer();
                resolve({
                    path: `/uploads/mods/${filename}`,
                    size: fileSize,
                    filename: filename
                });
            });

            archive.on('error', (err) => {
                reject(err);
            });

            archive.pipe(output);

            // Create basic mod structure
            const modInfo = {
                name: modData.title,
                version: modData.version,
                author: "Test Author",
                description: modData.description,
                ddlc_version: modData.requirements.ddlc_version || "1.1.1"
            };

            // Add mod info file
            archive.append(JSON.stringify(modInfo, null, 2), { name: 'mod_info.json' });

            // Add basic script file
            const basicScript = `# ${modData.title}
# Test mod script

label start:
    scene bg club_day
    show monika 1a at center
    m "Welcome to ${modData.title}!"
    m "This is a test mod created for demonstration purposes."
    m "Enjoy exploring the features!"
    return
`;
            archive.append(basicScript, { name: 'game/script.rpy' });

            // Add readme
            const readme = `# ${modData.title}

${modData.description}

## Installation
1. Extract this mod to your DDLC directory
2. Run the game
3. Enjoy!

## Version: ${modData.version}
## Category: ${modData.category_name}
## Tags: ${modData.tags.join(', ')}
`;
            archive.append(readme, { name: 'README.md' });

            archive.finalize();
        });
    }

    /**
     * Create a thumbnail using the default thumbnail generator
     */
    async createThumbnail(modId) {
        try {
            // Use the same function as the API to generate default thumbnails
            const thumbnailUrl = await generateDefaultThumbnail(modId, 300, 200);
            return thumbnailUrl;
        } catch (error) {
            console.warn('Failed to generate default thumbnail, creating fallback:', error);

            // Fallback to simple PNG if picsum.photos fails
            const timestamp = Date.now();
            const randomId = Math.floor(Math.random() * 1000000);
            const filename = `testThumbnail-${timestamp}-${randomId}.png`;
            const filepath = path.join(this.uploadsDir, filename);

            // Create a simple colored rectangle as placeholder
            // This is a minimal PNG file (1x1 pixel)
            const pngData = Buffer.from([
                0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
                0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
                0x49, 0x48, 0x44, 0x52, // IHDR
                0x00, 0x00, 0x00, 0x01, // Width: 1
                0x00, 0x00, 0x00, 0x01, // Height: 1
                0x08, 0x02, 0x00, 0x00, 0x00, // Bit depth, color type, compression, filter, interlace
                0x90, 0x77, 0x53, 0xDE, // CRC
                0x00, 0x00, 0x00, 0x0C, // IDAT chunk length
                0x49, 0x44, 0x41, 0x54, // IDAT
                0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
                0xE2, 0x21, 0xBC, 0x33, // CRC
                0x00, 0x00, 0x00, 0x00, // IEND chunk length
                0x49, 0x45, 0x4E, 0x44, // IEND
                0xAE, 0x42, 0x60, 0x82  // CRC
            ]);

            fs.writeFileSync(filepath, pngData);
            return `/uploads/mods/${filename}`;
        }
    }

    /**
     * Get category ID by name
     */
    async getCategoryId(categoryName) {
        const category = await this.db.get('SELECT id FROM categories WHERE name = ?', [categoryName]);
        return category ? category.id : 1; // Default to first category if not found
    }

    /**
     * Get a test user ID (creates one if none exists)
     */
    async getTestUserId() {
        // Try to find an existing admin user
        let user = await this.db.get('SELECT id FROM users WHERE is_admin = 1 LIMIT 1');

        if (!user) {
            // Create a test user if none exists
            const bcrypt = require('bcryptjs');
            const password_hash = await bcrypt.hash('testuser123', 10);

            const result = await this.db.createUser({
                username: 'testuser',
                email: 'test@sayonika.moe',
                password_hash: password_hash,
                display_name: 'Test User',
                is_admin: true
            });

            return result.id;
        }

        return user.id;
    }

    /**
     * Create a single test mod
     */
    async createTestMod(templateIndex = 0, authorId = null) {
        try {
            await this.db.connect();

            const templates = this.getTestModTemplates();
            const template = templates[templateIndex] || templates[0];

            // Get author ID
            const author_id = authorId || await this.getTestUserId();

            // Get category ID
            const category_id = await this.getCategoryId(template.category_name);

            // Generate unique slug
            let baseSlug = slugify(template.title);
            let slug = baseSlug;
            let counter = 1;

            // Ensure slug is unique
            while (await this.db.get('SELECT id FROM mods WHERE slug = ?', [slug])) {
                slug = `${baseSlug}-${counter}`;
                counter++;
            }

            console.log(`Creating test mod: ${template.title}`);

            // Create mod file
            console.log('Creating mod file...');
            const modFile = await this.createModFile(template);

            // Prepare mod data without thumbnail first
            const modData = {
                title: template.title,
                slug: slug,
                description: template.description,
                short_description: template.short_description,
                author_id: author_id,
                category_id: category_id,
                version: template.version,
                file_path: modFile.path,
                file_size: modFile.size,
                thumbnail_url: null, // Will be set after mod creation
                screenshots: [], // Empty for test mods
                tags: template.tags,
                requirements: template.requirements,
                is_nsfw: template.is_nsfw
            };

            // Create mod in database first
            console.log('Saving to database...');
            const result = await this.db.createMod(modData);

            // Create thumbnail with the mod ID
            console.log('Creating thumbnail...');
            const thumbnailUrl = await this.createThumbnail(result.id);

            // Update mod with thumbnail URL
            if (thumbnailUrl) {
                await this.db.run(
                    'UPDATE mods SET thumbnail_url = ? WHERE id = ?',
                    [thumbnailUrl, result.id]
                );
                console.log(`Thumbnail created and saved: ${thumbnailUrl}`);
            }

            console.log(`✅ Test mod created successfully!`);
            console.log(`   ID: ${result.id}`);
            console.log(`   Title: ${template.title}`);
            console.log(`   Slug: ${slug}`);
            console.log(`   Category: ${template.category_name}`);
            console.log(`   File: ${modFile.filename}`);
            console.log(`   Size: ${Math.round(modFile.size / 1024)} KB`);

            return {
                id: result.id,
                title: template.title,
                slug: slug,
                category: template.category_name,
                file: modFile.filename,
                size: modFile.size
            };

        } catch (error) {
            console.error('❌ Error creating test mod:', error);
            throw error;
        }
    }

    /**
     * Create multiple test mods
     */
    async createMultipleTestMods(count = 3, authorId = null) {
        try {
            await this.db.connect();

            const templates = this.getTestModTemplates();
            const results = [];

            console.log(`Creating ${count} test mods...`);
            console.log('='.repeat(50));

            for (let i = 0; i < count && i < templates.length; i++) {
                const result = await this.createTestMod(i, authorId);
                results.push(result);
                console.log(''); // Empty line between mods
            }

            console.log('='.repeat(50));
            console.log(`✅ Successfully created ${results.length} test mods!`);

            return results;

        } catch (error) {
            console.error('❌ Error creating multiple test mods:', error);
            throw error;
        } finally {
            await this.db.close();
        }
    }

    /**
     * Clean up test mods (remove from database and files)
     */
    async cleanupTestMods() {
        try {
            await this.db.connect();

            // Find all test mods (those with file paths starting with testMod-)
            const testMods = await this.db.all(`
                SELECT id, title, file_path, thumbnail_url
                FROM mods
                WHERE file_path LIKE '%testMod-%'
                   OR thumbnail_url LIKE '%testThumbnail-%'
            `);

            console.log(`Found ${testMods.length} test mods to clean up...`);

            for (const mod of testMods) {
                // Delete files
                if (mod.file_path) {
                    const filePath = path.join(__dirname, '..', mod.file_path);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`Deleted file: ${mod.file_path}`);
                    }
                }

                if (mod.thumbnail_url) {
                    const thumbnailPath = path.join(__dirname, '..', mod.thumbnail_url);
                    if (fs.existsSync(thumbnailPath)) {
                        fs.unlinkSync(thumbnailPath);
                        console.log(`Deleted thumbnail: ${mod.thumbnail_url}`);
                    }
                }

                // Delete from database
                await this.db.run('DELETE FROM mods WHERE id = ?', [mod.id]);
                console.log(`Deleted mod: ${mod.title} (ID: ${mod.id})`);
            }

            console.log(`✅ Cleaned up ${testMods.length} test mods!`);

        } catch (error) {
            console.error('❌ Error cleaning up test mods:', error);
            throw error;
        } finally {
            await this.db.close();
        }
    }
}

// Export the class
module.exports = TestModCreator;

// CLI functionality
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'create';

    const creator = new TestModCreator();

    switch (command) {
        case 'create':
            const count = parseInt(args[1]) || 1;
            if (count === 1) {
                creator.createTestMod().then(() => process.exit(0)).catch(err => {
                    console.error(err);
                    process.exit(1);
                });
            } else {
                creator.createMultipleTestMods(count).then(() => process.exit(0)).catch(err => {
                    console.error(err);
                    process.exit(1);
                });
            }
            break;

        case 'cleanup':
            creator.cleanupTestMods().then(() => process.exit(0)).catch(err => {
                console.error(err);
                process.exit(1);
            });
            break;

        case 'help':
        default:
            console.log(`
Test Mod Creator Utility

Usage: node createTestMod.js <command> [options]

Commands:
  create [count]    Create test mod(s) (default: 1)
  cleanup          Remove all test mods and their files
  help             Show this help message

Examples:
  node createTestMod.js create        # Create 1 test mod
  node createTestMod.js create 3      # Create 3 test mods
  node createTestMod.js cleanup       # Remove all test mods
            `);
            break;
    }
}
