const fs = require('fs');
const path = require('path');

class MigrationManager {
    constructor(database) {
        this.db = database;
        this.migrationsDir = path.join(__dirname, 'migrations');
    }

    async initialize() {
        // Create migrations table to track applied migrations
        await this.db.run(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename VARCHAR(255) UNIQUE NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Ensure migrations directory exists
        if (!fs.existsSync(this.migrationsDir)) {
            fs.mkdirSync(this.migrationsDir, { recursive: true });
        }
    }

    async getAppliedMigrations() {
        try {
            const migrations = await this.db.all('SELECT filename FROM migrations ORDER BY applied_at');
            return migrations.map(m => m.filename);
        } catch (error) {
            // If migrations table doesn't exist yet, return empty array
            return [];
        }
    }

    async getPendingMigrations() {
        const appliedMigrations = await this.getAppliedMigrations();

        // Get all migration files
        const migrationFiles = fs.readdirSync(this.migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

        // Return files that haven't been applied yet
        return migrationFiles.filter(file => !appliedMigrations.includes(file));
    }

    async runMigration(filename) {
        const migrationPath = path.join(this.migrationsDir, filename);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log(`Running migration: ${filename}`);

        try {
            // Execute the migration
            await new Promise((resolve, reject) => {
                this.db.db.exec(migrationSQL, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            // Record that this migration has been applied
            await this.db.run(
                'INSERT INTO migrations (filename) VALUES (?)',
                [filename]
            );

            console.log(`Migration completed: ${filename}`);
        } catch (error) {
            console.error(`Migration failed: ${filename}`, error);
            throw error;
        }
    }

    async runPendingMigrations() {
        await this.initialize();

        const pendingMigrations = await this.getPendingMigrations();

        if (pendingMigrations.length === 0) {
            console.log('No pending migrations');
            return;
        }

        console.log(`Found ${pendingMigrations.length} pending migration(s)`);

        for (const migration of pendingMigrations) {
            await this.runMigration(migration);
        }

        console.log('All migrations completed successfully');
    }

    async createMigration(name, sql) {
        // Get list of existing migrations to determine next number
        const existingMigrations = fs.existsSync(this.migrationsDir)
            ? fs.readdirSync(this.migrationsDir).filter(file => file.endsWith('.sql')).sort()
            : [];

        // Extract the highest migration number
        let nextNumber = 1;
        if (existingMigrations.length > 0) {
            const lastMigration = existingMigrations[existingMigrations.length - 1];
            const match = lastMigration.match(/^(\d+)_/);
            if (match) {
                nextNumber = parseInt(match[1]) + 1;
            }
        }

        const filename = `${nextNumber.toString().padStart(3, '0')}_${name}.sql`;
        const migrationPath = path.join(this.migrationsDir, filename);

        // Ensure migrations directory exists
        if (!fs.existsSync(this.migrationsDir)) {
            fs.mkdirSync(this.migrationsDir, { recursive: true });
        }

        fs.writeFileSync(migrationPath, sql);
        console.log(`Created migration: ${filename}`);
        return filename;
    }

    async rollbackMigration(filename) {
        console.log(`Rolling back migration: ${filename}`);

        // Remove from migrations table
        await this.db.run('DELETE FROM migrations WHERE filename = ?', [filename]);

        console.log(`Rollback completed: ${filename}`);
        console.log('Note: SQL rollback must be done manually if needed');
    }

    async getSchemaVersion() {
        try {
            const appliedMigrations = await this.getAppliedMigrations();
            return appliedMigrations.length;
        } catch (error) {
            return 0;
        }
    }

    async listMigrations() {
        const appliedMigrations = await this.getAppliedMigrations();
        const allMigrationFiles = fs.existsSync(this.migrationsDir)
            ? fs.readdirSync(this.migrationsDir).filter(file => file.endsWith('.sql')).sort()
            : [];

        console.log('\nMigration Status:');
        console.log('================');

        if (allMigrationFiles.length === 0) {
            console.log('No migrations found');
            return;
        }

        for (const file of allMigrationFiles) {
            const status = appliedMigrations.includes(file) ? '✓ Applied' : '✗ Pending';
            console.log(`${status} - ${file}`);
        }

        console.log(`\nSchema version: ${appliedMigrations.length}`);
    }
}

module.exports = MigrationManager;
