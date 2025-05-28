const express = require('express');
const router = express.Router();
const { docsNavigation, getActiveNavigation } = require('../config/docs-navigation');

// Documentation home page
router.get('/', (req, res) => {
    const navData = getActiveNavigation(req.path);
    res.render('docs/index', {
        title: 'Documentation - Sayonika',
        user: req.user,
        currentPath: req.path,
        docsNavigation: navData.navigation,
        activeSection: navData.activeSection,
        activeItem: navData.activeItem
    });
});

// Helper function to handle missing templates
function renderDocPage(req, res, templatePath, title, pageTitle) {
    const navData = getActiveNavigation(req.path);

    // Try to render the actual template first
    res.render(templatePath, {
        title: title,
        user: req.user,
        currentPath: req.path,
        pageTitle: pageTitle,
        docsNavigation: navData.navigation,
        activeSection: navData.activeSection,
        activeItem: navData.activeItem
    }, (err, html) => {
        if (err) {
            // If template doesn't exist, render coming soon page
            res.render('docs/coming-soon', {
                title: title,
                user: req.user,
                currentPath: req.path,
                pageTitle: pageTitle || title.replace(' - Sayonika Documentation', '').replace(' - API Reference', ''),
                docsNavigation: navData.navigation,
                activeSection: navData.activeSection,
                activeItem: navData.activeItem
            });
        } else {
            // Template exists, send the rendered HTML
            res.send(html);
        }
    });
}

// Getting Started section
router.get('/installation', (req, res) => {
    renderDocPage(req, res, 'docs/installation', 'Installation - Sayonika Documentation', 'Installation');
});

router.get('/configuration', (req, res) => {
    renderDocPage(req, res, 'docs/configuration', 'Configuration - Sayonika Documentation', 'Configuration');
});

// Redirect old routes to new structure
router.get('/getting-started', (req, res) => {
    res.redirect('/docs/installation');
});

router.get('/first-run', (req, res) => {
    res.redirect('/docs/installation#first-run');
});

// API Reference section
router.get('/api', (req, res) => {
    const navData = getActiveNavigation(req.path);
    res.render('docs/api/index', {
        title: 'API Reference - Sayonika Documentation',
        user: req.user,
        currentPath: req.path,
        docsNavigation: navData.navigation,
        activeSection: navData.activeSection,
        activeItem: navData.activeItem
    });
});

router.get('/api/authentication', (req, res) => {
    renderDocPage(req, res, 'docs/api/authentication', 'Authentication - API Reference', 'Authentication');
});

router.get('/api/rate-limiting', (req, res) => {
    renderDocPage(req, res, 'docs/api/rate-limiting', 'Rate Limiting - API Reference', 'Rate Limiting');
});

router.get('/api/response-format', (req, res) => {
    renderDocPage(req, res, 'docs/api/response-format', 'Response Format - API Reference', 'Response Format');
});

router.get('/api/error-handling', (req, res) => {
    renderDocPage(req, res, 'docs/api/error-handling', 'Error Handling - API Reference', 'Error Handling');
});

// API Endpoints section
router.get('/api/endpoints', (req, res) => {
    renderDocPage(req, res, 'docs/api/endpoints/index', 'API Endpoints - Sayonika Documentation', 'API Endpoints');
});

router.get('/api/endpoints/auth', (req, res) => {
    renderDocPage(req, res, 'docs/api/endpoints/auth', 'Authentication Endpoints - API Reference', 'Authentication Endpoints');
});

router.get('/api/endpoints/mods', (req, res) => {
    renderDocPage(req, res, 'docs/api/endpoints/mods', 'Mod Endpoints - API Reference', 'Mod Endpoints');
});

router.get('/api/endpoints/users', (req, res) => {
    renderDocPage(req, res, 'docs/api/endpoints/users', 'User Endpoints - API Reference', 'User Endpoints');
});

router.get('/api/endpoints/admin', (req, res) => {
    renderDocPage(req, res, 'docs/api/endpoints/admin', 'Admin Endpoints - API Reference', 'Admin Endpoints');
});

router.get('/api/endpoints/categories', (req, res) => {
    renderDocPage(req, res, 'docs/api/endpoints/categories', 'Category Endpoints - API Reference', 'Category Endpoints');
});

// User Features section
router.get('/features/achievements', (req, res) => {
    renderDocPage(req, res, 'docs/features/achievements', 'Achievements System - Sayonika Documentation', 'Achievements System');
});

router.get('/features/oauth', (req, res) => {
    renderDocPage(req, res, 'docs/features/oauth', 'OAuth Account Linking - Sayonika Documentation', 'OAuth Account Linking');
});

router.get('/features/profiles', (req, res) => {
    renderDocPage(req, res, 'docs/features/profiles', 'User Profiles - Sayonika Documentation', 'User Profiles');
});

router.get('/features/maintenance', (req, res) => {
    renderDocPage(req, res, 'docs/features/maintenance', 'Maintenance Mode - Sayonika Documentation', 'Maintenance Mode');
});

// Troubleshooting section
router.get('/customization', (req, res) => {
    renderDocPage(req, res, 'docs/customization', 'Customization - Sayonika Documentation', 'Customization');
});

router.get('/troubleshooting', (req, res) => {
    renderDocPage(req, res, 'docs/troubleshooting', 'Troubleshooting - Sayonika Documentation', 'Troubleshooting');
});

module.exports = router;
