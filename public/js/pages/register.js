// Register page functionality

document.addEventListener('DOMContentLoaded', function() {
    // Auto-focus first input
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.focus();
    }

    // Event listeners
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const registerForm = document.getElementById('registerForm');

    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            checkPasswordStrength(this.value);
        });
    }

    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', checkPasswordMatch);
    }

    if (passwordInput) {
        passwordInput.addEventListener('input', checkPasswordMatch);
    }

    if (usernameInput) {
        usernameInput.addEventListener('input', checkUsernameAvailability);
    }

    if (registerForm) {
        registerForm.addEventListener('submit', handleRegisterSubmit);
    }

    // Setup OAuth buttons
    setupOAuthButtons();
});

// Password strength checker
function checkPasswordStrength(password) {
    const strengthIndicator = document.getElementById('passwordStrength');
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');

    if (!strengthIndicator || !strengthFill || !strengthText) return;

    if (password.length === 0) {
        strengthIndicator.style.display = 'none';
        return;
    }

    strengthIndicator.style.display = 'block';

    let score = 0;
    let feedback = [];

    // Length check
    if (password.length >= 8) score += 1;
    else feedback.push('at least 8 characters');

    // Uppercase check
    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('uppercase letter');

    // Lowercase check
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('lowercase letter');

    // Number check
    if (/\d/.test(password)) score += 1;
    else feedback.push('number');

    // Special character check
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
    else feedback.push('special character');

    const percentage = (score / 5) * 100;
    strengthFill.style.width = percentage + '%';

    if (score <= 2) {
        strengthFill.style.backgroundColor = '#e74c3c';
        strengthText.textContent = 'Weak';
        strengthText.style.color = '#e74c3c';
    } else if (score <= 3) {
        strengthFill.style.backgroundColor = '#f39c12';
        strengthText.textContent = 'Fair';
        strengthText.style.color = '#f39c12';
    } else if (score <= 4) {
        strengthFill.style.backgroundColor = '#3498db';
        strengthText.textContent = 'Good';
        strengthText.style.color = '#3498db';
    } else {
        strengthFill.style.backgroundColor = '#27ae60';
        strengthText.textContent = 'Strong';
        strengthText.style.color = '#27ae60';
    }

    if (feedback.length > 0) {
        strengthText.textContent += ` (needs: ${feedback.join(', ')})`;
    }
}

function checkPasswordMatch() {
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');
    const matchIndicator = document.getElementById('passwordMatch');

    if (!password || !confirmPassword || !matchIndicator) return;

    if (confirmPassword.value.length === 0) {
        matchIndicator.style.display = 'none';
        return;
    }

    matchIndicator.style.display = 'block';

    if (password.value === confirmPassword.value) {
        matchIndicator.innerHTML = '<i class="fas fa-check"></i> Passwords match';
        matchIndicator.style.color = '#27ae60';
    } else {
        matchIndicator.innerHTML = '<i class="fas fa-times"></i> Passwords do not match';
        matchIndicator.style.color = '#e74c3c';
    }
}

// Username availability check
let usernameTimeout;
function checkUsernameAvailability() {
    const username = document.getElementById('username').value;
    const usernameField = document.getElementById('username');

    if (username.length < 3) {
        // Clear any existing messages for short usernames
        usernameField.style.borderColor = '';
        const errorMsg = usernameField.parentNode.querySelector('.error-message');
        if (errorMsg) {
            errorMsg.remove();
        }
        const successMsg = usernameField.parentNode.querySelector('.success-message');
        if (successMsg) {
            successMsg.remove();
        }
        return;
    }

    // Client-side validation first
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
        // Clear success message and show format error
        const successMsg = usernameField.parentNode.querySelector('.success-message');
        if (successMsg) {
            successMsg.remove();
        }

        if (window.S && window.S.form) {
            window.S.form.showError(usernameField, 'Username can only contain letters, numbers, underscores, and hyphens');
        } else {
            // Fallback error display
            usernameField.style.borderColor = '#e74c3c';
            let errorMsg = usernameField.parentNode.querySelector('.error-message');
            if (!errorMsg) {
                errorMsg = document.createElement('small');
                errorMsg.className = 'error-message';
                errorMsg.style.color = '#e74c3c';
                usernameField.parentNode.appendChild(errorMsg);
            }
            errorMsg.textContent = 'Username can only contain letters, numbers, underscores, and hyphens';
        }
        return;
    }

    clearTimeout(usernameTimeout);
    usernameTimeout = setTimeout(async () => {
        try {
            if (window.S && window.S.api) {
                await window.S.api.get(`/auth/check-username?username=${encodeURIComponent(username)}`);
                if (window.S.form) {
                    window.S.form.clearError(usernameField);
                }
            } else {
                // Fallback API call
                const response = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`);

                // Check if response is JSON
                const contentType = response.headers.get('content-type');
                let data;

                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    // Handle non-JSON responses
                    const text = await response.text();
                    data = { error: text };
                }

                if (!response.ok) {
                    throw new Error(data.error || 'Username check failed');
                }

                // Clear any existing errors if username is available
                usernameField.style.borderColor = '#27ae60';
                const errorMsg = usernameField.parentNode.querySelector('.error-message');
                if (errorMsg) {
                    errorMsg.remove();
                }

                // Show success message
                let successMsg = usernameField.parentNode.querySelector('.success-message');
                if (!successMsg) {
                    successMsg = document.createElement('small');
                    successMsg.className = 'success-message';
                    successMsg.style.color = '#27ae60';
                    usernameField.parentNode.appendChild(successMsg);
                }
                successMsg.innerHTML = '<i class="fas fa-check"></i> Username is available';
            }
        } catch (error) {
            let errorMessage = 'Username is already taken';

            // Handle different types of errors
            if (error.message.includes('taken') || error.message.includes('already')) {
                errorMessage = 'Username is already taken';
            } else if (error.message.includes('characters') || error.message.includes('contain')) {
                errorMessage = 'Username can only contain letters, numbers, underscores, and hyphens';
            } else if (error.message.includes('400')) {
                errorMessage = 'Invalid username format';
            }

            // Clear success message
            const successMsg = usernameField.parentNode.querySelector('.success-message');
            if (successMsg) {
                successMsg.remove();
            }

            if (window.S && window.S.form) {
                window.S.form.showError(usernameField, errorMessage);
            } else {
                // Fallback error display
                usernameField.style.borderColor = '#e74c3c';
                let errorMsg = usernameField.parentNode.querySelector('.error-message');
                if (!errorMsg) {
                    errorMsg = document.createElement('small');
                    errorMsg.className = 'error-message';
                    errorMsg.style.color = '#e74c3c';
                    usernameField.parentNode.appendChild(errorMsg);
                }
                errorMsg.textContent = errorMessage;
            }
        }
    }, 500);
}

// Form submission
async function handleRegisterSubmit(e) {
    e.preventDefault();

    const formData = window.S ? window.S.form.serialize(this) : new FormData(this);
    const submitBtn = this.querySelector('button[type="submit"]');

    // Convert FormData to object if needed
    const data = formData instanceof FormData ? Object.fromEntries(formData) : formData;

    // Client-side validation
    if (data.password !== data.confirmPassword) {
        if (window.S && window.S.notify) {
            window.S.notify.error('Passwords do not match');
        } else {
            alert('Passwords do not match');
        }
        return;
    }

    if (!data.terms) {
        if (window.S && window.S.notify) {
            window.S.notify.error('You must agree to the Terms of Service');
        } else {
            alert('You must agree to the Terms of Service');
        }
        return;
    }

    try {
        submitBtn.classList.add('btn-loading');
        submitBtn.disabled = true;

        let response;
        if (window.S && window.S.api) {
            response = await window.S.api.post('/auth/register', data);
        } else {
            // Fallback API call
            const fetchResponse = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            // Check if response is JSON
            const contentType = fetchResponse.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                response = await fetchResponse.json();
            } else {
                // Handle non-JSON responses
                const text = await fetchResponse.text();
                response = { error: text };
            }

            if (!fetchResponse.ok) {
                throw new Error(response.error || 'Registration failed');
            }
        }

        // Handle different registration outcomes
        if (response.requiresEmailVerification) {
            // User needs to verify email before they can log in
            const message = 'Registration successful! Please check your email and click the verification link to complete your account setup.';

            if (window.S && window.S.notify) {
                window.S.notify.success(message);
            } else {
                alert(message);
            }

            // Redirect to a verification pending page or login page
            setTimeout(() => {
                window.location.href = '/login?message=' + encodeURIComponent('Please verify your email before logging in.');
            }, 2000);
        } else {
            // First user (admin) - automatically logged in
            const welcomeMessage = 'Welcome! You are now the site administrator. You have access to the admin panel to manage mods and users.';

            if (window.S && window.S.notify) {
                window.S.notify.success(welcomeMessage);
            } else {
                alert(welcomeMessage);
            }

            // Update authentication state
            if (window.S && window.S.auth) {
                await window.S.auth.checkAuthStatus();
            }

            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        }

    } catch (error) {
        if (window.S && window.S.notify) {
            window.S.notify.error(error.message || 'Registration failed. Please try again.');
        } else {
            alert(error.message || 'Registration failed. Please try again.');
        }
    } finally {
        submitBtn.classList.remove('btn-loading');
        submitBtn.disabled = false;
    }
}

function setupOAuthButtons() {
    const githubBtn = document.getElementById('githubOAuthRegister');
    const discordBtn = document.getElementById('discordOAuthRegister');

    if (githubBtn) {
        githubBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // For registration, we don't need remember me functionality
            window.location.href = this.href;
        });
    }

    if (discordBtn) {
        discordBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // For registration, we don't need remember me functionality
            window.location.href = this.href;
        });
    }
}
