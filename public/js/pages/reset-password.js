// Reset password page functionality

document.addEventListener('DOMContentLoaded', function() {
    // Check for messages in URL parameters
    checkForMessages();

    // Auto-focus password input
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.focus();
    }

    // Form submission
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', handleResetPasswordSubmit);
    }

    // Password confirmation validation
    const confirmPasswordInput = document.getElementById('confirmPassword');
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', validatePasswordMatch);
    }
    if (passwordInput) {
        passwordInput.addEventListener('input', validatePasswordMatch);
    }
});

function checkForMessages() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');

    if (error) {
        let errorMessage = '';
        switch (error) {
            case 'invalid_token':
                errorMessage = 'Invalid or expired reset token. Please request a new password reset.';
                break;
            case 'token_expired':
                errorMessage = 'Reset token has expired. Please request a new password reset.';
                break;
            default:
                errorMessage = 'An error occurred. Please try again.';
        }

        showError(errorMessage);

        // Clean up URL
        const newUrl = new URL(window.location);
        newUrl.searchParams.delete('error');
        window.history.replaceState({}, '', newUrl);
    }
}

function showError(message) {
    // Use global notification system if available
    if (window.S && window.S.notify) {
        window.S.notify.error(message);
    } else {
        // Fallback to inline error display
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
}

function validatePasswordMatch() {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const confirmInput = document.getElementById('confirmPassword');

    if (confirmPassword && password !== confirmPassword) {
        confirmInput.setCustomValidity('Passwords do not match');
        confirmInput.style.borderColor = '#ffb6c1';
    } else {
        confirmInput.setCustomValidity('');
        confirmInput.style.borderColor = '';
    }
}

async function handleResetPasswordSubmit(e) {
    e.preventDefault();

    const formData = new FormData(this);
    const submitBtn = this.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const originalText = btnText.textContent;

    // Validate passwords match
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');

    if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
    }

    if (password.length < 8) {
        showError('Password must be at least 8 characters long');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.classList.add('btn-loading');
        btnText.textContent = 'Updating... ✨';

        let response;
        if (window.S && window.S.api) {
            // Use global API system
            response = await window.S.api.post('/auth/reset-password', Object.fromEntries(formData));
        } else {
            // Fallback to fetch
            const fetchResponse = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(Object.fromEntries(formData))
            });

            response = await fetchResponse.json();
            if (!fetchResponse.ok) {
                throw new Error(response.error || 'Failed to reset password');
            }
        }

        // Show success and redirect to login
        if (window.S && window.S.notify) {
            window.S.notify.success('Password reset successful! You can now log in with your new password ♡');
        } else {
            alert('Password reset successful! You can now log in with your new password ♡');
        }

        setTimeout(() => {
            window.location.href = '/login?success=password_reset';
        }, 2000);

    } catch (error) {
        showError(error.message || 'Failed to reset password. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        btnText.textContent = originalText;
    }
}
