#!/usr/bin/env node

/**
 * Development startup script for Sayonika
 * This script starts the server and opens the browser to the correct localhost URL
 * to avoid SSL/security header issues with IP addresses
 */

const { spawn, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Try to import open, but handle gracefully if not available
let open;
try {
    // The open package is an ES module, so we need to use dynamic import
    open = null; // We'll load it dynamically when needed
} catch (err) {
    console.log('📦 open package not found. Install with: npm install open --save-dev');
    open = null;
}

const PORT = process.env.PORT || 3000;
const URL = process.env.BASE_URL || `http://localhost:${PORT}`;

console.log('🚀 Starting Sayonika development server...');
console.log(`📍 Server will be available at: ${URL}`);
console.log('💡 Using localhost instead of IP address to avoid security header issues');

// Function to kill existing Sayonika processes
async function killExistingProcesses() {
    try {
        console.log('🔍 Checking for existing Sayonika processes...');

        // Find processes running on the port
        const { stdout: portProcesses } = await execAsync(`lsof -ti:${PORT} 2>/dev/null || true`);
        if (portProcesses.trim()) {
            console.log(`🔪 Killing processes on port ${PORT}...`);
            const pids = portProcesses.trim().split('\n').filter(pid => pid.trim());
            for (const pid of pids) {
                try {
                    await execAsync(`kill -9 ${pid.trim()}`);
                } catch (err) {
                    // Ignore errors - process might already be dead
                }
            }
            console.log('✅ Port cleared');
        }

        // Find Node processes running server.js
        const { stdout: nodeProcesses } = await execAsync(`pgrep -f "node.*server.js" 2>/dev/null || true`);
        if (nodeProcesses.trim()) {
            console.log('🔪 Killing existing Sayonika server processes...');
            const pids = nodeProcesses.trim().split('\n').filter(pid => pid.trim());
            for (const pid of pids) {
                try {
                    await execAsync(`kill -9 ${pid.trim()}`);
                } catch (err) {
                    // Ignore errors - process might already be dead
                }
            }
            console.log('✅ Existing processes killed');
        }

        // Wait a moment for processes to fully terminate
        await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
        // Ignore errors - processes might not exist
        console.log('ℹ️  No existing processes found or already terminated');
    }
}

// Main function to start the development server
async function startDevelopmentServer() {
    // Kill any existing processes first
    await killExistingProcesses();

    // Start the server
    const server = spawn('npm', ['start'], {
        stdio: 'inherit',
        shell: true,
        detached: false
    });

    // Log server events for debugging
    server.on('error', (err) => {
        console.error('❌ Failed to start server:', err);
    });

    server.on('spawn', () => {
        console.log('✅ Server process spawned successfully');
    });

    return server;
}

// Start the development server
startDevelopmentServer().then(server => {
    // Open browser after a short delay
    setTimeout(async () => {
        try {
            console.log(`🌐 Opening browser at ${URL}`);
            // Dynamically import the open package (ES module)
            const { default: openBrowser } = await import('open');
            await openBrowser(URL);
            console.log('✅ Browser opened successfully');
        } catch (err) {
            console.log('Could not open browser automatically:', err.message);
            console.log(`🌐 Please manually open: ${URL}`);
        }
    }, 3000);

    // Handle process termination
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down development server...');
        server.kill('SIGINT');
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n🛑 Shutting down development server...');
        server.kill('SIGTERM');
        process.exit(0);
    });

    server.on('close', (code, signal) => {
        console.log(`\n📊 Server process exited with code ${code} and signal ${signal}`);
        if (code !== 0) {
            console.log('❌ Server exited unexpectedly. Check the logs above for errors.');
        }
        process.exit(code);
    });
}).catch(err => {
    console.error('❌ Failed to start development server:', err);
    process.exit(1);
});
