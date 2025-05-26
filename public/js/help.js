// Help Center Search Functionality
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('help-search');
    const helpSections = document.querySelectorAll('.help-section');
    const faqItems = document.querySelectorAll('.faq-item');

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            
            if (searchTerm === '') {
                // Show all sections and items
                helpSections.forEach(section => {
                    section.style.display = 'block';
                });
                faqItems.forEach(item => {
                    item.style.display = 'block';
                });
                return;
            }

            // Search through FAQ items
            faqItems.forEach(item => {
                const title = item.querySelector('h3').textContent.toLowerCase();
                const content = item.querySelector('p, ul, ol')?.textContent.toLowerCase() || '';
                
                if (title.includes(searchTerm) || content.includes(searchTerm)) {
                    item.style.display = 'block';
                    // Highlight the parent section
                    const parentSection = item.closest('.help-section');
                    if (parentSection) {
                        parentSection.style.display = 'block';
                    }
                } else {
                    item.style.display = 'none';
                }
            });

            // Hide sections that have no visible FAQ items
            helpSections.forEach(section => {
                const visibleItems = section.querySelectorAll('.faq-item:not([style*="display: none"])');
                if (visibleItems.length === 0 && section.querySelectorAll('.faq-item').length > 0) {
                    section.style.display = 'none';
                } else {
                    section.style.display = 'block';
                }
            });
        });

        // Add search suggestions
        const searchHints = [
            'upload', 'download', 'account', 'mod', 'login', 'register',
            'password', 'github', 'discord', 'oauth', 'file', 'zip',
            'install', 'review', 'guidelines', 'report', 'bug', 'error'
        ];

        searchInput.addEventListener('focus', function() {
            // You could add autocomplete suggestions here if needed
        });
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add some visual feedback for quick link cards
    document.querySelectorAll('.quick-link-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-4px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
});
