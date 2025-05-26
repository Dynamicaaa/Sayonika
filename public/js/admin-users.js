// Admin User Management JavaScript

class UserManager {
    constructor() {
        this.currentUsers = [];
        this.currentFilters = {};
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadUsers();
    }

    bindEvents() {
        // Search button
        const searchBtn = document.querySelector('.search-users-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.handleSearch());
        }

        // Enter key in search input
        const searchInput = document.getElementById('userSearch');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSearch();
                }
            });
        }

        // Role filter change
        const roleFilter = document.getElementById('roleFilter');
        if (roleFilter) {
            roleFilter.addEventListener('change', () => this.handleSearch());
        }

        // Event delegation for dynamically created buttons
        document.addEventListener('click', (e) => {
            // Retry button in error state
            if (e.target.closest('.error-state .btn')) {
                this.loadUsers();
                return;
            }

            // Edit user button
            if (e.target.closest('.btn-edit-user')) {
                const userId = parseInt(e.target.closest('.btn-edit-user').dataset.userId);
                this.showEditModal(userId);
                return;
            }

            // Delete user button
            if (e.target.closest('.btn-delete-user')) {
                const userId = parseInt(e.target.closest('.btn-delete-user').dataset.userId);
                this.confirmDelete(userId);
                return;
            }

            // Modal close button
            if (e.target.closest('.modal-close')) {
                this.closeModal();
                return;
            }

            // Modal cancel button
            if (e.target.closest('.btn-modal-cancel')) {
                this.closeModal();
                return;
            }

            // Modal save button
            if (e.target.closest('.btn-modal-save')) {
                const userId = parseInt(e.target.closest('.btn-modal-save').dataset.userId);
                this.saveUserRole(userId);
                return;
            }
        });
    }

    handleSearch() {
        const search = document.getElementById('userSearch')?.value.trim();
        const role = document.getElementById('roleFilter')?.value;

        this.currentFilters = {};
        if (search) this.currentFilters.search = search;
        if (role) this.currentFilters.role = role;

        this.loadUsers();
    }

    async loadUsers() {
        try {
            this.showLoading();

            const params = new URLSearchParams(this.currentFilters);
            const response = await fetch(`/api/admin/users?${params}`, {
                credentials: 'include' // Include cookies in the request
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const users = await response.json();
            this.currentUsers = users;
            this.renderUsersTable(users);
        } catch (error) {
            console.error('Error loading users:', error);
            this.showError('Failed to load users: ' + error.message);
        }
    }

    showLoading() {
        const container = document.getElementById('usersTableContainer');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading users...</p>
                </div>
            `;
        }
    }

    showError(message) {
        const container = document.getElementById('usersTableContainer');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${message}</p>
                    <button class="btn btn-primary">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    }

    renderUsersTable(users) {
        const container = document.getElementById('usersTableContainer');
        if (!container) return;

        if (users.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No users found</h3>
                    <p>No users match your search criteria.</p>
                </div>
            `;
            return;
        }

        const currentUser = this.getCurrentUser();

        container.innerHTML = `
            <div class="users-table-wrapper">
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Role</th>
                            <th>Stats</th>
                            <th>Joined</th>
                            <th>Last Login</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => this.renderUserRow(user, currentUser)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderUserRow(user, currentUser) {
        const isCurrentUser = currentUser && user.id === currentUser.id;
        const canModify = currentUser && (currentUser.is_owner || (!user.is_admin && currentUser.is_admin));
        const canDelete = currentUser && currentUser.is_owner && !user.is_owner && !isCurrentUser;

        const roleClass = user.is_owner ? 'owner' : user.is_admin ? 'admin' : user.is_verified ? 'verified' : 'regular';
        const roleText = user.is_owner ? 'Owner' : user.is_admin ? 'Admin' : user.is_verified ? 'Verified' : 'Regular';

        return `
            <tr class="user-row" data-user-id="${user.id}">
                <td>
                    <div class="user-info">
                        <img src="${user.avatar_url || 'https://picsum.photos/1024/1024'}" alt="${user.username}" class="user-avatar">
                        <div class="user-details">
                            <div class="user-name">${user.display_name || user.username}</div>
                            <div class="user-username">@${user.username}</div>
                            ${user.email ? `<div class="user-email">${user.email}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <span class="role-badge ${roleClass}">${roleText}</span>
                    ${user.github_username ? `<span class="oauth-badge github" title="GitHub: ${user.github_username}"><i class="fab fa-github"></i></span>` : ''}
                    ${user.discord_username ? `<span class="oauth-badge discord" title="Discord: ${user.discord_username}"><i class="fab fa-discord"></i></span>` : ''}
                </td>
                <td>
                    <div class="user-stats">
                        <div class="stat-item">
                            <span class="stat-number">${user.stats.totalMods}</span>
                            <span class="stat-label">Mods</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${user.stats.publishedMods}</span>
                            <span class="stat-label">Published</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${user.stats.totalDownloads}</span>
                            <span class="stat-label">Downloads</span>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="date-info">
                        ${this.formatDate(user.created_at)}
                    </div>
                </td>
                <td>
                    <div class="date-info">
                        ${user.last_login ? this.formatDate(user.last_login) : 'Never'}
                    </div>
                </td>
                <td>
                    <div class="user-actions">
                        ${canModify && !user.is_owner ? `
                            <button class="btn btn-sm btn-secondary btn-edit-user" data-user-id="${user.id}" title="Edit Role">
                                <i class="fas fa-edit"></i>
                            </button>
                        ` : ''}
                        ${canDelete ? `
                            <button class="btn btn-sm btn-danger btn-delete-user" data-user-id="${user.id}" title="Delete User">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                        ${isCurrentUser ? '<span class="text-muted">(You)</span>' : ''}
                    </div>
                </td>
            </tr>
        `;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    getCurrentUser() {
        // Get current user from meta tag for CSP compliance
        const metaTag = document.querySelector('meta[name="current-user"]');
        if (metaTag) {
            try {
                const userData = decodeURIComponent(metaTag.getAttribute('content'));
                return JSON.parse(userData);
            } catch (error) {
                console.error('Error parsing user data from meta tag:', error);
            }
        }
        // Fallback to global variable if meta tag not found
        return window.currentUser || null;
    }

    showEditModal(userId) {
        const user = this.currentUsers.find(u => u.id === userId);
        if (!user) return;

        // Create modal HTML
        const modalHtml = `
            <div class="modal-overlay" id="editUserModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Edit User Role</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="user-info-header">
                            <img src="${user.avatar_url || 'https://picsum.photos/1024/1024'}" alt="${user.username}" class="user-avatar">
                            <div>
                                <h4>${user.display_name || user.username}</h4>
                                <p>@${user.username}</p>
                            </div>
                        </div>
                        <form id="editUserForm">
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="isAdmin" ${user.is_admin ? 'checked' : ''}>
                                    Administrator
                                </label>
                                <small>Administrators can manage mods and access the admin panel</small>
                            </div>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="isVerified" ${user.is_verified ? 'checked' : ''}>
                                    Verified User
                                </label>
                                <small>Verified users have additional privileges</small>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary btn-modal-cancel">Cancel</button>
                        <button class="btn btn-primary btn-modal-save" data-user-id="${userId}">Save Changes</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    async saveUserRole(userId) {
        try {
            const isAdmin = document.getElementById('isAdmin').checked;
            const isVerified = document.getElementById('isVerified').checked;

            const response = await fetch(`/api/admin/users/${userId}/role`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Include cookies in the request
                body: JSON.stringify({
                    is_admin: isAdmin,
                    is_verified: isVerified
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update user role');
            }

            this.closeModal();
            this.loadUsers(); // Reload users
            this.showNotification('User role updated successfully', 'success');
        } catch (error) {
            console.error('Error updating user role:', error);
            this.showNotification('Failed to update user role: ' + error.message, 'error');
        }
    }

    confirmDelete(userId) {
        const user = this.currentUsers.find(u => u.id === userId);
        if (!user) return;

        if (confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) {
            this.deleteUser(userId);
        }
    }

    async deleteUser(userId) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include' // Include cookies in the request
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete user');
            }

            this.loadUsers(); // Reload users
            this.showNotification('User deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showNotification('Failed to delete user: ' + error.message, 'error');
        }
    }

    closeModal() {
        const modal = document.getElementById('editUserModal');
        if (modal) {
            modal.remove();
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
}

// Initialize user manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.userManager = new UserManager();
});
