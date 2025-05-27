// Reverse proxy detection middleware
const Database = require('../database/database');

const db = new Database();

// Initialize database connection
db.connect().catch(console.error);

/**
 * Detect reverse proxy setup and adjust file size limits accordingly
 */
const detectReverseProxy = async (req, res, next) => {
    try {

        // Initialize proxy detection info
        req.proxyInfo = {
            isCloudflare: false,
            isNginx: false,
            isReverseProxy: false,
            maxFileSize: null,
            detectedHeaders: []
        };

        // Check for Cloudflare headers
        const cloudflareHeaders = [
            'cf-ray',
            'cf-connecting-ip',
            'cf-ipcountry',
            'cf-visitor',
            'cf-request-id'
        ];

        const foundCloudflareHeaders = cloudflareHeaders.filter(header =>
            req.headers[header] !== undefined
        );

        if (foundCloudflareHeaders.length > 0) {
            req.proxyInfo.isCloudflare = true;
            req.proxyInfo.isReverseProxy = true;
            req.proxyInfo.detectedHeaders.push(...foundCloudflareHeaders);

            // Cloudflare has a 100MB limit for free plans
            req.proxyInfo.maxFileSize = 100 * 1024 * 1024; // 100MB in bytes

            console.log(`[Proxy Detection] Cloudflare detected via headers: ${foundCloudflareHeaders.join(', ')}`);
        }

        // Check for nginx reverse proxy headers
        const nginxHeaders = [
            'x-real-ip',
            'x-forwarded-for',
            'x-forwarded-proto',
            'x-forwarded-host'
        ];

        const foundNginxHeaders = nginxHeaders.filter(header =>
            req.headers[header] !== undefined
        );

        if (foundNginxHeaders.length > 0) {
            req.proxyInfo.isNginx = true;
            req.proxyInfo.isReverseProxy = true;
            req.proxyInfo.detectedHeaders.push(...foundNginxHeaders);

            console.log(`[Proxy Detection] Nginx reverse proxy detected via headers: ${foundNginxHeaders.join(', ')}`);
        }

        // Check for other common reverse proxy headers
        const otherProxyHeaders = [
            'x-forwarded-server',
            'x-cluster-client-ip',
            'x-original-forwarded-for',
            'forwarded'
        ];

        const foundOtherHeaders = otherProxyHeaders.filter(header =>
            req.headers[header] !== undefined
        );

        if (foundOtherHeaders.length > 0) {
            req.proxyInfo.isReverseProxy = true;
            req.proxyInfo.detectedHeaders.push(...foundOtherHeaders);

            console.log(`[Proxy Detection] Other reverse proxy detected via headers: ${foundOtherHeaders.join(', ')}`);
        }

        // If no specific proxy limits are set, get from database
        if (!req.proxyInfo.maxFileSize) {
            const dbMaxSize = await db.getSiteSetting('max_file_size_mb');
            if (dbMaxSize) {
                req.proxyInfo.maxFileSize = dbMaxSize * 1024 * 1024; // Convert MB to bytes
            }
        }

        // Log proxy detection results
        if (req.proxyInfo.isReverseProxy) {
            console.log(`[Proxy Detection] Reverse proxy setup detected:`, {
                cloudflare: req.proxyInfo.isCloudflare,
                nginx: req.proxyInfo.isNginx,
                maxFileSize: req.proxyInfo.maxFileSize ? `${Math.round(req.proxyInfo.maxFileSize / 1024 / 1024)}MB` : 'Not set',
                headers: req.proxyInfo.detectedHeaders
            });
        }

        next();
    } catch (error) {
        console.error('[Proxy Detection] Error detecting reverse proxy:', error);
        // Continue without proxy detection if there's an error
        req.proxyInfo = {
            isCloudflare: false,
            isNginx: false,
            isReverseProxy: false,
            maxFileSize: null,
            detectedHeaders: []
        };
        next();
    }
};

/**
 * Get effective file size limit considering proxy constraints
 */
const getEffectiveFileLimit = (req) => {
    if (req.proxyInfo && req.proxyInfo.maxFileSize) {
        return req.proxyInfo.maxFileSize;
    }

    // Default fallback (should not happen if middleware is working)
    return 500 * 1024 * 1024; // 500MB default
};

/**
 * Get file size limit in MB for display purposes
 */
const getFileLimitMB = (req) => {
    const bytesLimit = getEffectiveFileLimit(req);
    return Math.round(bytesLimit / 1024 / 1024);
};

module.exports = {
    detectReverseProxy,
    getEffectiveFileLimit,
    getFileLimitMB
};
