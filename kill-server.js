#!/usr/bin/env node

/**
 * Kill existing Sayonika server processes
 * Useful for cleaning up stuck processes
 */

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const PORT = process.env.PORT || 3000;

async function killSayonikaProcesses() {
    console.log('🔍 Searching for Sayonika processes...');

    try {
        // Find processes running on the port
        const { stdout: portProcesses } = await execAsync(`lsof -ti:${PORT} 2>/dev/null || true`);
        if (portProcesses.trim()) {
            console.log(`🔪 Killing processes on port ${PORT}...`);
            const pids = portProcesses.trim().split('\n').filter(pid => pid.trim());
            for (const pid of pids) {
                try {
                    await execAsync(`kill -9 ${pid.trim()}`);
                    console.log(`✅ Killed process ${pid.trim()}`);
                } catch (err) {
                    console.log(`ℹ️  Process ${pid.trim()} already terminated`);
                }
            }
        } else {
            console.log(`ℹ️  No processes found on port ${PORT}`);
        }

        // Find Node processes running server.js
        const { stdout: nodeProcesses } = await execAsync(`pgrep -f "node.*server.js" 2>/dev/null || true`);
        if (nodeProcesses.trim()) {
            console.log('🔪 Killing Sayonika server processes...');
            const pids = nodeProcesses.trim().split('\n').filter(pid => pid.trim());
            for (const pid of pids) {
                try {
                    await execAsync(`kill -9 ${pid.trim()}`);
                    console.log(`✅ Killed server process ${pid.trim()}`);
                } catch (err) {
                    console.log(`ℹ️  Server process ${pid.trim()} already terminated`);
                }
            }
        } else {
            console.log('ℹ️  No Sayonika server processes found');
        }

        // Find npm processes that might be running the server
        const { stdout: npmProcesses } = await execAsync(`pgrep -f "npm.*start" 2>/dev/null || true`);
        if (npmProcesses.trim()) {
            console.log('🔪 Killing npm start processes...');
            const pids = npmProcesses.trim().split('\n').filter(pid => pid.trim());
            for (const pid of pids) {
                try {
                    await execAsync(`kill -9 ${pid.trim()}`);
                    console.log(`✅ Killed npm process ${pid.trim()}`);
                } catch (err) {
                    console.log(`ℹ️  npm process ${pid.trim()} already terminated`);
                }
            }
        } else {
            console.log('ℹ️  No npm start processes found');
        }

        console.log('🎉 Process cleanup completed!');

    } catch (error) {
        console.error('❌ Error during cleanup:', error.message);
        process.exit(1);
    }
}

// Run the cleanup
killSayonikaProcesses();
