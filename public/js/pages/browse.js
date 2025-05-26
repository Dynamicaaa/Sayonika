// Browse page functionality

// Filter removal
function removeFilter(filterType) {
    const url = new URL(window.location);
    url.searchParams.delete(filterType);
    window.location.href = url.toString();
}

// View toggle functionality
document.addEventListener('DOMContentLoaded', function() {
    const viewButtons = document.querySelectorAll('.view-btn');
    const modsContainer = document.getElementById('modsContainer');
    
    viewButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.getAttribute('data-view');
            
            // Update active button
            viewButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Update container class
            if (view === 'list') {
                modsContainer.className = 'mods-list-view';
            } else {
                modsContainer.className = 'mods-grid-view';
            }
        });
    });

    // Auto-submit search form on input
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.form.submit();
            }, 500);
        });
    }

    // Add event listeners for remove filter buttons
    document.querySelectorAll('.remove-filter').forEach(button => {
        button.addEventListener('click', function() {
            const filterType = this.getAttribute('data-filter-type');
            removeFilter(filterType);
        });
    });
});
