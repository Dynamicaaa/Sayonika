#!/usr/bin/env node

const Database = require('../database/database');
const path = require('path');

const db = new Database();

async function toggleMaintenanceMode(action) {
    try {
        await db.connect();
        
        let isEnabled;
        let message;
        
        switch (action) {
            case 'on':
            case 'enable':
                isEnabled = true;
                message = 'Maintenance mode ENABLED';
                break;
            case 'off':
            case 'disable':
                isEnabled = false;
                message = 'Maintenance mode DISABLED';
                break;
            case 'status':
                const currentStatus = await db.isMaintenanceMode();
                console.log(`Maintenance mode is currently: ${currentStatus ? 'ENABLED' : 'DISABLED'}`);
                
                if (currentStatus) {
                    const maintenanceMessage = await db.getSiteSetting('maintenance_message');
                    console.log(`Maintenance message: "${maintenanceMessage}"`);
                }
                
                process.exit(0);
                break;
            default:
                console.error('Invalid action. Use: on, off, enable, disable, or status');
                console.log('Usage:');
                console.log('  npm run maintenance:on     - Enable maintenance mode');
                console.log('  npm run maintenance:off    - Disable maintenance mode');
                console.log('  npm run maintenance:status - Check current status');
                process.exit(1);
        }
        
        // Update maintenance mode setting
        await db.setSiteSetting('maintenance_mode', isEnabled, 'boolean');
        
        console.log(`✅ ${message}`);
        
        if (isEnabled) {
            console.log('');
            console.log('🔧 Maintenance mode is now active:');
            console.log('   • Regular users cannot access most site features');
            console.log('   • Mod browsing remains available');
            console.log('   • Admins can access all features normally');
            console.log('   • API endpoints return maintenance status codes');
            console.log('');
            console.log('To disable maintenance mode, run: npm run maintenance:off');
        } else {
            console.log('');
            console.log('🎉 Site is now fully operational');
            console.log('   • All features are available to users');
            console.log('   • Normal operation resumed');
        }
        
    } catch (error) {
        console.error('❌ Error toggling maintenance mode:', error.message);
        process.exit(1);
    } finally {
        await db.close();
    }
}

async function setMaintenanceMessage(newMessage) {
    try {
        await db.connect();
        
        if (!newMessage || newMessage.trim() === '') {
            console.error('❌ Maintenance message cannot be empty');
            process.exit(1);
        }
        
        await db.setSiteSetting('maintenance_message', newMessage.trim(), 'string');
        
        console.log('✅ Maintenance message updated');
        console.log(`New message: "${newMessage.trim()}"`);
        
    } catch (error) {
        console.error('❌ Error setting maintenance message:', error.message);
        process.exit(1);
    } finally {
        await db.close();
    }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('Sayonika Maintenance Mode Manager');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/maintenance.js <action> [message]');
    console.log('');
    console.log('Actions:');
    console.log('  on, enable    - Enable maintenance mode');
    console.log('  off, disable  - Disable maintenance mode');
    console.log('  status        - Check current maintenance mode status');
    console.log('  message       - Set maintenance message (requires message text)');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/maintenance.js on');
    console.log('  node scripts/maintenance.js off');
    console.log('  node scripts/maintenance.js status');
    console.log('  node scripts/maintenance.js message "Site will be back online soon!"');
    console.log('');
    console.log('NPM Scripts:');
    console.log('  npm run maintenance:on     - Enable maintenance mode');
    console.log('  npm run maintenance:off    - Disable maintenance mode');
    console.log('  npm run maintenance:status - Check current status');
    process.exit(0);
}

const action = args[0].toLowerCase();

if (action === 'message') {
    const message = args.slice(1).join(' ');
    setMaintenanceMessage(message);
} else {
    toggleMaintenanceMode(action);
}
