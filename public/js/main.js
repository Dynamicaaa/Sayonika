// Sayonika Main JavaScript

// Global utilities
window.Sayonika = {
    // API helper functions
    api: {
        baseUrl: '/api',

        async request(endpoint, options = {}) {
            const url = `${this.baseUrl}${endpoint}`;

            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                credentials: 'include', // Include httpOnly cookies
                ...options
            };

            try {
                const response = await fetch(url, config);

                // Check if response is JSON
                const contentType = response.headers.get('content-type');
                let data;

                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    // Handle non-JSON responses (like rate limit text responses)
                    const text = await response.text();
                    data = { error: text };
                }

                if (!response.ok) {
                    throw new Error(data.error || `Request failed with status ${response.status}`);
                }

                return data;
            } catch (error) {
                console.error('API request failed:', error);
                throw error;
            }
        },

        async get(endpoint) {
            return this.request(endpoint);
        },

        async post(endpoint, data) {
            return this.request(endpoint, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },

        async put(endpoint, data) {
            return this.request(endpoint, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        },

        async delete(endpoint) {
            return this.request(endpoint, {
                method: 'DELETE'
            });
        }
    },

    // Notification system
    notify: {
        show(message, type = 'info', duration = 5000) {
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.innerHTML = `
                <div class="notification-content">
                    <i class="fas fa-${this.getIcon(type)}"></i>
                    <span>${message}</span>
                </div>
                <button class="notification-close">
                    <i class="fas fa-times"></i>
                </button>
            `;

            // Add close event listener
            const closeBtn = notification.querySelector('.notification-close');
            closeBtn.addEventListener('click', () => notification.remove());

            // Add to container or create one
            let container = document.querySelector('.notifications-container');
            if (!container) {
                container = document.createElement('div');
                container.className = 'notifications-container';
                document.body.appendChild(container);
            }

            container.appendChild(notification);

            // Auto remove after duration
            if (duration > 0) {
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, duration);
            }
        },

        getIcon(type) {
            const icons = {
                success: 'check-circle',
                error: 'exclamation-circle',
                warning: 'exclamation-triangle',
                info: 'info-circle'
            };
            return icons[type] || 'info-circle';
        },

        success(message, duration) {
            this.show(message, 'success', duration);
        },

        error(message, duration) {
            this.show(message, 'error', duration);
        },

        warning(message, duration) {
            this.show(message, 'warning', duration);
        },

        info(message, duration) {
            this.show(message, 'info', duration);
        }
    },

    // Modal system
    modal: {
        show(content, options = {}) {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-dialog ${options.size || ''}">
                    <div class="modal-content">
                        ${options.title ? `<div class="modal-header">
                            <h3 class="modal-title">${options.title}</h3>
                            <button class="modal-close">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>` : ''}
                        <div class="modal-body">
                            ${content}
                        </div>
                        ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Add close event listener
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => modal.remove());
            }

            // Close on overlay click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });

            // Close on escape key
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    modal.remove();
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);

            return modal;
        },

        confirm(message, title = 'Confirm') {
            return new Promise((resolve) => {
                const modal = this.show(message, {
                    title,
                    footer: `
                        <button class="btn btn-outline modal-cancel">
                            Cancel
                        </button>
                        <button class="btn btn-danger modal-confirm">
                            Confirm
                        </button>
                    `
                });

                // Add event listeners for confirm/cancel buttons
                const cancelBtn = modal.querySelector('.modal-cancel');
                const confirmBtn = modal.querySelector('.modal-confirm');

                if (cancelBtn) {
                    cancelBtn.addEventListener('click', () => {
                        modal.remove();
                        resolve(false);
                    });
                }

                if (confirmBtn) {
                    confirmBtn.addEventListener('click', () => {
                        modal.remove();
                        resolve(true);
                    });
                }
            });
        }
    },

    // Form utilities
    form: {
        serialize(form) {
            const formData = new FormData(form);
            const data = {};

            for (let [key, value] of formData.entries()) {
                if (data[key]) {
                    if (Array.isArray(data[key])) {
                        data[key].push(value);
                    } else {
                        data[key] = [data[key], value];
                    }
                } else {
                    data[key] = value;
                }
            }

            return data;
        },

        validate(form) {
            const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
            let isValid = true;

            inputs.forEach(input => {
                if (!input.value.trim()) {
                    this.showError(input, 'This field is required');
                    isValid = false;
                } else {
                    this.clearError(input);
                }
            });

            return isValid;
        },

        showError(input, message) {
            this.clearError(input);

            const error = document.createElement('div');
            error.className = 'form-error';
            error.textContent = message;

            input.classList.add('is-invalid');
            input.parentNode.appendChild(error);
        },

        clearError(input) {
            input.classList.remove('is-invalid');
            const error = input.parentNode.querySelector('.form-error');
            if (error) {
                error.remove();
            }
        }
    },

    // Utility functions
    utils: {
        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';

            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));

            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        },

        formatRelativeTime(dateString) {
            const date = new Date(dateString);
            const now = new Date();
            const diff = now - date;

            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
            if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
            if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
            return 'Just now';
        },

        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        throttle(func, limit) {
            let inThrottle;
            return function() {
                const args = arguments;
                const context = this;
                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }
    },

    // Authentication utilities
    auth: {
        currentUser: null,

        async checkAuthStatus() {
            try {
                const response = await fetch('/api/auth/me', {
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.authenticated) {
                        this.currentUser = data.user;
                        this.updateUI(true, data.user);
                        return data.user;
                    }
                }

                this.currentUser = null;
                this.updateUI(false);
                return null;
            } catch (error) {
                console.error('Auth check failed:', error);
                this.currentUser = null;
                this.updateUI(false);
                return null;
            }
        },

        updateUI(isAuthenticated, user = null) {
            const authButtons = document.querySelector('.auth-buttons');
            const userMenu = document.querySelector('.user-menu');
            const uploadLink = document.querySelector('a[href="/upload"]');

            if (isAuthenticated && user) {
                // Show user menu, hide auth buttons
                if (authButtons) authButtons.style.display = 'none';
                if (userMenu) {
                    userMenu.style.display = 'block';

                    // Update user info in menu
                    const userAvatar = userMenu.querySelector('.user-avatar');
                    const userName = userMenu.querySelector('.user-name');

                    if (userAvatar) {
                        userAvatar.src = user.avatar_url || 'https://picsum.photos/1024/1024';
                        userAvatar.alt = user.display_name || user.username;
                    }

                    if (userName) {
                        userName.textContent = user.display_name || user.username;
                    }
                }

                // Show upload link
                if (uploadLink) {
                    uploadLink.style.display = '';
                }

                // Update CTA section if on home page
                const ctaSection = document.querySelector('.cta-section .cta-actions');
                if (ctaSection) {
                    ctaSection.innerHTML = `
                        <a href="/upload" class="btn btn-primary btn-lg">
                            <i class="fas fa-upload"></i> Upload Your Mod
                        </a>
                    `;
                }
            } else {
                // Show auth buttons, hide user menu
                if (authButtons) authButtons.style.display = 'flex';
                if (userMenu) userMenu.style.display = 'none';

                // Hide upload link
                if (uploadLink) {
                    uploadLink.style.display = 'none';
                }

                // Update CTA section if on home page
                const ctaSection = document.querySelector('.cta-section .cta-actions');
                if (ctaSection) {
                    ctaSection.innerHTML = `
                        <a href="/register" class="btn btn-primary btn-lg">
                            <i class="fas fa-user-plus"></i> Join Community
                        </a>
                        <a href="/login" class="btn btn-outline btn-lg">
                            <i class="fas fa-sign-in-alt"></i> Login
                        </a>
                    `;
                }
            }
        },

        isLoggedIn() {
            return this.currentUser !== null;
        },

        getUser() {
            return this.currentUser;
        }
    }
};

// Create shorter alias for convenience
window.S = window.Sayonika;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme
    initializeTheme();

    // Handle OAuth success/error redirects
    handleOAuthRedirect();

    // Check authentication status on page load to ensure UI is in sync
    Sayonika.auth.checkAuthStatus();

    // Add event listeners for header buttons
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    const userMenuToggle = document.querySelector('.user-menu-toggle');
    if (userMenuToggle) {
        userMenuToggle.addEventListener('click', toggleUserMenu);
    }

    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', toggleMobileMenu);
    }

    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Add loading states to forms
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(e) {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn && !submitBtn.disabled) {
                submitBtn.classList.add('btn-loading');
                submitBtn.disabled = true;

                // Re-enable after 10 seconds as fallback
                setTimeout(() => {
                    submitBtn.classList.remove('btn-loading');
                    submitBtn.disabled = false;
                }, 10000);
            }
        });
    });

    // Add smooth scrolling to anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Initialize tooltips (if any)
    document.querySelectorAll('[data-tooltip]').forEach(element => {
        element.addEventListener('mouseenter', function() {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = this.getAttribute('data-tooltip');
            document.body.appendChild(tooltip);

            const rect = this.getBoundingClientRect();
            tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
            tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';

            this._tooltip = tooltip;
        });

        element.addEventListener('mouseleave', function() {
            if (this._tooltip) {
                this._tooltip.remove();
                this._tooltip = null;
            }
        });
    });
});

// Theme functionality
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeToggle = document.querySelector('.theme-toggle i');

    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        if (themeToggle) {
            themeToggle.className = 'fas fa-sun';
        }
    } else {
        document.body.classList.remove('dark-theme');
        if (themeToggle) {
            themeToggle.className = 'fas fa-moon';
        }
    }
}

function toggleTheme() {
    const body = document.body;
    const themeToggle = document.querySelector('.theme-toggle i');

    body.classList.toggle('dark-theme');

    // Update icon and save preference
    if (themeToggle) {
        if (body.classList.contains('dark-theme')) {
            themeToggle.className = 'fas fa-sun';
            localStorage.setItem('theme', 'dark');
        } else {
            themeToggle.className = 'fas fa-moon';
            localStorage.setItem('theme', 'light');
        }
    }
}

// Header functionality
function toggleUserMenu() {
    const dropdown = document.querySelector('.user-menu-dropdown');
    const toggle = document.querySelector('.user-menu-toggle');

    if (dropdown && toggle) {
        dropdown.classList.toggle('show');
        toggle.classList.toggle('active');
    }
}

function toggleMobileMenu() {
    const navbar = document.querySelector('.navbar');
    const toggle = document.querySelector('.mobile-menu-toggle');

    if (navbar && toggle) {
        navbar.classList.toggle('mobile-open');
        toggle.classList.toggle('active');
    }
}

async function logout() {
    try {
        // Call logout API (httpOnly cookies will be cleared by server)
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });

        // Clear local auth state
        Sayonika.auth.currentUser = null;
        Sayonika.auth.updateUI(false);

        // Redirect to home
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
        // Clear local auth state even if API call fails
        Sayonika.auth.currentUser = null;
        Sayonika.auth.updateUI(false);
        // Still redirect even if API call fails
        window.location.href = '/';
    }
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
    // Close user menu if clicking outside
    const userMenu = document.querySelector('.user-menu');
    const userDropdown = document.querySelector('.user-menu-dropdown');

    if (userMenu && userDropdown && !userMenu.contains(e.target)) {
        userDropdown.classList.remove('show');
        document.querySelector('.user-menu-toggle')?.classList.remove('active');
    }

    // Close mobile menu if clicking outside
    const navbar = document.querySelector('.navbar');
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const navbarMenu = document.querySelector('.navbar-menu');

    if (navbar && mobileToggle && navbarMenu && navbar.classList.contains('mobile-open') &&
        !navbarMenu.contains(e.target) && !mobileToggle.contains(e.target)) {
        navbar.classList.remove('mobile-open');
        mobileToggle.classList.remove('active');
    }
});

// Handle OAuth redirect parameters
function handleOAuthRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    const error = urlParams.get('error');

    console.log('handleOAuthRedirect called');
    console.log('Current URL:', window.location.href);
    console.log('URL search params:', window.location.search);
    console.log('Auth status:', authStatus);
    console.log('Error:', error);

    if (authStatus === 'success') {
        // OAuth login successful
        Sayonika.notify.success('Login successful! Welcome back!');

        // Update authentication state
        setTimeout(async () => {
            await Sayonika.auth.checkAuthStatus();
        }, 500);

        // Clean up URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    } else if (error) {
        // Handle OAuth errors
        let errorMessage = 'Authentication failed. Please try again.';

        switch (error) {
            case 'github_auth_failed':
                errorMessage = 'GitHub authentication failed. Please try again.';
                break;
            case 'discord_auth_failed':
                errorMessage = 'Discord authentication failed. Please try again.';
                break;
            case 'github_not_configured':
                errorMessage = 'GitHub authentication is not configured.';
                break;
            case 'discord_not_configured':
                errorMessage = 'Discord authentication is not configured.';
                break;
            case 'github_auth_error':
                errorMessage = 'An error occurred during GitHub authentication.';
                break;
            case 'discord_auth_error':
                errorMessage = 'An error occurred during Discord authentication.';
                break;
            case 'token_generation_failed':
                errorMessage = 'Failed to generate authentication token.';
                break;
            case 'auth_failed':
                errorMessage = 'Authentication failed. Please try again.';
                break;
        }

        Sayonika.notify.error(errorMessage);

        // Clean up URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    }
}

// Export for global use
window.S = window.Sayonika;
