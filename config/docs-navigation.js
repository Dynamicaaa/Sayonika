/**
 * Documentation Navigation Configuration
 * This file defines the structure and organization of the documentation sidebar navigation.
 * When adding new documentation pages, update this file to include them in the navigation.
 */

const docsNavigation = [
    {
        title: "Getting Started",
        items: [
            {
                title: "Overview",
                path: "/docs",
                description: "Introduction to Sayonika"
            },
            {
                title: "Installation",
                path: "/docs/installation",
                description: "How to install and set up Sayonika"
            },
            {
                title: "Configuration",
                path: "/docs/configuration",
                description: "Configure your Sayonika instance"
            }
        ]
    },
    {
        title: "API Reference",
        items: [
            {
                title: "Overview",
                path: "/docs/api",
                description: "API documentation overview"
            },
            {
                title: "Authentication",
                path: "/docs/api/authentication",
                description: "API authentication methods"
            },
            {
                title: "Rate Limiting",
                path: "/docs/api/rate-limiting",
                description: "API rate limiting information"
            },
            {
                title: "Response Format",
                path: "/docs/api/response-format",
                description: "API response format specification"
            },
            {
                title: "Error Handling",
                path: "/docs/api/error-handling",
                description: "API error handling and codes"
            }
        ]
    },
    {
        title: "Endpoints",
        items: [
            {
                title: "Overview",
                path: "/docs/api/endpoints",
                description: "API endpoints overview"
            },
            {
                title: "Authentication",
                path: "/docs/api/endpoints/auth",
                description: "Authentication endpoints"
            },
            {
                title: "Mods",
                path: "/docs/api/endpoints/mods",
                description: "Mod management endpoints"
            },
            {
                title: "Users",
                path: "/docs/api/endpoints/users",
                description: "User management endpoints"
            },
            {
                title: "Admin",
                path: "/docs/api/endpoints/admin",
                description: "Admin endpoints"
            },
            {
                title: "Categories",
                path: "/docs/api/endpoints/categories",
                description: "Category management endpoints"
            }
        ]
    },
    {
        title: "Features",
        items: [
            {
                title: "Achievements System",
                path: "/docs/features/achievements",
                description: "User achievements and gamification"
            },
            {
                title: "OAuth Account Linking",
                path: "/docs/features/oauth",
                description: "OAuth integration and account linking"
            },
            {
                title: "User Profiles",
                path: "/docs/features/profiles",
                description: "User profile management"
            },
            {
                title: "Maintenance Mode",
                path: "/docs/features/maintenance",
                description: "Maintenance mode configuration"
            }
        ]
    },
    {
        title: "Troubleshooting",
        items: [
            {
                title: "Customization",
                path: "/docs/customization",
                description: "Customizing your Sayonika instance"
            },
            {
                title: "Troubleshooting",
                path: "/docs/troubleshooting",
                description: "Common issues and solutions"
            }
        ]
    }
];

/**
 * Helper function to get the active section and item based on current path
 * @param {string} currentPath - The current request path
 * @returns {object} Object containing active section and item information
 */
function getActiveNavigation(currentPath) {
    let activeSection = null;
    let activeItem = null;

    for (const section of docsNavigation) {
        for (const item of section.items) {
            if (item.path === currentPath || 
                (currentPath === '/docs/' && item.path === '/docs')) {
                activeSection = section;
                activeItem = item;
                break;
            }
        }
        if (activeItem) break;
    }

    return {
        activeSection,
        activeItem,
        navigation: docsNavigation
    };
}

/**
 * Get all navigation paths for route validation
 * @returns {string[]} Array of all valid documentation paths
 */
function getAllNavigationPaths() {
    const paths = [];
    for (const section of docsNavigation) {
        for (const item of section.items) {
            paths.push(item.path);
        }
    }
    return paths;
}

module.exports = {
    docsNavigation,
    getActiveNavigation,
    getAllNavigationPaths
};
