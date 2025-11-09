// Staff Menu JavaScript
// Get user data
const user = JSON.parse(document.getElementById('user-data').textContent);

// Global payment variables for automatic checking
let currentOrderId = null;
let paymentStatusInterval = null;
let selectedPaymentMethod = null;

// Global promo variables
let selectedPromo = null;
let activePromos = [];

// Initialize delivery type handling
document.addEventListener('DOMContentLoaded', function() {
    // Get active promos data
    const activePromosData = document.getElementById('activePromos-data');
    if (activePromosData) {
        try {
            activePromos = JSON.parse(activePromosData.textContent);
        } catch (error) {
            console.error('Error parsing activePromos data:', error);
            activePromos = [];
        }
    }

    // Initialize promo dropdown
    const promoSelect = document.getElementById('promo-select');
    if (promoSelect) {
        promoSelect.addEventListener('change', handlePromoSelection);
    }

    const deliveryTypeSelect = document.getElementById('delivery-type');
    if (deliveryTypeSelect) {
        deliveryTypeSelect.addEventListener('change', handleDeliveryTypeChange);
        // Initialize payment options on page load
        handleDeliveryTypeChange();
    }

    const proceedOrderBtn = document.getElementById('proceed-order-btn');
    if (proceedOrderBtn) {
        proceedOrderBtn.addEventListener('click', proceedOrder);
    }

    // Initialize cart if not exists
    if (!window.cartItems) {
        window.cartItems = [];
    }
});

// Handle promo selection
function handlePromoSelection() {
    const promoSelect = document.getElementById('promo-select');
    
    if (promoSelect.value === '') {
        selectedPromo = null;
        
        // Clear promo labels immediately and aggressively
        const promoAppliedElement = document.getElementById('promo-applied');
        const promoDetailsElement = document.getElementById('promo-details');
        
        // Clear all dropdown promo labels - only keep B1T1 and Buy3 if they exist
        if (promoAppliedElement) {
            const b1t1Applied = window.cartItems && window.cartItems.some(item => item.isB1T1);
            const buy3Applied = window.cartItems && calculateBuy3For143Savings(window.cartItems) > 0;
            
            let promoLabels = [];
            if (b1t1Applied) promoLabels.push('B1T1');
            if (buy3Applied) promoLabels.push('Buy 3 for ₱143');
            
            promoAppliedElement.textContent = promoLabels.join(', ');
        }
        
        // Clear promo details completely
        if (promoDetailsElement) {
            promoDetailsElement.textContent = '';
            promoDetailsElement.style.display = 'none';
        }
        
        updateCartDisplay();
        return;
    }

    try {
        const promoData = JSON.parse(promoSelect.options[promoSelect.selectedIndex].dataset.promo);
        
        // Check if cart has items matching promo category
        if (!isPromoApplicableToCart(promoData)) {
            showFeedbackMessage(`This promotion is only applicable to ${promoData.category} items. Please add ${promoData.category.toLowerCase()} items to your cart.`, 'info');
            promoSelect.value = '';
            selectedPromo = null;
            updateCartDisplay();
            return;
        }

        selectedPromo = promoData;
        updateCartDisplay();
        
    } catch (error) {
        console.error('Error parsing promo data:', error);
        selectedPromo = null;
    }
}

// Check if promo is applicable to current cart
function isPromoApplicableToCart(promo) {
    if (!window.cartItems || window.cartItems.length === 0) {
        return false;
    }

    // Get menu data to check categories
    const menuData = JSON.parse(document.getElementById('menu-data').textContent);
    
    return window.cartItems.some(cartItem => {
        const menuItem = menuData.find(item => item.Name === cartItem.ProductName);
        return menuItem && menuItem.Category === promo.category;
    });
}

// Update promo dropdown options based on cart content
function updatePromoAvailability() {
    const promoSelect = document.getElementById('promo-select');
    if (!promoSelect || !activePromos) return;

    // Get current cart categories
    const menuData = JSON.parse(document.getElementById('menu-data').textContent);
    const cartCategories = new Set();
    
    if (window.cartItems && window.cartItems.length > 0) {
        window.cartItems.forEach(cartItem => {
            const menuItem = menuData.find(item => item.Name === cartItem.ProductName);
            if (menuItem) {
                cartCategories.add(menuItem.Category);
            }
        });
    }

    // Update promo options
    Array.from(promoSelect.options).forEach((option, index) => {
        if (index === 0) return; // Skip "No promotion selected" option
        
        try {
            const promoData = JSON.parse(option.dataset.promo);
            const isApplicable = cartCategories.has(promoData.category);
            option.disabled = !isApplicable;
            option.style.color = isApplicable ? '' : '#ccc';
        } catch (error) {
            console.error('Error checking promo applicability:', error);
        }
    });

    // Reset promo selection if no longer applicable or cart is empty
    if (selectedPromo && (!window.cartItems || window.cartItems.length === 0 || !cartCategories.has(selectedPromo.category))) {
        promoSelect.value = '';
        selectedPromo = null;
        
        // Immediately clear promo labels and description
        const promoAppliedElement = document.getElementById('promo-applied');
        const promoDetailsElement = document.getElementById('promo-details');
        if (promoAppliedElement) promoAppliedElement.textContent = '';
        if (promoDetailsElement) promoDetailsElement.style.display = 'none';
    }
}

// Handle delivery type changes and update payment options
function handleDeliveryTypeChange() {
    const deliveryType = document.getElementById('delivery-type').value;
    const addressContainer = document.getElementById('address-container');
    const cashOption = document.querySelector('.payment-option[onclick*="cash"]');
    const epaymentOption = document.querySelector('.payment-option[onclick*="epayment"]');

    // Reset selected payment method when delivery type changes
    selectedPaymentMethod = null;

    // Toggle address container for Delivery
    if (deliveryType === 'Delivery') {
        if (addressContainer) addressContainer.style.display = 'block';
    } else {
        if (addressContainer) addressContainer.style.display = 'none';
    }

    if (deliveryType === 'Delivery' || deliveryType === 'Pick-Up') {
        // Hide cash option, show e-payment but don't auto-select
        if (cashOption) {
            cashOption.style.display = 'none';
        }
        if (epaymentOption) {
            epaymentOption.style.display = 'flex';
            // Reset selection - user must manually select
            const epaymentCheck = epaymentOption.querySelector('.payment-check');
            if (epaymentCheck) {
                epaymentCheck.style.backgroundColor = '';
            }
            // Reset border styling and remove selected class
            epaymentOption.style.border = '2px solid #e0e0e0';
            epaymentOption.style.boxShadow = 'none';
            epaymentOption.classList.remove('payment-selected');
        }
    } else {
        // Show both options for Take-Out
        if (cashOption) {
            cashOption.style.display = 'flex';
        }
        if (epaymentOption) {
            epaymentOption.style.display = 'flex';
        }
        // Reset all selections for take-out
        const paymentOptions = document.querySelectorAll('.payment-option');
        paymentOptions.forEach(option => {
            const check = option.querySelector('.payment-check');
            if (check) {
                check.style.backgroundColor = '';
            }
            // Reset border styling and remove selected class
            option.style.border = '2px solid #e0e0e0';
            option.style.boxShadow = 'none';
            option.classList.remove('payment-selected');
        });
    }

    // Update cart display to show/hide delivery fee
    updateCartDisplay();
}

// Product click handler
function handleProductClick(item) {
    console.log('Product clicked:', item);

    // Show size modal for items with multiple sizes or add-ons
    if ((item.Sizes && item.Sizes.length > 1) || item.Category !== 'Pastries') {
        showSizeModal(item);
    } else {
        // Direct add to cart for pastries or single-size items
        addToCart(item);
    }
}

// Scroll to category function
function scrollToCategory(category) {
    const sections = document.querySelectorAll('.section-title');
    for (let section of sections) {
        if (section.textContent.trim() === category) {
            section.scrollIntoView({ behavior: 'smooth' });
            break;
        }
    }
}

// Modal functions
function showSizeModal(item) {
    const modal = document.getElementById('size-modal');
    const productName = document.getElementById('modal-product-name');
    productName.textContent = item.Name;

    // Store current item
    window.currentModalItem = item;

    // Populate modal content
    populateModalContent(item);

    modal.style.display = 'flex';
}

function populateModalContent(item) {
    const sizeSection = document.getElementById('size-section');
    const addonSection = document.getElementById('addon-section');
    const directOrderSection = document.getElementById('direct-order-section');

    // Hide all sections first
    sizeSection.style.display = 'none';
    addonSection.style.display = 'none';
    directOrderSection.style.display = 'none';

    // Show size section if item has multiple sizes
    if (item.Sizes && item.Sizes.length > 1) {
        populateSizeOptions(item.Sizes);
        sizeSection.style.display = 'block';
    } else if (item.Sizes && item.Sizes.length === 1) {
        // Store single size selection
        window.selectedSize = item.Sizes[0];
    }

    // Show addon section for drinks (non-pastries)
    if (item.Category !== "Pastries") {
        populateAddonOptions();
        addonSection.style.display = 'block';
    }

    // Show direct order section for pastries
    if (item.Category === "Pastries") {
        directOrderSection.style.display = 'block';
    }
}

function populateSizeOptions(sizes) {
    const sizeOptionsContainer = document.getElementById('size-options');
    let html = '';

    sizes.forEach((size, index) => {
        // Handle both Size and SizeName properties
        const sizeName = size.Size || size.SizeName || 'Regular';
        const sizePrice = size.BasePrice || size.Price || 0;

        html += `
            <label class="size-option" data-size='${JSON.stringify(size)}'>
                <input type="radio" name="modal-size" value="${sizeName}" ${index === 0 ? 'checked' : ''}>
                <span class="size-label">${sizeName} - ₱${Number(sizePrice).toFixed(2)}</span>
            </label>
        `;
    });

    sizeOptionsContainer.innerHTML = html;

    // Add event listeners for size selection
    const sizeInputs = sizeOptionsContainer.querySelectorAll('input[name="modal-size"]');
    sizeInputs.forEach(input => {
        input.addEventListener('change', function() {
            const sizeData = JSON.parse(this.closest('.size-option').dataset.size);
            window.selectedSize = sizeData;
        });
    });

    // Set initial selection
    if (sizes.length > 0) {
        window.selectedSize = sizes[0];
    }
}

async function populateAddonOptions() {
    const addonOptionsContainer = document.getElementById('addon-options');
    addonOptionsContainer.innerHTML = '<span style="font-size:12px;color:#999;">Loading add-ons...</span>';

    try {
        // Get addons and ingredients from the data passed by the server
        const addonsData = JSON.parse(document.getElementById('addons-data').textContent);
        const ingredientsData = JSON.parse(document.getElementById('ingredients-data').textContent);

        let html = '';

        // Regular addons section
        if (addonsData && addonsData.length > 0) {
            html += '<div class="addon-group"><h5>Add-ons</h5><div class="options-grid">';
            addonsData.forEach(addon => {
                const addonName = addon.Name || addon.name || 'Unknown Add-on';
                const addonPrice = addon.BasePrice || addon.Price || addon.price || 0;
                const addonId = addon.AddOnID || addon._id || addon.id || Math.random().toString(36);

                html += `
                    <label class="addon-option">
                        <input type="checkbox" class="addon-checkbox" data-addon-id="${addonId}" data-addon-name="${addonName}" data-addon-price="${addonPrice}">
                        <span class="addon-label">${addonName} - ₱${Number(addonPrice).toFixed(2)}</span>
                    </label>
                `;
            });
            html += '</div></div>';
        }

        // Additional ingredients section
        if (ingredientsData && ingredientsData.length > 0) {
            html += '<div class="addon-group"><h5>Additional Ingredients</h5><div class="options-grid">';
            ingredientsData.forEach(ingredient => {
                const ingredientName = ingredient.Name || ingredient.name || 'Unknown Ingredient';
                const ingredientPrice = 20; // Fixed price for ingredients
                const ingredientId = ingredient.IngredientID || ingredient._id || ingredient.id || Math.random().toString(36);

                html += `
                    <label class="addon-option">
                        <input type="checkbox" class="ingredient-checkbox" data-ingredient-id="${ingredientId}" data-ingredient-name="${ingredientName}" data-ingredient-price="${ingredientPrice}">
                        <span class="addon-label">${ingredientName} - ₱${ingredientPrice}.00</span>
                    </label>
                `;
            });
            html += '</div></div>';
        }

        if (html === '') {
            html = '<span style="font-size:12px;color:#666;">No add-ons or ingredients available</span>';
        }

        addonOptionsContainer.innerHTML = html;

    } catch (error) {
        console.error('Error loading addons/ingredients:', error);
        addonOptionsContainer.innerHTML = '<span style="font-size:12px;color:#f44336;">Error loading options. Please try again.</span>';
    }
}

function getSelectedAddons() {
    const selectedAddons = [];

    // Get regular addons
    const addonCheckboxes = document.querySelectorAll('.addon-checkbox:checked');
    addonCheckboxes.forEach(checkbox => {
        selectedAddons.push({
            id: checkbox.dataset.addonId,
            name: checkbox.dataset.addonName,
            price: parseFloat(checkbox.dataset.addonPrice)
        });
    });

    // Get ingredient addons
    const ingredientCheckboxes = document.querySelectorAll('.ingredient-checkbox:checked');
    ingredientCheckboxes.forEach(checkbox => {
        selectedAddons.push({
            id: checkbox.dataset.ingredientId,
            name: checkbox.dataset.ingredientName,
            price: parseFloat(checkbox.dataset.ingredientPrice)
        });
    });

    return selectedAddons;
}

function closeSizeModal() {
    document.getElementById('size-modal').style.display = 'none';
    window.currentModalItem = null;
    window.selectedSize = null;
}

function closePromotionModal() {
    document.getElementById('promotion-modal').style.display = 'none';
}

function closeB1T1Modal() {
    document.getElementById('b1t1-modal').style.display = 'none';
}

// Payment selection function
function selectPayment(method) {
    // Store the selected payment method globally
    selectedPaymentMethod = method;
    
    const paymentOptions = document.querySelectorAll('.payment-option');
    paymentOptions.forEach(option => {
        const check = option.querySelector('.payment-check');
        check.style.backgroundColor = '#ddd';
        // Reset border to default
        option.style.border = '2px solid #e0e0e0';
        option.style.boxShadow = 'none';
        // Remove selected class if it exists
        option.classList.remove('payment-selected');
    });

    // Find the clicked option and highlight it
    const clickedOption = event.currentTarget;
    const selectedCheck = clickedOption.querySelector('.payment-check');
    selectedCheck.style.backgroundColor = '#5cb85c';
    // Add darker border and shadow for selected state
    clickedOption.style.border = '2px solid #2c5aa0';
    clickedOption.style.boxShadow = '0 2px 8px rgba(44, 90, 160, 0.3)';
    // Add selected class for easy identification
    clickedOption.classList.add('payment-selected');
}

// Cart functions
function addModalItemToCart() {
    if (!window.currentModalItem) return;

    const selectedAddons = getSelectedAddons();
    const selectedSize = window.selectedSize;

    addToCart(window.currentModalItem, selectedSize, selectedAddons);
    closeSizeModal();
}

function addToCart(item, selectedSize = null, addons = []) {
    if (!window.cartItems) {
        window.cartItems = [];
    }

    // Calculate base price and total addon price
    let basePrice;
    let sizeName;

    if (selectedSize) {
        basePrice = selectedSize.BasePrice || selectedSize.Price || 0;
        sizeName = selectedSize.Size || selectedSize.SizeName || 'Regular';
    } else if (item.Sizes && item.Sizes[0]) {
        basePrice = item.Sizes[0].BasePrice || item.Sizes[0].Price || 0;
        sizeName = item.Sizes[0].Size || item.Sizes[0].SizeName || 'Regular';
    } else {
        basePrice = item.BasePrice || item.Price || 0;
        sizeName = 'Regular';
    }

    const addonPrice = addons.reduce((sum, addon) => sum + addon.price, 0);
    const totalPrice = basePrice + addonPrice;

    const cartItem = {
        itemId: Date.now() + Math.random(),
        ProductName: item.Name,
        ProductID: item._id || item.id,
        Size: sizeName,
        AddOns: addons.map(addon => addon.name),
        Quantity: 1,
        BasePrice: totalPrice, // Include addon prices in base price for total calculation
        ImageLink: item.imagelink || ""
    };

    window.cartItems.push(cartItem);
    updateCartDisplay();
}

function updateCartDisplay() {
    const orderItemsContainer = document.getElementById('order-items');
    const totalItemsElement = document.getElementById('total-items');
    const subtotalElement = document.getElementById('subtotal');
    const totalElement = document.getElementById('total');

    if (!window.cartItems || window.cartItems.length === 0) {
        // Clear promo immediately when cart is empty
        if (selectedPromo) {
            selectedPromo = null;
            const promoSelect = document.getElementById('promo-select');
            if (promoSelect) promoSelect.value = '';
            
            // Clear labels immediately
            const promoAppliedElement = document.getElementById('promo-applied');
            const promoDetailsElement = document.getElementById('promo-details');
            const promoDiscountRow = document.getElementById('promo-discount-row');
            
            if (promoAppliedElement) {
                promoAppliedElement.textContent = '';
                promoAppliedElement.style.display = 'none';
            }
            if (promoDetailsElement) {
                promoDetailsElement.textContent = '';
                promoDetailsElement.style.display = 'none';
            }
            if (promoDiscountRow) promoDiscountRow.style.display = 'none';
        }
        
        // Force clear all promo elements even if selectedPromo was null
        const promoAppliedElement = document.getElementById('promo-applied');
        const promoDetailsElement = document.getElementById('promo-details');
        const promoDiscountRow = document.getElementById('promo-discount-row');
        
        if (promoAppliedElement) {
            promoAppliedElement.textContent = '';
            promoAppliedElement.style.display = 'none';
        }
        if (promoDetailsElement) {
            promoDetailsElement.textContent = '';
            promoDetailsElement.style.display = 'none';
        }
        if (promoDiscountRow) promoDiscountRow.style.display = 'none';
        
        orderItemsContainer.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No items in cart</div>';
        totalItemsElement.textContent = '0';
        subtotalElement.textContent = '₱ 0.00';
        totalElement.textContent = '₱ 0.00';
        
        // Reset promo when cart is empty
        selectedPromo = null;
        updatePromoAvailability();
        return;
    }

    let html = '';
    let totalItems = 0;
    let subtotal = 0;

    window.cartItems.forEach((item, index) => {
        const itemTotal = item.BasePrice * item.Quantity;
        totalItems += item.Quantity;
        subtotal += itemTotal;

        html += `
            <div class="order-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #eee;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; flex-shrink: 0;">
                        ${item.ImageLink ?
                            `<img src="${item.ImageLink}" alt="${item.ProductName}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px;">` :
                            `<div style="width: 40px; height: 40px; background: #f0f0f0; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #999;">No img</div>`
                        }
                    </div>
                    <div>
                        <div style="font-weight: 600; font-size: 14px;">${item.ProductName}</div>
                        <div style="font-size: 12px; color: #666;">${item.Size}</div>
                        ${item.AddOns && item.AddOns.length > 0 ? `<div style="font-size: 12px; color: #999;">+ ${item.AddOns.join(', ')}</div>` : ''}
                        ${item.isB1T1 ? `<div style="font-size: 11px; color: #4caf50; font-weight: 600;">🎁 B1T1 FREE</div>` : ''}
                    </div>
                </div>
                <div style="text-align: right;">
                    ${item.isB1T1 ? '<div style="font-weight: 600; text-decoration: line-through; color: #999;">₱ ' + Number(item.originalPrice || 0).toFixed(2) + '</div><div style="font-weight: 600; color: #4caf50;">₱ 0.00</div>' : '<div style="font-weight: 600;">₱ ' + itemTotal.toFixed(2) + '</div>'}
                    ${!item.isB1T1 ? `
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px;">
                        <!-- Quantity Controls -->
                        <button class="qty-btn qty-minus" onclick="updateQuantity(${index}, -1)"
                                style="width: 28px; height: 28px; border: none; background: #ffffff; color: #a05c2f; cursor: pointer; border-radius: 50%; font-family: 'Inter', sans-serif; font-size: 16px; font-weight: bold; line-height: 1; transition: all 0.15s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center;"
                                onmouseover="this.style.backgroundColor='#a05c2f'; this.style.color='white'; this.style.transform='scale(1.05)';"
                                onmouseout="this.style.backgroundColor='#ffffff'; this.style.color='#a05c2f'; this.style.transform='scale(1)';"
                                onmousedown="this.style.transform='scale(0.95)';"
                                onmouseup="this.style.transform='scale(1.05)';"
                                title="Decrease quantity">−</button>

                        <span style="min-width: 32px; text-align: center; font-weight: 700; font-size: 15px; margin-top: 12px; color: #372b2a; font-family: 'Inter', sans-serif;">${item.Quantity}</span>

                        <button class="qty-btn qty-plus" onclick="updateQuantity(${index}, 1)"
                                style="width: 28px; height: 28px; border: none; background: #ffffff; color: #a05c2f; cursor: pointer; border-radius: 50%; font-family: 'Inter', sans-serif; font-size: 16px; font-weight: bold; line-height: 1; transition: all 0.15s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center;"
                                onmouseover="this.style.backgroundColor='#a05c2f'; this.style.color='white'; this.style.transform='scale(1.05)';"
                                onmouseout="this.style.backgroundColor='#ffffff'; this.style.color='#a05c2f'; this.style.transform='scale(1)';"
                                onmousedown="this.style.transform='scale(0.95)';"
                                onmouseup="this.style.transform='scale(1.05)';"
                                title="Increase quantity">+</button>

                        <!-- Remove Button -->
                        <button class="remove-btn" onclick="removeFromCart(${index})"
                                style="width: 32px; height: 32px; border: 2px solid #dc3545; background: #dc3545; color: white; cursor: pointer; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 12px; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center;"
                                onmouseover="this.style.backgroundColor='#c82333'; this.style.borderColor='#c82333'; this.style.transform='scale(1.05)';"
                                onmouseout="this.style.backgroundColor='#dc3545'; this.style.borderColor='#dc3545'; this.style.transform='scale(1)';"
                                title="Remove item">
                            <i class="fa-solid fa-trash" style="font-size: 11px;"></i>
                        </button>
                    </div>
                    ` : `
                    <div style="margin-top: 10px;">
                        <button class="remove-btn" onclick="removeFromCart(${index})"
                                style="width: 32px; height: 32px; border: 2px solid #dc3545; background: #dc3545; color: white; cursor: pointer; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 12px; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center;"
                                onmouseover="this.style.backgroundColor='#c82333'; this.style.borderColor='#c82333'; this.style.transform='scale(1.05)';"
                                onmouseout="this.style.backgroundColor='#dc3545'; this.style.borderColor='#dc3545'; this.style.transform='scale(1)';"
                                title="Remove item">
                            <i class="fa-solid fa-trash" style="font-size: 11px;"></i>
                        </button>
                    </div>
                    `}
                    ${(() => {
                        if (!item.isB1T1 && !item.b1t1Used) {
                            const menuData = JSON.parse(document.getElementById('menu-data').textContent);
                            const menuItem = menuData.find(mItem => mItem._id === item.ProductID || mItem.id === item.ProductID || mItem.Name === item.ProductName);
                            if (menuItem && menuItem.Category !== 'Pastries') {
                                return `<button class="b1t1-btn" onclick="showB1T1Modal('${menuItem.Category.replace(/'/g, "\\'")}', '${item.Size.replace(/'/g, "\\'")}', ${index})"
                                        style="margin-top: 8px; padding: 8px 12px; background: #8B4513; color: white; border: none; border-radius: 8px; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; transition: all 0.2s ease;"
                                        onmouseover="this.style.backgroundColor='#a05c2f'; this.style.transform='scale(1.05)';"
                                        onmouseout="this.style.backgroundColor='#8B4513'; this.style.transform='scale(1)';"
                                        title="Buy 1 Take 1">🛍️ B1T1</button>`;
                            }
                        }
                        return '';
                    })()}
                </div>
            </div>
        `;
    });

    // Add promotional information
    const promoSets = checkBuy3For143(window.cartItems);
    const savings = calculateBuy3For143Savings(window.cartItems);
    if (promoSets > 0 && savings > 0) {
        html += `
            <div style="background: #e8f5e8; border: 1px solid #4caf50; border-radius: 8px; padding: 12px; margin: 12px 0;">
                <div style="display: flex; align-items: center; gap: 8px; color: #2e7d32; font-weight: 600; font-size: 14px;">
                    <span>🎉</span>
                    <span>Buy 3 for ₱143 Applied!</span>
                </div>
                <div style="color: #2e7d32; font-size: 12px; margin-top: 4px;">
                    You save ₱${savings.toFixed(2)} on ${promoSets} set${promoSets > 1 ? 's' : ''} of drinks
                </div>
            </div>
        `;
    }

    orderItemsContainer.innerHTML = html;
    totalItemsElement.textContent = totalItems.toString();

    // Update promo availability based on cart content first (this will reset selectedPromo if invalid)
    updatePromoAvailability();

    // Update promotional labels
    const promoAppliedElement = document.getElementById('promo-applied');
    const promoDetailsElement = document.getElementById('promo-details');
    
    // Clear labels first to ensure fresh start
    if (promoAppliedElement) promoAppliedElement.textContent = '';
    if (promoDetailsElement) {
        promoDetailsElement.textContent = '';
        promoDetailsElement.style.display = 'none';
    }
    
    const b1t1Applied = window.cartItems && window.cartItems.some(item => item.isB1T1);
    const buy3Applied = window.cartItems && calculateBuy3For143Savings(window.cartItems) > 0;

    let promoLabels = [];
    let promoDetails = '';
    
    // Only add dropdown promo if it exists, cart has items, and promo is still applicable
    if (selectedPromo && window.cartItems && window.cartItems.length > 0 && isPromoApplicableToCart(selectedPromo)) {
        promoLabels.push(`${selectedPromo.event} (-${selectedPromo.discountPercentage}%)`);
        promoDetails = `${selectedPromo.description} • ${selectedPromo.discountPercentage}% discount on ${selectedPromo.category} items`;
    } else if (selectedPromo) {
        // If we reach here, selectedPromo exists but is not applicable - clear it
        selectedPromo = null;
        const promoSelect = document.getElementById('promo-select');
        if (promoSelect) promoSelect.value = '';
    }
    
    if (b1t1Applied) promoLabels.push('B1T1');
    if (buy3Applied) promoLabels.push('Buy 3 for ₱143');

    promoAppliedElement.textContent = promoLabels.length > 0 ? promoLabels.join(', ') : '';
    promoAppliedElement.style.textAlign = 'left';
    
    if (promoLabels.length > 0) {
        promoAppliedElement.style.display = 'block';
    } else {
        promoAppliedElement.style.display = 'none';
    }
    
    if (promoDetails) {
        promoDetailsElement.textContent = promoDetails;
        promoDetailsElement.style.display = 'block';
        promoDetailsElement.style.marginBottom = '20px';
    } else {
        promoDetailsElement.style.display = 'none';
    }

    subtotalElement.textContent = `₱ ${subtotal.toFixed(2)}`;

    // Calculate promotional total (including selected promo discount)
    let promotionalTotal = calculatePromotionalTotal(window.cartItems);
    let promoDiscountAmount = 0;
    
    // Apply selected promo discount (only if promo is still applicable)
    if (selectedPromo && isPromoApplicableToCart(selectedPromo)) {
        const menuData = JSON.parse(document.getElementById('menu-data').textContent);
        
        window.cartItems.forEach(cartItem => {
            const menuItem = menuData.find(item => item.Name === cartItem.ProductName);
            if (menuItem && menuItem.Category === selectedPromo.category) {
                const itemTotal = cartItem.BasePrice * cartItem.Quantity;
                promoDiscountAmount += itemTotal * (selectedPromo.discountPercentage / 100);
            }
        });
        
        promotionalTotal -= promoDiscountAmount;
    }

    // Update promo discount row display
    const promoDiscountRow = document.getElementById('promo-discount-row');
    const promoDiscountElement = document.getElementById('promo-discount');
    if (promoDiscountAmount > 0) {
        promoDiscountRow.style.display = 'flex';
        promoDiscountElement.textContent = `-₱ ${promoDiscountAmount.toFixed(2)}`;
    } else {
        promoDiscountRow.style.display = 'none';
    }
    
    totalElement.textContent = `₱ ${promotionalTotal.toFixed(2)}`;

    // Handle delivery fee
    const deliveryType = document.getElementById('delivery-type').value;
    const deliveryFeeRow = document.getElementById('delivery-fee-row');
    let finalTotal = promotionalTotal;

    if (deliveryType === 'Delivery') {
        deliveryFeeRow.style.display = 'flex';
        finalTotal += 20;
        totalElement.textContent = `₱ ${finalTotal.toFixed(2)}`;
    } else {
        deliveryFeeRow.style.display = 'none';
    }
}

function updateQuantity(index, change) {
    if (!window.cartItems || !window.cartItems[index]) return;

    window.cartItems[index].Quantity += change;

    if (window.cartItems[index].Quantity <= 0) {
        const itemToRemove = window.cartItems[index];

        // If this is a basis drink that availed B1T1, remove all associated free drinks
        if (itemToRemove.b1t1Used) {
            // Remove from end to start to avoid index issues
            for (let i = window.cartItems.length - 1; i >= 0; i--) {
                if (window.cartItems[i].b1t1BasisId === itemToRemove.itemId && window.cartItems[i].isB1T1) {
                    window.cartItems.splice(i, 1);
                }
            }
        }

        // Now remove the main item
        window.cartItems.splice(index, 1);
        
        // Check if promo is still valid after removal, reset if not
        if (selectedPromo && !isPromoApplicableToCart(selectedPromo)) {
            selectedPromo = null;
            const promoSelect = document.getElementById('promo-select');
            if (promoSelect) promoSelect.value = '';
        }
    }

    updateCartDisplay();
}

function removeFromCart(index) {
    if (!window.cartItems || !window.cartItems[index]) return;

    const itemToRemove = window.cartItems[index];

    // If this is a basis drink that availed B1T1, remove all associated free drinks
    if (itemToRemove.b1t1Used) {
        // Remove from end to start to avoid index issues
        for (let i = window.cartItems.length - 1; i >= 0; i--) {
            if (window.cartItems[i].b1t1BasisId === itemToRemove.itemId && window.cartItems[i].isB1T1) {
                window.cartItems.splice(i, 1);
            }
        }
    }

    // Now remove the main item
    window.cartItems.splice(index, 1);
    
    // Check if promo is still valid after removal, reset if not
    if (selectedPromo && !isPromoApplicableToCart(selectedPromo)) {
        selectedPromo = null;
        const promoSelect = document.getElementById('promo-select');
        if (promoSelect) promoSelect.value = '';
    }
    
    updateCartDisplay();
}

// Order submission following Website format from Orders collection
function submitOrder() {
    const cart = getOrderItems();
    const customerName = document.getElementById('customer-name').value;
    const contactNumber = document.getElementById('contact-number').value;
    const deliveryType = document.getElementById('delivery-type').value;
    const streetAddress = document.getElementById('street-address').value;
    const areaSelect = document.getElementById('area-select').value;
    const notes = document.getElementById('notes-textarea').value;
    const paymentMethod = getSelectedPaymentMethod();
    const itemTotal = cart.reduce((sum, item) => sum + item.Quantity, 0);
    let total = calculatePromotionalTotal(cart);

    // Add delivery fee for delivery orders
    if (deliveryType === 'Delivery') {
        total += 20;
    }

    // Generate current date in the format from Orders collection
    const now = new Date();
    const dateStr = now.getFullYear() + '-' +
                   String(now.getMonth() + 1).padStart(2, '0') + '-' +
                   String(now.getDate()).padStart(2, '0') + ' ' +
                   String(now.getHours()).padStart(2, '0') + ':' +
                   String(now.getMinutes()).padStart(2, '0') + ':' +
                   String(now.getSeconds()).padStart(2, '0');

    const orderData = {
        OrderID: generateOrderID(),
        Date: new Date().toISOString(),
        Source: "POS",
        Cart: cart.map(item => ({
            ProductName: item.ProductName,
            ProductID: item.ProductID,
            Size: item.Size,
            Addons: item.AddOns || [],
            Quantity: item.Quantity,
            Price: item.BasePrice,
            ImageLink: item.ImageLink || ""
        })),
        Customer: {
            fullname: customerName,
            email: '',
            contactnumber: contactNumber,
            deliveryMethod: deliveryType
        },
        Total: total,
        Notes: notes,
        PaymentStatus: paymentMethod === "cash" ? "Payment pending" : "Pending",
        FulfillmentStatus: "Preparing",
        FulfillmentMethod: deliveryType,
        PaymentMethod: paymentMethod,
        PaymentMode: paymentMethod === "cash" ? "Cash on Hand" : "E-Payment",
        cashierName: user ? user.fullname : "Staff"
    };

    // Add XenditPaymentID if e-payment is selected
    if (paymentMethod === "epayment") {
        orderData.XenditPaymentID = generateXenditPaymentId();
    }

    return orderData;
}

function generateOrderID() {
    const now = new Date();
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const dayStr = String(now.getDate()).padStart(2, '0');
    const hourStr = String(now.getHours()).padStart(2, '0');
    const minuteStr = String(now.getMinutes()).padStart(2, '0');
    return `${monthStr}${dayStr}${hourStr}${minuteStr}-BLESSINGSCAFE`;
}

function generateCustomerId() {
    return `Customer#${Math.floor(Math.random() * 100000)}`;
}

function generateXenditPaymentId() {
    return Math.random().toString(16).substring(2, 26);
}

// Helper function to get selected payment method
function getSelectedPaymentMethod() {
    // First check if we have a globally stored selection
    if (selectedPaymentMethod) {
        return selectedPaymentMethod;
    }
    
    // Fallback: check for selected class or visual indicators
    const selectedOption = document.querySelector('.payment-option.payment-selected');
    if (selectedOption) {
        // Try to determine payment method from onclick attribute
        const onclickStr = selectedOption.getAttribute('onclick') || '';
        if (onclickStr.includes("'cash'") || onclickStr.includes('"cash"')) {
            return 'cash';
        } else if (onclickStr.includes("'epayment'") || onclickStr.includes('"epayment"')) {
            return 'epayment';
        }
    }
    
    // Final fallback: check visual styling
    const paymentOptions = document.querySelectorAll('.payment-option');
    for (let option of paymentOptions) {
        const check = option.querySelector('.payment-check');
        if (check && (check.style.backgroundColor === '#5cb85c' || 
                     check.style.backgroundColor === 'rgb(92, 184, 92)')) {
            const onclickStr = option.getAttribute('onclick') || '';
            if (onclickStr.includes("'cash'") || onclickStr.includes('"cash"')) {
                return 'cash';
            } else if (onclickStr.includes("'epayment'") || onclickStr.includes('"epayment"')) {
                return 'epayment';
            }
        }
    }
    
    return null; // No payment method explicitly selected
}

// Helper function to calculate total (this should match your existing calculation logic)
function calculateTotal() {
    const subtotalElement = document.getElementById('subtotal');
    if (subtotalElement) {
        const subtotalText = subtotalElement.textContent.replace('₱ ', '').replace(',', '');
        return parseFloat(subtotalText) || 0;
    }
    return 0;
}

// Helper function to get order items (this should match your existing cart logic)
function getOrderItems() {
    // This function should return the current cart items
    // You'll need to implement this based on how your cart is structured
    // For now, returning empty array - you should replace this with actual cart logic
    return window.cartItems || [];
}

function checkB1T1Eligibility(cart, category = null) {
    // Check if cart has eligible drinks for B1T1
    let eligibleDrinks = [];
    cart.forEach((item, index) => {
        if (item.ProductName && item.ProductName.toLowerCase().indexOf('pastry') === -1 && !item.isB1T1) {
            const menuItem = getMenuItem(item.ProductID, item.ProductName);
            if (!category || (menuItem && menuItem.Category === category)) {
                eligibleDrinks.push({ ...item, cartIndex: index });
            }
        }
    });

    return eligibleDrinks.length > 0 ? eligibleDrinks : null;
}

function getMenuDrinksWithSize(category, basisSize) {
    const menuData = JSON.parse(document.getElementById('menu-data').textContent);
    let availableDrinks = [];
    menuData.forEach(menuItem => {
        if (menuItem.Category === category && menuItem.Category !== 'Pastries') {
            const sizeObj = menuItem.Sizes ? menuItem.Sizes.find(s => (s.SizeName || s.Size) === basisSize) : null;
            if (sizeObj) {
                availableDrinks.push({ menuItem, sizeObj });
            }
        }
    });
    return availableDrinks;
}

// Helper function to get menu item by ProductID or Name
function getMenuItem(productID, productName) {
    const menuData = JSON.parse(document.getElementById('menu-data').textContent);
    return menuData.find(item => item._id === productID || item.id === productID || item.Name === productName);
}

// Promotion functions - Buy 3 for ₱143 (EXCLUDES PASTRIES)
function checkBuy3For143(cart) {
    let drinkCount = 0;
    cart.forEach(item => {
        // Get menu item to check category
        const menuItem = getMenuItem(item.ProductID, item.ProductName);

        // Only count drinks (non-pastries) for the promotion
        if (item.ProductName &&
            item.ProductName.toLowerCase().indexOf('pastry') === -1 &&
            (!menuItem || menuItem.Category !== 'Pastries')) {
            drinkCount += item.Quantity || 1;
        }
    });

    const promoSets = Math.floor(drinkCount / 3);
    return promoSets > 0 ? promoSets : 0;
}

function calculateBuy3For143Savings(cart) {
    const promoSets = checkBuy3For143(cart);
    if (promoSets === 0) return 0;

    let drinkItems = [];
    cart.forEach(item => {
        // Get menu item to check category
        const menuItem = getMenuItem(item.ProductID, item.ProductName);

        // Only include drinks (non-pastries) for savings calculation
        if (item.ProductName &&
            item.ProductName.toLowerCase().indexOf('pastry') === -1 &&
            (!menuItem || menuItem.Category !== 'Pastries')) {
            drinkItems.push(item);
        }
    });

    // Calculate total drinks count
    let totalDrinkCount = 0;
    drinkItems.forEach(item => {
        totalDrinkCount += item.Quantity || 1;
    });

    const completeSets = Math.floor(totalDrinkCount / 3);

    if (completeSets === 0) return 0;

    // Sort all drinks by price to apply promotion optimally
    const allDrinks = [];
    drinkItems.forEach(item => {
        for (let i = 0; i < (item.Quantity || 1); i++) {
            allDrinks.push({
                price: item.BasePrice || 0,
                name: item.ProductName
            });
        }
    });

    // Sort by price ascending (cheapest first)
    allDrinks.sort((a, b) => a.price - b.price);

    let totalSavings = 0;

    // Process drinks in groups of 3
    for (let setIndex = 0; setIndex < completeSets; setIndex++) {
        const setStart = setIndex * 3;
        const setDrinks = allDrinks.slice(setStart, setStart + 3);

        // Calculate normal price for this set of 3
        const normalSetPrice = setDrinks.reduce((sum, drink) => sum + drink.price, 0);

        // Only count savings if normal price is more than ₱143
        if (normalSetPrice > 143) {
            totalSavings += normalSetPrice - 143;
        }
    }

    return totalSavings;
}

function checkB1T1Eligibility(cart, category = null) {
    // Check if cart has eligible drinks for B1T1
    let eligibleDrinks = [];
    cart.forEach((item, index) => {
        if (item.ProductName && item.ProductName.toLowerCase().indexOf('pastry') === -1 && !item.isB1T1) {
            const menuItem = getMenuItem(item.ProductID, item.ProductName);
            if (!category || (menuItem && menuItem.Category === category)) {
                eligibleDrinks.push({ ...item, cartIndex: index });
            }
        }
    });

    return eligibleDrinks.length > 0 ? eligibleDrinks : null;
}

function showB1T1Modal(category, basisSize, basisIndex) {
    const availableDrinks = getMenuDrinksWithSize(category, basisSize);
    if (!availableDrinks || availableDrinks.length === 0) {
        alert('No eligible drinks for Buy 1 Take 1 promotion in this category and size.');
        return;
    }

    // Store drink options and basis index globally to avoid JSON stringify issues
    window.b1t1Options = availableDrinks;
    window.b1t1BasisIndex = basisIndex;

    const modal = document.getElementById('b1t1-modal');
    const drinkOptions = document.getElementById('b1t1-drink-options');

    let html = '';
    availableDrinks.forEach((drink, index) => {
        html += `
            <div class="b1t1-drink-option" onclick="selectB1T1DrinkFromIndex(${index})" style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 2px solid #e1e5e9; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                <div style="width: 40px; height: 40px; flex-shrink: 0;">
                    ${drink.menuItem.imagelink ?
                        `<img src="${drink.menuItem.imagelink}" alt="${drink.menuItem.Name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px;">` :
                        `<div style="width: 40px; height: 40px; background: #f0f0f0; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #999;">No img</div>`
                    }
                </div>
                <div>
                    <div style="font-weight: 600; font-size: 14px;">${drink.menuItem.Name}</div>
                    <div style="font-size: 12px; color: #666;">${basisSize}</div>
                </div>
                <div style="margin-left: auto; font-size: 12px; color: #a05c2f; font-weight: 600;">FREE</div>
            </div>
        `;
    });

    drinkOptions.innerHTML = html;
    modal.style.display = 'flex';
}

function selectB1T1DrinkFromIndex(index) {
    const drinkData = window.b1t1Options[index];
    if (!drinkData) return;

    addToCart(drinkData.menuItem, drinkData.sizeObj);
    const freeItemIndex = window.cartItems.length - 1;
    const calculatedPrice = window.cartItems[freeItemIndex].BasePrice; // Store calculated price before setting to 0
    window.cartItems[freeItemIndex].originalPrice = calculatedPrice;
    window.cartItems[freeItemIndex].isB1T1 = true;
    window.cartItems[freeItemIndex].b1t1BasisId = window.cartItems[window.b1t1BasisIndex].itemId; // Track which basis drink this free drink belongs to
    window.cartItems[freeItemIndex].BasePrice = 0;
    window.cartItems[freeItemIndex].ProductName += ' (B1T1 FREE)';

    // Mark the basis item as having used B1T1
    if (window.b1t1BasisIndex >= 0) {
        window.cartItems[window.b1t1BasisIndex].b1t1Used = true;
    }

    updateCartDisplay();
    closeB1T1Modal();
    showPromotionMessage('Buy 1 Take 1 promotion applied! You get one free drink.');
}

function showBuy3For143Modal() {
    const promoSets = checkBuy3For143(window.cartItems || []);
    if (promoSets === 0) {
        alert('You need at least 3 drinks to apply the Buy 3 for ₱143 promotion.');
        return;
    }

    // Check if promotion will actually save money
    const savings = calculateBuy3For143Savings(window.cartItems || []);
    if (savings <= 0) {
        alert('The Buy 3 for ₱143 promotion does not apply because your drinks cost ₱143 or less combined.');
        return;
    }

    // Promotion is applied automatically in calculatePromotionalTotal()
    // Just refresh the display to show current promotional state
    updateCartDisplay();

    // Show success message with correct savings
    showPromotionMessage(`Buy 3 for ₱143 promotion applied! You save ₱${savings.toFixed(2)} on ${promoSets} set${promoSets > 1 ? 's' : ''} of drinks.`);
}

// Generate a unique customer name with format "Customer#XXXXX" (range 10000-99999, 90,000 possible unique names)
function generateUniqueCustomerName() {
    // Generate random number between 10000 and 99999
    const customerNumber = Math.floor(Math.random() * 90000) + 10000;
    return `Customer#${customerNumber}`;
}

function showFeedbackMessage(message, type = 'success') {
    // Neutral/minimalist design with white background and black text
    const borderColor = type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196F3';
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'i';

    // Create a temporary message element
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        color: black;
        padding: 16px 20px;
        border: 2px solid ${borderColor};
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        z-index: 10000;
        font-weight: 500;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        line-height: 1.4;
    `;
    messageDiv.innerHTML = `<span style="color: ${borderColor}; font-weight: 600; margin-right: 8px;">${icon}</span>${message}`;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(messageDiv);

    // Remove after 4 seconds
    const duration = 4000;
    setTimeout(() => {
        messageDiv.style.animation = 'slideIn 0.3s ease-in reverse';
        setTimeout(() => {
            if (document.body.contains(messageDiv)) {
                document.body.removeChild(messageDiv);
            }
        }, 300);
    }, duration);
}

function validateOrderInputs() {
    const customerName = document.getElementById('customer-name').value.trim();
    const deliveryType = document.getElementById('delivery-type').value;
    const cartItems = window.cartItems || [];

    let errors = [];

    // Check if customer name is provided (skip for Take-Out orders)
    if (!customerName && deliveryType !== 'Take-Out') {
        errors.push('Customer name is required');
    }

    // Check if cart has items
    if (!cartItems || cartItems.length === 0) {
        errors.push('Please add items to the cart');
    }

    // Check address for delivery
    if (deliveryType === 'Delivery') {
        const streetAddress = document.getElementById('street-address').value.trim();
        const areaSelect = document.getElementById('area-select').value;

        if (!streetAddress) {
            errors.push('Street address is required for delivery');
        }
        if (!areaSelect || areaSelect === '') {
            errors.push('Please select an area for delivery');
        }
    }

    // Check payment method selection
    const paymentMethod = getSelectedPaymentMethod();
    if (!paymentMethod || (paymentMethod !== 'cash' && paymentMethod !== 'epayment')) {
        errors.push('Please select a payment method');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Proceed with order function
function proceedOrder() {
    // Validate inputs
    const validation = validateOrderInputs();
    if (!validation.isValid) {
        showFeedbackMessage(validation.errors.join('\n'), 'error');
        return;
    }

    // Show order confirmation modal
    showOrderConfirmation();
}

function showOrderConfirmation() {
    let customerName = document.getElementById('customer-name').value.trim();
    const contactNumber = document.getElementById('contact-number').value.trim();
    const deliveryType = document.getElementById('delivery-type').value;
    const streetAddress = document.getElementById('street-address').value.trim();
    const areaSelect = document.getElementById('area-select').value;
    const notes = document.getElementById('notes-textarea').value.trim();
    const paymentMethod = getSelectedPaymentMethod();
    const cartItems = window.cartItems || [];

    // Auto-generate customer name for Take-Out orders if not provided
    if (deliveryType === 'Take-Out' && !customerName) {
        customerName = generateUniqueCustomerName();
        // Update the form field to show the generated name
        document.getElementById('customer-name').value = customerName;
    }

    let confirmMessage = `Customer: ${customerName}\n`;
    if (contactNumber) confirmMessage += `Contact: ${contactNumber}\n\n`;
    confirmMessage += `Delivery Type: ${deliveryType}\n`;

    if (deliveryType === 'Delivery') {
        confirmMessage += `Address: ${streetAddress}, ${areaSelect}\n\n`;
    } else {
        confirmMessage += `\n`;
    }

    confirmMessage += `Order Items:\n`;
    let itemCount = 0;
    cartItems.forEach(item => {
        itemCount += item.Quantity;
        confirmMessage += `- ${item.ProductName} (x${item.Quantity}) - ₱${(item.BasePrice * item.Quantity).toFixed(2)}\n`;
        if (item.AddOns && item.AddOns.length > 0) {
            confirmMessage += `  Add-ons: ${item.AddOns.join(', ')}\n`;
        }
    });

    confirmMessage += `\nTotal Items: ${itemCount}\n`;
    const subtotal = cartItems.reduce((sum, item) => sum + (item.BasePrice * item.Quantity), 0);
    confirmMessage += `Subtotal: ₱${subtotal.toFixed(2)}\n`;

    const promotionalTotal = calculatePromotionalTotal(cartItems);
    let finalTotal = promotionalTotal;
    let deliveryFee = 0;

    if (deliveryType === 'Delivery') {
        deliveryFee = 20;
        finalTotal += deliveryFee;
    }

    if (promotionalTotal < subtotal) {
        const savings = subtotal - promotionalTotal;
        confirmMessage += `Discount Applied: ₱${savings.toFixed(2)}\n`;
    }

    if (deliveryFee > 0) {
        confirmMessage += `Delivery Fee: ₱${deliveryFee.toFixed(2)}\n`;
    }

    confirmMessage += `Total: ₱${finalTotal.toFixed(2)}\n\n`;
    confirmMessage += `Payment Method: ${paymentMethod === 'cash' ? 'Cash on Hand' : 'E-Payment'}`;

    if (notes) {
        confirmMessage += `\n\nNotes: ${notes}`;
    }

    // Set the confirmation message
    const confirmMessageElement = document.getElementById('confirm-message');
    confirmMessageElement.textContent = confirmMessage;

    // Setup confirmation buttons
    const confirmSubmitBtn = document.getElementById('confirm-submit-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

    // Ensure buttons are visible
    if (confirmSubmitBtn) {
        confirmSubmitBtn.style.display = '';
        confirmSubmitBtn.disabled = false;
    }
    if (confirmCancelBtn) {
        confirmCancelBtn.style.display = '';
        confirmCancelBtn.disabled = false;
    }

    // Remove previous event listeners by cloning and replacing
    if (confirmSubmitBtn && confirmCancelBtn) {
        const newConfirmSubmitBtn = confirmSubmitBtn.cloneNode(true);
        const newConfirmCancelBtn = confirmCancelBtn.cloneNode(true);

        confirmSubmitBtn.parentNode.replaceChild(newConfirmSubmitBtn, confirmSubmitBtn);
        confirmCancelBtn.parentNode.replaceChild(newConfirmCancelBtn, confirmCancelBtn);

        // Add new event listeners
        newConfirmSubmitBtn.addEventListener('click', () => {
            finalizeOrder();
        });

        newConfirmCancelBtn.addEventListener('click', closeOrderConfirmation);
    }

    // Show the modal
    document.getElementById('order-confirm-modal').classList.remove('hidden');
}

function showOrderConfirmationProcessing() {
    // Hide confirmation state and show processing state
    document.getElementById('confirm-state').style.display = 'none';
    document.getElementById('processing-state').style.display = 'block';
    document.getElementById('success-state').style.display = 'none';

    // Change title
    document.getElementById('confirm-title').textContent = 'Processing Order';
}

function showOrderConfirmationSuccess() {
    // Hide processing state and show success state
    document.getElementById('confirm-state').style.display = 'none';
    document.getElementById('processing-state').style.display = 'none';
    document.getElementById('success-state').style.display = 'block';

    // Change title
    document.getElementById('confirm-title').textContent = 'Order Confirmed';

    // Add event listener to OK button
    const successOkBtn = document.getElementById('success-ok-btn');
    if (successOkBtn) {
        // Remove any existing listeners first
        const newSuccessOkBtn = successOkBtn.cloneNode(true);
        successOkBtn.parentNode.replaceChild(newSuccessOkBtn, successOkBtn);
        
        // Add new event listener
        newSuccessOkBtn.addEventListener('click', closeOrderConfirmation);
    }
}

function resetOrderConfirmationModal() {
    // Show confirmation state and hide others
    document.getElementById('confirm-state').style.display = 'block';
    document.getElementById('processing-state').style.display = 'none';
    document.getElementById('success-state').style.display = 'none';

    // Reset title
    document.getElementById('confirm-title').textContent = 'Confirm Order';

    // Ensure buttons are visible and properly reset
    const confirmSubmitBtn = document.getElementById('confirm-submit-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

    if (confirmSubmitBtn) {
        confirmSubmitBtn.style.display = '';
        confirmSubmitBtn.disabled = false;
    }
    if (confirmCancelBtn) {
        confirmCancelBtn.style.display = '';
        confirmCancelBtn.disabled = false;
    }
}

function closeOrderConfirmation() {
    document.getElementById('order-confirm-modal').classList.add('hidden');
    resetOrderConfirmationModal();
}

async function finalizeOrder() {
    const paymentMethod = getSelectedPaymentMethod();
    const orderData = submitOrder();

    // Hide the confirmation buttons to prevent multiple clicks
    document.getElementById('confirm-submit-btn').style.display = 'none';
    document.getElementById('confirm-cancel-btn').style.display = 'none';

    try {
        // Check inventory availability before creating order (like checkout.js)
        const cartItems = window.cartItems || [];
        const inventoryCheck = await fetch('/api/inventory/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                Cart: cartItems.map(item => ({
                    ProductName: item.ProductName,
                    ProductID: item.ProductID,
                    Size: item.Size,
                    Addons: item.AddOns || [],
                    Quantity: item.Quantity,
                    Price: item.BasePrice,
                    ImageLink: item.ImageLink || ""
                }))
            })
        });

        if (!inventoryCheck.ok) {
            const inventoryError = await inventoryCheck.json();

            if (inventoryCheck.status === 409) {
                // Log detailed error information for debugging
                console.log('Inventory check failed - detailed information:');
                console.log('Full error response:', inventoryError);

                // Log each unavailable item with details
                inventoryError.unavailableItems.forEach(item => {
                    console.log(`Unavailable item: ${item.item} - Reason: ${item.reason}`);
                    if (item.missingIngredients && item.missingIngredients.length > 0) {
                        item.missingIngredients.forEach(ing => {
                            if (ing.type === 'addon') {
                                console.log(`  Missing add-on: ${ing.name} - Need: ${ing.needed}, Available: ${ing.available}`);
                            } else {
                                console.log(`  Missing ingredient: ${ing.name} - Need: ${ing.needed}g, Available: ${ing.available}g`);
                            }
                        });
                    }
                });

                // Customer-friendly message
                const unavailableItemNames = inventoryError.unavailableItems.map(item => item.item);
                let customerMessage;

                if (unavailableItemNames.length === 1) {
                    customerMessage = `Sorry, ${unavailableItemNames[0]} is currently unavailable due to insufficient ingredients.\n\nPlease choose a different item or modify your order.`;
                } else {
                    customerMessage = `Sorry, the following items are currently unavailable:\n\n${unavailableItemNames.map(name => `• ${name}`).join('\n')}\n\nPlease choose different items or modify your order.`;
                }

                alert(customerMessage);
                resetOrderConfirmationModal();
                return;
            } else {
                throw new Error(inventoryError.error || 'Inventory check failed');
            }
        }

        // Continue with order processing if inventory is available
        if (paymentMethod === 'cash') {
            // Show processing state for cash payment
            showOrderConfirmationProcessing();

            // Submit order and handle success
            submitToServer(orderData);
        } else if (paymentMethod === 'epayment') {
            // Immediately show processing state for e-payment
            showOrderConfirmationProcessing();
            // Show payment gateway
            showXenditGateway(orderData);
        }
    } catch (error) {
        console.error('Order processing error:', error);
        alert('An error occurred during order processing. Please try again.');
        resetOrderConfirmationModal();
    }
}

async function submitToServer(orderData) {
    try {
        const response = await fetch('/staff/orders/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // Show success state with confirm button
            showOrderConfirmationSuccess();
            showFeedbackMessage('Order submitted successfully!', 'success');
            clearOrderForm();
        } else {
            throw new Error(result.message || 'Failed to submit order');
        }
    } catch (error) {
        console.error('Order submission error:', error);
        showFeedbackMessage('Failed to submit order. Please try again.', 'error');
        // Reset modal to default state on error
        resetOrderConfirmationModal();
    }
}

async function showXenditGateway(orderData) {
    const gatewayModal = document.getElementById('xendit-gateway-modal');
    const loadingElement = document.getElementById('xendit-gateway-loading');
    const detailsElement = document.getElementById('xendit-gateway-details');

    // Show loading
    loadingElement.style.display = 'block';
    detailsElement.style.display = 'none';
    gatewayModal.classList.remove('hidden');

    try {
        // Create order first like in checkout.js
        const createOrderResponse = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (!createOrderResponse.ok) {
            throw new Error('Failed to create order');
        }

        const orderResult = await createOrderResponse.json();
        currentOrderId = orderResult.orderId;

        // Get customer data for invoice
        const customerName = document.getElementById('customer-name').value.trim();
        const contactNumber = document.getElementById('contact-number').value.trim();
        const email = user?.email || "";

        // Build minimal customer object (only include non-empty fields)
        const customerData = {
            given_names: customerName || user?.fullname || 'POS Customer'
        };

        if (email.trim()) {
            customerData.email = email.trim();
        }

        if (contactNumber.trim()) {
            customerData.mobile_number = contactNumber.trim();
        }

        // Create Xendit payment invoice with proper payload
        const invoicePayload = {
            external_id: orderResult.orderId,
            amount: orderData.Total,
            currency: 'PHP',
            description: `Payment for Order ${orderResult.orderId}`,
            customer: customerData,
            payment_methods: ['SHOPEEPAY', 'PAYMAYA', 'GCASH', 'QRPH'], // Philippine e-wallets and QR
            customer_notification_preference: {
                invoice_created: email.trim() ? ['email'] : [],
                reminding: email.trim() ? ['email'] : [],
                payment_attempt: email.trim() ? ['email'] : []
            },
            // Fix expiry format - use invoice_duration to match checkout.js working implementation
            invoice_duration: 600 // 10 minutes in seconds
        };

        const paymentResponse = await fetch('/api/xendit/create-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(invoicePayload)
        });

        if (!paymentResponse.ok) {
            const errorData = await paymentResponse.text();
            throw new Error(`Failed to create payment: ${errorData}`);
        }

        const paymentData = await paymentResponse.json();

        // Save payment ID to order
        await fetch(`/api/orders/update-payment-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                paymentId: paymentData.external_id,
                invoiceId: paymentData.id,
                status: 'Pending'
            })
        });

        // Show payment amount
        const total = orderData.Total.toFixed(2);
        document.getElementById('xendit-payment-amount').textContent = total;

        // Use real invoice_url from Xendit API
        const paymentUrl = paymentData.invoice_url;

        if (paymentUrl) {
            const linkElement = document.getElementById('xendit-payment-link');
            linkElement.href = paymentUrl;

            // Try to open payment window
            let paymentWindow;
            try {
                paymentWindow = window.open(paymentUrl, '_blank');

                if (!paymentWindow || paymentWindow.closed || typeof paymentWindow.closed === 'undefined') {
                    // Popup blocked - show fallback
                    const paymentWindowStatus = document.getElementById('payment-window-status') || document.createElement('p');
                    if (!document.getElementById('payment-window-status')) {
                        paymentWindowStatus.id = 'payment-window-status';
                        paymentWindowStatus.textContent = 'The payment window was blocked by your browser. Please click the link below:';
                        paymentWindowStatus.style.color = '#f44336';
                        paymentWindowStatus.style.marginBottom = '10px';
                        detailsElement.insertBefore(paymentWindowStatus, document.getElementById('payment-link-container'));
                    }

                    document.getElementById('payment-link-container').style.display = 'block';
                } else {
                    paymentWindowStatus.textContent = 'Please complete your payment in the new tab that just opened.';
                }
            } catch (error) {
                document.getElementById('payment-link-container').style.display = 'block';
                console.error('Failed to open payment window:', error);
            }

            // Set up check payment status
            document.getElementById('xendit-check-payment-status').onclick = () => {
                checkPaymentStatus(currentOrderId, false); // Manual check
            };

            // Clear any existing interval before starting new one
            if (paymentStatusInterval) {
                clearInterval(paymentStatusInterval);
                paymentStatusInterval = null;
            }

            // Start automatic payment status checking
            paymentStatusInterval = setInterval(() => {
                checkPaymentStatus(currentOrderId, true); // Automatic check
            }, 5000); // Increased to 5 seconds to reduce frequency

        } else {
            alert('Invoice created successfully. Check your email for payment instructions.');
        }

        // Set up cancel
        document.getElementById('xendit-cancel-gateway').onclick = () => {
            closeXenditGateway();
        };

        // Set up close
        document.getElementById('close-payment-modal-btn').onclick = () => {
            closeXenditGateway();
        };

        // Show details
        loadingElement.style.display = 'none';
        detailsElement.style.display = 'block';

    } catch (error) {
        console.error('Payment gateway error:', error);
        showFeedbackMessage('Failed to create payment gateway. Please try again.', 'error');
        closeXenditGateway();
        resetOrderConfirmationModal();
    }
}

function closeXenditGateway() {
    // Clear interval when closing gateway
    if (paymentStatusInterval) {
        clearInterval(paymentStatusInterval);
        paymentStatusInterval = null;
    }
    document.getElementById('xendit-gateway-modal').classList.add('hidden');

    // Reset order confirmation modal to initial state when payment is cancelled
    resetOrderConfirmationModal();
}

async function checkPaymentStatus(orderId, isAutomatic = false) {
    try {
        const response = await fetch(`/api/xendit/check-payment-by-order/${orderId}`);
        if (response.ok) {
            const paymentData = await response.json();
            if (paymentData.status === 'PAID') {
                // Clear the polling interval FIRST to prevent multiple calls
                if (paymentStatusInterval) {
                    clearInterval(paymentStatusInterval);
                    paymentStatusInterval = null;
                }

                // Only show success message once by checking if modal is still open
                const gatewayModal = document.getElementById('xendit-gateway-modal');
                if (!gatewayModal.classList.contains('hidden')) {
                    // Update PaymentStatus to "Paid"
                    try {
                        // Extract payment method from various possible locations in Xendit response
                        const invoiceId = paymentData.id || paymentData.invoice_id || 'unknown';
                        const paymentMethod = paymentData.payment_method || 
                                            (paymentData.payments && paymentData.payments[0] && 
                                             (paymentData.payments[0].payment_method || 
                                              paymentData.payments[0].payment_channel || 
                                              paymentData.payments[0].channel_code)) || 
                                            null;

                        const updatePayload = {
                            paymentId: orderId,
                            invoiceId: invoiceId,
                            status: 'Paid'
                        };

                        // Add PaymentMethod to payload if available
                        if (paymentMethod) {
                            updatePayload.PaymentMethod = paymentMethod;
                        }

                        console.log('Updating payment with payload:', updatePayload);

                        const updateResponse = await fetch(`/api/orders/update-payment-status`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(updatePayload)
                        });

                        if (!updateResponse.ok) {
                            console.error('Failed to update payment status:', await updateResponse.text());
                        } else {
                            console.log('Payment status updated successfully to Paid');
                        }
                    } catch (error) {
                        console.error('Error updating payment status:', error);
                    }

                    showFeedbackMessage('Payment successful!', 'success');
                    showOrderConfirmationSuccess(); // Show success state in modal
                    closeXenditGateway();
                    clearOrderForm();
                }
            } else if (!isAutomatic) {
                // This is from manual check, show alert
                alert('Payment not yet confirmed. Please complete the payment in the new tab.');
            } // If polling, just continue without alert
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('Payment check error:', errorData);

            // Use user-friendly error message from API
            const errorMessage = errorData.message ||
                                errorData.error ||
                                'Unable to check payment status. Please try again.';
            if (!isAutomatic) {
                // Only show alert if manual check
                alert(errorMessage);
            }
        }
    } catch (error) {
        console.error('Error checking payment status:', error);
        if (!isAutomatic) {
            // Only show alert if manual check
            alert('Error checking payment status. Please try again or contact support.');
        }
    }
}

function clearOrderForm() {
    // Reset all form fields
    document.getElementById('customer-name').value = '';
    document.getElementById('contact-number').value = '';
    document.getElementById('delivery-type').value = 'Take-Out';
    document.getElementById('street-address').value = '';
    document.getElementById('area-select').value = '';
    document.getElementById('notes-textarea').value = '';

    // Reset selected payment method
    selectedPaymentMethod = null;

    // Reset address container display
    const addressContainer = document.getElementById('address-container');
    if (addressContainer) addressContainer.style.display = 'none';

    // Reset payment selection
    const paymentOptions = document.querySelectorAll('.payment-option');
    paymentOptions.forEach(option => {
        const check = option.querySelector('.payment-check');
        check.style.backgroundColor = '#ddd';
        // Reset border styling and remove selected class
        option.style.border = '2px solid #e0e0e0';
        option.style.boxShadow = 'none';
        option.classList.remove('payment-selected');
    });

    // Reset cart
    window.cartItems = [];
    updateCartDisplay();

    // Close all modals
    closeOrderConfirmation();
    closeXenditGateway();
}

function showPromotionMessage(message) {
    // Create a temporary message element
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-weight: 600;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;
    messageDiv.innerHTML = `🎉 ${message}`;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(messageDiv);

    // Remove after 4 seconds
    setTimeout(() => {
        messageDiv.style.animation = 'slideIn 0.3s ease-in reverse';
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, 300);
    }, 4000);
}

// Calculate promotional pricing for order submission
function calculatePromotionalTotal(cart) {
    let total = 0;
    const promoSets = checkBuy3For143(cart);

    if (promoSets > 0) {
        // Apply Buy 3 for 143 pricing
        let drinkItems = [];
        let nonDrinkItems = [];

        cart.forEach(item => {
            if (item.ProductName && item.ProductName.toLowerCase().indexOf('pastry') === -1) {
                drinkItems.push(item);
            } else {
                nonDrinkItems.push(item);
            }
        });

        // Calculate total drinks count
        let totalDrinkCount = 0;
        drinkItems.forEach(item => {
            totalDrinkCount += item.Quantity || 1;
        });

        // Calculate promotional pricing for drinks
        const completeSets = Math.floor(totalDrinkCount / 3);
        const remainingDrinks = totalDrinkCount % 3;

        let drinkTotal = 0;

        // Process complete sets of 3 drinks
        if (completeSets > 0) {
            // Sort all drinks by price to apply promotion optimally
            const allDrinks = [];
            drinkItems.forEach(item => {
                for (let i = 0; i < (item.Quantity || 1); i++) {
                    allDrinks.push({
                        price: item.BasePrice || 0,
                        name: item.ProductName
                    });
                }
            });

            // Sort by price ascending (cheapest first)
            allDrinks.sort((a, b) => a.price - b.price);

            // Process drinks in groups of 3
            for (let setIndex = 0; setIndex < completeSets; setIndex++) {
                const setStart = setIndex * 3;
                const setDrinks = allDrinks.slice(setStart, setStart + 3);

                // Calculate normal price for this set of 3
                const normalSetPrice = setDrinks.reduce((sum, drink) => sum + drink.price, 0);

                // Only apply ₱143 if normal price is more than ₱143
                if (normalSetPrice > 143) {
                    drinkTotal += 143;
                } else {
                    drinkTotal += normalSetPrice;
                }
            }

            // Add remaining drinks (not part of complete sets)
            for (let i = completeSets * 3; i < allDrinks.length; i++) {
                drinkTotal += allDrinks[i].price;
            }
        }

        // Calculate non-drink items normally
        nonDrinkItems.forEach(item => {
            total += (item.BasePrice || 0) * (item.Quantity || 1);
        });

        total += drinkTotal;
    } else {
        // No promotion, calculate normally
        cart.forEach(item => {
            total += (item.BasePrice || 0) * (item.Quantity || 1);
        });
    }

    return total;
}
