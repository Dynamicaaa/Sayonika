// Forgot password page functionality

document.addEventListener('DOMContentLoaded', function() {
    // Check for messages in URL parameters
    checkForMessages();

    // Auto-focus email input
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.focus();
    }

    // Form submission
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', handleForgotPasswordSubmit);
    }
});

function checkForMessages() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const success = urlParams.get('success');

    if (error) {
        let errorMessage = '';
        switch (error) {
            case 'user_not_found':
                errorMessage = 'No account found with that email address.';
                break;
            case 'email_not_configured':
                errorMessage = 'Email service is not configured. Please contact support.';
                break;
            case 'rate_limit':
                errorMessage = 'Too many requests. Please wait before trying again.';
                break;
            default:
                errorMessage = 'An error occurred. Please try again.';
        }

        showError(errorMessage);
    }

    if (success) {
        let successMessage = '';
        switch (success) {
            case 'email_sent':
                successMessage = 'Password reset email sent! Please check your inbox ♡';
                break;
            default:
                successMessage = 'Success!';
        }

        showSuccess(successMessage);
    }

    // Clean up URL
    if (error || success) {
        const newUrl = new URL(window.location);
        newUrl.searchParams.delete('error');
        newUrl.searchParams.delete('success');
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

function showSuccess(message) {
    // Use global notification system if available
    if (window.S && window.S.notify) {
        window.S.notify.success(message);
    } else {
        // Fallback to inline success display
        const successDiv = document.getElementById('successMessage');
        const successText = document.getElementById('successText');

        if (successDiv && successText) {
            successText.textContent = message;
            successDiv.style.display = 'flex';

            // Auto-hide after 15 seconds
            setTimeout(() => {
                successDiv.style.display = 'none';
            }, 15000);
        }
    }
}

async function handleForgotPasswordSubmit(e) {
    e.preventDefault();

    const formData = new FormData(this);
    const submitBtn = this.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const originalText = btnText.textContent;

    try {
        submitBtn.disabled = true;
        submitBtn.classList.add('btn-loading');
        btnText.textContent = 'Sending... ✨';

        let response;
        if (window.S && window.S.api) {
            // Use global API system
            response = await window.S.api.post('/auth/forgot-password', Object.fromEntries(formData));
        } else {
            // Fallback to fetch
            const fetchResponse = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(Object.fromEntries(formData))
            });

            response = await fetchResponse.json();
            if (!fetchResponse.ok) {
                throw new Error(response.error || 'Failed to send reset email');
            }
        }

        // Show success message
        showSuccess('Password reset email sent! Please check your inbox ♡');

        // Clear the form
        this.reset();

    } catch (error) {
        showError(error.message || 'Failed to send reset email. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        btnText.textContent = originalText;
    }
}
