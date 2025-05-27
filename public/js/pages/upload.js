// Upload page functionality

let currentStep = 1;
let currentScreenshotIndex = 0;
let screenshots = [];
let tags = [];

// Initialize upload page event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Initialize wizard to step 1
    initializeWizard();
    initializeStepNavigation();
    initializeFormValidation();
    initializeFileUploads();
    initializeTagsInput();
    initializeScreenshots();
    initializeCharacterCounters();
    initializeFormSubmission();

    // Load and update file size limit display
    updateFileSizeLimitDisplay();
});

// Initialize wizard state
function initializeWizard() {
    console.log('Initializing upload wizard...');

    // Ensure only step 1 is visible on load
    const allSections = document.querySelectorAll('.form-section');
    console.log('Found', allSections.length, 'form sections');

    allSections.forEach((section, index) => {
        section.classList.remove('active');
        console.log(`Section ${index + 1} (data-section="${section.dataset.section}") - active class removed`);
    });

    // Show step 1
    const firstSection = document.querySelector('[data-section="1"]');
    if (firstSection) {
        firstSection.classList.add('active');
        console.log('Step 1 section found and activated');
    } else {
        console.error('Step 1 section not found!');
    }

    // Set step indicators
    const stepIndicators = document.querySelectorAll('.upload-steps .step');
    console.log('Found', stepIndicators.length, 'step indicators');

    stepIndicators.forEach((step, index) => {
        step.classList.toggle('active', index === 0);
    });

    // Set progress bar
    const progressFill = document.querySelector('.form-progress .progress-fill');
    const progressText = document.querySelector('.form-progress .progress-text');
    if (progressFill && progressText) {
        progressFill.style.width = '25%';
        progressText.textContent = 'Step 1 of 4';
        console.log('Progress bar initialized');
    } else {
        console.error('Progress bar elements not found');
    }

    currentStep = 1;
    console.log('Wizard initialization complete - current step:', currentStep);
}

// Step navigation
function initializeStepNavigation() {
    // Next/Previous buttons
    document.querySelectorAll('.next-section').forEach(btn => {
        btn.addEventListener('click', function() {
            const nextStep = parseInt(this.dataset.next);
            if (validateCurrentStep()) {
                goToStep(nextStep);
            }
        });
    });

    document.querySelectorAll('.prev-section').forEach(btn => {
        btn.addEventListener('click', function() {
            const prevStep = parseInt(this.dataset.prev);
            goToStep(prevStep);
        });
    });

    // Step indicator clicks
    document.querySelectorAll('.upload-steps .step').forEach(step => {
        step.addEventListener('click', function() {
            const stepNumber = parseInt(this.dataset.step);
            if (stepNumber <= currentStep || validateStepsUpTo(stepNumber - 1)) {
                goToStep(stepNumber);
            }
        });
    });
}

function goToStep(step) {
    console.log(`Going to step ${step} from step ${currentStep}`);

    // Hide current section
    document.querySelectorAll('.form-section').forEach(section => {
        section.classList.remove('active');
    });

    // Show target section
    const targetSection = document.querySelector(`[data-section="${step}"]`);
    if (targetSection) {
        targetSection.classList.add('active');
        console.log(`Step ${step} section activated`);
    } else {
        console.error(`Step ${step} section not found!`);
    }

    // Update step indicators
    document.querySelectorAll('.upload-steps .step').forEach((stepEl, index) => {
        stepEl.classList.toggle('active', index + 1 === step);
    });

    // Update progress bar
    const progressFill = document.querySelector('.form-progress .progress-fill');
    const progressText = document.querySelector('.form-progress .progress-text');
    if (progressFill && progressText) {
        const percentage = (step / 4) * 100;
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `Step ${step} of 4`;
        console.log(`Progress updated to ${percentage}%`);
    }

    currentStep = step;

    // Update review section if on final step
    if (step === 4) {
        updateReviewSection();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    console.log(`Successfully navigated to step ${step}`);
}

function validateCurrentStep() {
    switch (currentStep) {
        case 1:
            return validateBasicInfo();
        case 2:
            return validateFileUpload();
        case 3:
            return validateAdditionalInfo();
        default:
            return true;
    }
}

function validateStepsUpTo(step) {
    for (let i = 1; i <= step; i++) {
        currentStep = i;
        if (!validateCurrentStep()) {
            return false;
        }
    }
    return true;
}

function validateBasicInfo() {
    const title = document.getElementById('title').value.trim();
    const category = document.getElementById('category_id').value;
    const shortDesc = document.getElementById('short_description').value.trim();
    const description = document.getElementById('description').value.trim();

    if (!title || !category || !shortDesc || !description) {
        showNotification('Please fill in all required fields in the basic information section.', 'error');
        return false;
    }

    if (shortDesc.length > 500) {
        showNotification('Short description must be 500 characters or less.', 'error');
        return false;
    }

    return true;
}

function validateFileUpload() {
    const modFile = document.getElementById('modFile').files[0];
    const version = document.getElementById('version').value.trim();

    if (!modFile) {
        showNotification('Please select a mod file to upload.', 'error');
        return false;
    }

    if (!version) {
        showNotification('Please enter a version number.', 'error');
        return false;
    }

    return true;
}

function validateAdditionalInfo() {
    // Additional info is optional, so always return true
    return true;
}

// Form validation
function initializeFormValidation() {
    // Real-time validation for inputs
    const inputs = document.querySelectorAll('input[required], textarea[required], select[required]');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });

        input.addEventListener('input', function() {
            if (this.classList.contains('invalid')) {
                validateField(this);
            }
        });
    });
}

function validateField(field) {
    const wrapper = field.closest('.input-wrapper') || field.closest('.textarea-wrapper');
    const feedback = wrapper?.querySelector('.input-feedback');

    if (!field.value.trim() && field.hasAttribute('required')) {
        field.classList.add('invalid');
        field.classList.remove('valid');
        if (feedback) {
            feedback.innerHTML = '<i class="fas fa-times"></i>';
            feedback.className = 'input-feedback invalid';
        }
        return false;
    } else {
        field.classList.remove('invalid');
        field.classList.add('valid');
        if (feedback) {
            feedback.innerHTML = '<i class="fas fa-check"></i>';
            feedback.className = 'input-feedback valid';
        }
        return true;
    }
}

// File uploads
function initializeFileUploads() {
    // Main mod file upload
    const fileUploadArea = document.getElementById('fileUploadArea');
    const modFileInput = document.getElementById('modFile');

    if (fileUploadArea && modFileInput) {
        fileUploadArea.addEventListener('click', () => modFileInput.click());

        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('drag-over');
        });

        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('drag-over');
        });

        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('drag-over');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                modFileInput.files = files;
                handleFileSelect(files[0]);
            }
        });

        modFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });
    }

    // Thumbnail upload
    const thumbnailUploadArea = document.getElementById('thumbnailUploadArea');
    const thumbnailInput = document.getElementById('thumbnail');

    if (thumbnailUploadArea && thumbnailInput) {
        thumbnailUploadArea.addEventListener('click', () => thumbnailInput.click());

        thumbnailInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleThumbnailSelect(e.target.files[0]);
            }
        });
    }
}

async function handleFileSelect(file) {
    const fileUploadArea = document.getElementById('fileUploadArea');
    const placeholder = fileUploadArea.querySelector('.upload-placeholder');

    // Get dynamic file size limit from server
    let maxSizeMB = 100; // Default fallback
    try {
        const response = await fetch('/api/settings/public');
        if (response.ok) {
            const settings = await response.json();
            maxSizeMB = settings.max_file_size_mb || 100;
        }
    } catch (error) {
        console.warn('Could not fetch file size limit, using default 100MB');
    }

    const maxSize = maxSizeMB * 1024 * 1024;

    if (file.size > maxSize) {
        showNotification(`File size must be less than ${maxSizeMB}MB`, 'error');
        return;
    }

    // Validate file type
    const allowedExtensions = ['.zip', '.rar', '.7z'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!allowedExtensions.includes(fileExtension)) {
        showNotification('Please select a valid mod file (.zip, .rar, or .7z)', 'error');
        return;
    }

    // Update UI to show selected file
    fileUploadArea.classList.add('file-selected');
    placeholder.innerHTML = `
        <div class="upload-icon">
            <i class="fas fa-file-archive"></i>
        </div>
        <div class="upload-text">
            <h3>${file.name}</h3>
            <p>Size: ${formatFileSize(file.size)}</p>
        </div>
        <button type="button" class="remove-file-btn" onclick="clearFileSelection()">
            <i class="fas fa-times"></i> Remove File
        </button>
    `;
}

function handleThumbnailSelect(file) {
    const thumbnailUploadArea = document.getElementById('thumbnailUploadArea');
    const placeholder = thumbnailUploadArea.querySelector('.thumbnail-placeholder');
    const preview = thumbnailUploadArea.querySelector('.thumbnail-preview');

    if (file.size > 5 * 1024 * 1024) { // 5MB limit for images
        showNotification('Thumbnail image must be less than 5MB', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        placeholder.style.display = 'none';
        preview.style.display = 'block';
        preview.querySelector('img').src = e.target.result;
    };
    reader.readAsDataURL(file);

    // Add remove thumbnail functionality
    const removeBtn = preview.querySelector('.remove-thumbnail');
    removeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        clearThumbnailSelection();
    });
}

function clearThumbnailSelection() {
    const thumbnailUploadArea = document.getElementById('thumbnailUploadArea');
    const thumbnailInput = document.getElementById('thumbnail');
    const placeholder = thumbnailUploadArea.querySelector('.thumbnail-placeholder');
    const preview = thumbnailUploadArea.querySelector('.thumbnail-preview');

    thumbnailInput.value = '';
    placeholder.style.display = 'block';
    preview.style.display = 'none';
}

function clearFileSelection() {
    const fileUploadArea = document.getElementById('fileUploadArea');
    const modFileInput = document.getElementById('modFile');
    const placeholder = fileUploadArea.querySelector('.upload-placeholder');

    // Clear the file input
    modFileInput.value = '';

    // Remove the file-selected class
    fileUploadArea.classList.remove('file-selected');

    // Reset the placeholder content with dynamic file size limit
    updateFileSizeLimitDisplay();
}

// Tags input
function initializeTagsInput() {
    const tagsInput = document.getElementById('tags');
    const tagsContainer = document.getElementById('tagsContainer');

    if (tagsInput && tagsContainer) {
        tagsInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTag(this.value.trim());
                this.value = '';
            }
        });

        tagsInput.addEventListener('blur', function() {
            if (this.value.trim()) {
                addTag(this.value.trim());
                this.value = '';
            }
        });
    }
}

function addTag(tagText) {
    if (!tagText || tags.includes(tagText.toLowerCase()) || tags.length >= 10) {
        return;
    }

    tags.push(tagText.toLowerCase());
    updateTagsDisplay();
}

function removeTag(tagText) {
    const index = tags.indexOf(tagText.toLowerCase());
    if (index > -1) {
        tags.splice(index, 1);
        updateTagsDisplay();
    }
}

function updateTagsDisplay() {
    const tagsContainer = document.getElementById('tagsContainer');
    if (!tagsContainer) return;

    tagsContainer.innerHTML = tags.map(tag => `
        <div class="tag-item">
            ${tag}
            <button type="button" class="remove-tag" onclick="removeTag('${tag}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

// Screenshots
function initializeScreenshots() {
    updateScreenshotSlots();

    const screenshotInput = document.getElementById('screenshotInput');
    if (screenshotInput) {
        screenshotInput.addEventListener('change', function() {
            handleScreenshots(this.files);
        });
    }
}

function handleScreenshots(files) {
    Array.from(files).forEach((file, index) => {
        if (screenshots.length >= 5) return;

        if (file.size > 5 * 1024 * 1024) {
            showNotification(`Screenshot ${file.name} is too large (max 5MB)`, 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            screenshots.push(e.target.result);
            updateScreenshotSlots();
        };
        reader.readAsDataURL(file);
    });
}

function updateScreenshotSlots() {
    const container = document.getElementById('screenshotSlots');
    if (!container) return;

    container.innerHTML = '';

    // Add existing screenshots
    screenshots.forEach((screenshot, index) => {
        if (screenshot) {
            const slot = document.createElement('div');
            slot.className = 'screenshot-slot';
            slot.innerHTML = `
                <img src="${screenshot}" alt="Screenshot ${index + 1}">
                <div class="screenshot-overlay">
                    <button type="button" class="remove-screenshot-btn" data-index="${index}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            const removeBtn = slot.querySelector('.remove-screenshot-btn');
            removeBtn.addEventListener('click', function() {
                removeScreenshot(parseInt(this.dataset.index));
            });

            container.appendChild(slot);
        }
    });

    // Add empty slots up to 5 total
    for (let i = screenshots.length; i < 5; i++) {
        const slot = document.createElement('div');
        slot.className = 'screenshot-slot';
        slot.innerHTML = `
            <i class="fas fa-plus"></i>
            <span>Add Screenshot</span>
        `;

        slot.addEventListener('click', function() {
            document.getElementById('screenshotInput').click();
        });

        container.appendChild(slot);
    }
}

function removeScreenshot(index) {
    screenshots.splice(index, 1);
    updateScreenshotSlots();
}

// Character counters
function initializeCharacterCounters() {
    const shortDescInput = document.getElementById('short_description');
    if (shortDescInput) {
        const updateCounter = () => {
            const counter = shortDescInput.closest('.textarea-wrapper').querySelector('.char-counter .char-count');
            if (counter) {
                counter.textContent = shortDescInput.value.length;
            }
        };

        shortDescInput.addEventListener('input', updateCounter);
        updateCounter(); // Initialize
    }
}

// Form submission
function initializeFormSubmission() {
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleFormSubmission);
    }

    // Save draft button
    const saveDraftBtn = document.querySelector('.save-draft-btn');
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', saveDraft);
    }
}

// Review section
function updateReviewSection() {
    const summaryContainer = document.getElementById('submissionSummary');
    if (!summaryContainer) return;

    const title = document.getElementById('title').value || 'Not specified';
    const category = document.getElementById('category_id').selectedOptions[0]?.text || 'Not specified';
    const shortDesc = document.getElementById('short_description').value || 'Not specified';
    const version = document.getElementById('version').value || 'Not specified';
    const modFile = document.getElementById('modFile').files[0];
    const thumbnail = document.getElementById('thumbnail').files[0];
    const changelog = document.getElementById('changelog').value || 'None';
    const isNsfw = document.getElementById('is_nsfw').checked;

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
            <span class="summary-label">Short Description:</span>
            <span class="summary-value">${shortDesc.substring(0, 100)}${shortDesc.length > 100 ? '...' : ''}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Mod File:</span>
            <span class="summary-value">${modFile ? `${modFile.name} (${formatFileSize(modFile.size)})` : 'Not selected'}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Thumbnail:</span>
            <span class="summary-value">${thumbnail ? thumbnail.name : 'None'}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Tags:</span>
            <span class="summary-value">${tags.length > 0 ? tags.join(', ') : 'None'}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Screenshots:</span>
            <span class="summary-value">${screenshots.length} uploaded</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Changelog:</span>
            <span class="summary-value">${changelog.substring(0, 100)}${changelog.length > 100 ? '...' : ''}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Content Rating:</span>
            <span class="summary-value">${isNsfw ? 'Mature/NSFW' : 'General Audience'}</span>
        </div>
    `;
}

// Form submission handler
async function handleFormSubmission(e) {
    e.preventDefault();

    if (!validateStepsUpTo(4)) {
        showNotification('Please complete all required fields before submitting.', 'error');
        return;
    }

    const form = e.target;
    const formData = new FormData(form);
    const submitBtn = form.querySelector('button[type="submit"]');

    // Add tags as JSON
    if (tags.length > 0) {
        formData.set('tags', JSON.stringify(tags));
    } else {
        formData.delete('tags');
    }

    try {
        submitBtn.classList.add('btn-loading');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

        const response = await fetch('/api/mods', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            if (result.errors && Array.isArray(result.errors)) {
                const errorMessages = result.errors.map(err => err.msg).join(', ');
                throw new Error(`Validation errors: ${errorMessages}`);
            }
            throw new Error(result.error || 'Upload failed');
        }

        showNotification('Mod uploaded successfully! It will be reviewed before being published.', 'success');

        setTimeout(() => {
            window.location.href = `/mod/${result.slug}`;
        }, 2000);

    } catch (error) {
        showNotification(error.message || 'Upload failed. Please try again.', 'error');
    } finally {
        submitBtn.classList.remove('btn-loading');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Mod';
    }
}

function saveDraft() {
    showNotification('Draft functionality coming soon!', 'info');
}

// Update file size limit display
async function updateFileSizeLimitDisplay() {
    const fileUploadArea = document.getElementById('fileUploadArea');
    const placeholder = fileUploadArea?.querySelector('.upload-placeholder');

    if (!placeholder) return;

    // Get dynamic file size limit from server
    let maxSizeMB = 100; // Default fallback
    try {
        const response = await fetch('/api/settings/public');
        if (response.ok) {
            const settings = await response.json();
            maxSizeMB = settings.max_file_size_mb || 100;
        }
    } catch (error) {
        console.warn('Could not fetch file size limit, using default 100MB');
    }

    // Update the placeholder content with the correct file size limit
    placeholder.innerHTML = `
        <div class="upload-icon">
            <i class="fas fa-cloud-upload-alt"></i>
        </div>
        <div class="upload-text">
            <h3>Drop your mod file here</h3>
            <p>or <span class="upload-link">click to browse</span></p>
            <div class="upload-specs">
                <span class="spec-item"><i class="fas fa-file-archive"></i> ZIP, RAR, 7Z</span>
                <span class="spec-item"><i class="fas fa-weight-hanging"></i> Max ${maxSizeMB}MB</span>
            </div>
        </div>
    `;
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showNotification(message, type = 'info') {
    if (window.S && window.S.notify) {
        window.S.notify[type](message);
    } else {
        alert(message);
    }
}
