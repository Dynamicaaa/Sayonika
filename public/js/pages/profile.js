// Profile page functionality

document.addEventListener('DOMContentLoaded', function() {
    // Edit profile button
    const editProfileBtns = document.querySelectorAll('.edit-profile-btn');
    editProfileBtns.forEach(btn => {
        btn.addEventListener('click', editProfile);
    });

    // Modal close buttons
    const editProfileModal = document.getElementById('editProfileModal');
    const modalCloseBtn = editProfileModal ? editProfileModal.querySelector('.modal-close') : null;
    const cancelBtn = editProfileModal ? editProfileModal.querySelector('.btn-outline') : null;
    const saveBtn = editProfileModal ? editProfileModal.querySelector('.btn-primary') : null;

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeEditProfile);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeEditProfile);
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', saveProfile);
    }

    // Avatar upload preview
    const avatarFileInput = document.getElementById('avatarFile');
    if (avatarFileInput) {
        avatarFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const currentAvatar = document.querySelector('.current-avatar');
                    if (currentAvatar) {
                        currentAvatar.src = e.target.result;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Close modal on outside click
    if (editProfileModal) {
        editProfileModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeEditProfile();
            }
        });
    }
});

function editProfile() {
    const modal = document.getElementById('editProfileModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeEditProfile() {
    const modal = document.getElementById('editProfileModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function saveProfile() {
    const form = document.getElementById('editProfileForm');
    if (!form) return;

    const formData = window.S ? window.S.form.serialize(form) : new FormData(form);

    try {
        let response;
        if (window.S && window.S.api) {
            response = await window.S.api.put('/auth/profile', formData);
        } else {
            // Fallback API call
            const fetchResponse = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(Object.fromEntries(formData))
            });

            if (!fetchResponse.ok) {
                throw new Error('Failed to update profile');
            }

            response = await fetchResponse.json();
        }

        if (window.S && window.S.notify) {
            window.S.notify.success('Profile updated successfully!');
        } else {
            alert('Profile updated successfully!');
        }

        // Refresh page to show changes
        setTimeout(() => {
            window.location.reload();
        }, 1000);

    } catch (error) {
        if (window.S && window.S.notify) {
            window.S.notify.error(error.message || 'Failed to update profile');
        } else {
            alert(error.message || 'Failed to update profile');
        }
    }
}
