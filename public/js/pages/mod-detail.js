// Escape HTML special characters to prevent XSS and rendering issues
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Mod detail page functionality

// Format a date as time-ago (e.g., "5 minutes ago")
function formatTimeAgo(date) {
    if (!(date instanceof Date)) date = new Date(date);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (isNaN(seconds)) return '';
    if (seconds < 60) return 'just now';
    const intervals = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'week', seconds: 604800 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 }
    ];
    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) {
            return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
        }
    }
    return 'just now';
}

// Remove spinner CSS from the document head if present (cleanup)
(function removeSpinnerCSS() {
    const style = document.getElementById('mod-detail-spinner-style');
    if (style) {
        style.remove();
    }
})();

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
                submitBtn.addEventListener('click', function() {
                    const textarea = document.querySelector('.modal-overlay textarea');
                    const reason = textarea ? textarea.value : '';
                    submitReport(reason);
                });
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
    // Get modId from a global variable or data attribute
    let modId = window.modId;
    if (!modId) {
        // Try to get from DOM (e.g., data-mod-id on body or main container)
        const modContainer = document.querySelector('.mod-detail_page, [data-mod-id]');
        if (modContainer && modContainer.dataset.modId) {
            modId = modContainer.dataset.modId;
        }
    }
    if (!modId) {
        alert('Could not determine mod ID for report.');
        return;
    }
    // Validate reason
    if (!reason || reason.length < 5) {
        if (window.S && window.S.notify) {
            window.S.notify.error('Please provide a reason (at least 5 characters).');
        } else {
            alert('Please provide a reason (at least 5 characters).');
        }
        return;
    }
    fetch('/api/report/mod', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            modId: parseInt(modId),
            reason: reason,
            details: '' // Optionally add more details
        })
    })
    .then(async res => {
        // Always close the modal on submit (success or error)
        setTimeout(() => {
            document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
        }, 10);
        if (res.ok) {
            if (window.S && window.S.notify) {
                window.S.notify.success('Report submitted successfully!');
            } else {
                alert('Report submitted successfully!');
            }
        } else {
            const data = await res.json().catch(() => ({}));
            const msg = data && data.error ? data.error : 'Failed to submit report.';
            if (window.S && window.S.notify) {
                window.S.notify.error(msg);
            } else {
                alert(msg);
            }
        }
    })
    .catch(() => {
        setTimeout(() => {
            document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
        }, 10);
        if (window.S && window.S.notify) {
            window.S.notify.error('Failed to submit report.');
        } else {
            alert('Failed to submit report.');
        }
    });
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
    attachCommentEventListeners();
}

// Attach comment action event listeners (edit, reply, delete)
function attachCommentEventListeners() {
    // Edit functionality for comments
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const commentDiv = btn.closest('.comment');
            const commentId = btn.getAttribute('data-comment-id');
            const contentP = commentDiv.querySelector('.comment-content p');
            const originalContent = contentP.textContent;

            // Replace content with textarea and buttons using DOM methods
            const commentContentDiv = commentDiv.querySelector('.comment-content');
            commentContentDiv.innerHTML = '';
            
            const form = document.createElement('form');
            form.className = 'edit-form';
            form.style.margin = '0';
            
            const textarea = document.createElement('textarea');
            textarea.className = 'edit-textarea';
            textarea.required = true;
            textarea.style.marginBottom = '0.5rem';
            textarea.value = originalContent;
            
            const actions = document.createElement('div');
            actions.className = 'edit-actions';
            actions.style.marginBottom = '0';
            
            const saveBtn = document.createElement('button');
            saveBtn.type = 'submit';
            saveBtn.className = 'save-edit-btn';
            saveBtn.tabIndex = 0;
            saveBtn.textContent = 'Save';
            
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'cancel-edit-btn';
            cancelBtn.tabIndex = 0;
            cancelBtn.textContent = 'Cancel';
            
            actions.appendChild(saveBtn);
            actions.appendChild(cancelBtn);
            form.appendChild(textarea);
            form.appendChild(actions);
            commentContentDiv.appendChild(form);

            // Disable edit button while editing
            btn.disabled = true;

            // Cancel handler
            cancelBtn.addEventListener('click', () => {
                commentContentDiv.innerHTML = `<p>${escapeHtml(originalContent)}</p>`;
                btn.disabled = false;
            });

            // Save handler (form submit)
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const newContent = textarea.value.trim();
                if (!newContent) {
                    if (window.S && window.S.notify) {
                        window.S.notify.error('Comment cannot be empty');
                    }
                    return;
                }
                try {
                    const response = await fetch('/api/comments/' + commentId, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: newContent })
                    });
                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || 'Failed to edit comment');
                    }
                    if (window.S && window.S.notify) {
                        window.S.notify.success('Comment edited successfully!');
                    }
                    loadComments();
                } catch (error) {
                    if (window.S && window.S.notify) {
                        window.S.notify.error('Failed to edit comment');
                    }
                }
            });
        });
    });

    // Reply functionality for comments
    document.querySelectorAll('.reply-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const commentDiv = btn.closest('.comment');
            // Prevent multiple reply boxes
            if (commentDiv.querySelector('.comment-content.replying')) return;

            const replyContentDiv = document.createElement('div');
            replyContentDiv.className = 'comment-content replying';

            // Unified reply form (same as edit form)
            const form = document.createElement('form');
            form.className = 'edit-form'; // Use same class as edit form
            form.style.margin = '0';

            const textarea = document.createElement('textarea');
            textarea.className = 'edit-textarea';
            textarea.required = true;
            textarea.style.marginBottom = '0.5rem';
            textarea.placeholder = 'Write your reply...';

            const actions = document.createElement('div');
            actions.className = 'edit-actions';
            actions.style.marginBottom = '0';

            const saveBtn = document.createElement('button');
            saveBtn.type = 'submit';
            saveBtn.className = 'save-edit-btn'; // Use save-edit-btn for reply as well
            saveBtn.tabIndex = 0;
            saveBtn.textContent = 'Post';

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'cancel-edit-btn'; // Use cancel-edit-btn for reply as well
            cancelBtn.tabIndex = 0;
            cancelBtn.textContent = 'Cancel';

            actions.appendChild(saveBtn);
            actions.appendChild(cancelBtn);
            form.appendChild(textarea);
            form.appendChild(actions);
            replyContentDiv.appendChild(form);
            commentDiv.appendChild(replyContentDiv);

            // Cancel handler
            cancelBtn.addEventListener('click', () => {
                replyContentDiv.remove();
            });

            // Post handler (form submit)
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const replyContent = textarea.value.trim();
                if (!replyContent) {
                    if (window.S && window.S.notify) {
                        window.S.notify.error('Reply cannot be empty');
                    }
                    return;
                }
                await submitComment(btn.getAttribute('data-comment-id'), replyContent, form.querySelector('button[type="submit"]'));
            });
        });
    });

    // Delete functionality for comments and replies
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const commentId = btn.getAttribute('data-comment-id');
            if (!commentId) return;
            if (!confirm('Are you sure you want to delete this comment?')) return;
            fetch(`/api/comments/${commentId}`, {
                method: 'DELETE'
            })
            .then(response => {
                if (!response.ok) throw new Error('Failed to delete comment');
                if (window.S && window.S.notify) {
                    window.S.notify.success('Comment deleted successfully!');
                }
                loadComments();
            })
            .catch(error => {
                if (window.S && window.S.notify) {
                    window.S.notify.error('Failed to delete comment');
                } else {
                    alert('Failed to delete comment');
                }
            });
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

async function submitComment(parentId = null, overrideContent = null, submitBtn = null) {
    let content;
    let originalBtnText;
    if (overrideContent !== null) {
        content = overrideContent.trim();
    } else {
        const commentContent = document.getElementById('commentContent');
        content = commentContent.value.trim();
        if (!submitBtn) {
            const commentForm = document.getElementById('commentForm');
            if (commentForm) {
                submitBtn = commentForm.querySelector('button[type="submit"]');
            }
        }
    }

    if (!content) {
        if (window.S && window.S.notify) {
            window.S.notify.error('Please enter a comment');
        } else {
            alert('Please enter a comment');
        }
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'Posting...';
    }

    try {
        const modSlug = window.location.pathname.split('/').pop();
        const bodyObj = parentId !== null && !isNaN(Number(parentId))
            ? { content: content, parent_id: Number(parentId) }
            : { content: content };
        const response = await fetch(`/api/mods/${modSlug}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bodyObj)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to post comment');
        }

        // Clear form and reload comments if not a reply
        if (parentId === null) {
            const commentContent = document.getElementById('commentContent');
            if (commentContent) {
                commentContent.value = '';
            }
            const charCount = document.querySelector('.char-count');
            if (charCount) {
                charCount.textContent = '0/2000';
            }
            if (window.S && window.S.notify) {
                window.S.notify.success('Comment posted successfully!');
            }
        } else {
            if (window.S && window.S.notify) {
                window.S.notify.success('Reply posted successfully!');
            }
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
        loadComments();
    } catch (error) {
        if (window.S && window.S.notify) {
            window.S.notify.error(error.message);
        } else {
            alert(error.message);
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    }
}
