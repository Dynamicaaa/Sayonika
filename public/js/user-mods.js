// User mod management functionality

class UserModManager {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // Delete mod buttons
        document.querySelectorAll('.delete-mod-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const modId = btn.dataset.modId;
                const modTitle = btn.dataset.modTitle;
                this.deleteMod(modId, modTitle);
            });
        });

        // Analytics buttons
        document.querySelectorAll('.analytics-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const modId = btn.dataset.modId;
                this.showAnalytics(modId);
            });
        });
    }

    async deleteMod(modId, modTitle) {
        const confirmed = window.S && window.S.modal
            ? await window.S.modal.confirm(
                `Are you sure you want to delete "${modTitle}"? This action cannot be undone.`,
                'Delete Mod'
              )
            : confirm(`Are you sure you want to delete "${modTitle}"? This action cannot be undone.`);

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/user/mods/${modId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete mod');
            }

            if (window.S && window.S.notify) {
                window.S.notify.success('Mod deleted successfully!');
            } else {
                alert('Mod deleted successfully!');
            }

            // Remove the mod card from the page
            const modCard = document.querySelector(`[data-mod-id="${modId}"]`)?.closest('.user-mod-card');
            if (modCard) {
                modCard.remove();
            }

            // Refresh the page to update stats
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error) {
            console.error('Error deleting mod:', error);
            if (window.S && window.S.notify) {
                window.S.notify.error(`Failed to delete mod: ${error.message}`);
            } else {
                alert(`Failed to delete mod: ${error.message}`);
            }
        }
    }

    async showAnalytics(modId) {
        try {
            // For now, show a simple analytics modal
            // In a full implementation, you'd fetch real analytics data
            const modal = this.createAnalyticsModal(modId);
            document.body.appendChild(modal);
            modal.style.display = 'flex';

            // Load analytics data
            await this.loadAnalyticsData(modId, modal);

        } catch (error) {
            console.error('Error showing analytics:', error);
            if (window.S && window.S.notify) {
                window.S.notify.error('Failed to load analytics');
            }
        }
    }

    createAnalyticsModal(modId) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">Mod Analytics</h3>
                        <button class="modal-close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="analytics-loading">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Loading analytics...</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline close-modal-btn">Close</button>
                    </div>
                </div>
            </div>
        `;

        // Close modal events
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('.close-modal-btn').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        return modal;
    }

    async loadAnalyticsData(modId, modal) {
        try {
            // Simulate loading analytics data
            // In a real implementation, you'd have an API endpoint for this
            await new Promise(resolve => setTimeout(resolve, 1000));

            const analyticsHTML = `
                <div class="analytics-content">
                    <div class="analytics-grid">
                        <div class="analytics-card">
                            <div class="analytics-icon">
                                <i class="fas fa-download"></i>
                            </div>
                            <div class="analytics-info">
                                <h4>Total Downloads</h4>
                                <p class="analytics-number">--</p>
                                <small>All time</small>
                            </div>
                        </div>

                        <div class="analytics-card">
                            <div class="analytics-icon">
                                <i class="fas fa-eye"></i>
                            </div>
                            <div class="analytics-info">
                                <h4>Page Views</h4>
                                <p class="analytics-number">--</p>
                                <small>Last 30 days</small>
                            </div>
                        </div>

                        <div class="analytics-card">
                            <div class="analytics-icon">
                                <i class="fas fa-star"></i>
                            </div>
                            <div class="analytics-info">
                                <h4>Average Rating</h4>
                                <p class="analytics-number">--</p>
                                <small>From reviews</small>
                            </div>
                        </div>

                        <div class="analytics-card">
                            <div class="analytics-icon">
                                <i class="fas fa-heart"></i>
                            </div>
                            <div class="analytics-info">
                                <h4>Favorites</h4>
                                <p class="analytics-number">--</p>
                                <small>Users who favorited</small>
                            </div>
                        </div>
                    </div>

                    <div class="analytics-section">
                        <h4>Download Trends</h4>
                        <div class="chart-placeholder">
                            <i class="fas fa-chart-line"></i>
                            <p>Analytics charts coming soon!</p>
                        </div>
                    </div>

                    <div class="analytics-section">
                        <h4>Recent Activity</h4>
                        <div class="activity-list">
                            <div class="activity-item">
                                <i class="fas fa-download"></i>
                                <span>Analytics feature is in development</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            modal.querySelector('.modal-body').innerHTML = analyticsHTML;

        } catch (error) {
            modal.querySelector('.modal-body').innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h4>Failed to load analytics</h4>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.user-mod-card')) {
        new UserModManager();
    }
});
