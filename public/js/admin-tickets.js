class AdminTicketsManager {
    constructor() {
        this.currentFilters = {
            search: '',
            status: '',
            priority: '',
            limit: 50
        };
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadTickets();
    }

    bindEvents() {
        // Search and filter events
        document.getElementById('refreshTicketsBtn')?.addEventListener('click', () => {
            this.loadTickets();
        });

        document.querySelector('.search-tickets-btn')?.addEventListener('click', () => {
            this.applyFilters();
        });

        document.querySelector('.clear-ticket-filters-btn')?.addEventListener('click', () => {
            this.clearFilters();
        });

        // Enter key search
        document.getElementById('ticketSearch')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.applyFilters();
            }
        });
    }

    async loadTickets() {
        const container = document.getElementById('ticketsTableContainer');
        if (!container) return;

        try {
            container.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading support tickets...</p>
                </div>
            `;

            const params = new URLSearchParams(this.currentFilters);
            const response = await fetch(`/api/admin/support/tickets?${params}`);
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            this.renderTicketsTable(data.tickets || []);
        } catch (error) {
            console.error('Error loading tickets:', error);
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Error Loading Tickets</h3>
                    <p>${error.message}</p>
                    <button class="btn btn-primary" onclick="adminTicketsManager.loadTickets()">
                        <i class="fas fa-retry"></i> Try Again
                    </button>
                </div>
            `;
        }
    }

    renderTicketsTable(tickets) {
        const container = document.getElementById('ticketsTableContainer');
        
        if (tickets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-ticket-alt"></i>
                    </div>
                    <h3>No Support Tickets</h3>
                    <p>No support tickets match your current filters.</p>
                </div>
            `;
            return;
        }

        const tableHTML = `
            <table class="admin-table tickets-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Subject</th>
                        <th>From</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${tickets.map(ticket => this.renderTicketRow(ticket)).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;
        this.bindTicketEvents();
    }

    renderTicketRow(ticket) {
        const statusClass = this.getStatusClass(ticket.status);
        const priorityClass = this.getPriorityClass(ticket.priority);
        
        return `
            <tr data-ticket-id="${ticket.id}">
                <td>
                    <span class="ticket-id">#${ticket.id}</span>
                </td>
                <td>
                    <div class="ticket-subject">
                        <a href="/admin/tickets/${ticket.id}" class="ticket-link">
                            ${this.escapeHtml(ticket.subject)}
                        </a>
                    </div>
                </td>
                <td>
                    <div class="ticket-from">
                        <div class="from-name">${this.escapeHtml(ticket.name)}</div>
                        <div class="from-email">${this.escapeHtml(ticket.email)}</div>
                        ${ticket.username ? `<div class="from-username">@${this.escapeHtml(ticket.username)}</div>` : ''}
                    </div>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">
                        <i class="fas fa-${this.getStatusIcon(ticket.status)}"></i>
                        ${ticket.status.replace('_', ' ').toUpperCase()}
                    </span>
                </td>
                <td>
                    <span class="priority-badge ${priorityClass}">
                        <i class="fas fa-${this.getPriorityIcon(ticket.priority)}"></i>
                        ${ticket.priority.toUpperCase()}
                    </span>
                </td>
                <td>
                    <div class="date-info">
                        ${this.formatDate(ticket.created_at)}
                    </div>
                </td>
                <td>
                    <div class="ticket-actions">
                        <a href="/admin/tickets/${ticket.id}" class="btn btn-sm btn-primary">
                            <i class="fas fa-eye"></i> View
                        </a>
                        <button class="btn btn-sm btn-success quick-resolve-btn" data-ticket-id="${ticket.id}" 
                                ${ticket.status === 'resolved' || ticket.status === 'closed' ? 'disabled' : ''}>
                            <i class="fas fa-check"></i> Resolve
                        </button>
                        <button class="btn btn-sm btn-danger quick-delete-btn" data-ticket-id="${ticket.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    bindTicketEvents() {
        // Quick resolve buttons
        document.querySelectorAll('.quick-resolve-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ticketId = e.target.closest('button').dataset.ticketId;
                this.quickResolveTicket(ticketId);
            });
        });

        // Quick delete buttons
        document.querySelectorAll('.quick-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ticketId = e.target.closest('button').dataset.ticketId;
                this.quickDeleteTicket(ticketId);
            });
        });
    }

    async quickResolveTicket(ticketId) {
        try {
            const response = await fetch(`/api/admin/support/tickets/${ticketId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: 'resolved' })
            });

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            this.showMessage('Ticket resolved successfully', 'success');
            this.loadTickets(); // Reload the table
        } catch (error) {
            console.error('Error resolving ticket:', error);
            this.showMessage('Failed to resolve ticket', 'error');
        }
    }

    async quickDeleteTicket(ticketId) {
        if (!confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/support/tickets/${ticketId}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            this.showMessage('Ticket deleted successfully', 'success');
            this.loadTickets(); // Reload the table
        } catch (error) {
            console.error('Error deleting ticket:', error);
            this.showMessage('Failed to delete ticket', 'error');
        }
    }

    applyFilters() {
        this.currentFilters.search = document.getElementById('ticketSearch')?.value || '';
        this.currentFilters.status = document.getElementById('ticketStatusFilter')?.value || '';
        this.currentFilters.priority = document.getElementById('ticketPriorityFilter')?.value || '';
        this.loadTickets();
    }

    clearFilters() {
        document.getElementById('ticketSearch').value = '';
        document.getElementById('ticketStatusFilter').value = '';
        document.getElementById('ticketPriorityFilter').value = '';
        this.currentFilters = {
            search: '',
            status: '',
            priority: '',
            limit: 50
        };
        this.loadTickets();
    }

    getStatusClass(status) {
        const classes = {
            'open': 'status-open',
            'in_progress': 'status-in-progress',
            'resolved': 'status-resolved',
            'closed': 'status-closed'
        };
        return classes[status] || 'status-open';
    }

    getPriorityClass(priority) {
        const classes = {
            'low': 'priority-low',
            'medium': 'priority-medium',
            'high': 'priority-high',
            'urgent': 'priority-urgent'
        };
        return classes[priority] || 'priority-medium';
    }

    getStatusIcon(status) {
        const icons = {
            'open': 'exclamation-circle',
            'in_progress': 'spinner',
            'resolved': 'check-circle',
            'closed': 'times-circle'
        };
        return icons[status] || 'exclamation-circle';
    }

    getPriorityIcon(priority) {
        const icons = {
            'low': 'arrow-down',
            'medium': 'minus',
            'high': 'arrow-up',
            'urgent': 'exclamation-triangle'
        };
        return icons[priority] || 'minus';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showMessage(message, type) {
        // Create or update a message display
        let messageContainer = document.getElementById('adminMessageContainer');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'adminMessageContainer';
            messageContainer.className = 'admin-message-container';
            document.body.appendChild(messageContainer);
        }

        messageContainer.innerHTML = `
            <div class="alert alert-${type}">
                ${message}
                <button type="button" class="close-btn" onclick="this.parentElement.parentElement.style.display='none'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        messageContainer.style.display = 'block';

        setTimeout(() => {
            messageContainer.style.display = 'none';
        }, 5000);
    }
}

// Initialize when DOM is loaded
let adminTicketsManager;
document.addEventListener('DOMContentLoaded', function() {
    adminTicketsManager = new AdminTicketsManager();
});
