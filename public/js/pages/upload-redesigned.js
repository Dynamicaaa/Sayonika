// Redesigned Upload Page JavaScript
let currentStep = 1;
let maxSizeMB = 500;
let maxThumbnailSizeMB = 10;
let uploadedFiles = {};
let tags = [];

// Initialize upload page
document.addEventListener('DOMContentLoaded', function() {
    console.log('[Upload] Initializing redesigned upload page...');
    
    initializeStepNavigation();
    initializeFileUploads();
    initializeFormValidation();
    initializeTagsInput();
    initializeCharacterCounters();
    loadFileSizeLimits();
    
    console.log('[Upload] Redesigned upload page initialized');
});

// Step Navigation
function initializeStepNavigation() {
    // Progress step clicks
    document.querySelectorAll('.progress-step').forEach(step => {
        step.addEventListener('click', function() {
            const stepNumber = parseInt(this.dataset.step);
            if (stepNumber <= currentStep || validateStepsUpTo(stepNumber - 1)) {
                goToStep(stepNumber);
            }
        });
    });

    // Next/Previous buttons
    document.querySelectorAll('.next-step').forEach(btn => {
        btn.addEventListener('click', function() {
            const nextStep = parseInt(this.dataset.next);
            if (validateCurrentStep()) {
                goToStep(nextStep);
            }
        });
    });

    document.querySelectorAll('.prev-step').forEach(btn => {
        btn.addEventListener('click', function() {
            const prevStep = parseInt(this.dataset.prev);
            goToStep(prevStep);
        });
    });
}

// Go to specific step
function goToStep(step) {
    console.log(`[Upload] Going to step ${step}`);
    
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(stepEl => {
        stepEl.classList.remove('active');
    });
    
    // Show target step
    const targetStep = document.querySelector(`[data-step="${step}"]`);
    if (targetStep) {
        targetStep.classList.add('active');
    }
    
    // Update progress
    updateProgress(step);
    
    // Update current step
    currentStep = step;
}

// Update progress indicator
function updateProgress(step) {
    const percentage = (step / 4) * 100;
    
    // Update progress bar
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
    
    // Update step indicators
    document.querySelectorAll('.progress-step').forEach((stepEl, index) => {
        stepEl.classList.toggle('active', index + 1 === step);
    });
}

// File Upload Handling
function initializeFileUploads() {
    // Mod file upload
    const modFileUpload = document.getElementById('modFileUpload');
    const modFileInput = document.getElementById('modFile');
    
    if (modFileUpload && modFileInput) {
        setupFileUpload(modFileUpload, modFileInput, 'mod');
    }
    
    // Thumbnail upload
    const thumbnailUpload = document.getElementById('thumbnailUpload');
    const thumbnailInput = document.getElementById('thumbnail');
    
    if (thumbnailUpload && thumbnailInput) {
        setupThumbnailUpload(thumbnailUpload, thumbnailInput);
    }
}

// Setup file upload area
function setupFileUpload(uploadArea, fileInput, type) {
    // Click to browse
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFileSelect(e.target.files[0], type, uploadArea);
    });
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0], type, uploadArea);
        }
    });
}

// Handle file selection
function handleFileSelect(file, type, uploadArea) {
    if (!file) return;
    
    console.log(`[Upload] File selected: ${file.name} (${file.size} bytes)`);
    
    // Validate file size
    const maxSize = type === 'mod' ? maxSizeMB : maxThumbnailSizeMB;
    if (file.size > maxSize * 1024 * 1024) {
        showError(`File size exceeds the maximum limit of ${maxSize}MB`);
        return;
    }
    
    // Store file
    uploadedFiles[type] = file;
    
    // Update UI
    updateFileUploadUI(uploadArea, file, type);
}

// Update file upload UI
function updateFileUploadUI(uploadArea, file, type) {
    const uploadZone = uploadArea.querySelector('.upload-zone');
    const fileInfo = uploadArea.querySelector('.file-info');
    
    if (uploadZone) uploadZone.style.display = 'none';
    if (fileInfo) {
        fileInfo.style.display = 'flex';
        
        const fileName = fileInfo.querySelector('.file-name');
        const fileSize = fileInfo.querySelector('.file-size');
        
        if (fileName) fileName.textContent = file.name;
        if (fileSize) fileSize.textContent = formatFileSize(file.size);
        
        // Remove file button
        const removeBtn = fileInfo.querySelector('.remove-file');
        if (removeBtn) {
            removeBtn.onclick = () => removeFile(type, uploadArea);
        }
    }
}

// Remove file
function removeFile(type, uploadArea) {
    delete uploadedFiles[type];
    
    const uploadZone = uploadArea.querySelector('.upload-zone');
    const fileInfo = uploadArea.querySelector('.file-info');
    
    if (uploadZone) uploadZone.style.display = 'block';
    if (fileInfo) fileInfo.style.display = 'none';
    
    // Clear file input
    const fileInput = uploadArea.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
}

// Setup thumbnail upload
function setupThumbnailUpload(uploadArea, fileInput) {
    const thumbnailZone = uploadArea.querySelector('.thumbnail-zone');
    
    thumbnailZone.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleThumbnailSelect(file, uploadArea);
        }
    });
}

// Handle thumbnail selection
function handleThumbnailSelect(file, uploadArea) {
    if (file.size > maxThumbnailSizeMB * 1024 * 1024) {
        showError(`Thumbnail size exceeds the maximum limit of ${maxThumbnailSizeMB}MB`);
        return;
    }
    
    uploadedFiles.thumbnail = file;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        const thumbnailZone = uploadArea.querySelector('.thumbnail-zone');
        thumbnailZone.innerHTML = `
            <img src="${e.target.result}" alt="Thumbnail preview" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">
        `;
    };
    reader.readAsDataURL(file);
}

// Tags Input
function initializeTagsInput() {
    const tagsInput = document.getElementById('tagsInput');
    const tagsContainer = document.getElementById('tagsContainer');
    
    if (!tagsInput || !tagsContainer) return;
    
    tagsInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(tagsInput.value.trim());
            tagsInput.value = '';
        }
    });
}

// Add tag
function addTag(tagText) {
    if (!tagText || tags.includes(tagText)) return;
    
    tags.push(tagText);
    renderTags();
}

// Remove tag
function removeTag(tagText) {
    tags = tags.filter(tag => tag !== tagText);
    renderTags();
}

// Render tags
function renderTags() {
    const tagsContainer = document.getElementById('tagsContainer');
    if (!tagsContainer) return;
    
    tagsContainer.innerHTML = tags.map(tag => `
        <div class="tag-item">
            <span>${tag}</span>
            <button type="button" class="remove-tag" onclick="removeTag('${tag}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

// Character Counters
function initializeCharacterCounters() {
    const shortDesc = document.getElementById('short_description');
    if (shortDesc) {
        const counter = shortDesc.parentElement.querySelector('.char-count');
        if (counter) {
            shortDesc.addEventListener('input', () => {
                counter.textContent = shortDesc.value.length;
            });
        }
    }
}

// Form Validation
function initializeFormValidation() {
    const form = document.getElementById('uploadForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
}

// Validate current step
function validateCurrentStep() {
    switch (currentStep) {
        case 1:
            return validateBasicInfo();
        case 2:
            return validateFiles();
        case 3:
            return validateDetails();
        case 4:
            return validateReview();
        default:
            return true;
    }
}

// Validate basic info
function validateBasicInfo() {
    const title = document.getElementById('title').value.trim();
    const category = document.getElementById('category_id').value;
    const shortDesc = document.getElementById('short_description').value.trim();
    const description = document.getElementById('description').value.trim();
    
    if (!title || !category || !shortDesc || !description) {
        showError('Please fill in all required fields');
        return false;
    }
    
    return true;
}

// Validate files
function validateFiles() {
    if (!uploadedFiles.mod) {
        showError('Please upload a mod file');
        return false;
    }
    
    return true;
}

// Validate details
function validateDetails() {
    const version = document.getElementById('version').value.trim();
    
    if (!version) {
        showError('Please enter a version number');
        return false;
    }
    
    return true;
}

// Validate review
function validateReview() {
    const terms = document.getElementById('terms').checked;
    
    if (!terms) {
        showError('Please agree to the terms and conditions');
        return false;
    }
    
    return true;
}

// Load file size limits
async function loadFileSizeLimits() {
    try {
        const response = await fetch('/api/settings/public');
        const settings = await response.json();
        
        maxSizeMB = settings.max_file_size_mb;
        maxThumbnailSizeMB = settings.max_thumbnail_size_mb;
        
        // Update UI hints
        const fileSizeHint = document.getElementById('fileSizeHint');
        if (fileSizeHint) {
            fileSizeHint.textContent = `Maximum file size: ${maxSizeMB}MB`;
        }
        
        console.log(`[Upload] File size limits loaded: ${maxSizeMB}MB mod, ${maxThumbnailSizeMB}MB thumbnail`);
    } catch (error) {
        console.error('[Upload] Error loading file size limits:', error);
    }
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showError(message) {
    // You can implement a toast notification system here
    alert(message);
}

function showSuccess(message) {
    // You can implement a toast notification system here
    alert(message);
}

// Form submission
function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!validateCurrentStep()) {
        return;
    }
    
    // Create FormData
    const formData = new FormData();
    
    // Add form fields
    const formElements = e.target.elements;
    for (let element of formElements) {
        if (element.name && element.type !== 'file') {
            if (element.type === 'checkbox') {
                formData.append(element.name, element.checked);
            } else {
                formData.append(element.name, element.value);
            }
        }
    }
    
    // Add files
    if (uploadedFiles.mod) {
        formData.append('modFile', uploadedFiles.mod);
    }
    if (uploadedFiles.thumbnail) {
        formData.append('thumbnail', uploadedFiles.thumbnail);
    }
    
    // Add tags
    formData.append('tags', tags.join(','));
    
    // Submit form
    submitForm(formData);
}

// Submit form to server
async function submitForm(formData) {
    try {
        console.log('[Upload] Submitting form...');
        
        const response = await fetch('/api/mods', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess('Mod uploaded successfully!');
            window.location.href = `/mod/${result.id}`;
        } else {
            showError(result.error || 'Upload failed');
        }
    } catch (error) {
        console.error('[Upload] Submit error:', error);
        showError('Upload failed. Please try again.');
    }
}
