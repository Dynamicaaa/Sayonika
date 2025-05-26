// Modern Documentation JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    // Clean up any corrupted code blocks first
    cleanupCorruptedCodeBlocks();

    // Initialize all functionality
    initializeTabs();
    initializeSmoothScrolling();
    initializeCopyButtons();
    initializeActiveNavigation();
    initializeMobileMenu();
    // Temporarily disable syntax highlighting to prevent corruption
    // initializeSyntaxHighlighting();
});

// Clean up any corrupted code blocks that might have class attributes in the text
function cleanupCorruptedCodeBlocks() {
    const codeBlocks = document.querySelectorAll('code');

    codeBlocks.forEach(block => {
        let text = block.textContent || block.innerText;

        // Check if the text contains class attributes that shouldn't be there
        if (text.includes('class="') || text.includes("class='") || text.includes('class=')) {
            // Clean up the text by removing all class attributes
            text = text.replace(/class="[^"]*"/g, '');
            text = text.replace(/class='[^']*'/g, '');
            text = text.replace(/class=/g, '');
            text = text.replace(/>/g, ''); // Remove any stray > characters

            // Clean up extra whitespace
            text = text.replace(/\s+/g, ' ').trim();

            // Update the block content
            block.textContent = text;

            console.log('Cleaned up corrupted code block');
        }
    });
}

// Tab functionality for installation and code examples
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            const tabGroup = button.closest('.installation-tabs, .language-tabs');

            if (tabGroup) {
                // Remove active class from buttons and contents in this group
                const groupButtons = tabGroup.querySelectorAll('.tab-button');
                const groupContents = tabGroup.querySelectorAll('.tab-content');

                groupButtons.forEach(btn => btn.classList.remove('active'));
                groupContents.forEach(content => content.classList.remove('active'));

                // Add active class to clicked button and corresponding content
                button.classList.add('active');
                const targetContent = tabGroup.querySelector(`#${targetTab}`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            }
        });
    });

    // Initialize first tab as active for each group
    document.querySelectorAll('.installation-tabs, .language-tabs').forEach(group => {
        const firstButton = group.querySelector('.tab-button');
        const firstContent = group.querySelector('.tab-content');
        if (firstButton && firstContent) {
            firstButton.classList.add('active');
            firstContent.classList.add('active');
        }
    });
}

// Smooth scrolling for navigation links
function initializeSmoothScrolling() {
    const navLinks = document.querySelectorAll('.nav-link[href^="#"], a[href^="#"]');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href.startsWith('#') && href.length > 1) {
                e.preventDefault();
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);

                if (targetElement) {
                    const headerOffset = 100;
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });

                    // Close mobile menu if open
                    closeMobileMenu();
                }
            }
        });
    });
}

// Copy to clipboard functionality for code blocks
function initializeCopyButtons() {
    const codeBlocks = document.querySelectorAll('.code-block');

    codeBlocks.forEach(block => {
        // Skip if copy button already exists
        if (block.querySelector('.copy-button')) return;

        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        copyButton.title = 'Copy to clipboard';

        copyButton.addEventListener('click', async () => {
            const code = block.querySelector('code');
            if (code) {
                try {
                    await navigator.clipboard.writeText(code.textContent);

                    // Success feedback
                    copyButton.innerHTML = '<i class="fas fa-check"></i>';
                    copyButton.style.background = 'rgba(40, 167, 69, 0.8)';

                    setTimeout(() => {
                        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                        copyButton.style.background = '';
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy text: ', err);

                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = code.textContent;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);

                    // Show success feedback
                    copyButton.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 2000);
                }
            }
        });

        block.style.position = 'relative';
        block.appendChild(copyButton);
    });
}

// Active navigation highlighting based on scroll position
function initializeActiveNavigation() {
    const sections = document.querySelectorAll('.docs-section[id]');
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');

    function updateActiveNavigation() {
        let currentSection = '';
        const scrollPosition = window.scrollY + 150;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;

            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                currentSection = section.id;
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('href');
            if (href === `#${currentSection}`) {
                link.classList.add('active');
            }
        });
    }

    // Throttle scroll events for better performance
    let ticking = false;
    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(updateActiveNavigation);
            ticking = true;
            setTimeout(() => { ticking = false; }, 10);
        }
    }

    window.addEventListener('scroll', requestTick);
    updateActiveNavigation(); // Initial call
}

// Mobile menu functionality
function initializeMobileMenu() {
    const mobileToggle = document.getElementById('docsMenuToggle');
    const sidebar = document.getElementById('docsSidebar');
    const sidebarClose = document.getElementById('sidebarClose');
    const overlay = document.getElementById('sidebarOverlay');

    // Toggle mobile menu
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
            overlay.classList.toggle('active');

            // Update toggle button icon
            const icon = mobileToggle.querySelector('i');
            if (sidebar.classList.contains('mobile-open')) {
                icon.className = 'fas fa-times';
            } else {
                icon.className = 'fas fa-bars';
            }
        });
    }

    // Close button in sidebar
    if (sidebarClose) {
        sidebarClose.addEventListener('click', closeMobileMenu);
    }

    // Close when clicking overlay
    if (overlay) {
        overlay.addEventListener('click', closeMobileMenu);
    }

    // Close menu when clicking navigation links on mobile
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                closeMobileMenu();
            }
        });
    });

    // Close menu on window resize if desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            closeMobileMenu();
        }
    });
}

// Helper function to close mobile menu
function closeMobileMenu() {
    const sidebar = document.getElementById('docsSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const mobileToggle = document.getElementById('docsMenuToggle');

    if (sidebar) {
        sidebar.classList.remove('mobile-open');
    }
    if (overlay) {
        overlay.classList.remove('active');
    }
    if (mobileToggle) {
        const icon = mobileToggle.querySelector('i');
        if (icon) {
            icon.className = 'fas fa-bars';
        }
    }
}

// Simple syntax highlighting for code blocks
function initializeSyntaxHighlighting() {
    const codeBlocks = document.querySelectorAll('code');

    codeBlocks.forEach(block => {
        // Skip if already highlighted or if it's inline code
        if (block.classList.contains('highlighted') || block.parentElement.tagName !== 'PRE') return;

        // Get the original text content for processing
        let text = block.textContent || block.innerText;

        // Check if the content contains malformed class attributes - if so, skip highlighting
        if (text.includes('class="') || text.includes("class='") || text.includes('class=')) {
            console.warn('Skipping syntax highlighting for malformed code block');
            block.classList.add('highlighted'); // Mark as processed to avoid re-processing
            return;
        }

        // Clean up any existing HTML tags that might have been added incorrectly
        text = text.replace(/<[^>]*>/g, '');

        // Detect if this is JSON content
        const trimmedText = text.trim();
        const isJSON = (trimmedText.startsWith('{') && trimmedText.endsWith('}')) ||
                      (trimmedText.startsWith('[') && trimmedText.endsWith(']'));

        if (isJSON) {
            // Special handling for JSON to preserve structure
            text = highlightJSON(text);
        } else {
            // Regular syntax highlighting for other code types
            text = highlightGenericCode(text);
        }

        block.innerHTML = text;
        block.classList.add('highlighted');
    });
}

// JSON-specific syntax highlighting
function highlightJSON(text) {
    // Escape HTML entities first
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Highlight JSON strings (property names and values)
    text = text.replace(/("(?:[^"\\]|\\.)*")\s*:/g, '<span class="json-key">$1</span>:');
    text = text.replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="string">$1</span>');

    // Highlight JSON values that aren't strings
    text = text.replace(/:\s*(true|false|null)\b/g, ': <span class="boolean">$1</span>');
    text = text.replace(/:\s*(\d+\.?\d*)\b/g, ': <span class="syntax-number">$1</span>');

    // Highlight array values
    text = text.replace(/\[\s*("(?:[^"\\]|\\.)*")/g, '[<span class="string">$1</span>');
    text = text.replace(/,\s*("(?:[^"\\]|\\.)*")/g, ', <span class="string">$1</span>');
    text = text.replace(/\[\s*(true|false|null)\b/g, '[<span class="boolean">$1</span>');
    text = text.replace(/,\s*(true|false|null)\b/g, ', <span class="boolean">$1</span>');
    text = text.replace(/\[\s*(\d+\.?\d*)\b/g, '[<span class="syntax-number">$1</span>');
    text = text.replace(/,\s*(\d+\.?\d*)\b/g, ', <span class="syntax-number">$1</span>');

    return text;
}

// Generic code syntax highlighting
function highlightGenericCode(text) {
    // Escape HTML entities first
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Clean up any remaining class attributes that might have leaked through
    text = text.replace(/class="[^"]*"/g, '');
    text = text.replace(/class='[^']*'/g, '');

    // Highlight strings (be more careful with quotes)
    text = text.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="string">$1</span>');
    text = text.replace(/('(?:[^'\\]|\\.)*')/g, '<span class="string">$1</span>');

    // Highlight booleans and null
    text = text.replace(/\b(true|false|null|undefined|True|False|None)\b/g, '<span class="boolean">$1</span>');

    // Highlight comments
    text = text.replace(/(#.*$)/gm, '<span class="comment">$1</span>'); // Shell/Python comments
    text = text.replace(/(\/\/.*$)/gm, '<span class="comment">$1</span>'); // JS comments
    text = text.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="comment">$1</span>'); // Block comments

    // Highlight keywords (including Python keywords)
    text = text.replace(/\b(function|const|let|var|if|else|for|while|return|import|export|from|async|await|try|catch|finally|throw|new|this|super|extends|static|public|private|protected|def|class|in|and|or|not|is|with|as|pass|break|continue|raise|except|elif|lambda|yield|global|nonlocal|GET|POST|PUT|DELETE|PATCH|curl|npm|node|git|cd|cp|mkdir)\b/g, '<span class="keyword">$1</span>');

    // Highlight numbers
    text = text.replace(/\b(\d+\.?\d*)\b(?![a-zA-Z_])/g, '<span class="syntax-number">$1</span>');

    return text;
}

// Add syntax highlighting styles
const syntaxStyles = document.createElement('style');
syntaxStyles.textContent = `
    .code-block .keyword { color: #ff7b72; font-weight: 600; }
    .code-block .string { color: #a5d6ff; }
    .code-block .json-key { color: #7dd3fc; font-weight: 500; }
    .code-block .boolean { color: #79c0ff; font-weight: 600; }
    .code-block .comment { color: #8b949e; font-style: italic; }
    .code-block .syntax-number { color: #79c0ff; }
`;
document.head.appendChild(syntaxStyles);
