// Notifications functionality
class NotificationManager {
    constructor() {
        this.isOpen = false;
        this.notifications = [];
        this.unreadCount = 0;
        this.refreshInterval = null;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadNotifications();
        this.startAutoRefresh();
    }

    bindEvents() {
        const toggle = document.getElementById('notificationsToggle');
        const dropdown = document.getElementById('notificationsDropdown');
        const markAllReadBtn = document.getElementById('markAllReadBtn');

        if (toggle) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
        }

        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', () => {
                this.markAllAsRead();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown?.contains(e.target) && !toggle?.contains(e.target)) {
                this.closeDropdown();
            }
        });

        // Prevent dropdown from closing when clicking inside
        if (dropdown) {
            dropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    async loadNotifications() {
        try {
            const response = await fetch('/api/notifications', {
                credentials: 'include'
            });

            if (response.ok) {
                this.notifications = await response.json();
                this.updateUnreadCount();
                this.renderNotifications();
            } else {
                console.error('Failed to load notifications');
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    async loadUnreadCount() {
        try {
            const response = await fetch('/api/notifications/unread-count', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.unreadCount = data.count;
                this.updateBadge();
            }
        } catch (error) {
            console.error('Error loading unread count:', error);
        }
    }

    updateUnreadCount() {
        this.unreadCount = this.notifications.filter(n => !n.is_read).length;
        this.updateBadge();
    }

    updateBadge() {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.style.display = 'block';
                badge.classList.add('pulse');
            } else {
                badge.style.display = 'none';
                badge.classList.remove('pulse');
            }
        }
    }

    renderNotifications() {
        const container = document.getElementById('notificationsList');
        if (!container) return;

        if (this.notifications.length === 0) {
            container.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <h5>No notifications</h5>
                    <p>You're all caught up!</p>
                </div>
            `;
            return;
        }

        const html = this.notifications.slice(0, 10).map(notification => {
            const timeAgo = this.getTimeAgo(notification.created_at);
            const iconClass = this.getNotificationIcon(notification.type);
            
            return `
                <div class="notification-item ${!notification.is_read ? 'unread' : ''}" 
                     data-id="${notification.id}" 
                     onclick="notificationManager.handleNotificationClick(${notification.id}, '${notification.type}', ${notification.related_id})">
                    <div class="notification-icon ${notification.type}">
                        <i class="${iconClass}"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-title">${this.escapeHtml(notification.title)}</div>
                        <div class="notification-message">${this.escapeHtml(notification.message)}</div>
                        <div class="notification-time">${timeAgo}</div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    getNotificationIcon(type) {
        const icons = {
            'achievement': 'fas fa-trophy',
            'mod_approved': 'fas fa-check-circle',
            'mod_rejected': 'fas fa-times-circle',
            'general': 'fas fa-info-circle'
        };
        return icons[type] || 'fas fa-bell';
    }

    getTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
        
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    toggleDropdown() {
        if (this.isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    openDropdown() {
        const toggle = document.getElementById('notificationsToggle');
        const dropdown = document.getElementById('notificationsDropdown');
        
        if (toggle && dropdown) {
            toggle.classList.add('active');
            dropdown.classList.add('show');
            this.isOpen = true;
            
            // Load fresh notifications when opening
            this.loadNotifications();
        }
    }

    closeDropdown() {
        const toggle = document.getElementById('notificationsToggle');
        const dropdown = document.getElementById('notificationsDropdown');
        
        if (toggle && dropdown) {
            toggle.classList.remove('active');
            dropdown.classList.remove('show');
            this.isOpen = false;
        }
    }

    async handleNotificationClick(notificationId, type, relatedId) {
        // Mark as read
        await this.markAsRead(notificationId);
        
        // Navigate based on notification type
        switch (type) {
            case 'achievement':
                window.location.href = '/achievements';
                break;
            case 'mod_approved':
            case 'mod_rejected':
                if (relatedId) {
                    window.location.href = `/mod/${relatedId}`;
                } else {
                    window.location.href = '/profile';
                }
                break;
            default:
                // For general notifications, just close the dropdown
                this.closeDropdown();
                break;
        }
    }

    async markAsRead(notificationId) {
        try {
            const response = await fetch(`/api/notifications/${notificationId}/read`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                // Update local state
                const notification = this.notifications.find(n => n.id === notificationId);
                if (notification) {
                    notification.is_read = true;
                    this.updateUnreadCount();
                    this.renderNotifications();
                }
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    async markAllAsRead() {
        try {
            const response = await fetch('/api/notifications/mark-all-read', {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                // Update local state
                this.notifications.forEach(n => n.is_read = true);
                this.updateUnreadCount();
                this.renderNotifications();
                
                // Show success message
                if (window.S && window.S.notify) {
                    window.S.notify.success('All notifications marked as read');
                }
            }
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    startAutoRefresh() {
        // Refresh unread count every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.loadUnreadCount();
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // Public method to add a new notification (for real-time updates)
    addNotification(notification) {
        this.notifications.unshift(notification);
        this.updateUnreadCount();
        this.renderNotifications();
        
        // Show a brief toast notification
        this.showToast(notification);
    }

    showToast(notification) {
        // Simple toast notification for new notifications
        if (window.S && window.S.notify) {
            window.S.notify.info(notification.title);
        }
    }
}

// Initialize notification manager when DOM is loaded
let notificationManager;

document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if user is logged in (notifications toggle exists)
    if (document.getElementById('notificationsToggle')) {
        notificationManager = new NotificationManager();
        
        // Make it globally available
        window.notificationManager = notificationManager;
    }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (notificationManager) {
        notificationManager.stopAutoRefresh();
    }
});
