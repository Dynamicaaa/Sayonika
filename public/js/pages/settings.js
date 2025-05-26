// Settings page functionality

let oauthStatus = {};

// Tab switching
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', function() {
        const tabName = this.getAttribute('data-tab');

        // Remove active class from all tabs and content
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        // Add active class to clicked tab and corresponding content
        this.classList.add('active');
        document.getElementById(tabName + '-tab').classList.add('active');
    });
});

// Load OAuth status
async function loadOAuthStatus() {
    try {
        // Use direct fetch since this is not an API route but an OAuth route
        const response = await fetch('/auth/status', {
            method: 'GET',
            credentials: 'include', // Include cookies for authentication
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        oauthStatus = await response.json();
        updateConnectionsUI();
        updateSecurityStatus();
    } catch (error) {
        console.error('Failed to load OAuth status:', error);
    }
}

function updateConnectionsUI() {
    // GitHub
    const githubStatus = document.getElementById('githubStatus');
    const githubAction = document.getElementById('githubAction');

    if (oauthStatus.github?.connected) {
        githubStatus.textContent = `Connected as ${oauthStatus.github.username}`;
        githubAction.innerHTML = '<i class="fas fa-unlink"></i> Disconnect';
        githubAction.className = 'btn btn-danger';

        // Disable button if this is the only auth method
        if (!oauthStatus.github.canUnlink) {
            githubAction.disabled = true;
            githubAction.title = 'Cannot disconnect - this is your only sign-in method. Please set a password or connect another account first.';
            githubAction.className = 'btn btn-danger btn-disabled';
            githubAction.style.cursor = 'not-allowed';
            githubAction.style.opacity = '0.6';
        } else {
            githubAction.disabled = false;
            githubAction.title = '';
            githubAction.style.cursor = 'pointer';
            githubAction.style.opacity = '1';
        }
    } else {
        githubStatus.textContent = 'Not connected';
        githubAction.innerHTML = '<i class="fab fa-github"></i> Connect';
        githubAction.className = 'btn btn-primary';
        githubAction.disabled = false;
        githubAction.title = '';
        githubAction.style.cursor = 'pointer';
        githubAction.style.opacity = '1';
    }

    // Discord
    const discordStatus = document.getElementById('discordStatus');
    const discordAction = document.getElementById('discordAction');

    if (oauthStatus.discord?.connected) {
        const username = oauthStatus.discord.discriminator ?
            `${oauthStatus.discord.username}#${oauthStatus.discord.discriminator}` :
            oauthStatus.discord.username;
        discordStatus.textContent = `Connected as ${username}`;
        discordAction.innerHTML = '<i class="fas fa-unlink"></i> Disconnect';
        discordAction.className = 'btn btn-danger';

        // Disable button if this is the only auth method
        if (!oauthStatus.discord.canUnlink) {
            discordAction.disabled = true;
            discordAction.title = 'Cannot disconnect - this is your only sign-in method. Please set a password or connect another account first.';
            discordAction.className = 'btn btn-danger btn-disabled';
            discordAction.style.cursor = 'not-allowed';
            discordAction.style.opacity = '0.6';
        } else {
            discordAction.disabled = false;
            discordAction.title = '';
            discordAction.style.cursor = 'pointer';
            discordAction.style.opacity = '1';
        }
    } else {
        discordStatus.textContent = 'Not connected';
        discordAction.innerHTML = '<i class="fab fa-discord"></i> Connect';
        discordAction.className = 'btn btn-primary';
        discordAction.disabled = false;
        discordAction.title = '';
        discordAction.style.cursor = 'pointer';
        discordAction.style.opacity = '1';
    }
}

function updateSecurityStatus() {
    const passwordStatus = document.getElementById('passwordStatus');

    if (oauthStatus.hasPassword) {
        passwordStatus.textContent = 'Password is set';
    } else {
        passwordStatus.textContent = 'No password set (using OAuth only)';
    }

    // Update connection warning based on auth method count
    updateConnectionWarning();
}

function updateConnectionWarning() {
    const warningDiv = document.querySelector('.connection-warning .alert');
    if (!warningDiv || !oauthStatus) return;

    const authMethodCount = oauthStatus.authMethodCount || 0;

    if (authMethodCount <= 1) {
        warningDiv.className = 'alert alert-danger';
        warningDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Warning:</strong> You only have one sign-in method. You cannot disconnect your only authentication method. Please set a password or connect another account first.
        `;
    } else {
        warningDiv.className = 'alert alert-warning';
        warningDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Important:</strong> Make sure you have at least one way to sign in (password or connected account) before disconnecting any accounts.
        `;
    }
}

// OAuth connection functions
async function toggleGitHub() {
    const button = document.getElementById('githubAction');
    if (!button) return;

    // Prevent action if button is disabled or if it's the only auth method
    if (button.disabled) {
        if (oauthStatus.github?.connected && !oauthStatus.github?.canUnlink) {
            S.notify.error('Cannot disconnect GitHub - this is your only sign-in method. Please set a password or connect another account first.');
        }
        return;
    }

    // Double-check the status before proceeding
    if (oauthStatus.github?.connected && !oauthStatus.github?.canUnlink) {
        S.notify.error('Cannot disconnect GitHub - this is your only sign-in method. Please set a password or connect another account first.');
        return;
    }

    const spinner = button.querySelector('.fa-spinner');

    if (spinner) {
        spinner.style.display = 'inline-block';
    }
    button.disabled = true;

    try {
        if (oauthStatus.github?.connected) {
            // Check again before attempting disconnect
            if (!oauthStatus.github.canUnlink) {
                throw new Error('Cannot disconnect GitHub - this is your only sign-in method.');
            }

            // Disconnect
            const response = await fetch('/auth/unlink/github', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            S.notify.success('GitHub account disconnected');
        } else {
            // Connect
            window.location.href = '/auth/github';
            return;
        }

        // Reload OAuth status to update UI
        await loadOAuthStatus();
    } catch (error) {
        console.error('GitHub toggle error:', error);
        S.notify.error(error.message || 'Failed to update GitHub connection');
    } finally {
        if (spinner) {
            spinner.style.display = 'none';
        }
        // Re-enable button based on current status
        // The loadOAuthStatus() call above will update the UI properly
        if (!oauthStatus.github?.connected || oauthStatus.github?.canUnlink) {
            button.disabled = false;
        }
    }
}

async function toggleDiscord() {
    const button = document.getElementById('discordAction');
    if (!button) return;

    // Prevent action if button is disabled or if it's the only auth method
    if (button.disabled) {
        if (oauthStatus.discord?.connected && !oauthStatus.discord?.canUnlink) {
            S.notify.error('Cannot disconnect Discord - this is your only sign-in method. Please set a password or connect another account first.');
        }
        return;
    }

    // Double-check the status before proceeding
    if (oauthStatus.discord?.connected && !oauthStatus.discord?.canUnlink) {
        S.notify.error('Cannot disconnect Discord - this is your only sign-in method. Please set a password or connect another account first.');
        return;
    }

    const spinner = button.querySelector('.fa-spinner');

    if (spinner) {
        spinner.style.display = 'inline-block';
    }
    button.disabled = true;

    try {
        if (oauthStatus.discord?.connected) {
            // Check again before attempting disconnect
            if (!oauthStatus.discord.canUnlink) {
                throw new Error('Cannot disconnect Discord - this is your only sign-in method.');
            }

            // Disconnect
            const response = await fetch('/auth/unlink/discord', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            S.notify.success('Discord account disconnected');
        } else {
            // Connect
            window.location.href = '/auth/discord';
            return;
        }

        // Reload OAuth status to update UI
        await loadOAuthStatus();
    } catch (error) {
        console.error('Discord toggle error:', error);
        S.notify.error(error.message || 'Failed to update Discord connection');
    } finally {
        if (spinner) {
            spinner.style.display = 'none';
        }
        // Re-enable button based on current status
        // The loadOAuthStatus() call above will update the UI properly
        if (!oauthStatus.discord?.connected || oauthStatus.discord?.canUnlink) {
            button.disabled = false;
        }
    }
}

// Password change functions
function changePassword() {
    document.getElementById('passwordForm').style.display = 'block';
}

function cancelPasswordChange() {
    document.getElementById('passwordForm').style.display = 'none';
    document.getElementById('passwordForm').reset();
}

// Avatar functions
async function removeAvatar() {
    try {
        // Check if the button is disabled (for default avatars)
        const removeBtn = document.getElementById('removeAvatarBtn');
        if (removeBtn && removeBtn.disabled) {
            S.notify.error('Cannot remove default profile picture');
            return;
        }

        const confirmed = await S.modal.confirm(
            'Are you sure you want to remove your profile picture? A new default picture will be generated.',
            'Remove Profile Picture'
        );

        if (!confirmed) return;

        const response = await S.api.delete('/auth/profile/avatar');

        // Update the avatar preview with the new default avatar
        const avatarPreview = document.getElementById('avatarPreview');
        if (avatarPreview && response.avatar_url) {
            avatarPreview.src = response.avatar_url;
            avatarPreview.setAttribute('data-original-src', response.avatar_url);
        } else if (avatarPreview) {
            // Fallback to picsum.photos if no new avatar URL
            avatarPreview.src = 'https://picsum.photos/1024/1024';
        }

        S.notify.success('Profile picture removed and new default generated!');

        // Reload the page to update the button state since we now have a default avatar
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } catch (error) {
        console.error('Avatar removal error:', error);
        S.notify.error(error.message || 'Failed to remove profile picture');
    }
}

// Email verification functions
async function resendVerificationEmail() {
    const button = document.getElementById('resendVerificationBtn');
    if (!button) return;

    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
        const response = await S.api.post('/auth/resend-verification');
        S.notify.success('Verification email sent! Please check your inbox.');
    } catch (error) {
        console.error('Resend verification error:', error);
        S.notify.error(error.message || 'Failed to send verification email');
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

// Email preferences functions
async function loadEmailPreferences() {
    try {
        const preferences = await S.api.get('/auth/email-preferences');

        // Update form fields
        document.getElementById('emailNotificationsEnabled').checked = preferences.email_notifications_enabled;
        document.getElementById('emailModApproved').checked = preferences.email_mod_approved;
        document.getElementById('emailAchievements').checked = preferences.email_achievements;
        document.getElementById('emailComments').checked = preferences.email_comments;
    } catch (error) {
        console.error('Failed to load email preferences:', error);
    }
}

async function saveEmailPreferences(formData) {
    try {
        const preferences = {
            email_notifications_enabled: formData.get('email_notifications_enabled') === 'on',
            email_mod_approved: formData.get('email_mod_approved') === 'on',
            email_achievements: formData.get('email_achievements') === 'on',
            email_comments: formData.get('email_comments') === 'on'
        };

        await S.api.put('/auth/email-preferences', preferences);
        S.notify.success('Email preferences saved successfully!');
    } catch (error) {
        console.error('Save email preferences error:', error);
        S.notify.error(error.message || 'Failed to save email preferences');
    }
}

// Delete account function
function deleteAccount() {
    S.modal.confirm(
        'Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your mods and data.',
        'Delete Account'
    ).then(confirmed => {
        if (confirmed) {
            // Additional confirmation
            S.modal.confirm(
                'This is your final warning. Type "DELETE" to confirm account deletion.',
                'Final Confirmation'
            ).then(finalConfirmed => {
                if (finalConfirmed) {
                    deleteAccountConfirmed();
                }
            });
        }
    });
}

async function deleteAccountConfirmed() {
    try {
        await S.api.delete('/auth/account');
        S.notify.success('Account deleted successfully');
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    } catch (error) {
        S.notify.error(error.message || 'Failed to delete account');
    }
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Load OAuth status and email preferences
    loadOAuthStatus();
    loadEmailPreferences();

    // Update bio counter
    const bioField = document.getElementById('bio');
    if (bioField) {
        document.getElementById('bioCount').textContent = bioField.value.length;

        // Bio character counter
        bioField.addEventListener('input', function() {
            document.getElementById('bioCount').textContent = this.value.length;
        });
    }

    // Avatar change button
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener('click', function() {
            document.getElementById('avatarFile').click();
        });
    }

    // Avatar file input change handler
    const avatarFileInput = document.getElementById('avatarFile');
    if (avatarFileInput) {
        avatarFileInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            // Validate file size (5MB limit)
            if (file.size > 5 * 1024 * 1024) {
                S.notify.error('File size must be less than 5MB');
                return;
            }

            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                S.notify.error('Only image files (JPG, PNG, GIF, WebP) are allowed');
                return;
            }

            try {
                // Show preview
                const reader = new FileReader();
                reader.onload = function(e) {
                    const avatarPreview = document.getElementById('avatarPreview');
                    if (avatarPreview) {
                        avatarPreview.src = e.target.result;
                    }
                };
                reader.readAsDataURL(file);

                // Upload the file
                const formData = new FormData();
                formData.append('avatar', file);

                const response = await fetch('/api/auth/profile/avatar', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Upload failed');
                }

                const result = await response.json();
                S.notify.success('Profile picture updated successfully!');

                // Update the preview with the new URL
                const avatarPreview = document.getElementById('avatarPreview');
                if (avatarPreview) {
                    avatarPreview.src = result.avatar_url;
                }
            } catch (error) {
                console.error('Avatar upload error:', error);
                S.notify.error(error.message || 'Failed to upload profile picture');

                // Reset the file input
                e.target.value = '';

                // Restore original avatar
                const avatarPreview = document.getElementById('avatarPreview');
                if (avatarPreview) {
                    avatarPreview.src = avatarPreview.getAttribute('data-original-src') || 'https://picsum.photos/1024/1024';
                }
            }
        });
    }

    // Remove avatar button
    const removeAvatarBtn = document.getElementById('removeAvatarBtn');
    if (removeAvatarBtn) {
        removeAvatarBtn.addEventListener('click', function(e) {
            // Prevent action if button is disabled
            if (this.disabled) {
                e.preventDefault();
                S.notify.error('Cannot remove default profile picture');
                return;
            }
            removeAvatar();
        });
    }

    // Change password button
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', changePassword);
    }

    // Cancel password button
    const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
    if (cancelPasswordBtn) {
        cancelPasswordBtn.addEventListener('click', cancelPasswordChange);
    }

    // GitHub action button
    const githubAction = document.getElementById('githubAction');
    if (githubAction) {
        githubAction.addEventListener('click', toggleGitHub);
    }

    // Discord action button
    const discordAction = document.getElementById('discordAction');
    if (discordAction) {
        discordAction.addEventListener('click', toggleDiscord);
    }

    // Delete account button
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', deleteAccount);
    }

    // Form handlers
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const formData = S.form.serialize(this);

            try {
                await S.api.put('/auth/profile', formData);
                S.notify.success('Profile updated successfully!');
            } catch (error) {
                S.notify.error(error.message || 'Failed to update profile');
            }
        });
    }

    // Password form handler
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const formData = S.form.serialize(this);

            if (formData.newPassword !== formData.confirmPassword) {
                S.notify.error('New passwords do not match');
                return;
            }

            try {
                await S.api.post('/auth/change-password', formData);
                S.notify.success('Password updated successfully!');
                cancelPasswordChange();
                await loadOAuthStatus();
            } catch (error) {
                S.notify.error(error.message || 'Failed to update password');
            }
        });
    }

    // Resend verification email button
    const resendVerificationBtn = document.getElementById('resendVerificationBtn');
    if (resendVerificationBtn) {
        resendVerificationBtn.addEventListener('click', resendVerificationEmail);
    }

    // Email notifications form
    const notificationsForm = document.getElementById('notificationsForm');
    if (notificationsForm) {
        notificationsForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            await saveEmailPreferences(formData);
        });
    }

    // Master email notifications toggle
    const emailNotificationsEnabled = document.getElementById('emailNotificationsEnabled');
    if (emailNotificationsEnabled) {
        emailNotificationsEnabled.addEventListener('change', function() {
            const emailOptions = document.querySelector('.email-options');
            const checkboxes = emailOptions.querySelectorAll('input[type="checkbox"]');

            if (this.checked) {
                emailOptions.style.opacity = '1';
                emailOptions.style.pointerEvents = 'auto';
                checkboxes.forEach(cb => cb.disabled = false);
            } else {
                emailOptions.style.opacity = '0.5';
                emailOptions.style.pointerEvents = 'none';
                checkboxes.forEach(cb => {
                    cb.disabled = true;
                    cb.checked = false;
                });
            }
        });
    }
});
