// Admin Menu JavaScript
// Get user data
const user = JSON.parse(document.getElementById('user-data').textContent);

// Initialize delivery type handling
document.addEventListener('DOMContentLoaded', function() {
    const deliveryTypeSelect = document.getElementById('delivery-type');
    if (deliveryTypeSelect) {
        deliveryTypeSelect.addEventListener('change', handleDeliveryTypeChange);
        // Initialize payment options on page load
        handleDeliveryTypeChange();
    }
});

// Handle delivery type changes and update payment options
function handleDeliveryTypeChange() {
    const deliveryType = document.getElementById('delivery-type').value;
    const cashOption = document.querySelector('.payment-option[onclick*="cash"]');
    const epaymentOption = document.querySelector('.payment-option[onclick*="epayment"]');

    if (deliveryType === 'Delivery' || deliveryType === 'Pick-Up') {
        // Hide cash option and auto-select E-Payment
        if (cashOption) {
            cashOption.style.display = 'none';
        }
        if (epaymentOption) {
            epaymentOption.style.display = 'flex';
            // Auto-select E-Payment
            selectPayment('epayment');
        }
    } else {
        // Show both options for Take-Out
        if (cashOption) {
            cashOption.style.display = 'flex';
        }
        if (epaymentOption) {
            epaymentOption.style.display = 'flex';
        }
        // Don't auto-select anything, let user choose
    }
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
    const paymentOptions = document.querySelectorAll('.payment-option');
    paymentOptions.forEach(option => {
        const check = option.querySelector('.payment-check');
        check.style.backgroundColor = '#ddd';
    });

    // Find the clicked option and highlight it
    const clickedOption = event.currentTarget;
    const selectedCheck = clickedOption.querySelector('.payment-check');
    selectedCheck.style.backgroundColor = '#a05c2f';
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
        orderItemsContainer.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No items in cart</div>';
        totalItemsElement.textContent = '0';
        subtotalElement.textContent = '₱ 0.00';
        totalElement.textContent = '₱ 0.00';
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
                    <div style="font-weight: 600; ${item.isB1T1 ? 'text-decoration: line-through; color: #999;' : ''}">₱ ${itemTotal.toFixed(2)}</div>
                    ${item.isB1T1 ? '<div style="font-weight: 600; color: #4caf50;">₱ 0.00</div>' : ''}
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px;">
                        <!-- Quantity Controls -->
                        <button class="qty-btn qty-minus" onclick="updateQuantity(${index}, -1)"
                                style="width: 28px; height: 28px; border: none; background: #ffffff; color: #a05c2f; cursor: pointer; border-radius: 50%; font-family: 'Inter', sans-serif; font-size: 16px; font-weight: bold; line-height: 1; transition: all 0.15s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center;"
                                onmouseover="this.style.backgroundColor='#a05c2f'; this.style.color='white'; this.style.transform='scale(1.05)';"
                                onmouseout="this.style.backgroundColor='#ffffff'; this.style.color='#a05c2f'; this.style.transform='scale(1)';"
                                onmousedown="this.style.transform='scale(0.95)';"
                                onmouseup="this.style.transform='scale(1.05)';"
                                title="Decrease quantity">−</button>

                        <span style="min-width: 32px; text-align: center; font-weight: 700; font-size: 15px; color: #372b2a; font-family: 'Inter', sans-serif;">${item.Quantity}</span>

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
    subtotalElement.textContent = `₱ ${subtotal.toFixed(2)}`;

    // Calculate promotional total
    const promotionalTotal = calculatePromotionalTotal(window.cartItems);
    totalElement.textContent = `₱ ${promotionalTotal.toFixed(2)}`;
}

function updateQuantity(index, change) {
    if (!window.cartItems || !window.cartItems[index]) return;

    window.cartItems[index].Quantity += change;

    if (window.cartItems[index].Quantity <= 0) {
        window.cartItems.splice(index, 1);
    }

    updateCartDisplay();
}

function removeFromCart(index) {
    if (!window.cartItems || !window.cartItems[index]) return;

    window.cartItems.splice(index, 1);
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
    const total = calculatePromotionalTotal(cart);

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
        Date: dateStr,
        Cart: cart.map(item => ({
            ProductName: item.ProductName,
            ProductID: item.ProductID,
            Size: item.Size,
            Addons: item.AddOns || [],
            Quantity: item.Quantity,
            Price: item.BasePrice,
            ImageLink: item.ImageLink || ""
        })),
        Customer: customerName,
        customerId: generateCustomerId(),
        ContactNumber: contactNumber,
        PaymentStatus: paymentMethod === "cash" ? "Payment pending" : "Pending",
        PaymentMode: paymentMethod === "cash" ? "Cash on Hand" : "E-Payment",
        Total: total,
        ItemTotal: itemTotal,
        DeliveryStatus: deliveryType,
        Address: deliveryType === "Delivery" ? `${streetAddress}, ${areaSelect}` : "",
        Notes: notes,
        FulfillmentStatus: "Preparing",
        Source: "POS",
        cashierName: user ? user.fullname : "Admin"
    };

    // Add XenditPaymentID if e-payment is selected
    if (paymentMethod === "epayment") {
        orderData.XenditPaymentID = generateXenditPaymentId();
        orderData.paymentStatus = "Pending";
        orderData.fulfillmentStatus = "Preparing";
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
    const deliveryType = document.getElementById('delivery-type').value;

    // For Delivery and Pick-Up, only E-Payment is allowed
    if (deliveryType === 'Delivery' || deliveryType === 'Pick-Up') {
        return 'epayment';
    }

    // For Take-Out, check which option is selected
    const paymentOptions = document.querySelectorAll('.payment-option');
    for (let option of paymentOptions) {
        const check = option.querySelector('.payment-check');
        if (check.style.backgroundColor === 'rgb(160, 92, 47)' || check.style.backgroundColor === '#a05c2f') {
            return option.onclick.toString().includes("'cash'") ? 'cash' : 'epayment';
        }
    }
    return 'cash'; // default to cash for Take-Out
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

// Promotion functions
function checkBuy3For143(cart) {
    let drinkCount = 0;
    cart.forEach(item => {
        if (item.ProductName && item.ProductName.toLowerCase().indexOf('pastry') === -1) {
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
        if (item.ProductName && item.ProductName.toLowerCase().indexOf('pastry') === -1) {
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

function checkB1T1Eligibility(cart) {
    // Check if cart has eligible drinks for B1T1
    let eligibleDrinks = [];
    cart.forEach((item, index) => {
        if (item.ProductName && item.ProductName.toLowerCase().indexOf('pastry') === -1) {
            eligibleDrinks.push({ ...item, cartIndex: index });
        }
    });

    return eligibleDrinks.length > 0 ? eligibleDrinks : null;
}

function showB1T1Modal() {
    const eligibleDrinks = checkB1T1Eligibility(window.cartItems || []);
    if (!eligibleDrinks || eligibleDrinks.length === 0) {
        alert('No eligible drinks for Buy 1 Take 1 promotion.');
        return;
    }

    const modal = document.getElementById('b1t1-modal');
    const drinkOptions = document.getElementById('b1t1-drink-options');

    let html = '';
    eligibleDrinks.forEach(drink => {
        html += `
            <div class="b1t1-drink-option" onclick="selectB1T1Drink('${drink.cartIndex}')" style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 2px solid #e1e5e9; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                <div style="width: 40px; height: 40px; flex-shrink: 0;">
                    ${drink.ImageLink ?
                        `<img src="${drink.ImageLink}" alt="${drink.ProductName}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px;">` :
                        `<div style="width: 40px; height: 40px; background: #f0f0f0; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #999;">No img</div>`
                    }
                </div>
                <div>
                    <div style="font-weight: 600; font-size: 14px;">${drink.ProductName}</div>
                    <div style="font-size: 12px; color: #666;">${drink.Size}</div>
                </div>
                <div style="margin-left: auto; font-size: 12px; color: #a05c2f; font-weight: 600;">FREE</div>
            </div>
        `;
    });

    drinkOptions.innerHTML = html;
    modal.style.display = 'flex';
}

function selectB1T1Drink(cartIndex) {
    if (!window.cartItems || !window.cartItems[cartIndex]) return;

    const selectedDrink = window.cartItems[cartIndex];

    // Add a free version of the selected drink
    const freeDrink = {
        ...selectedDrink,
        ProductName: `${selectedDrink.ProductName} (B1T1 FREE)`,
        BasePrice: 0, // Free
        Quantity: 1,
        isB1T1: true
    };

    window.cartItems.push(freeDrink);
    updateCartDisplay();
    closeB1T1Modal();

    // Show success message
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

    // Apply the promotion automatically
    applyBuy3For143(window.cartItems || []);
    updateCartDisplay();

    // Show success message with correct savings
    showPromotionMessage(`Buy 3 for ₱143 promotion applied! You save ₱${savings.toFixed(2)} on ${promoSets} set${promoSets > 1 ? 's' : ''} of drinks.`);
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