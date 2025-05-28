// Upload page functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the upload form
    initializeUploadForm();

    // Initialize file size limits
    loadFileSizeLimits();
});

let currentSection = 1;
let maxSections = 4;
let selectedTags = [];
let selectedScreenshots = [];

function initializeUploadForm() {
    // Section navigation
    document.querySelectorAll('.next-section').forEach(btn => {
        btn.addEventListener('click', function() {
            const nextSection = parseInt(this.dataset.next);
            if (validateCurrentSection()) {
                goToSection(nextSection);
            }
        });
    });

    document.querySelectorAll('.prev-section').forEach(btn => {
        btn.addEventListener('click', function() {
            const prevSection = parseInt(this.dataset.prev);
            goToSection(prevSection);
        });
    });

    // Form submission
    document.getElementById('uploadForm').addEventListener('submit', handleFormSubmit);

    // File upload handlers
    initializeFileUploads();

    // Tags functionality
    initializeTagsInput();

    // Screenshots functionality
    initializeScreenshots();

    // Character counters
    initializeCharCounters();

    // Upload method toggle
    initializeUploadMethodToggle();

    // Generate initial screenshot slots
    generateScreenshotSlots();
}

async function loadFileSizeLimits() {
    try {
        const response = await fetch('/api/settings/public');
        const settings = await response.json();

        const maxFileSize = settings.max_file_size_mb || 1024;
        const maxThumbnailSize = settings.max_thumbnail_size_mb || 5;
        const maxScreenshotSize = settings.max_screenshot_size_mb || 5;

        // Update file size displays
        document.querySelectorAll('.upload-specs .spec-item').forEach(item => {
            if (item.textContent.includes('Max Loading...')) {
                item.innerHTML = `<i class="fas fa-weight-hanging"></i> Max ${maxFileSize}MB`;
            }
        });

        document.querySelectorAll('small').forEach(small => {
            if (small.textContent.includes('max Loading...')) {
                if (small.textContent.includes('thumbnail')) {
                    small.textContent = small.textContent.replace('max Loading...', `max ${maxThumbnailSize}MB`);
                } else {
                    small.textContent = small.textContent.replace('max Loading...', `max ${maxScreenshotSize}MB`);
                }
            }
        });

    } catch (error) {
        console.error('Failed to load file size limits:', error);
    }
}

function goToSection(sectionNumber) {
    // Hide all sections
    document.querySelectorAll('.form-section').forEach(section => {
        section.classList.remove('active');
    });

    // Show target section
    document.querySelector(`[data-section="${sectionNumber}"]`).classList.add('active');

    // Update steps
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active');
    });
    document.querySelector(`[data-step="${sectionNumber}"]`).classList.add('active');

    // Update progress
    const progress = (sectionNumber / maxSections) * 100;
    document.querySelector('.progress-fill').style.width = `${progress}%`;
    document.querySelector('.progress-text').textContent = `Step ${sectionNumber} of ${maxSections}`;

    currentSection = sectionNumber;

    // Update submission summary if on final section
    if (sectionNumber === 4) {
        console.log('Navigated to section 4, updating submission summary...');
        updateSubmissionSummary();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateCurrentSection() {
    const section = document.querySelector(`[data-section="${currentSection}"]`);
    const requiredFields = section.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('error');
            isValid = false;
        } else {
            field.classList.remove('error');
        }
    });

    // Special validation for section 2 (files)
    if (currentSection === 2) {
        const activeMethod = document.querySelector('.toggle-btn.active').dataset.method;
        if (activeMethod === 'file') {
            const modFile = document.getElementById('modFile').files[0];
            if (!modFile) {
                showNotification('Please select a mod file to upload', 'error');
                isValid = false;
            }
        } else if (activeMethod === 'url') {
            const externalUrl = document.getElementById('externalUrl').value.trim();
            if (!externalUrl) {
                showNotification('Please provide an external URL for your mod', 'error');
                isValid = false;
            }
        }
    }

    if (!isValid) {
        showNotification('Please fill in all required fields', 'error');
    }

    return isValid;
}

function initializeFileUploads() {
    // Mod file upload
    const modFileInput = document.getElementById('modFile');
    const fileUploadArea = document.getElementById('fileUploadArea');

    if (fileUploadArea) {
        fileUploadArea.addEventListener('click', () => modFileInput.click());
        fileUploadArea.addEventListener('dragover', handleDragOver);
        fileUploadArea.addEventListener('drop', (e) => handleFileDrop(e, modFileInput));
        fileUploadArea.addEventListener('dragleave', handleDragLeave);
    }

    if (modFileInput) {
        modFileInput.addEventListener('change', (e) => handleFileSelect(e, 'mod'));
    }

    // Thumbnail upload
    const thumbnailInput = document.getElementById('thumbnail');
    const thumbnailUploadArea = document.getElementById('thumbnailUploadArea');

    if (thumbnailUploadArea) {
        thumbnailUploadArea.addEventListener('click', () => thumbnailInput.click());
    }

    if (thumbnailInput) {
        thumbnailInput.addEventListener('change', (e) => handleFileSelect(e, 'thumbnail'));
    }

    // Remove thumbnail button
    document.addEventListener('click', function(e) {
        if (e.target.closest('.remove-thumbnail')) {
            removeThumbnail();
        }
    });
}

function initializeUploadMethodToggle() {
    // Use a timeout to ensure DOM is fully loaded
    setTimeout(() => {
        const toggleButtons = document.querySelectorAll('.toggle-btn');
        console.log('Found toggle buttons:', toggleButtons.length); // Debug log

        if (toggleButtons.length === 0) {
            console.warn('No toggle buttons found, retrying...');
            // Retry after a short delay
            setTimeout(initializeUploadMethodToggle, 500);
            return;
        }

        toggleButtons.forEach((btn, index) => {
            console.log(`Button ${index}:`, btn, 'data-method:', btn.dataset.method);

            // Add multiple event listeners to catch any issues
            btn.addEventListener('click', function(e) {
                e.preventDefault(); // Prevent form submission
                e.stopPropagation(); // Stop event bubbling

                const method = this.dataset.method;
                console.log('Toggle button clicked:', method); // Debug log

                // Update button states
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                // Show/hide upload methods
                const fileUploadMethod = document.getElementById('fileUploadMethod');
                const urlUploadMethod = document.getElementById('urlUploadMethod');

                console.log('fileUploadMethod:', fileUploadMethod);
                console.log('urlUploadMethod:', urlUploadMethod);

                if (fileUploadMethod && urlUploadMethod) {
                    fileUploadMethod.style.display = method === 'file' ? 'block' : 'none';
                    urlUploadMethod.style.display = method === 'url' ? 'block' : 'none';
                    console.log('Upload method toggled to:', method); // Debug log
                } else {
                    console.error('Upload method containers not found');
                }
            });

            // Also add mousedown as backup
            btn.addEventListener('mousedown', function() {
                console.log('Mousedown on toggle button:', this.dataset.method);
            });
        });
    }, 100);
}

function initializeTagsInput() {
    const tagsInput = document.getElementById('tags');

    if (tagsInput) {
        tagsInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTag(this.value.trim());
                this.value = '';
            }
        });
    }
}

function addTag(tagText) {
    if (!tagText || selectedTags.includes(tagText) || selectedTags.length >= 10) return;

    selectedTags.push(tagText);

    const tagElement = document.createElement('span');
    tagElement.className = 'tag-item';
    tagElement.innerHTML = `
        ${tagText}
        <button type="button" class="remove-tag" data-tag="${tagText}">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.getElementById('tagsContainer').appendChild(tagElement);

    // Add event listener to remove button
    tagElement.querySelector('.remove-tag').addEventListener('click', function() {
        removeTag(tagText);
    });
}

function removeTag(tagText) {
    selectedTags = selectedTags.filter(tag => tag !== tagText);

    // Remove from DOM
    const tagElements = document.querySelectorAll('.tag-item');
    tagElements.forEach(element => {
        if (element.textContent.trim().startsWith(tagText)) {
            element.remove();
        }
    });
}

function initializeScreenshots() {
    const screenshotInput = document.getElementById('screenshotInput');

    if (screenshotInput) {
        screenshotInput.addEventListener('change', handleScreenshotSelect);
    }
}

function generateScreenshotSlots() {
    const slotsContainer = document.getElementById('screenshotSlots');
    console.log('Screenshot slots container:', slotsContainer);

    if (!slotsContainer) {
        console.error('Screenshot slots container not found!');
        return;
    }

    const maxScreenshots = 5;

    for (let i = 0; i < maxScreenshots; i++) {
        const slot = document.createElement('div');
        slot.className = 'screenshot-slot';
        slot.innerHTML = `
            <div class="screenshot-placeholder">
                <i class="fas fa-plus"></i>
                <span>Add Screenshot</span>
            </div>
        `;

        slot.addEventListener('click', () => {
            console.log('Screenshot slot clicked');
            document.getElementById('screenshotInput').click();
        });

        slotsContainer.appendChild(slot);
    }

    console.log(`Generated ${maxScreenshots} screenshot slots`);
}

function initializeCharCounters() {
    document.querySelectorAll('textarea[maxlength]').forEach(textarea => {
        const counter = textarea.parentElement.querySelector('.char-count');
        if (counter) {
            updateCharCounter(textarea.id);
            textarea.addEventListener('input', () => updateCharCounter(textarea.id));
        }
    });
}

function updateCharCounter(textareaId) {
    const textarea = document.getElementById(textareaId);
    const counter = textarea.parentElement.querySelector('.char-count');
    if (counter) {
        counter.textContent = textarea.value.length;
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
}

function handleFileDrop(e, input) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        input.files = files;
        handleFileSelect({ target: input }, input.id === 'modFile' ? 'mod' : 'thumbnail');
    }
}

function handleFileSelect(e, type) {
    const file = e.target.files[0];
    if (!file) return;

    if (type === 'thumbnail') {
        displayThumbnailPreview(file);
    } else if (type === 'mod') {
        displayModFileInfo(file);
    }

    console.log(`Selected ${type} file:`, file.name);
}

function handleScreenshotSelect(e) {
    console.log('Screenshot selection triggered');
    const files = Array.from(e.target.files);
    console.log('Selected files:', files.length);

    files.forEach((file, index) => {
        console.log(`Processing file ${index}:`, file.name, file.type, file.size);
        if (selectedScreenshots.length < 5) {
            selectedScreenshots.push(file);
            displayScreenshotPreview(file);
            console.log(`Added screenshot ${selectedScreenshots.length - 1}:`, file.name);
        } else {
            console.log('Maximum screenshots reached, skipping file:', file.name);
        }
    });

    console.log('Total selected screenshots:', selectedScreenshots.length);

    // Update the submission summary if we're on the final section
    if (currentSection === 4) {
        updateSubmissionSummary();
    }

    // Clear the input so the same file can be selected again
    e.target.value = '';
}

function displayThumbnailPreview(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.querySelector('.thumbnail-preview');
        const placeholder = document.querySelector('.thumbnail-placeholder');

        preview.querySelector('img').src = e.target.result;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function displayModFileInfo(file) {
    const uploadArea = document.getElementById('fileUploadArea');
    const placeholder = uploadArea.querySelector('.upload-placeholder');

    // Create file info display
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    fileInfo.innerHTML = `
        <div class="file-icon">
            <i class="fas fa-file-archive"></i>
        </div>
        <div class="file-details">
            <div class="file-name">${file.name}</div>
            <div class="file-size">${(file.size / (1024 * 1024)).toFixed(2)} MB</div>
        </div>
        <button type="button" class="btn btn-sm btn-outline remove-file">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Replace placeholder with file info
    placeholder.style.display = 'none';
    uploadArea.appendChild(fileInfo);

    // Add remove functionality
    fileInfo.querySelector('.remove-file').addEventListener('click', function() {
        document.getElementById('modFile').value = '';
        fileInfo.remove();
        placeholder.style.display = 'block';
    });
}

function displayScreenshotPreview(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        // Find the first empty slot
        const emptySlot = document.querySelector('.screenshot-slot:not(.has-image)');
        if (emptySlot) {
            // Get the correct index for this screenshot
            const screenshotIndex = selectedScreenshots.length - 1;
            console.log(`Displaying screenshot preview for index ${screenshotIndex}:`, file.name);

            emptySlot.classList.add('has-image');
            emptySlot.dataset.screenshotIndex = screenshotIndex; // Store the index on the slot
            emptySlot.innerHTML = `
                <img src="${e.target.result}" alt="Screenshot preview">
                <div class="screenshot-overlay">
                    <button type="button" class="btn btn-sm btn-danger remove-screenshot" data-index="${screenshotIndex}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            // Add remove functionality
            emptySlot.querySelector('.remove-screenshot').addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                console.log(`Removing screenshot at index ${index}`);
                removeScreenshot(index, emptySlot);
            });
        } else {
            console.warn('No empty screenshot slot available');
        }
    };
    reader.readAsDataURL(file);
}

function removeScreenshot(index, slotElement) {
    console.log(`Removing screenshot at index ${index}, current array length: ${selectedScreenshots.length}`);

    // Remove from the array
    selectedScreenshots.splice(index, 1);
    console.log(`Screenshot removed, new array length: ${selectedScreenshots.length}`);

    // Reset the slot
    slotElement.classList.remove('has-image');
    slotElement.removeAttribute('data-screenshot-index');
    slotElement.innerHTML = `
        <div class="screenshot-placeholder">
            <i class="fas fa-plus"></i>
            <span>Add Screenshot</span>
        </div>
    `;

    // Re-add click listener
    slotElement.addEventListener('click', () => {
        console.log('Screenshot slot clicked after removal');
        document.getElementById('screenshotInput').click();
    });

    // Update indices for remaining screenshots
    updateScreenshotIndices();

    // Update the submission summary if we're on the final section
    if (currentSection === 4) {
        updateSubmissionSummary();
    }
}

function updateScreenshotIndices() {
    const screenshotSlots = document.querySelectorAll('.screenshot-slot.has-image');
    console.log(`Updating indices for ${screenshotSlots.length} screenshot slots`);

    screenshotSlots.forEach((slot, newIndex) => {
        slot.dataset.screenshotIndex = newIndex;
        const removeBtn = slot.querySelector('.remove-screenshot');
        if (removeBtn) {
            removeBtn.dataset.index = newIndex;
        }
    });
}

function removeThumbnail() {
    const preview = document.querySelector('.thumbnail-preview');
    const placeholder = document.querySelector('.thumbnail-placeholder');

    preview.style.display = 'none';
    placeholder.style.display = 'block';

    // Clear the input
    document.getElementById('thumbnail').value = '';
}

function updateSubmissionSummary() {
    console.log('Updating submission summary...');
    console.log('Current selectedScreenshots array:', selectedScreenshots);
    console.log('Screenshots count:', selectedScreenshots.length);

    const summaryContainer = document.getElementById('submissionSummary');
    const form = document.getElementById('uploadForm');

    const title = form.elements.title.value || 'Not specified';
    const category = form.elements.category_id.selectedOptions[0]?.text || 'Not selected';
    const version = form.elements.version.value || 'Not specified';
    const uploadMethod = document.querySelector('.toggle-btn.active').textContent.trim();
    const tagsCount = selectedTags.length;
    const screenshotsCount = selectedScreenshots.length;
    const isNSFW = form.elements.is_nsfw.checked ? 'Yes' : 'No';

    console.log('Summary data:', {
        title, category, version, uploadMethod, tagsCount, screenshotsCount, isNSFW
    });

    summaryContainer.innerHTML = `
        <div class="summary-item">
            <span class="summary-label">Title:</span>
            <span class="summary-value">${title}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Category:</span>
            <span class="summary-value">${category}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Version:</span>
            <span class="summary-value">${version}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Upload Method:</span>
            <span class="summary-value">${uploadMethod}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Tags:</span>
            <span class="summary-value">${tagsCount} tag(s)</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Screenshots:</span>
            <span class="summary-value">${screenshotsCount} image(s)</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">NSFW Content:</span>
            <span class="summary-value">${isNSFW}</span>
        </div>
    `;
}

async function handleFormSubmit(e) {
    e.preventDefault();

    if (!validateCurrentSection()) {
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    // Show loading state
    submitBtn.classList.add('btn-loading');
    submitBtn.innerHTML = '<span class="btn-text">Uploading...</span>';
    submitBtn.disabled = true;

    try {
        const formData = new FormData();
        const form = e.target;

        // Add basic form data
        formData.append('title', form.elements.title.value);
        formData.append('description', form.elements.description.value);
        formData.append('short_description', form.elements.short_description.value);
        formData.append('category_id', form.elements.category_id.value);
        formData.append('version', form.elements.version.value);
        formData.append('changelog', form.elements.changelog.value);
        formData.append('is_nsfw', form.elements.is_nsfw.checked);

        // Add tags
        formData.append('tags', JSON.stringify(selectedTags));

        // Add upload method and file/URL
        const activeMethod = document.querySelector('.toggle-btn.active').dataset.method;
        formData.append('uploadMethod', activeMethod);

        if (activeMethod === 'file' && form.elements.modFile.files[0]) {
            formData.append('modFile', form.elements.modFile.files[0]);
        } else if (activeMethod === 'url') {
            formData.append('externalUrl', form.elements.externalUrl.value);
        }

        // Add thumbnail if selected
        if (form.elements.thumbnail.files[0]) {
            formData.append('thumbnail', form.elements.thumbnail.files[0]);
        }

        // Add screenshots
        console.log(`Adding ${selectedScreenshots.length} screenshots to upload`);
        console.log('Selected screenshots array:', selectedScreenshots);

        selectedScreenshots.forEach((screenshot, index) => {
            console.log(`Adding screenshot ${index}:`, screenshot.name, screenshot.type, screenshot.size);
            formData.append(`screenshot_${index}`, screenshot);
        });

        // Debug: Log all FormData entries
        console.log('FormData entries:');
        for (let [key, value] of formData.entries()) {
            if (value instanceof File) {
                console.log(`${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
            } else {
                console.log(`${key}: ${value}`);
            }
        }

        const response = await fetch('/api/mods', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Mod uploaded successfully! Redirecting...', 'success');

            // Redirect to the mod page after a short delay
            setTimeout(() => {
                window.location.href = `/mod/${result.slug}`;
            }, 1500);
        } else {
            throw new Error(result.error || 'Failed to upload mod');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showNotification(`Failed to upload mod: ${error.message}`, 'error');
    } finally {
        // Reset button state
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function showNotification(message, type = 'info') {
    // Use existing notification system if available
    if (window.S && window.S.notify) {
        window.S.notify[type](message);
    } else {
        // Fallback to alert
        alert(message);
    }
}
