// Notifications page functionality

document.addEventListener('DOMContentLoaded', function() {
    // Mark all as read button
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllAsRead);
    }

    // Refresh notifications button
    const refreshBtn = document.getElementById('refreshNotificationsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshNotifications);
    }

    // Individual mark as read buttons
    const markReadBtns = document.querySelectorAll('.mark-read-btn');
    markReadBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const notificationId = this.dataset.id;
            markAsRead(notificationId);
        });
    });

    // Delete notification buttons
    const deleteBtns = document.querySelectorAll('.delete-notification-btn');
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const notificationId = this.dataset.id;
            deleteNotification(notificationId);
        });
    });

    // Notification item click handlers
    const notificationItems = document.querySelectorAll('.notification-item');
    notificationItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Don't trigger if clicking on buttons
            if (e.target.closest('button') || e.target.closest('a')) {
                return;
            }

            const notificationId = this.dataset.id;
            const type = this.dataset.type;
            const relatedId = this.dataset.relatedId;

            handleNotificationClick(notificationId, type, relatedId);
        });
    });
});

async function markAllAsRead() {
    const btn = document.getElementById('markAllReadBtn');
    const originalContent = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Marking as read...';

        const response = await fetch('/api/notifications/mark-all-read', {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            // Show success message
            if (window.S && window.S.notify) {
                window.S.notify.success('All notifications marked as read');
            } else {
                alert('All notifications marked as read');
            }

            // Refresh the page to show updated state
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            throw new Error('Failed to mark notifications as read');
        }
    } catch (error) {
        console.error('Error marking all as read:', error);
        if (window.S && window.S.notify) {
            window.S.notify.error('Failed to mark notifications as read');
        } else {
            alert('Failed to mark notifications as read');
        }
        
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

async function markAsRead(notificationId) {
    const btn = document.querySelector(`[data-id="${notificationId}"].mark-read-btn`);
    const notificationItem = document.querySelector(`[data-id="${notificationId}"].notification-item`);
    
    if (!btn || !notificationItem) return;

    const originalContent = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const response = await fetch(`/api/notifications/${notificationId}/read`, {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            // Update UI
            notificationItem.classList.remove('unread');
            btn.remove(); // Remove the mark as read button
            
            // Remove unread indicator
            const unreadIndicator = notificationItem.querySelector('.unread-indicator');
            if (unreadIndicator) {
                unreadIndicator.remove();
            }

            // Update global notification manager if available
            if (window.notificationManager) {
                window.notificationManager.loadUnreadCount();
            }

            if (window.S && window.S.notify) {
                window.S.notify.success('Notification marked as read');
            }
        } else {
            throw new Error('Failed to mark notification as read');
        }
    } catch (error) {
        console.error('Error marking as read:', error);
        if (window.S && window.S.notify) {
            window.S.notify.error('Failed to mark notification as read');
        } else {
            alert('Failed to mark notification as read');
        }
        
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

async function deleteNotification(notificationId) {
    const confirmed = window.S && window.S.modal
        ? await window.S.modal.confirm('Are you sure you want to delete this notification?', 'Delete Notification')
        : confirm('Are you sure you want to delete this notification?');

    if (!confirmed) return;

    const btn = document.querySelector(`[data-id="${notificationId}"].delete-notification-btn`);
    const notificationItem = document.querySelector(`[data-id="${notificationId}"].notification-item`);
    
    if (!btn || !notificationItem) return;

    const originalContent = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const response = await fetch(`/api/notifications/${notificationId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (response.ok) {
            // Animate removal
            notificationItem.style.transition = 'all 0.3s ease';
            notificationItem.style.opacity = '0';
            notificationItem.style.transform = 'translateX(-100%)';
            
            setTimeout(() => {
                notificationItem.remove();
                
                // Check if no notifications left
                const remainingNotifications = document.querySelectorAll('.notification-item');
                if (remainingNotifications.length === 0) {
                    window.location.reload(); // Reload to show empty state
                }
            }, 300);

            // Update global notification manager if available
            if (window.notificationManager) {
                window.notificationManager.loadUnreadCount();
            }

            if (window.S && window.S.notify) {
                window.S.notify.success('Notification deleted');
            }
        } else {
            throw new Error('Failed to delete notification');
        }
    } catch (error) {
        console.error('Error deleting notification:', error);
        if (window.S && window.S.notify) {
            window.S.notify.error('Failed to delete notification');
        } else {
            alert('Failed to delete notification');
        }
        
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

function handleNotificationClick(notificationId, type, relatedId) {
    // Mark as read first
    markAsRead(notificationId);
    
    // Navigate based on type
    setTimeout(() => {
        switch (type) {
            case 'achievement':
                window.location.href = '/achievements';
                break;
            case 'mod_approved':
            case 'mod_rejected':
                if (relatedId && relatedId !== 'null') {
                    window.location.href = `/mod/${relatedId}`;
                } else {
                    window.location.href = '/profile';
                }
                break;
            default:
                // For general notifications, stay on page
                break;
        }
    }, 100);
}

function refreshNotifications() {
    const btn = document.getElementById('refreshNotificationsBtn');
    const originalContent = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
    
    // Simple page reload for now
    setTimeout(() => {
        window.location.reload();
    }, 500);
}

// Auto-refresh every 30 seconds
setInterval(() => {
    // Only refresh if user is still on the page and page is visible
    if (!document.hidden) {
        // Update global notification manager if available
        if (window.notificationManager) {
            window.notificationManager.loadUnreadCount();
        }
    }
}, 30000);
