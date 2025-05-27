// Mod edit page functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the edit form
    initializeEditForm();

    // Load existing mod data
    loadModData();

    // Initialize file size limits
    loadFileSizeLimits();
});

let currentSection = 1;
let maxSections = 4;
let existingTags = [];
let removedScreenshots = [];
let selectedScreenshots = [];

function initializeEditForm() {
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
    document.getElementById('editForm').addEventListener('submit', handleFormSubmit);

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
}

function loadModData() {
    if (window.modData) {
        // Load existing tags
        if (window.modData.tags && Array.isArray(window.modData.tags)) {
            existingTags = [...window.modData.tags];
        }

        // Update character counters
        updateCharCounter('short_description');

        // Set upload method based on existing data
        if (window.modData.external_url) {
            document.querySelector('[data-method="url"]').click();
        }
    }
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

    if (!isValid) {
        if (window.S && window.S.notify) {
            window.S.notify.error('Please fill in all required fields');
        } else {
            alert('Please fill in all required fields');
        }
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
}

function initializeUploadMethodToggle() {
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const method = this.dataset.method;

            // Update button states
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Show/hide upload methods
            document.getElementById('fileUploadMethod').style.display = method === 'file' ? 'block' : 'none';
            document.getElementById('urlUploadMethod').style.display = method === 'url' ? 'block' : 'none';
        });
    });
}

function initializeTagsInput() {
    const tagsInput = document.getElementById('tags');
    const tagsContainer = document.getElementById('tagsContainer');

    if (tagsInput) {
        tagsInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTag(this.value.trim());
                this.value = '';
            }
        });
    }

    // Handle existing tag removal
    document.querySelectorAll('.remove-tag').forEach(btn => {
        btn.addEventListener('click', function() {
            const tag = this.dataset.tag;
            removeTag(tag);
        });
    });
}

function addTag(tagText) {
    if (!tagText || existingTags.includes(tagText)) return;

    existingTags.push(tagText);

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
    existingTags = existingTags.filter(tag => tag !== tagText);

    // Remove from DOM
    const tagElements = document.querySelectorAll('.tag-item');
    tagElements.forEach(element => {
        if (element.textContent.trim().startsWith(tagText)) {
            element.remove();
        }
    });
}

function initializeScreenshots() {
    // Handle current screenshot removal
    document.querySelectorAll('.remove-current-screenshot').forEach(btn => {
        btn.addEventListener('click', function() {
            const screenshot = this.dataset.screenshot;
            removeCurrentScreenshot(screenshot);
        });
    });

    // Initialize screenshot upload slots
    generateScreenshotSlots();

    // Handle screenshot file input
    const screenshotInput = document.getElementById('screenshotInput');
    if (screenshotInput) {
        screenshotInput.addEventListener('change', handleScreenshotSelect);
    }
}

function removeCurrentScreenshot(screenshotUrl) {
    if (!removedScreenshots.includes(screenshotUrl)) {
        removedScreenshots.push(screenshotUrl);
    }

    // Hide the screenshot element
    const screenshotElement = document.querySelector(`[data-screenshot="${screenshotUrl}"]`).closest('.current-screenshot-item');
    if (screenshotElement) {
        screenshotElement.style.display = 'none';
    }
}

function generateScreenshotSlots() {
    const slotsContainer = document.getElementById('screenshotSlots');
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
            document.getElementById('screenshotInput').click();
        });

        slotsContainer.appendChild(slot);
    }
}

function handleScreenshotSelect(e) {
    const files = Array.from(e.target.files);

    files.forEach(file => {
        if (selectedScreenshots.length < 5) {
            selectedScreenshots.push(file);
            displayScreenshotPreview(file);
        }
    });

    // Clear the input so the same file can be selected again
    e.target.value = '';
}

function displayScreenshotPreview(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        // Find the first empty slot
        const emptySlot = document.querySelector('.screenshot-slot:not(.has-image)');
        if (emptySlot) {
            emptySlot.classList.add('has-image');
            emptySlot.innerHTML = `
                <img src="${e.target.result}" alt="Screenshot preview">
                <div class="screenshot-overlay">
                    <button type="button" class="btn btn-sm btn-danger remove-screenshot" data-index="${selectedScreenshots.length - 1}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            // Add remove functionality
            emptySlot.querySelector('.remove-screenshot').addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                removeScreenshot(index, emptySlot);
            });
        }
    };
    reader.readAsDataURL(file);
}

function removeScreenshot(index, slotElement) {
    selectedScreenshots.splice(index, 1);

    // Reset the slot
    slotElement.classList.remove('has-image');
    slotElement.innerHTML = `
        <div class="screenshot-placeholder">
            <i class="fas fa-plus"></i>
            <span>Add Screenshot</span>
        </div>
    `;

    // Re-add click listener
    slotElement.addEventListener('click', () => {
        document.getElementById('screenshotInput').click();
    });
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
    }

    // You can add file validation here
    console.log(`Selected ${type} file:`, file.name);
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

async function handleFormSubmit(e) {
    e.preventDefault();

    if (!validateCurrentSection()) {
        return;
    }

    const formData = new FormData();
    const form = e.target;

    // Add basic form data
    formData.append('modId', form.modId.value);
    formData.append('title', form.title.value);
    formData.append('description', form.description.value);
    formData.append('short_description', form.short_description.value);
    formData.append('category_id', form.category_id.value);
    formData.append('version', form.version.value);
    formData.append('changelog', form.changelog.value);
    formData.append('is_nsfw', form.is_nsfw.checked);

    // Add tags
    formData.append('tags', JSON.stringify(existingTags));

    // Add removed screenshots
    formData.append('removedScreenshots', JSON.stringify(removedScreenshots));

    // Add files
    if (form.modFile.files[0]) {
        formData.append('modFile', form.modFile.files[0]);
    }

    if (form.thumbnail.files[0]) {
        formData.append('thumbnail', form.thumbnail.files[0]);
    }

    // Add new screenshots
    console.log(`Adding ${selectedScreenshots.length} new screenshots to mod edit`);
    selectedScreenshots.forEach((screenshot, index) => {
        console.log(`Adding screenshot ${index}:`, screenshot.name, screenshot.size);
        formData.append(`screenshot_${index}`, screenshot);
    });

    // Add external URL if using URL method
    const activeMethod = document.querySelector('.toggle-btn.active').dataset.method;
    if (activeMethod === 'url') {
        formData.append('externalUrl', form.externalUrl.value);
    }

    try {
        const response = await fetch(`/api/user/mods/${form.modId.value}`, {
            method: 'PATCH',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            if (window.S && window.S.notify) {
                window.S.notify.success('Mod updated successfully!');
            } else {
                alert('Mod updated successfully!');
            }

            // Redirect to mod page
            setTimeout(() => {
                window.location.href = `/mod/${window.modData.slug}`;
            }, 1500);
        } else {
            throw new Error(result.error || 'Failed to update mod');
        }
    } catch (error) {
        console.error('Update error:', error);
        if (window.S && window.S.notify) {
            window.S.notify.error(`Failed to update mod: ${error.message}`);
        } else {
            alert(`Failed to update mod: ${error.message}`);
        }
    }
}
