// Phone number formatting
document.getElementById('phone').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    // Limit to 11 digits
    value = value.slice(0, 11);
    e.target.value = value;
});

// Phone validation and formatting
document.getElementById('phone').addEventListener('blur', function(e) {
    let cleaned = e.target.value.replace(/\D/g, '');
    if (cleaned) {
        if (cleaned.length === 10) {
            cleaned = '0' + cleaned;
        } else if (cleaned.length === 11) {
            if (!cleaned.startsWith('09')) {
                if (cleaned.startsWith('0')) {
                    cleaned = '09' + cleaned.slice(1);
                } else {
                    cleaned = '09' + cleaned.slice(0, 8);
                }
            }
        } else {
            alert('Please enter a valid 11-digit Philippines phone number');
            return;
        }
        e.target.value = cleaned;
    }
});

// Form submit validation
document.getElementById('profileForm').addEventListener('submit', function(e) {
    const phoneValue = document.getElementById('phone').value.replace(/\D/g, '');
    if (phoneValue && phoneValue.length !== 11) {
        alert('Please enter a valid 11-digit Philippines phone number');
        e.preventDefault();
        document.getElementById('phone').focus();
        return false;
    }
});

// Form handling - profile form now submits via POST

document.getElementById('passwordForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match!');
        return;
    }

    if (newPassword.length < 6) {
        alert('Password must be at least 6 characters long!');
        return;
    }

    // Add password change logic here
    alert('Password changed successfully!');
    document.getElementById('passwordForm').reset();
});

// Function to apply dark mode
function applyDarkMode(enabled) {
    if (enabled) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
}

// Function to update checkbox state
function updateCheckbox(checkboxId, enabled) {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
        checkbox.checked = enabled;
    }
}

// Preference handling
document.querySelectorAll('.toggle-switch input').forEach(toggle => {
    toggle.addEventListener('change', function() {
        // For dark mode, apply immediately
        if (this.id === 'darkMode') {
            applyDarkMode(this.checked);
        }
        savePreferences();
    });
});

// Number input handling for admin low stock alert range
const lowStockInput = document.getElementById('lowStockAlertRange');
if (lowStockInput) {
    lowStockInput.addEventListener('change', function() {
        savePreferences();
    });
}

// Load saved preferences - now done server-side in template

// Function to save preferences to server
async function savePreferences() {
    try {
        const preferences = {};

        // Get toggle values
        document.querySelectorAll('.toggle-switch input').forEach(toggle => {
            preferences[toggle.id] = toggle.checked;
        });

        // Get number input if exists (admin only)
        const lowStockRange = document.getElementById('lowStockAlertRange');
        if (lowStockRange) {
            preferences.lowStockAlertRange = parseInt(lowStockRange.value);
        }

        // Determine if admin or staff
        const isAdmin = window.location.pathname.startsWith('/admin');

        const response = await fetch(`${isAdmin ? '/admin' : '/staff'}/settings/preferences`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(preferences)
        });

        const result = await response.json();
        if (result.success) {
            console.log('Preferences saved successfully');
        } else {
            console.error('Failed to save preferences:', result.message);
        }
    } catch (error) {
        console.error('Error saving preferences:', error);
    }
}

// Quick actions
function exportSettings() {
    const settings = {
        soundEnabled: document.getElementById('soundEnabled').checked,
        printReceipts: document.getElementById('printReceipts').checked,
        darkMode: document.getElementById('darkMode').checked,
        orderConfirmations: document.getElementById('orderConfirmations').checked
    };

    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'staff-settings.json';
    link.click();
    URL.revokeObjectURL(url);
}

function resetSettings() {
    showConfirm('Are you sure you want to reset all settings to default?', 'Reset Settings',
        () => {
            document.querySelectorAll('.toggle-switch input').forEach(toggle => {
                toggle.checked = toggle.id === 'soundEnabled' || toggle.id === 'orderConfirmations';
                localStorage.removeItem(toggle.id);
            });
            alert('Settings reset to default!');
        }
    );
}

function logoutAllDevices() {
    showConfirm('Are you sure you want to logout from all devices? You will need to login again.', 'Logout All Devices',
        () => {
            // Add logout logic here
            alert('Logged out from all devices!');
        }
    );
}

// Password visibility toggle for account creation form
const passwordToggle = document.getElementById('passwordToggle');
const accountPassword = document.getElementById('accountPassword');
const passwordIcon = document.getElementById('passwordIcon');

if (passwordToggle && accountPassword && passwordIcon) {
    passwordToggle.addEventListener('click', function() {
        const isPassword = accountPassword.type === 'password';
        accountPassword.type = isPassword ? 'text' : 'password';

        // Add visual feedback class for smooth transitions
        passwordToggle.classList.add('toggle-visible');

        // Toggle active state for icon animation
        setTimeout(() => {
            if (isPassword) {
                passwordToggle.classList.add('active');
            } else {
                passwordToggle.classList.remove('active');
            }
            passwordToggle.classList.remove('toggle-visible');
        }, 0);
    });
}

// Account creation form handling
const createAccountForm = document.getElementById('createAccountForm');
if (createAccountForm) {
    createAccountForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const createAccountBtn = document.getElementById('createAccountBtn');
        const btnText = createAccountBtn.querySelector('.btn-text');
        const btnLoader = createAccountBtn.querySelector('.btn-loader');

        // Show loading state
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline';

        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());

        // Remove any empty optional fields
        Object.keys(data).forEach(key => {
            if (data[key] === '') {
                delete data[key];
            }
        });

        try {
            const response = await fetch('/admin/settings/create-account', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                // Display all entered credentials in confirmation
                const confirmationMessage = `${result.message}\n\n═══ ACCOUNT CREDENTIALS ═══\n` +
                    `Username: ${data.username}\n` +
                    `Password: ${data.password}\n` +
                    `Role: ${data.role}\n` +
                    `Staff ID: ${result.user.staffId}\n\n` +
                    `⚠️  IMPORTANT: Please securely store these credentials!\n` +
                    `The new user can log in immediately.`;

                alert(confirmationMessage);
                createAccountForm.reset();
                // Reset password visibility after form reset
                if (passwordToggle) {
                    passwordToggle.classList.remove('active');
                }
                if (accountPassword) {
                    accountPassword.type = 'password';
                }
            } else {
                alert('Error creating account: ' + result.message);
            }
        } catch (error) {
            console.error('Account creation error:', error);
            alert('Failed to create account. Please try again.');
        } finally {
            // Hide loading state
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
        }
    });
}

class CarouselPageManager {
    constructor() {
        this.carouselData = null;
        this.editingIndex = null;
        this.init();
    }

    async init() {
        try {
            await this.loadCarouselData();
            this.renderSlides();
            this.attachEventListeners();
        } catch (error) {
            console.error('Failed to initialize carousel manager:', error);
        }
    }

    async loadCarouselData() {
        const response = await fetch('/admin/api/page-management/carousel');
        if (!response.ok) throw new Error('Failed to load carousel data');
        const result = await response.json();
        this.carouselData = result.data;
    }

    renderSlides() {
        const slidesList = document.getElementById('carouselSlidesList');
        if (!slidesList || !this.carouselData) return;

        slidesList.innerHTML = this.carouselData.slides.map((slide, index) => `
            <div class="carousel-slide-card" data-slide-id="${slide.slideId}" data-index="${index}">
                <div class="slide-thumbnail">
                    <img src="${slide.bannerImage}" alt="${slide.title}">
                    <div class="slide-overlay">
                        <button type="button" class="btn-edit-slide" data-index="${index}" title="Edit slide">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn-delete-slide" data-index="${index}" title="Delete slide">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="slide-info">
                    <h4>Slide ${index + 1}</h4>
                    <p class="slide-title-text">${slide.title}</p>
                    <p class="slide-preview">${slide.caption.substring(0, 60)}${slide.caption.length > 60 ? '...' : ''}</p>
                </div>
            </div>
        `).join('');

        this.renderEditModal();
    }

    renderEditModal() {
        let editModal = document.getElementById('slideEditModal');
        if (!editModal) {
            editModal = document.createElement('div');
            editModal.id = 'slideEditModal';
            editModal.className = 'slide-edit-modal';
            document.body.appendChild(editModal);
        }

        if (this.editingIndex !== null) {
            const slide = this.carouselData.slides[this.editingIndex];
            editModal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Edit Slide ${this.editingIndex + 1}</h3>
                        <button type="button" class="btn-close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Title</label>
                            <input type="text" class="slide-title" value="${slide.title}" placeholder="Slide title">
                        </div>
                        <div class="form-group">
                            <label>Caption/Description</label>
                            <textarea class="slide-caption" placeholder="Slide caption" rows="4">${slide.caption}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Button Text</label>
                            <input type="text" class="slide-button-text" value="${slide.buttonText}" placeholder="Button text">
                        </div>
                        <div class="form-group">
                            <label>Banner Image</label>
                            <div class="image-preview">
                                <img src="${slide.bannerImage}" alt="Current banner">
                            </div>
                            <button type="button" class="btn-upload-image">
                                <i class="fas fa-upload"></i> Change Image
                            </button>
                            <input type="file" class="slide-image-upload" accept="image/*" style="display: none;">
                            <p style="font-size: 11px; color: #999; margin-top: 8px;">Max: 2MB (JPG, PNG, WebP - any resolution)</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary btn-cancel-edit">Cancel</button>
                        <button type="button" class="btn-primary btn-save-slide-edit">Save Changes</button>
                    </div>
                </div>
            `;
            editModal.classList.add('active');
        } else {
            editModal.classList.remove('active');
        }
    }

    attachEventListeners() {
        const slidesList = document.getElementById('carouselSlidesList');
        
        slidesList.querySelectorAll('.btn-edit-slide').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.editingIndex = parseInt(btn.dataset.index);
                this.renderEditModal();
                this.attachModalListeners();
            });
        });

        slidesList.querySelectorAll('.btn-delete-slide').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const index = parseInt(btn.dataset.index);
                if (this.carouselData.slides.length > 1 && confirm('Are you sure you want to delete this slide?')) {
                    this.carouselData.slides.splice(index, 1);
                    this.renderSlides();
                    this.attachEventListeners();
                } else if (this.carouselData.slides.length === 1) {
                    alert('You must keep at least one slide');
                }
            });
        });

        const addSlideBtn = document.getElementById('addSlideBtn');
        if (addSlideBtn) {
            addSlideBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const newSlide = {
                    slideId: `slide-${Date.now()}`,
                    title: 'New Slide',
                    caption: 'Enter slide caption here',
                    bannerImage: '/resources/BannerBC.png',
                    buttonText: 'Learn More',
                    order: this.carouselData.slides.length + 1
                };
                this.carouselData.slides.push(newSlide);
                this.renderSlides();
                this.attachEventListeners();
            });
        }

        const saveCarouselBtn = document.getElementById('saveCarouselBtn');
        if (saveCarouselBtn) {
            saveCarouselBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.saveCarousel();
            });
        }
    }

    attachModalListeners() {
        const modal = document.getElementById('slideEditModal');
        if (!modal) return;

        const uploadBtn = modal.querySelector('.btn-upload-image');
        const fileInput = modal.querySelector('.slide-image-upload');
        
        if (uploadBtn) {
            uploadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                fileInput.click();
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleImageUpload(e, this.editingIndex);
            });
        }

        const closeBtn = modal.querySelector('.btn-close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.editingIndex = null;
                this.renderEditModal();
            });
        }

        const cancelBtn = modal.querySelector('.btn-cancel-edit');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.editingIndex = null;
                this.renderEditModal();
            });
        }

        const saveBtn = modal.querySelector('.btn-save-slide-edit');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveSlideEdit();
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.editingIndex = null;
                this.renderEditModal();
            }
        });
    }

    saveSlideEdit() {
        const modal = document.getElementById('slideEditModal');
        if (this.editingIndex !== null) {
            this.carouselData.slides[this.editingIndex].title = modal.querySelector('.slide-title').value;
            this.carouselData.slides[this.editingIndex].caption = modal.querySelector('.slide-caption').value;
            this.carouselData.slides[this.editingIndex].buttonText = modal.querySelector('.slide-button-text').value;
            
            this.editingIndex = null;
            this.renderSlides();
            this.attachEventListeners();
        }
    }

    async handleImageUpload(e, index) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('bannerImage', file);

        try {
            const response = await fetch('/admin/api/page-management/carousel/upload-image', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                this.carouselData.slides[index].bannerImage = result.data.path;
                const modal = document.getElementById('slideEditModal');
                const preview = modal.querySelector('.image-preview img');
                if (preview) {
                    preview.src = result.data.path;
                }
                alert('Image uploaded successfully');
            } else {
                alert('Error uploading image: ' + result.error);
            }
        } catch (error) {
            console.error('Image upload error:', error);
            alert('Failed to upload image');
        }
    }

    async saveCarousel() {
        const saveBtn = document.getElementById('saveCarouselBtn');
        const btnText = saveBtn.querySelector('.btn-text');
        const btnLoader = saveBtn.querySelector('.btn-loader');

        btnText.style.display = 'none';
        btnLoader.style.display = 'inline';

        try {
            const updatedSlides = this.carouselData.slides.map((slide, index) => ({
                slideId: slide.slideId,
                title: slide.title,
                caption: slide.caption,
                bannerImage: slide.bannerImage,
                buttonText: slide.buttonText,
                order: index + 1
            }));

            const response = await fetch('/admin/api/page-management/carousel/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slides: updatedSlides })
            });

            const result = await response.json();
            if (result.success) {
                alert('Carousel saved successfully! Changes will appear on the home page.');
                await this.loadCarouselData();
                this.renderSlides();
                this.attachEventListeners();
            } else {
                alert('Error saving carousel: ' + result.error);
            }
        } catch (error) {
            console.error('Carousel save error:', error);
            alert('Failed to save carousel');
        } finally {
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const carouselTab = document.getElementById('carousel-tab');
    if (carouselTab) {
        new CarouselPageManager();
    }

    setTimeout(() => {
        const promoModalForm = document.getElementById('promoModalForm');
        if (promoModalForm) {
            console.log('Initializing promo modal settings');
            initPromoModalSettings();
        }
    }, 0);
});

function initPromoModalSettings() {
    const form = document.getElementById('promoModalForm');
    const fileInput = document.getElementById('promoImageFile');
    const saveBtn = document.getElementById('savePromoBtn');
    const previewBtn = document.getElementById('previewPromoBtn');
    const removeBtn = document.getElementById('removePromoBtn');
    const preview = document.querySelector('.promo-image-preview-container');
    const previewImg = document.getElementById('promoImagePreview');
    const uploadStatus = document.getElementById('uploadStatus');
    const promoEnabled = document.getElementById('promoEnabled');
    const promoStartDate = document.getElementById('promoStartDate');
    const promoEndDate = document.getElementById('promoEndDate');
    const promoDismissDuration = document.getElementById('promoDismissDuration');

    let uploadedImageUrl = null;

    loadPromoImageUrl();

    fileInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            uploadStatus.textContent = 'File size exceeds 5MB limit';
            uploadStatus.style.color = '#dc3545';
            return;
        }

        uploadStatus.textContent = 'Uploading...';
        uploadStatus.style.color = '#007bff';

        try {
            const formData = new FormData();
            formData.append('promoImage', file);

            const response = await fetch('/admin/settings/upload-promo-image', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                uploadedImageUrl = result.data.path;
                previewImg.src = uploadedImageUrl;
                preview.style.display = 'block';
                uploadStatus.textContent = 'Upload successful! Ready to save.';
                uploadStatus.style.color = '#28a745';
            } else {
                uploadStatus.textContent = 'Upload failed: ' + result.error;
                uploadStatus.style.color = '#dc3545';
                uploadedImageUrl = null;
            }
        } catch (error) {
            console.error('Upload error:', error);
            uploadStatus.textContent = 'Upload failed. Please try again.';
            uploadStatus.style.color = '#dc3545';
            uploadedImageUrl = null;
        }
    });

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const imageUrl = uploadedImageUrl || previewImg.src;
        
        if (!imageUrl) {
            alert('Please upload an image first');
            return;
        }

        const btnText = saveBtn.querySelector('.btn-text');
        const btnLoader = saveBtn.querySelector('.btn-loader');
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline';

        try {
            const payload = {
                promoImageUrl: imageUrl,
                promoEnabled: promoEnabled.checked,
                promoStartDate: promoStartDate.value || null,
                promoEndDate: promoEndDate.value || null,
                promoDismissDuration: parseInt(promoDismissDuration.value) || 24
            };
            
            const response = await fetch('/admin/settings/update-promo-modal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                alert('Promotional modal configuration saved successfully!');
                fileInput.value = '';
                uploadStatus.textContent = '';
                uploadedImageUrl = null;
            } else {
                alert('Error: ' + (result.message || 'Failed to save configuration'));
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('Failed to save promotional modal configuration: ' + error.message);
        } finally {
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
        }
    });

    removeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        if (!confirm('Are you sure you want to remove the promotional modal? This action cannot be undone.')) {
            return;
        }

        const btnText = removeBtn.textContent;
        removeBtn.disabled = true;
        removeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removing...';

        fetch('/admin/settings/remove-promo-modal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                alert('Promotional modal removed successfully!');
                fileInput.value = '';
                uploadStatus.textContent = '';
                uploadedImageUrl = null;
                previewImg.src = '';
                preview.style.display = 'none';
                form.reset();
            } else {
                alert('Error: ' + (result.message || 'Failed to remove modal'));
            }
        })
        .catch(error => {
            console.error('Remove error:', error);
            alert('Failed to remove promotional modal: ' + error.message);
        })
        .finally(() => {
            removeBtn.disabled = false;
            removeBtn.innerHTML = '<i class="fas fa-trash"></i> Remove Modal';
        });
    });

    previewBtn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Preview button clicked');
        
        const imageUrl = uploadedImageUrl || previewImg.src;
        console.log('Image URL:', imageUrl);
        
        if (!imageUrl || imageUrl.trim() === '') {
            alert('No image attached. Please upload an image before previewing.');
            return;
        }

        const modalOverlay = document.getElementById('promoModalOverlay');
        console.log('Modal overlay:', modalOverlay);
        
        if (!modalOverlay) {
            alert('Modal not found on page');
            return;
        }

        const img = modalOverlay.querySelector('.promo-modal-image');
        const closeBtn = modalOverlay.querySelector('.promo-modal-close');
        
        if (!img || !closeBtn) {
            alert('Modal elements not found');
            return;
        }

        img.src = imageUrl;
        modalOverlay.classList.add('show');
        document.body.style.overflow = 'hidden';

        const handleClose = () => {
            modalOverlay.classList.remove('show');
            document.body.style.overflow = '';
        };

        const handleBackdropClose = (e) => {
            if (e.target === modalOverlay) {
                handleClose();
            }
        };

        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                handleClose();
                document.removeEventListener('keydown', handleEscKey);
            }
        };

        closeBtn.onclick = handleClose;
        modalOverlay.onclick = handleBackdropClose;
        document.addEventListener('keydown', handleEscKey);
    });
}

// Settings category navigation
document.addEventListener('DOMContentLoaded', function() {
    const categoryItems = document.querySelectorAll('.category-item');
    const sections = document.querySelectorAll('.settings-section');

    // Set first category as active by default
    if (categoryItems.length > 0) {
        categoryItems[0].classList.add('active');
        const firstCategory = categoryItems[0].getAttribute('data-category');
        document.querySelector(`[data-category="${firstCategory}"]`)?.parentElement.classList.add('active');
        sections.forEach(section => {
            if (section.getAttribute('data-category') === firstCategory) {
                section.classList.add('active');
            }
        });
    }

    // Add click handlers
    categoryItems.forEach(item => {
        item.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            
            // Update active category button
            categoryItems.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding section
            sections.forEach(section => {
                if (section.getAttribute('data-category') === category) {
                    section.classList.add('active');
                } else {
                    section.classList.remove('active');
                }
            });
            
            // Scroll to top of content
            document.querySelector('.settings-content').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
});
async function loadPromoImageUrl() {
    try {
        const response = await fetch('/api/promo-modal');
        const data = await response.json();

        if (data.imageUrl) {
            const previewImg = document.getElementById('promoImagePreview');
            const preview = document.querySelector('.promo-image-preview-container');

            previewImg.src = data.imageUrl;
            preview.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading promo image:', error);
    }
}
