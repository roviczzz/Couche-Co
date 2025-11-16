// Initialize orderItems array with data from localStorage
var orderItems = JSON.parse(localStorage.getItem('orderItems') || '[]');

// Get product data from EJS
try {
    var product = JSON.parse(document.getElementById('product-data').textContent);
} catch (error) {
    console.error('Error parsing product data:', error);
    var product = {};
}

// Toast notification functions
function createToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

function showToast(message, type = 'info', duration = 5000) {
    const container = createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? 'fas fa-check-circle' :
                 type === 'error' ? 'fas fa-exclamation-circle' :
                 type === 'warning' ? 'fas fa-exclamation-triangle' : 'fas fa-info-circle';

    toast.innerHTML = `
        <i class="${icon} toast-icon"></i>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }, duration);
}

// Centered error message function
function showCenteredError(message) {
    // Remove any existing centered error
    const existingError = document.querySelector('.centered-error-message');
    if (existingError) {
        existingError.remove();
    }

    // Create centered error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'centered-error-message';
    errorDiv.innerHTML = `
        <div class="centered-error-content">
            <i class="fas fa-exclamation-triangle error-icon"></i>
            <div class="error-text">${message}</div>
            <button class="error-close-btn" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    document.body.appendChild(errorDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 5000);
}

// Array to store selected add-ons
var selectedAddons = [];

// Array to store selected ingredients
var selectedIngredients = [];

// Update ingredients badge - show when ANY ingredient checkboxes are checked
function updateIngredientsBadge() {
    const badge = document.getElementById('ingredients-badge');

    if (!badge) {
        console.error('❌ Badge element not found!');
        return;
    }

    // Count any checked ingredient checkboxes, not just the selectedIngredients array
    const checkedCheckboxes = document.querySelectorAll('.ingredient-checkbox:checked');
    const count = checkedCheckboxes.length;

    // Check if modal is currently open
    const modal = document.getElementById('more-options-modal');
    const isModalOpen = modal && modal.style.display === 'block';

    // Show badge only if ingredients are checked AND modal is NOT open
    if (count > 0 && !isModalOpen) {
        badge.textContent = count;
        badge.style.display = 'flex';
        badge.classList.remove('hidden');
        badge.style.visibility = 'visible';
        badge.style.opacity = '1';
        badge.style.zIndex = '9999';
        badge.style.position = 'absolute';

        // Trigger animation
        badge.style.animation = 'none';
        setTimeout(() => {
            badge.style.animation = 'badgePulse 0.6s ease-out';
        }, 10);
    } else {
        // Hide badge when no ingredients checked OR modal is open
        badge.textContent = '';
        badge.style.display = 'none';
        badge.classList.add('hidden');
        badge.style.visibility = 'hidden';
        badge.style.opacity = '0';
        badge.style.zIndex = '0';
    }
}

// Initialize badge state
function initializeBadge() {
    const badge = document.getElementById('ingredients-badge');

    if (!badge) {
        console.error('Badge element not found during initialization!');
        return;
    }

    // Ensure badge starts completely hidden and empty
    badge.textContent = '';
    badge.style.display = 'none';
    badge.classList.add('hidden');
    badge.style.visibility = 'hidden';
    badge.style.opacity = '0';
    badge.style.zIndex = '0';

    // Clear any selected ingredients on page load
    selectedIngredients.length = 0;
}

// Initialize ingredient checkboxes event listeners using event delegation
function initializeIngredientListeners() {
    // Use event delegation on the ingredients container (modal)
    const modalIngredientsContainer = document.querySelector('.ingredients-options');

    if (modalIngredientsContainer) {
        // Remove any existing listeners to prevent duplicates
        modalIngredientsContainer.removeEventListener('change', handleIngredientChange);
        // Add event delegation listener for modal
        modalIngredientsContainer.addEventListener('change', handleIngredientChange);
    }

    // No longer setting up direct listeners to prevent duplication with delegation
    // Event delegation handles all ingredient checkboxes within the modal
}

// Handle ingredient checkbox changes
function handleIngredientChange(event) {
    const checkbox = event.target;

    // Only handle ingredient checkboxes
    if (!checkbox.classList.contains('ingredient-checkbox')) {
        return;
    }

    const ingredientId = checkbox.dataset.ingredientId;
    const ingredientName = checkbox.dataset.ingredientName;
    const ingredientPrice = parseFloat(checkbox.dataset.ingredientPrice) || 15;

    if (checkbox.checked) {
        // Add to selectedIngredients array
        selectedIngredients.push({
            IngredientID: ingredientId,
            Name: ingredientName,
            BasePrice: ingredientPrice
        });
        // Also add to selectedAddons for cart functionality
        selectedAddons.push({
            IngredientID: ingredientId,
            Name: ingredientName,
            BasePrice: ingredientPrice
        });
    } else {
        // Remove from selectedIngredients array
        const ingredientIndex = selectedIngredients.findIndex(a => a.IngredientID == ingredientId);
        if (ingredientIndex > -1) {
            selectedIngredients.splice(ingredientIndex, 1);
        }
        // Remove from selectedAddons array
        const addonIndex = selectedAddons.findIndex(a => a.IngredientID == ingredientId);
        if (addonIndex > -1) {
            selectedAddons.splice(addonIndex, 1);
        }
    }

    // Update the badge
    updateIngredientsBadge();
}

// Save order to localStorage and update cart count
function saveOrderItems() {
    localStorage.setItem('orderItems', JSON.stringify(orderItems));
    if (typeof window.updateCartCount === 'function') {
        window.updateCartCount();
    }

    // Sync with server for logged-in users
    if (window.user && window.user._id) {
        fetch('/api/cart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderItems)
        }).catch(err => console.error('Error saving cart to server:', err));
    }
}

// Add item to order (similar to menu.js addToOrder)
function addToOrder(name, price, size, category, productId, addons, imagelink, isFree, originalItemIndex, quantity) {
    const key = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const finalPrice = isFree ? 0 : parseFloat(price);
    const orderItem = {
        key: key,
        name: name,
        price: finalPrice,
        quantity: parseInt(quantity) || 1,
        size: size,
        category: category,
        productId: productId,
        addons: addons || [],
        imagelink: imagelink || '',
        isFree: isFree,
        originalItemIndex: originalItemIndex,
        isB1T1: isFree
    };
    orderItems.push(orderItem);
    saveOrderItems();

    // Show cart side popup instead of toast
    showCartSidePopup(orderItem);
}

// Fetch and display add-ons - try server-side data first, then API as fallback
function loadAddons() {
    // Try server-side data first
    const addonsDataScript = document.getElementById('addons-data');
    let addons = [];

    if (addonsDataScript) {
        try {
            addons = JSON.parse(addonsDataScript.textContent);
        } catch (e) {
            console.error('Error parsing server-side addons data:', e);
        }
    }

    // If no server-side data, try API as fallback
    if (addons.length === 0) {
        loadAddonsFromAPI();
        return;
    }

    // Use server-side data
    displayAddons(addons);
}

// Load add-ons from API (fallback)
async function loadAddonsFromAPI() {
    try {
        const response = await fetch('/api/addons');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const addons = await response.json();
        displayAddons(addons);
    } catch (error) {
        console.error('Error loading add-ons:', error);
        const addonOptionsContainer = document.querySelector('.addon-options');
        if (addonOptionsContainer) {
            addonOptionsContainer.innerHTML = '<span style="font-size:12px;color:#ff6b6b">Error loading add-ons.</span>';
        }
    }
}

// Display add-ons in the UI
function displayAddons(addons) {
    const addonOptionsContainer = document.querySelector('.addon-options');
    if (!addonOptionsContainer) {
        console.error('addon-options container not found');
        return;
    }

    addonOptionsContainer.innerHTML = '';

    if (addons && Array.isArray(addons) && addons.length > 0) {
        addons.forEach(addon => {
            const addonLabel = document.createElement('label');
            addonLabel.className = 'addon-checkbox-label';

            const addonText = document.createElement('span');
            addonText.className = 'addon-text';
            addonText.textContent = `${addon.Name} - ₱${Number(addon.BasePrice).toFixed(2)}`;

            const addonCheckbox = document.createElement('input');
            addonCheckbox.type = 'checkbox';
            addonCheckbox.className = 'addon-checkbox';
            addonCheckbox.dataset.addonId = addon.AddOnID;
            addonCheckbox.dataset.addonName = addon.Name;
            addonCheckbox.dataset.addonPrice = addon.BasePrice;

            addonLabel.addEventListener('change', function() {
                if (addonCheckbox.checked) {
                    selectedAddons.push({
                        AddOnID: addon.AddOnID,
                        Name: addon.Name,
                        BasePrice: addon.BasePrice
                    });
                } else {
                    const index = selectedAddons.findIndex(a => a.AddOnID === addon.AddOnID);
                    if (index > -1) {
                        selectedAddons.splice(index, 1);
                    }
                }
            });

            addonLabel.appendChild(addonText);
            addonLabel.appendChild(addonCheckbox);
            addonOptionsContainer.appendChild(addonLabel);
        });
    } else {
        addonOptionsContainer.innerHTML = '<span style="font-size:12px;color:#999">No add-ons available.</span>';
    }
}

// Initialize function
function initializePage() {
    // Load add-ons
    loadAddons();

    // Load ingredients
    loadIngredients();

    // Initialize ingredient listeners for existing checkboxes
    initializeIngredientListeners();

    // Setup modal functionality
    setupModal();

    // Initialize badge state - ensure it's hidden on load
    initializeBadge();

    // Ensure all size options are unselected on load
    document.querySelectorAll('input[name="size-radio"]').forEach(rb => {
        rb.checked = false;
    });

    // Add event listeners to size option buttons to handle selection
    const sizeOptionBtns = document.querySelectorAll('.size-option-btn');
    sizeOptionBtns.forEach(btn => {
        btn.addEventListener('click', function(event) {
            event.preventDefault(); // Prevent default label behavior

            const radio = this.querySelector('input[type="radio"]');
            const wasChecked = radio.checked;

            // If already checked, allow deselection
            if (wasChecked) {
                radio.checked = false;
                this.classList.remove('selected');
            } else {
                // Uncheck all other radio buttons and remove selected class
                document.querySelectorAll('input[name="size-radio"]').forEach(rb => {
                    rb.checked = false;
                    rb.closest('.size-option-btn').classList.remove('selected');
                });

                // Check this radio button and add selected class
                radio.checked = true;
                this.classList.add('selected');
            }
        });
    });

    // Add to cart button event listener
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', async function() {
            const quantity = document.getElementById('quantity').value;
            const selectedRadio = document.querySelector('input[name="size-radio"]:checked');

            // Validate size selection for products that have sizes
            if (product.Sizes && product.Sizes.length > 0 && !selectedRadio) {
                showToast('Please select a size before adding to cart.', 'error');
                return;
            }

            // Check product availability first
            try {
                const availabilityResponse = await fetch(`/api/check-product-availability/${product.ProductID}`);
                const availabilityData = await availabilityResponse.json();

                if (!availabilityData.available) {
                    showCenteredError(availabilityData.reason || 'This product is currently unavailable');
                    return;
                }
            } catch (error) {
                console.error('Error checking product availability:', error);
                // Continue with adding to cart if availability check fails (fail-safe)
            }

            let size = selectedRadio ? selectedRadio.value : null;
            let price = selectedRadio ? parseFloat(selectedRadio.closest('.size-option-btn').dataset.price) : parseFloat(product.BasePrice || 0);

            addToOrder(product.Name, price, size, product.Category, product.ProductID, selectedAddons.slice(), product.imagelink, false, null, quantity);
        });
    }
}

// Setup modal functionality with enhanced UX
function setupModal() {
    const modal = document.getElementById('more-options-modal');
    const btn = document.getElementById('more-options-btn');
    const span = document.getElementsByClassName('close')[0];
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const addBtn = document.getElementById('modal-add-btn');

    if (!modal || !btn) {
        return;
    }

    // Variable to store the element that had focus before modal opened
    let previousFocusElement = null;

    // Function to open modal with enhanced UX
    function openModal() {
        previousFocusElement = document.activeElement;

        // Prevent body scroll
        document.body.style.overflow = 'hidden';

        // Show modal
        modal.style.display = 'block';

        // Hide badge completely when modal opens
        const badge = document.getElementById('ingredients-badge');
        if (badge) {
            badge.style.display = 'none';
            badge.classList.add('hidden');
        }

        // Ingredient listeners are handled by event delegation in initializeIngredientListeners

        // Focus management: focus the close button after modal animation
        setTimeout(() => {
            if (span) {
                span.focus();
            }
        }, 100);
    }

    // Function to close modal with enhanced UX
    function closeModal() {
        // Hide modal
        modal.style.display = 'none';

        // Restore body scroll
        document.body.style.overflow = '';

        // Return focus to the button that opened the modal, then blur to remove focus styles
        if (previousFocusElement) {
            previousFocusElement.focus();
            // Immediately blur to remove persistent focus styles (border/outline)
            setTimeout(() => {
                previousFocusElement.blur();
            }, 0);
        }

        // Don't clear ingredients on modal close - badge should stay if checkboxes are checked

        // Restore badge z-index when modal closes
        const badge = document.getElementById('ingredients-badge');
        if (badge) {
            badge.style.zIndex = '9999';
        }

        // Update badge one more time when closing to ensure consistency
        updateIngredientsBadge();
    }

    // Show modal when button is clicked
    btn.addEventListener('click', function(event) {
        event.preventDefault();
        openModal();
    });

    // Close modal when close button is clicked
    if (span) {
        span.addEventListener('click', function(event) {
            event.preventDefault();
            closeModal();
        });
    }

    // Close modal when cancel button is clicked
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function(event) {
            event.preventDefault();
            closeModal();
        });
    }

    // Close modal when add button is clicked
    if (addBtn) {
        addBtn.addEventListener('click', function(event) {
            event.preventDefault();
            closeModal();
        });
    }

    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Close modal on ESC key press
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            closeModal();
        }
    });
}

// Load ingredients for modal
function loadIngredients() {
    const ingredientsDataScript = document.getElementById('ingredients-data');
    let ingredients = [];

    if (ingredientsDataScript) {
        try {
            ingredients = JSON.parse(ingredientsDataScript.textContent);
        } catch (e) {
            console.error('Error parsing server-side ingredients data:', e);
        }
    }

    // Display ingredients in modal
    displayIngredients(ingredients);
}

// Display ingredients in modal
function displayIngredients(ingredients) {
    const ingredientsOptionsContainer = document.querySelector('.ingredients-options');
    if (!ingredientsOptionsContainer) {
        console.error('ingredients-options container not found');
        return;
    }

    // Check if ingredients already exist from EJS template
    const existingIngredients = ingredientsOptionsContainer.querySelectorAll('.ingredient-checkbox-label');
    if (existingIngredients.length > 0) {
        // Event listeners handled by delegation
        return;
    }

    ingredientsOptionsContainer.innerHTML = '';

    if (ingredients && Array.isArray(ingredients) && ingredients.length > 0) {
        ingredients.forEach(ingredient => {
            const ingredientLabel = document.createElement('label');
            ingredientLabel.className = 'ingredient-checkbox-label';

            const ingredientText = document.createElement('span');
            ingredientText.className = 'ingredient-text';
            ingredientText.textContent = `${ingredient.Name} ₱15.00`;

            const ingredientCheckbox = document.createElement('input');
            ingredientCheckbox.type = 'checkbox';
            ingredientCheckbox.className = 'ingredient-checkbox';
            ingredientCheckbox.dataset.ingredientId = ingredient.IngredientID;
            ingredientCheckbox.dataset.ingredientName = ingredient.Name;
            ingredientCheckbox.dataset.ingredientPrice = 15;

            ingredientLabel.appendChild(ingredientText);
            ingredientLabel.appendChild(ingredientCheckbox);
            ingredientsOptionsContainer.appendChild(ingredientLabel);
        });

        // Event listeners handled by event delegation on the container
    } else {
        ingredientsOptionsContainer.innerHTML = '<span style="font-size:12px;color:#999">No ingredients available.</span>';
    }
}

// Setup ingredient event listeners
function setupIngredientEventListeners() {
    const ingredientCheckboxes = document.querySelectorAll('.ingredient-checkbox');

    ingredientCheckboxes.forEach((checkbox) => {
        // Remove existing listeners to prevent duplicates
        checkbox.removeEventListener('change', handleIngredientCheckboxChange);

        // Add new listener
        checkbox.addEventListener('change', handleIngredientCheckboxChange);
    });
}

// Handle ingredient checkbox changes
function handleIngredientCheckboxChange(event) {
    const checkbox = event.target;
    const ingredientId = checkbox.dataset.ingredientId;
    const ingredientName = checkbox.dataset.ingredientName;
    const ingredientPrice = parseFloat(checkbox.dataset.ingredientPrice) || 15;

    if (checkbox.checked) {
        // Add to selectedIngredients array
        selectedIngredients.push({
            IngredientID: ingredientId,
            Name: ingredientName,
            BasePrice: ingredientPrice
        });
        // Also add to selectedAddons for cart functionality
        selectedAddons.push({
            IngredientID: ingredientId,
            Name: ingredientName,
            BasePrice: ingredientPrice
        });
    } else {
        // Remove from selectedIngredients array
        const ingredientIndex = selectedIngredients.findIndex(a => a.IngredientID == ingredientId);
        if (ingredientIndex > -1) {
            selectedIngredients.splice(ingredientIndex, 1);
        }
        // Remove from selectedAddons array
        const addonIndex = selectedAddons.findIndex(a => a.IngredientID == ingredientId);
        if (addonIndex > -1) {
            selectedAddons.splice(addonIndex, 1);
        }
    }

    // Update the badge immediately - this should work with the new logic
    updateIngredientsBadge();
}

// Ensure DOM is fully loaded before initializing
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

// Show cart side popup with item details
function showCartSidePopup(orderItem) {
    // Update popup content
    const itemNameElement = document.getElementById('cart-popup-name');
    const itemPriceElement = document.getElementById('cart-popup-price');
    const itemDetailsElement = document.getElementById('cart-popup-details');
    const itemImageElement = document.getElementById('cart-popup-image');

    if (itemNameElement) itemNameElement.textContent = orderItem.name;
    if (itemPriceElement) itemPriceElement.textContent = `₱${(orderItem.price * orderItem.quantity).toFixed(2)}`;

    // Update image if available
    if (itemImageElement && orderItem.imagelink) {
        itemImageElement.src = orderItem.imagelink;
        itemImageElement.style.display = 'block';
    }

    // Build details string
    if (itemDetailsElement) {
        itemDetailsElement.innerHTML = '';
        let details = [];

        if (orderItem.size) details.push(`<span>Size: ${orderItem.size}</span>`);
        if (orderItem.quantity > 1) details.push(`<span>Qty: ${orderItem.quantity}</span>`);
        if (orderItem.addons && orderItem.addons.length > 0) {
            const addonNames = orderItem.addons.map(addon => addon.Name || addon.name).join(', ');
            details.push(`<span>Add-ons: ${addonNames}</span>`);
        }

        if (details.length > 0) {
            itemDetailsElement.innerHTML = details.join('<br>');
        }
    }

    // Show popup with animation
    const popup = document.getElementById('cart-side-popup');
    if (popup) {
        popup.classList.add('show');

        // Setup popup event listeners
        setupCartSidePopup();
    }
}

// Hide cart side popup
function hideCartSidePopup() {
    const popup = document.getElementById('cart-side-popup');
    if (popup) {
        popup.classList.remove('show');
    }
}

// Setup cart side popup functionality
function setupCartSidePopup() {
    const popup = document.getElementById('cart-side-popup');
    const closeBtn = document.getElementById('cart-popup-close');
    const continueBtn = document.getElementById('cart-continue-btn');
    const viewCartBtn = document.getElementById('cart-view-btn');
    const checkoutBtn = document.getElementById('cart-checkout-btn');

    if (!popup) return;

    // Close button event listener
    if (closeBtn) {
        closeBtn.addEventListener('click', hideCartSidePopup);
    }

    // Continue shopping button
    if (continueBtn) {
        continueBtn.addEventListener('click', hideCartSidePopup);
    }

    // View cart button
    if (viewCartBtn) {
        viewCartBtn.addEventListener('click', function() {
            hideCartSidePopup();
            // Navigate to cart page
            window.location.href = '/cart';
        });
    }

    // Checkout button
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function() {
            hideCartSidePopup();
            // Navigate to checkout page
            window.location.href = '/checkout';
        });
    }
}

// Remove item from cart (copied from cart.js for non-logged-in users)
function removeItem(index) {
    showConfirm('Are you sure you want to remove this item from your cart?', 'Remove Item',
        () => {
            orderItems.splice(index, 1);
            saveOrderItems();
            hideCartSidePopup();

            if (typeof window.updateCartCount === 'function') {
                window.updateCartCount();
            }
        }
    );
}

// Re-export setupModal for potential external access (if needed)
window.setupProductModal = setupModal;
