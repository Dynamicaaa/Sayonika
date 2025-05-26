#!/usr/bin/env node

const Database = require('./database');
const MigrationManager = require('./migrations');

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    const db = new Database();
    
    try {
        await db.connect();
        const migrationManager = new MigrationManager(db);
        await migrationManager.initialize();

        switch (command) {
            case 'up':
            case 'migrate':
                console.log('Running pending migrations...');
                await migrationManager.runPendingMigrations();
                break;

            case 'status':
            case 'list':
                await migrationManager.listMigrations();
                break;

            case 'create':
                const migrationName = args[1];
                if (!migrationName) {
                    console.error('Usage: node migrate.js create <migration_name>');
                    process.exit(1);
                }
                
                const sql = args[2] || `-- Migration: ${migrationName}\n-- Add your SQL here\n\n`;
                const filename = await migrationManager.createMigration(migrationName, sql);
                console.log(`Created migration: ${filename}`);
                console.log('Edit the file to add your SQL changes');
                break;

            case 'rollback':
                const rollbackFilename = args[1];
                if (!rollbackFilename) {
                    console.error('Usage: node migrate.js rollback <migration_filename>');
                    process.exit(1);
                }
                await migrationManager.rollbackMigration(rollbackFilename);
                break;

            case 'version':
                const version = await migrationManager.getSchemaVersion();
                console.log(`Current schema version: ${version}`);
                break;

            case 'help':
            default:
                console.log(`
Database Migration Tool

Usage: node migrate.js <command> [options]

Commands:
  up, migrate              Run all pending migrations
  status, list             Show migration status
  create <name> [sql]      Create a new migration file
  rollback <filename>      Rollback a specific migration
  version                  Show current schema version
  help                     Show this help message

Examples:
  node migrate.js migrate
  node migrate.js create add_user_preferences
  node migrate.js status
  node migrate.js rollback 2024-01-01T00-00-00_add_mod_reviews_table.sql
                `);
                break;
        }
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    } finally {
        await db.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = main;
