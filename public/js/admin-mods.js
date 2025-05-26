// Admin mod management functionality

class AdminModManager {
    constructor() {
        this.currentPage = 1;
        this.currentFilters = {};
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadMods();
    }

    bindEvents() {
        // Search and filter events
        document.querySelector('.search-mods-btn')?.addEventListener('click', () => {
            this.currentPage = 1;
            this.loadMods();
        });

        document.querySelector('.clear-filters-btn')?.addEventListener('click', () => {
            this.clearFilters();
        });

        document.getElementById('refreshAllModsBtn')?.addEventListener('click', () => {
            this.loadMods();
        });

        // Enter key in search
        document.getElementById('modSearch')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.currentPage = 1;
                this.loadMods();
            }
        });
    }

    clearFilters() {
        document.getElementById('modSearch').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('featuredFilter').value = '';
        document.getElementById('sortByFilter').value = 'created_at';
        this.currentPage = 1;
        this.loadMods();
    }

    getFilters() {
        return {
            search: document.getElementById('modSearch')?.value || '',
            status: document.getElementById('statusFilter')?.value || '',
            featured: document.getElementById('featuredFilter')?.value || '',
            sort_by: document.getElementById('sortByFilter')?.value || 'created_at',
            sort_order: 'desc',
            page: this.currentPage,
            limit: 20
        };
    }

    async loadMods() {
        const container = document.getElementById('allModsTableContainer');
        if (!container) return;

        try {
            // Show loading state
            container.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading mods...</p>
                </div>
            `;

            const filters = this.getFilters();
            this.currentFilters = filters;

            const queryParams = new URLSearchParams();
            Object.keys(filters).forEach(key => {
                if (filters[key]) {
                    queryParams.append(key, filters[key]);
                }
            });

            const response = await fetch(`/api/admin/mods?${queryParams}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to load mods');
            }

            const data = await response.json();
            this.renderModsTable(data.mods, data.pagination);

        } catch (error) {
            console.error('Error loading mods:', error);
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Error loading mods</h3>
                    <p>${error.message}</p>
                    <button class="btn btn-primary" onclick="adminModManager.loadMods()">
                        <i class="fas fa-retry"></i> Try Again
                    </button>
                </div>
            `;
        }
    }

    renderModsTable(mods, pagination) {
        const container = document.getElementById('allModsTableContainer');
        
        if (mods.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-puzzle-piece"></i>
                    </div>
                    <h3>No mods found</h3>
                    <p>No mods match your current filters.</p>
                </div>
            `;
            return;
        }

        const tableHTML = `
            <div class="table-responsive">
                <table class="admin-mods-table">
                    <thead>
                        <tr>
                            <th>Mod</th>
                            <th>Author</th>
                            <th>Status</th>
                            <th>Category</th>
                            <th>Downloads</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${mods.map(mod => this.renderModRow(mod)).join('')}
                    </tbody>
                </table>
            </div>
            ${this.renderPagination(pagination)}
        `;

        container.innerHTML = tableHTML;
        this.bindModActions();
    }

    renderModRow(mod) {
        const statusClass = mod.is_published ? 'published' : 'pending';
        const statusText = mod.is_published ? 'Published' : 'Pending';
        const featuredBadge = mod.is_featured ? '<span class="featured-badge"><i class="fas fa-star"></i> Featured</span>' : '';
        
        return `
            <tr data-mod-id="${mod.id}">
                <td>
                    <div class="mod-info">
                        <img src="${mod.thumbnail_url || '/images/default-mod-thumbnail.png'}" alt="${mod.title}" class="mod-thumbnail">
                        <div class="mod-details">
                            <div class="mod-title">
                                <a href="/mod/${mod.slug}" target="_blank">${mod.title}</a>
                                ${featuredBadge}
                            </div>
                            <div class="mod-version">v${mod.version}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <a href="/user/${mod.author_username}" target="_blank">
                        ${mod.author_display_name || mod.author_username}
                    </a>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">
                        <i class="fas fa-${mod.is_published ? 'check' : 'clock'}"></i>
                        ${statusText}
                    </span>
                </td>
                <td>
                    <span class="category-badge" style="background-color: ${mod.category_color || '#6c757d'}">
                        ${mod.category_name || 'Uncategorized'}
                    </span>
                </td>
                <td>
                    <span class="download-count">
                        <i class="fas fa-download"></i> ${mod.download_count}
                    </span>
                </td>
                <td>
                    <div class="date-info">
                        ${this.formatDate(mod.created_at)}
                    </div>
                </td>
                <td>
                    <div class="mod-actions">
                        <button class="btn btn-sm btn-outline view-mod-btn" data-mod-id="${mod.id}" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline edit-mod-btn" data-mod-id="${mod.id}" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-${mod.is_published ? 'warning' : 'success'} toggle-publish-btn" 
                                data-mod-id="${mod.id}" data-published="${mod.is_published}" title="${mod.is_published ? 'Unpublish' : 'Publish'}">
                            <i class="fas fa-${mod.is_published ? 'eye-slash' : 'check'}"></i>
                        </button>
                        <button class="btn btn-sm btn-${mod.is_featured ? 'warning' : 'info'} toggle-feature-btn" 
                                data-mod-id="${mod.id}" data-featured="${mod.is_featured}" title="${mod.is_featured ? 'Unfeature' : 'Feature'}">
                            <i class="fas fa-star"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-mod-btn" data-mod-id="${mod.id}" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    renderPagination(pagination) {
        if (pagination.pages <= 1) return '';

        const { page, pages } = pagination;
        let paginationHTML = '<div class="pagination-container"><div class="pagination">';

        // Previous button
        if (page > 1) {
            paginationHTML += `<button class="btn btn-outline btn-sm page-btn" data-page="${page - 1}">
                <i class="fas fa-chevron-left"></i> Previous
            </button>`;
        }

        // Page numbers
        const startPage = Math.max(1, page - 2);
        const endPage = Math.min(pages, page + 2);

        if (startPage > 1) {
            paginationHTML += `<button class="btn btn-outline btn-sm page-btn" data-page="1">1</button>`;
            if (startPage > 2) {
                paginationHTML += '<span class="pagination-ellipsis">...</span>';
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === page ? 'btn-primary' : 'btn-outline';
            paginationHTML += `<button class="btn ${activeClass} btn-sm page-btn" data-page="${i}">${i}</button>`;
        }

        if (endPage < pages) {
            if (endPage < pages - 1) {
                paginationHTML += '<span class="pagination-ellipsis">...</span>';
            }
            paginationHTML += `<button class="btn btn-outline btn-sm page-btn" data-page="${pages}">${pages}</button>`;
        }

        // Next button
        if (page < pages) {
            paginationHTML += `<button class="btn btn-outline btn-sm page-btn" data-page="${page + 1}">
                Next <i class="fas fa-chevron-right"></i>
            </button>`;
        }

        paginationHTML += '</div></div>';
        return paginationHTML;
    }

    bindModActions() {
        // Pagination
        document.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentPage = parseInt(btn.dataset.page);
                this.loadMods();
            });
        });

        // View mod
        document.querySelectorAll('.view-mod-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const modId = btn.dataset.modId;
                // Open mod in new tab - we'll need to get the slug first
                this.viewMod(modId);
            });
        });

        // Toggle publish
        document.querySelectorAll('.toggle-publish-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const modId = btn.dataset.modId;
                const isPublished = btn.dataset.published === 'true';
                this.togglePublish(modId, !isPublished);
            });
        });

        // Toggle feature
        document.querySelectorAll('.toggle-feature-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const modId = btn.dataset.modId;
                const isFeatured = btn.dataset.featured === 'true';
                this.toggleFeature(modId, !isFeatured);
            });
        });

        // Delete mod
        document.querySelectorAll('.delete-mod-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const modId = btn.dataset.modId;
                this.deleteMod(modId);
            });
        });
    }

    async viewMod(modId) {
        // For now, just open the mod page by ID - in a real implementation,
        // you might want to fetch the slug first
        window.open(`/mod/${modId}`, '_blank');
    }

    async togglePublish(modId, publish) {
        try {
            const response = await fetch(`/api/mods/${modId}/publish`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ is_published: publish })
            });

            if (!response.ok) {
                throw new Error('Failed to update mod status');
            }

            if (window.S && window.S.notify) {
                window.S.notify.success(`Mod ${publish ? 'published' : 'unpublished'} successfully!`);
            }

            this.loadMods(); // Refresh the table
        } catch (error) {
            console.error('Error toggling publish status:', error);
            if (window.S && window.S.notify) {
                window.S.notify.error('Failed to update mod status');
            }
        }
    }

    async toggleFeature(modId, feature) {
        try {
            const response = await fetch(`/api/mods/${modId}/feature`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ is_featured: feature })
            });

            if (!response.ok) {
                throw new Error('Failed to update featured status');
            }

            if (window.S && window.S.notify) {
                window.S.notify.success(`Mod ${feature ? 'featured' : 'unfeatured'} successfully!`);
            }

            this.loadMods(); // Refresh the table
        } catch (error) {
            console.error('Error toggling featured status:', error);
            if (window.S && window.S.notify) {
                window.S.notify.error('Failed to update featured status');
            }
        }
    }

    async deleteMod(modId) {
        const confirmed = window.S && window.S.modal
            ? await window.S.modal.confirm('Are you sure you want to delete this mod? This action cannot be undone.', 'Delete Mod')
            : confirm('Are you sure you want to delete this mod? This action cannot be undone.');

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/admin/mods/${modId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to delete mod');
            }

            if (window.S && window.S.notify) {
                window.S.notify.success('Mod deleted successfully!');
            }

            this.loadMods(); // Refresh the table
        } catch (error) {
            console.error('Error deleting mod:', error);
            if (window.S && window.S.notify) {
                window.S.notify.error('Failed to delete mod');
            }
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('allModsTableContainer')) {
        window.adminModManager = new AdminModManager();
    }
});
