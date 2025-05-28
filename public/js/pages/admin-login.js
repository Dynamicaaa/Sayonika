// Admin login page functionality

document.addEventListener('DOMContentLoaded', function() {
    // Check for error messages in URL parameters
    checkForErrors();

    // Auto-focus first input
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.focus();
    }

    // Form submission
    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', handleAdminLoginSubmit);
    }

    // Show/hide password toggle
    setupPasswordToggle();

    // Setup OAuth buttons to include admin parameter
    setupAdminOAuthButtons();
});

function checkForErrors() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');

    if (error) {
        let errorMessage = '';
        switch (error) {
            case 'access_denied':
                errorMessage = 'Access denied. Administrator privileges required.';
                break;
            case 'github_auth_failed':
                errorMessage = 'GitHub authentication failed. Please try again.';
                break;
            case 'discord_auth_failed':
                errorMessage = 'Discord authentication failed. Please try again.';
                break;
            case 'github_login_failed':
                errorMessage = 'GitHub login failed. Please try again.';
                break;
            case 'discord_login_failed':
                errorMessage = 'Discord login failed. Please try again.';
                break;
            default:
                errorMessage = 'An error occurred during login. Please try again.';
        }

        showError(errorMessage);

        // Clean up URL by removing error parameter
        const newUrl = new URL(window.location);
        newUrl.searchParams.delete('error');
        window.history.replaceState({}, '', newUrl);
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');

    if (errorDiv && errorText) {
        errorText.textContent = message;
        errorDiv.style.display = 'flex';

        // Auto-hide after 10 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 10000);
    }
}

async function handleAdminLoginSubmit(e) {
    e.preventDefault();

    const formData = window.S ? window.S.form.serialize(this) : new FormData(this);
    const submitBtn = this.querySelector('button[type="submit"]');

    try {
        submitBtn.classList.add('btn-loading');
        submitBtn.disabled = true;

        let response;
        if (window.S && window.S.api) {
            response = await window.S.api.post('/auth/admin-login', formData);
        } else {
            // Fallback API call - include remember me checkbox and admin flag
            const formDataObj = Object.fromEntries(formData);
            const rememberMe = document.getElementById('remember')?.checked || false;
            formDataObj.remember = rememberMe;
            formDataObj.admin = true; // Flag to indicate this is an admin login

            const fetchResponse = await fetch('/api/auth/admin-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formDataObj)
            });

            // Check if response is JSON
            const contentType = fetchResponse.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                response = await fetchResponse.json();
            } else {
                // Handle non-JSON responses (like rate limit text responses)
                const text = await fetchResponse.text();
                response = { error: text };
            }

            if (!fetchResponse.ok) {
                // Handle email verification errors specifically
                if (fetchResponse.status === 403 && response.code === 'EMAIL_NOT_VERIFIED') {
                    // Show verification pending message and redirect
                    if (window.S && window.S.notify) {
                        window.S.notify.error('Please verify your email address before accessing the admin panel.');
                    } else {
                        alert('Please verify your email address before accessing the admin panel.');
                    }

                    // Store user info for verification pending page
                    sessionStorage.setItem('pendingVerificationUser', JSON.stringify(response.user));

                    setTimeout(() => {
                        window.location.href = '/verification-pending';
                    }, 2000);
                    return;
                }

                throw new Error(response.error || 'Admin login failed');
            }
        }

        // Token is now stored as httpOnly cookie, no need to store in localStorage

        if (window.S && window.S.notify) {
            window.S.notify.success('Admin login successful! Redirecting...');
        } else {
            alert('Admin login successful! Redirecting...');
        }

        // Update authentication state
        if (window.S && window.S.auth) {
            await window.S.auth.checkAuthStatus();
        }

        // Redirect to admin dashboard
        setTimeout(() => {
            window.location.href = '/admin';
        }, 1000);

    } catch (error) {
        if (window.S && window.S.notify) {
            window.S.notify.error(error.message || 'Admin login failed. Please try again.');
        } else {
            alert(error.message || 'Admin login failed. Please try again.');
        }

        // Clear form errors
        document.querySelectorAll('.form-error').forEach(el => el.remove());
        document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

        // Show specific field errors if available
        if (error.errors) {
            error.errors.forEach(err => {
                const field = document.querySelector(`[name="${err.param}"]`);
                if (field) {
                    if (window.Sayonika && window.Sayonika.form) {
                        window.Sayonika.form.showError(field, err.msg);
                    } else {
                        // Fallback error display
                        field.style.borderColor = '#e74c3c';
                        let errorMsg = field.parentNode.querySelector('.error-message');
                        if (!errorMsg) {
                            errorMsg = document.createElement('small');
                            errorMsg.className = 'error-message';
                            errorMsg.style.color = '#e74c3c';
                            field.parentNode.appendChild(errorMsg);
                        }
                        errorMsg.textContent = err.msg;
                    }
                }
            });
        }
    } finally {
        submitBtn.classList.remove('btn-loading');
        submitBtn.disabled = false;
    }
}

function setupPasswordToggle() {
    const passwordInput = document.getElementById('password');
    if (!passwordInput) return;

    const togglePassword = document.createElement('button');
    togglePassword.type = 'button';
    togglePassword.className = 'password-toggle';
    togglePassword.innerHTML = '<i class="fas fa-eye"></i>';
    togglePassword.style.cssText = `
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        color: #666;
        cursor: pointer;
    `;

    passwordInput.parentNode.style.position = 'relative';
    passwordInput.parentNode.appendChild(togglePassword);
    passwordInput.style.paddingRight = '40px';

    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);

        const icon = this.querySelector('i');
        icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    });
}

function setupAdminOAuthButtons() {
    const githubBtn = document.getElementById('githubOAuth');
    const discordBtn = document.getElementById('discordOAuth');
    const rememberCheckbox = document.getElementById('remember');

    if (githubBtn) {
        githubBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const rememberMe = rememberCheckbox?.checked || false;
            const url = new URL(this.href, window.location.origin);
            if (rememberMe) {
                url.searchParams.set('remember', 'true');
            }
            url.searchParams.set('admin', 'true'); // Add admin flag
            window.location.href = url.toString();
        });
    }

    if (discordBtn) {
        discordBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const rememberMe = rememberCheckbox?.checked || false;
            const url = new URL(this.href, window.location.origin);
            if (rememberMe) {
                url.searchParams.set('remember', 'true');
            }
            url.searchParams.set('admin', 'true'); // Add admin flag
            window.location.href = url.toString();
        });
    }
}
