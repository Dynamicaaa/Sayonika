// Admin dashboard functionality

// Server-side logging utility
function serverLog(level, message, data = null) {
    const logData = {
        level: level, // 'info', 'warn', 'error', 'debug'
        message: message,
        data: data,
        timestamp: new Date().toISOString(),
        source: 'admin-dashboard'
    };

    // Send to server asynchronously, don't wait for response
    fetch('/api/admin/logs', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(logData)
    }).catch(err => {
        // Fallback to console if server logging fails
        console.error('[Admin Dashboard] Failed to send log to server:', err);
        console.log(`[Admin Dashboard] ${level.toUpperCase()}: ${message}`, data);
    });
}

// Tab switching
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', function(e) {
        e.preventDefault();

        // Remove active class from all tabs and content
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        // Add active class to clicked tab
        this.classList.add('active');

        // Show corresponding content
        const tabId = this.getAttribute('data-tab') + '-tab';
        document.getElementById(tabId).classList.add('active');
    });
});

// Initialize admin dashboard event listeners
document.addEventListener('DOMContentLoaded', function() {
    serverLog('info', 'Initializing event listeners...');

    // Debug: Check if pending mods tab is visible
    const pendingModsTab = document.getElementById('pending-mods-tab');
    const pendingModsTable = document.querySelector('.pending-mods-table');
    const emptyState = document.querySelector('#pending-mods-tab .empty-state');

    serverLog('debug', 'Pending mods tab visibility check', {
        tabExists: !!pendingModsTab,
        tabVisible: pendingModsTab ? !pendingModsTab.classList.contains('active') : false,
        tableExists: !!pendingModsTable,
        emptyStateExists: !!emptyState,
        tabClasses: pendingModsTab ? pendingModsTab.className : 'not found'
    });

    // Select all checkbox
    const selectAllCheckbox = document.getElementById('selectAll');
    if (selectAllCheckbox) {
        serverLog('debug', 'Found selectAll checkbox, adding event listener');
        selectAllCheckbox.addEventListener('change', toggleSelectAll);
    } else {
        serverLog('warn', 'selectAll checkbox not found');
    }

    // Individual mod checkboxes
    const modCheckboxes = document.querySelectorAll('.mod-checkbox');
    serverLog('debug', `Found ${modCheckboxes.length} mod checkboxes`);
    modCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateSelection);
    });

    // Bulk action buttons
    const clearSelectionBtn = document.querySelector('.clear-selection-btn');
    if (clearSelectionBtn) {
        serverLog('debug', 'Found clear selection button, adding event listener');
        clearSelectionBtn.addEventListener('click', clearSelection);
    }

    const bulkApproveBtn = document.querySelector('.bulk-approve-btn');
    if (bulkApproveBtn) {
        serverLog('debug', 'Found bulk approve button, adding event listener');
        bulkApproveBtn.addEventListener('click', bulkApprove);
    }

    const bulkRejectBtn = document.querySelector('.bulk-reject-btn');
    if (bulkRejectBtn) {
        serverLog('debug', 'Found bulk reject button, adding event listener');
        bulkRejectBtn.addEventListener('click', bulkReject);
    }

    // Individual mod action buttons
    const previewBtns = document.querySelectorAll('.preview-mod-btn');
    serverLog('debug', `Found ${previewBtns.length} preview buttons`);
    previewBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            serverLog('info', `Preview mod clicked for ID: ${this.dataset.modId}`);
            previewMod(this.dataset.modId);
        });
    });

    const approveBtns = document.querySelectorAll('.approve-mod-btn');
    serverLog('debug', `Found ${approveBtns.length} approve buttons`);
    approveBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            serverLog('info', `Approve mod clicked for ID: ${this.dataset.modId}`);
            approveMod(this.dataset.modId);
        });
    });

    const rejectBtns = document.querySelectorAll('.reject-mod-btn');
    serverLog('debug', `Found ${rejectBtns.length} reject buttons`);
    rejectBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            serverLog('info', `Reject mod clicked for ID: ${this.dataset.modId}`);
            rejectMod(this.dataset.modId);
        });
    });

    // Search users functionality is now handled by admin-users.js

    // Load site settings when page loads
    loadSiteSettings();

    // Settings form
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        serverLog('debug', 'Found settings form, adding event listener');
        settingsForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            serverLog('info', 'Settings form submitted');
            await saveSiteSettings();
        });
    }

    // Maintenance mode toggle handler
    const maintenanceModeCheckbox = document.getElementById('maintenanceMode');
    if (maintenanceModeCheckbox) {
        maintenanceModeCheckbox.addEventListener('change', function() {
            const isEnabled = this.checked;
            const label = document.querySelector('label[for="maintenanceMode"]');
            if (label) {
                if (isEnabled) {
                    label.innerHTML = '<strong>Maintenance mode is ENABLED</strong> - New uploads and registrations are blocked';
                    label.style.color = '#dc3545';
                } else {
                    label.innerHTML = 'Enable maintenance mode (prevents new uploads and registrations)';
                    label.style.color = '';
                }
            }
        });
    }

    // User management is now handled by admin-users.js

    // Refresh pending mods button
    const refreshPendingModsBtn = document.getElementById('refreshPendingModsBtn');
    if (refreshPendingModsBtn) {
        serverLog('debug', 'Found refresh pending mods button, adding event listener');
        refreshPendingModsBtn.addEventListener('click', refreshPendingMods);
    } else {
        serverLog('warn', 'Refresh pending mods button not found');
    }

    serverLog('info', 'Event listeners initialization complete');
});

// Mod selection
function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.mod-checkbox');

    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
    });

    updateSelection();
}

function updateSelection() {
    const checkboxes = document.querySelectorAll('.mod-checkbox');
    const selected = document.querySelectorAll('.mod-checkbox:checked');
    const bulkActions = document.getElementById('bulkActions');
    const selectedCount = bulkActions ? bulkActions.querySelector('.selected-count') : null;

    if (selectedCount) {
        selectedCount.textContent = `${selected.length} mod${selected.length !== 1 ? 's' : ''} selected`;
    }

    if (bulkActions) {
        if (selected.length > 0) {
            bulkActions.style.display = 'flex';
        } else {
            bulkActions.style.display = 'none';
        }
    }

    // Update select all checkbox
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
        selectAll.indeterminate = selected.length > 0 && selected.length < checkboxes.length;
        selectAll.checked = selected.length === checkboxes.length;
    }
}

function clearSelection() {
    document.querySelectorAll('.mod-checkbox').forEach(cb => {
        cb.checked = false;
    });
    updateSelection();
}

// Mod actions
async function approveMod(modId) {
    serverLog('info', `Starting approval process for mod ID: ${modId}`);

    // Show approval modal with optional reason
    const reason = prompt('Optional approval note:');
    serverLog('debug', `Approval reason provided: ${reason ? 'Yes' : 'No'}`);

    const confirmed = window.S && window.S.modal
        ? await window.S.modal.confirm('Are you sure you want to approve this mod?', 'Approve Mod')
        : confirm('Are you sure you want to approve this mod?');

    serverLog('info', `User confirmed approval: ${confirmed}`);

    if (confirmed) {
        serverLog('info', `Proceeding with approval for mod ${modId}`);

        // Add loading state to the button
        const approveBtn = document.querySelector(`[data-mod-id="${modId}"].approve-mod-btn`);
        const originalContent = approveBtn ? approveBtn.innerHTML : '';
        serverLog('debug', `Found approve button: ${approveBtn ? 'Yes' : 'No'}`);

        if (approveBtn) {
            approveBtn.disabled = true;
            approveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Approving...';
            serverLog('debug', 'Set button to loading state');
        }

        try {
            const requestBody = { reason: reason || '' };
            serverLog('debug', 'Sending approval request', requestBody);

            const response = await fetch(`/api/admin/mods/${modId}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(requestBody)
            });

            serverLog('debug', `API response status: ${response.status}`);

            const result = await response.json();
            serverLog('debug', 'API response data', result);

            if (response.ok) {
                serverLog('info', `Mod ${modId} approved successfully`);
                if (window.S && window.S.notify) {
                    window.S.notify.success('Mod approved successfully!');
                } else {
                    alert('Mod approved successfully!');
                }
                serverLog('info', 'Refreshing pending mods content');
                refreshPendingMods();
            } else {
                throw new Error(result.error || 'Failed to approve mod');
            }
        } catch (error) {
            serverLog('error', `Error approving mod ${modId}`, { error: error.message, stack: error.stack });
            if (window.S && window.S.notify) {
                window.S.notify.error('Failed to approve mod: ' + error.message);
            } else {
                alert('Failed to approve mod: ' + error.message);
            }
            // Restore button state on error
            if (approveBtn) {
                approveBtn.disabled = false;
                approveBtn.innerHTML = originalContent;
                serverLog('debug', 'Restored button state after error');
            }
        }
    } else {
        serverLog('info', `Approval cancelled by user for mod ${modId}`);
    }
}

async function rejectMod(modId) {
    serverLog('info', `Starting rejection process for mod ID: ${modId}`);

    // Require rejection reason
    const reason = prompt('Please provide a reason for rejection (required):');
    serverLog('debug', `Rejection reason provided: ${reason ? 'Yes' : 'No'}`);

    if (!reason || !reason.trim()) {
        serverLog('warn', 'Rejection cancelled - no reason provided');
        if (window.S && window.S.notify) {
            window.S.notify.error('Rejection reason is required');
        } else {
            alert('Rejection reason is required');
        }
        return;
    }

    const confirmed = window.S && window.S.modal
        ? await window.S.modal.confirm('Are you sure you want to reject and permanently remove this mod? This action cannot be undone.', 'Reject and Remove Mod')
        : confirm('Are you sure you want to reject and permanently remove this mod? This action cannot be undone.');

    serverLog('info', `User confirmed rejection: ${confirmed}`);

    if (confirmed) {
        serverLog('info', `Proceeding with rejection for mod ${modId}`);

        // Add loading state to the button
        const rejectBtn = document.querySelector(`[data-mod-id="${modId}"].reject-mod-btn`);
        const originalContent = rejectBtn ? rejectBtn.innerHTML : '';
        serverLog('debug', `Found reject button: ${rejectBtn ? 'Yes' : 'No'}`);

        if (rejectBtn) {
            rejectBtn.disabled = true;
            rejectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rejecting...';
            serverLog('debug', 'Set button to loading state');
        }

        try {
            const requestBody = { reason: reason.trim() };
            serverLog('debug', 'Sending rejection request', requestBody);

            const response = await fetch(`/api/admin/mods/${modId}/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(requestBody)
            });

            serverLog('debug', `API response status: ${response.status}`);

            const result = await response.json();
            serverLog('debug', 'API response data', result);

            if (response.ok) {
                serverLog('info', `Mod ${modId} rejected and removed successfully`);
                if (window.S && window.S.notify) {
                    window.S.notify.success('Mod rejected and removed successfully!');
                } else {
                    alert('Mod rejected and removed successfully!');
                }
                serverLog('info', 'Refreshing pending mods content');
                refreshPendingMods();
            } else {
                throw new Error(result.error || 'Failed to reject mod');
            }
        } catch (error) {
            serverLog('error', `Error rejecting mod ${modId}`, { error: error.message, stack: error.stack });
            if (window.S && window.S.notify) {
                window.S.notify.error('Failed to reject mod: ' + error.message);
            } else {
                alert('Failed to reject mod: ' + error.message);
            }
            // Restore button state on error
            if (rejectBtn) {
                rejectBtn.disabled = false;
                rejectBtn.innerHTML = originalContent;
                serverLog('debug', 'Restored button state after error');
            }
        }
    } else {
        serverLog('info', `Rejection cancelled by user for mod ${modId}`);
    }
}

function previewMod(modId) {
    // Open mod preview in new tab
    window.open(`/mod/${modId}?preview=true`, '_blank');
}

async function bulkApprove() {
    const selected = Array.from(document.querySelectorAll('.mod-checkbox:checked')).map(cb => cb.value);

    if (selected.length === 0) return;

    // Optional bulk approval note
    const reason = prompt('Optional approval note for all selected mods:');

    const confirmed = window.S && window.S.modal
        ? await window.S.modal.confirm(`Approve ${selected.length} mod${selected.length !== 1 ? 's' : ''}?`, 'Bulk Approve')
        : confirm(`Approve ${selected.length} mod${selected.length !== 1 ? 's' : ''}?`);

    if (confirmed) {
        try {
            // Use new admin API endpoints
            const promises = selected.map(async id => {
                const response = await fetch(`/api/admin/mods/${id}/approve`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ reason: reason || '' })
                });
                if (!response.ok) {
                    const result = await response.json();
                    throw new Error(result.error || `Failed to approve mod ${id}`);
                }
                return response.json();
            });

            await Promise.all(promises);

            if (window.S && window.S.notify) {
                window.S.notify.success(`${selected.length} mod${selected.length !== 1 ? 's' : ''} approved successfully!`);
            } else {
                alert(`${selected.length} mod${selected.length !== 1 ? 's' : ''} approved successfully!`);
            }
            refreshPendingMods();
        } catch (error) {
            if (window.S && window.S.notify) {
                window.S.notify.error('Failed to approve mods: ' + error.message);
            } else {
                alert('Failed to approve mods: ' + error.message);
            }
        }
    }
}

async function bulkReject() {
    const selected = Array.from(document.querySelectorAll('.mod-checkbox:checked')).map(cb => cb.value);

    if (selected.length === 0) return;

    // Require rejection reason for bulk reject
    const reason = prompt('Please provide a reason for rejecting all selected mods (required):');

    if (!reason || !reason.trim()) {
        if (window.S && window.S.notify) {
            window.S.notify.error('Rejection reason is required');
        } else {
            alert('Rejection reason is required');
        }
        return;
    }

    const confirmed = window.S && window.S.modal
        ? await window.S.modal.confirm(`Reject and permanently remove ${selected.length} mod${selected.length !== 1 ? 's' : ''}? This action cannot be undone.`, 'Bulk Reject and Remove')
        : confirm(`Reject and permanently remove ${selected.length} mod${selected.length !== 1 ? 's' : ''}? This action cannot be undone.`);

    if (confirmed) {
        try {
            // Use new admin API endpoints
            const promises = selected.map(async id => {
                const response = await fetch(`/api/admin/mods/${id}/reject`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ reason: reason.trim() })
                });
                if (!response.ok) {
                    const result = await response.json();
                    throw new Error(result.error || `Failed to reject mod ${id}`);
                }
                return response.json();
            });

            await Promise.all(promises);

            if (window.S && window.S.notify) {
                window.S.notify.success(`${selected.length} mod${selected.length !== 1 ? 's' : ''} rejected and removed successfully!`);
            } else {
                alert(`${selected.length} mod${selected.length !== 1 ? 's' : ''} rejected and removed successfully!`);
            }
            refreshPendingMods();
        } catch (error) {
            if (window.S && window.S.notify) {
                window.S.notify.error('Failed to reject mods: ' + error.message);
            } else {
                alert('Failed to reject mods: ' + error.message);
            }
        }
    }
}

function refreshPendingMods() {
    serverLog('info', 'Refreshing pending mods - reloading page');
    window.location.reload();
}

// Enhanced refresh function that updates content without full page reload
async function refreshPendingModsContent() {
    serverLog('info', 'Refreshing pending mods content dynamically');
    try {
        // This would require server-side support to return just the pending mods section
        // For now, we'll fall back to full page reload
        serverLog('debug', 'Dynamic refresh not implemented, falling back to page reload');
        refreshPendingMods();
    } catch (error) {
        serverLog('error', 'Error refreshing pending mods content', { error: error.message });
        refreshPendingMods();
    }
}

// Update pending mods count in navigation badge
function updatePendingModsCount() {
    serverLog('debug', 'Updating pending mods count badge');
    // This would require fetching the current count from the server
    // For now, we'll rely on the page reload to update the count
}

// User management functionality is now handled by admin-users.js

// Load site settings from server
async function loadSiteSettings() {
    try {
        const response = await fetch('/api/admin/settings', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const settings = await response.json();

        // Update form fields with current settings
        const maintenanceModeCheckbox = document.getElementById('maintenanceMode');
        const maintenanceMessageTextarea = document.getElementById('maintenanceMessage');
        const maxFileSizeInput = document.getElementById('maxFileSize');
        const maxThumbnailSizeInput = document.getElementById('maxThumbnailSize');
        const maxScreenshotSizeInput = document.getElementById('maxScreenshotSize');
        const featuredModsCountInput = document.getElementById('featuredModsCount');

        if (maintenanceModeCheckbox && 'maintenance_mode' in settings) {
            maintenanceModeCheckbox.checked = settings.maintenance_mode;
            // Trigger change event to update label
            maintenanceModeCheckbox.dispatchEvent(new Event('change'));

            // Update maintenance indicator
            updateMaintenanceIndicator(settings.maintenance_mode);
        }

        if (maintenanceMessageTextarea && 'maintenance_message' in settings) {
            maintenanceMessageTextarea.value = settings.maintenance_message || 'Sayonika is currently undergoing maintenance. Please check back later!';
        }

        if (maxFileSizeInput && 'max_file_size_mb' in settings) {
            maxFileSizeInput.value = settings.max_file_size_mb;
        }

        if (maxThumbnailSizeInput && 'max_thumbnail_size_mb' in settings) {
            maxThumbnailSizeInput.value = settings.max_thumbnail_size_mb;
        }

        if (maxScreenshotSizeInput && 'max_screenshot_size_mb' in settings) {
            maxScreenshotSizeInput.value = settings.max_screenshot_size_mb;
        }

        if (featuredModsCountInput && 'featured_mods_count' in settings) {
            featuredModsCountInput.value = settings.featured_mods_count;
        }

        serverLog('info', 'Site settings loaded successfully');
    } catch (error) {
        console.error('Failed to load site settings:', error);
        serverLog('error', `Failed to load site settings: ${error.message}`);

        if (window.S && window.S.notify) {
            window.S.notify.error('Failed to load site settings');
        }
    }
}

// Save site settings to server
async function saveSiteSettings() {
    serverLog('info', 'Starting saveSiteSettings function');
    try {
        const maintenanceModeCheckbox = document.getElementById('maintenanceMode');
        const maintenanceMessageTextarea = document.getElementById('maintenanceMessage');
        const maxFileSizeInput = document.getElementById('maxFileSize');
        const maxThumbnailSizeInput = document.getElementById('maxThumbnailSize');
        const maxScreenshotSizeInput = document.getElementById('maxScreenshotSize');
        const featuredModsCountInput = document.getElementById('featuredModsCount');

        const settings = {};

        // Debug: Log which form elements were found
        serverLog('debug', 'Form elements found', {
            maintenanceMode: !!maintenanceModeCheckbox,
            maintenanceMessage: !!maintenanceMessageTextarea,
            maxFileSize: !!maxFileSizeInput,
            maxThumbnailSize: !!maxThumbnailSizeInput,
            maxScreenshotSize: !!maxScreenshotSizeInput,
            featuredModsCount: !!featuredModsCountInput
        });

        if (maintenanceModeCheckbox) {
            settings.maintenance_mode = maintenanceModeCheckbox.checked;
            serverLog('debug', `Maintenance mode setting: ${settings.maintenance_mode}`);
        }

        if (maintenanceMessageTextarea) {
            settings.maintenance_message = maintenanceMessageTextarea.value.trim() || 'Sayonika is currently undergoing maintenance. Please check back later!';
            serverLog('debug', `Maintenance message setting: ${settings.maintenance_message}`);
        }

        if (maxFileSizeInput) {
            const maxFileSize = parseInt(maxFileSizeInput.value);
            if (isNaN(maxFileSize) || maxFileSize < 1) {
                throw new Error('Maximum file size must be a positive number');
            }
            settings.max_file_size_mb = maxFileSize;
            serverLog('debug', `Max file size setting: ${settings.max_file_size_mb}MB`);
        }

        if (maxThumbnailSizeInput) {
            const maxThumbnailSize = parseInt(maxThumbnailSizeInput.value);
            if (isNaN(maxThumbnailSize) || maxThumbnailSize < 1) {
                throw new Error('Maximum thumbnail size must be a positive number');
            }
            settings.max_thumbnail_size_mb = maxThumbnailSize;
            serverLog('debug', `Max thumbnail size setting: ${settings.max_thumbnail_size_mb}MB`);
        }

        if (maxScreenshotSizeInput) {
            const maxScreenshotSize = parseInt(maxScreenshotSizeInput.value);
            if (isNaN(maxScreenshotSize) || maxScreenshotSize < 1) {
                throw new Error('Maximum screenshot size must be a positive number');
            }
            settings.max_screenshot_size_mb = maxScreenshotSize;
            serverLog('debug', `Max screenshot size setting: ${settings.max_screenshot_size_mb}MB`);
        }

        if (featuredModsCountInput) {
            settings.featured_mods_count = parseInt(featuredModsCountInput.value);
            serverLog('debug', `Featured mods count setting: ${settings.featured_mods_count}`);
        }

        serverLog('info', 'Settings object prepared', settings);
        serverLog('info', 'Making API request to /api/admin/settings');

        const response = await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ settings })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        serverLog('debug', `API response status: ${response.status}`);
        const result = await response.json();
        serverLog('debug', 'Site settings saved successfully', result);

        if (window.S && window.S.notify) {
            window.S.notify.success('Settings saved successfully to database!');
        } else {
            alert('Settings saved successfully to database!');
        }

        // Show special message if maintenance mode was toggled
        if ('maintenance_mode' in settings) {
            const message = settings.maintenance_mode
                ? 'Maintenance mode has been enabled. New uploads and registrations are now blocked.'
                : 'Maintenance mode has been disabled. Normal operations have resumed.';

            if (window.S && window.S.notify) {
                window.S.notify.info(message);
            }

            // Update maintenance indicator
            updateMaintenanceIndicator(settings.maintenance_mode);
        }

        // Show special message if file size limit was changed
        if ('max_file_size_mb' in settings) {
            const message = `Maximum file size limit updated to ${settings.max_file_size_mb}MB`;
            serverLog('info', message);
        }

        serverLog('info', 'saveSiteSettings completed successfully');

    } catch (error) {
        serverLog('error', 'Failed to save site settings:', error.message);

        if (window.S && window.S.notify) {
            window.S.notify.error(`Failed to save settings: ${error.message}`);
        } else {
            alert(`Failed to save settings: ${error.message}`);
        }
    }
}

// Update maintenance mode indicator
function updateMaintenanceIndicator(isMaintenanceMode) {
    const indicator = document.getElementById('maintenanceIndicator');
    if (indicator) {
        if (isMaintenanceMode) {
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    }
}

// Function to switch tabs (used by maintenance indicator)
function switchTab(tabName) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Add active class to selected tab and content
    const selectedTab = document.querySelector(`[data-tab="${tabName}"]`);
    const selectedContent = document.getElementById(`${tabName}-tab`);

    if (selectedTab) selectedTab.classList.add('active');
    if (selectedContent) selectedContent.classList.add('active');
}