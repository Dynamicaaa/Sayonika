// Merge Accounts page functionality
document.addEventListener('DOMContentLoaded', function() {
    const confirmBtn = document.getElementById('confirmMergeBtn');
    const cancelBtn = document.getElementById('cancelMergeBtn');
    
    // Get provider from the page
    const providerElement = document.querySelector('[data-provider]');
    const provider = providerElement ? providerElement.getAttribute('data-provider') : null;

    if (!provider) {
        console.error('Provider not found');
        return;
    }

    confirmBtn.addEventListener('click', async function() {
        try {
            // Show loading state
            confirmBtn.disabled = true;
            const originalHTML = confirmBtn.innerHTML;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';

            // Call the link API endpoint
            const response = await fetch(`/auth/link/${provider}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                // Redirect to OAuth with link=true
                window.location.href = data.redirectUrl;
            } else {
                throw new Error(data.error || 'Failed to initiate account linking');
            }
        } catch (error) {
            console.error('Merge error:', error);
            
            // Show error message
            const errorMsg = error.message || 'Failed to connect account';
            
            // Create or update error alert
            let errorAlert = document.querySelector('.merge-error-alert');
            if (!errorAlert) {
                errorAlert = document.createElement('div');
                errorAlert.className = 'alert alert-danger merge-error-alert';
                errorAlert.style.marginTop = '1rem';
                confirmBtn.parentNode.insertBefore(errorAlert, confirmBtn.nextSibling);
            }
            
            errorAlert.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Error:</strong> ${errorMsg}
            `;
            
            // Reset button state
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `<i class="fab fa-${provider}"></i> Connect ${provider === 'github' ? 'GitHub' : 'Discord'} Account`;
        }
    });

    cancelBtn.addEventListener('click', function() {
        // Redirect back to settings or previous page
        const referrer = document.referrer;
        if (referrer && referrer.includes(window.location.origin)) {
            window.history.back();
        } else {
            window.location.href = '/settings';
        }
    });
});
