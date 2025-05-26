// Mod detail page functionality

// Initialize mod detail event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Screenshot gallery
    document.querySelectorAll('.screenshot').forEach(img => {
        img.addEventListener('click', function() {
            openScreenshot(this.dataset.screenshot);
        });
    });

    // Screenshot modal close buttons
    const screenshotModal = document.getElementById('screenshotModal');
    const screenshotModalClose = document.querySelector('.screenshot-modal-close');

    if (screenshotModalClose) {
        screenshotModalClose.addEventListener('click', closeScreenshot);
    }

    if (screenshotModal) {
        screenshotModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeScreenshot();
            }
        });
    }

    // Report mod button
    const reportModBtn = document.querySelector('.report-mod-btn');
    if (reportModBtn) {
        reportModBtn.addEventListener('click', reportMod);
    }

    // Download tracking
    const downloadLink = document.querySelector('a[href*="/download"]');
    if (downloadLink) {
        downloadLink.addEventListener('click', function() {
            // Track download analytics
            console.log('Download started for mod:', this.href);
        });
    }

    // Comments functionality
    initializeComments();
});

// Screenshot modal
function openScreenshot(src) {
    const screenshotImage = document.getElementById('screenshotImage');
    const screenshotModal = document.getElementById('screenshotModal');

    if (screenshotImage && screenshotModal) {
        screenshotImage.src = src;
        screenshotModal.style.display = 'flex';
    }
}

function closeScreenshot() {
    const screenshotModal = document.getElementById('screenshotModal');
    if (screenshotModal) {
        screenshotModal.style.display = 'none';
    }
}

// Favorite toggle
function toggleFavorite() {
    // Implementation for favorite toggle
    if (window.S && window.S.notify) {
        window.S.notify.info('Favorite functionality coming soon!');
    } else {
        alert('Favorite functionality coming soon!');
    }
}

// Report mod
function reportMod() {
    if (window.S && window.S.modal) {
        window.S.modal.show(
            '<p>Please describe the issue with this mod:</p>' +
            '<textarea class="form-control" rows="4" placeholder="Describe the issue..."></textarea>',
            {
                title: 'Report Mod',
                footer: '<button class="btn btn-outline modal-cancel-btn">Cancel</button>' +
                       '<button class="btn btn-danger modal-submit-btn">Submit Report</button>'
            }
        );

        // Add event listeners to modal buttons
        setTimeout(() => {
            const cancelBtn = document.querySelector('.modal-cancel-btn');
            const submitBtn = document.querySelector('.modal-submit-btn');

            if (cancelBtn) {
                cancelBtn.addEventListener('click', function() {
                    this.closest('.modal-overlay').remove();
                });
            }

            if (submitBtn) {
                submitBtn.addEventListener('click', submitReport);
            }
        }, 100);
    } else {
        // Fallback for when S.modal is not available
        const reason = prompt('Please describe the issue with this mod:');
        if (reason) {
            submitReport(reason);
        }
    }
}

function submitReport(reason) {
    if (window.S && window.S.notify) {
        window.S.notify.success('Report submitted successfully!');
    } else {
        alert('Report submitted successfully!');
    }

    const modalOverlay = document.querySelector('.modal-overlay');
    if (modalOverlay) {
        modalOverlay.remove();
    }
}

// Comments functionality
function initializeComments() {
    const commentForm = document.getElementById('commentForm');
    const commentContent = document.getElementById('commentContent');
    const charCount = document.querySelector('.char-count');

    // Load comments
    loadComments();

    // Character counter
    if (commentContent && charCount) {
        commentContent.addEventListener('input', function() {
            const count = this.value.length;
            charCount.textContent = `${count}/2000`;

            if (count > 1800) {
                charCount.style.color = 'var(--danger-color)';
            } else if (count > 1500) {
                charCount.style.color = 'var(--warning-color)';
            } else {
                charCount.style.color = 'var(--text-muted)';
            }
        });
    }

    // Comment form submission
    if (commentForm) {
        commentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            submitComment();
        });
    }
}

async function loadComments() {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;

    try {
        const modSlug = window.location.pathname.split('/').pop();
        const response = await fetch(`/api/mods/${modSlug}/comments`);

        if (!response.ok) {
            throw new Error('Failed to load comments');
        }

        const comments = await response.json();
        displayComments(comments);
    } catch (error) {
        console.error('Error loading comments:', error);
        commentsList.innerHTML = '<div class="error-message">Failed to load comments. Please try again later.</div>';
    }
}

function displayComments(comments) {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;

    if (comments.length === 0) {
        commentsList.innerHTML = '<div class="no-comments">No comments yet. Be the first to share your thoughts!</div>';
        return;
    }

    const commentsHtml = comments.map(comment => renderComment(comment)).join('');
    commentsList.innerHTML = commentsHtml;

    // Add event listeners to reply buttons
    document.querySelectorAll('.reply-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const commentId = this.dataset.commentId;
            showReplyForm(commentId);
        });
    });

    // Add event listeners to edit buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const commentId = this.dataset.commentId;
            showEditForm(commentId);
        });
    });

    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const commentId = this.dataset.commentId;
            deleteComment(commentId);
        });
    });
}

function renderComment(comment, isReply = false) {
    const timeAgo = formatTimeAgo(new Date(comment.created_at));
    const isEdited = comment.updated_at !== comment.created_at;
    const currentUser = window.currentUser; // Assuming this is set globally
    const canEdit = currentUser && (currentUser.id === comment.user_id || currentUser.is_admin);

    const repliesHtml = comment.replies ? comment.replies.map(reply => renderComment(reply, true)).join('') : '';

    return `
        <div class="comment ${isReply ? 'comment-reply' : ''}" data-comment-id="${comment.id}">
            <div class="comment-header">
                <div class="comment-author">
                    <img src="${comment.avatar_url || 'https://picsum.photos/1024/1024'}" alt="${comment.display_name || comment.username}" class="comment-avatar">
                    <div class="comment-author-info">
                        <span class="comment-author-name">${comment.display_name || comment.username}</span>
                        <span class="comment-author-title">${comment.user_title || 'Member'}</span>
                        <span class="comment-level">Level ${comment.user_level || 1}</span>
                    </div>
                </div>
                <div class="comment-meta">
                    <span class="comment-time" title="${new Date(comment.created_at).toLocaleString()}">${timeAgo}</span>
                    ${isEdited ? '<span class="comment-edited">(edited)</span>' : ''}
                </div>
            </div>
            <div class="comment-content">
                <p>${escapeHtml(comment.content)}</p>
            </div>
            <div class="comment-actions">
                ${!isReply && currentUser ? `<button class="reply-btn" data-comment-id="${comment.id}"><i class="fas fa-reply"></i> Reply</button>` : ''}
                ${canEdit ? `<button class="edit-btn" data-comment-id="${comment.id}"><i class="fas fa-edit"></i> Edit</button>` : ''}
                ${canEdit ? `<button class="delete-btn" data-comment-id="${comment.id}"><i class="fas fa-trash"></i> Delete</button>` : ''}
            </div>
            ${repliesHtml ? `<div class="comment-replies">${repliesHtml}</div>` : ''}
        </div>
    `;
}

async function submitComment(parentId = null) {
    const commentContent = document.getElementById('commentContent');
    const content = commentContent.value.trim();

    if (!content) {
        if (window.S && window.S.notify) {
            window.S.notify.error('Please enter a comment');
        } else {
            alert('Please enter a comment');
        }
        return;
    }

    try {
        const modSlug = window.location.pathname.split('/').pop();
        const response = await fetch(`/api/mods/${modSlug}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: content,
                parent_id: parentId
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to post comment');
        }

        // Clear form and reload comments
        commentContent.value = '';
        document.querySelector('.char-count').textContent = '0/2000';

        if (window.S && window.S.notify) {
            window.S.notify.success('Comment posted successfully!');
        }

        loadComments();
    } catch (error) {
        console.error('Error posting comment:', error);
        if (window.S && window.S.notify) {
            window.S.notify.error(error.message);
        } else {
            alert('Error posting comment: ' + error.message);
        }
    }
}

function showReplyForm(parentId) {
    // Implementation for reply form
    if (window.S && window.S.notify) {
        window.S.notify.info('Reply functionality coming soon!');
    }
}

function showEditForm(commentId) {
    // Implementation for edit form
    if (window.S && window.S.notify) {
        window.S.notify.info('Edit functionality coming soon!');
    }
}

async function deleteComment(commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) {
        return;
    }

    try {
        const response = await fetch(`/api/comments/${commentId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete comment');
        }

        if (window.S && window.S.notify) {
            window.S.notify.success('Comment deleted successfully!');
        }

        loadComments();
    } catch (error) {
        console.error('Error deleting comment:', error);
        if (window.S && window.S.notify) {
            window.S.notify.error('Failed to delete comment');
        } else {
            alert('Failed to delete comment');
        }
    }
}

// Utility functions
function formatTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;

    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
