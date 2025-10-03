// Initialize allProducts with the menu items from the server
var allProducts = JSON.parse(document.getElementById('menu-data').textContent);

// Initialize user data
var userData = JSON.parse(document.getElementById('user-data').textContent);

// Initialize orderItems array
var orderItems = [];

// Initialize add-ons cache
var cachedAddons = null;
var addonsLoading = false;

// Clear localStorage orderItems on page load to ensure a fresh start
localStorage.removeItem('orderItems');

// Function to save order items to localStorage
function saveOrderItems() {
    localStorage.setItem('orderItems', JSON.stringify(orderItems));
}

// Handle product click - show size/addon modal or add directly if no size options
function handleProductClick(item) {
    if (item.Sizes && item.Sizes.length > 1) {
        showSizeAndAddonModal(item);
    } else {
        let size = null;
        let price = item.BasePrice;
        if (item.Sizes && item.Sizes.length === 1) {
            size = item.Sizes[0].Size;
            price = item.Sizes[0].BasePrice;
        }
        showAddonModal(item, size, price);
    }
}

// Efficient add-on loading function
async function loadAddons() {
    if (cachedAddons !== null) {
        return cachedAddons; // Return cached data
    }

    if (addonsLoading) {
        // If already loading, wait for it to complete
        return new Promise((resolve, reject) => {
            const checkLoaded = () => {
                if (cachedAddons !== null) {
                    resolve(cachedAddons);
                } else if (!addonsLoading) {
                    reject(new Error('Failed to load add-ons'));
                } else {
                    setTimeout(checkLoaded, 100);
                }
            };
            checkLoaded();
        });
    }

    addonsLoading = true;
    try {
        const response = await fetch('/api/addons');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const addons = await response.json();
        cachedAddons = addons.filter(addon => addon.IsEnabled || addon.isEnabled);
        return cachedAddons;
    } catch (error) {
        cachedAddons = []; // Set to empty array on error to avoid repeated failed requests
        throw error;
    } finally {
        addonsLoading = false;
    }
}

// Helper function to render addons in container
function renderAddons(container, addons) {
    if (!Array.isArray(addons) || addons.length === 0) {
        container.innerHTML = '<span style="font-size:12px;color:#999">No available add-ons.</span>';
        return;
    }

    container.innerHTML = '';
    addons.forEach((addon) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'addon-option';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = addon.AddOnID;
        checkbox.dataset.name = addon.Name;
        checkbox.dataset.price = addon.BasePrice;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${addon.Name} (+₱${parseFloat(addon.BasePrice).toFixed(2)})`;

        optionDiv.appendChild(checkbox);
        optionDiv.appendChild(nameSpan);
        optionDiv.onclick = (e) => {
            // Don't toggle if clicking directly on checkbox
            if (e.target.type !== 'checkbox') {
                checkbox.checked = !checkbox.checked;
            }
        };

        container.appendChild(optionDiv);
    });
}

document.getElementById('toggle-notes-btn').onclick = function() {
    const ta = document.getElementById('notes-textarea');
    if (ta.style.display === 'block') {
        ta.style.display = 'none';
        ta.value = '';
    } else {
        ta.style.display = 'block';
        ta.focus();
    }
};

let currentPaymentId = null;

function checkAndApplyPromotion() {
    let drinkCount = 0;
    orderItems.forEach(item => {
        // Only count non-pastry items that are not free B1T1 items
        if (item.category !== 'Pastries' && !item.isB1T1) {
            drinkCount += item.quantity;
        }
    });

    let promotionApplied = false;
    let itemsToUpgrade = [];

    if (drinkCount >= 3) {
        const upgradeCount = Math.floor(drinkCount / 3);
        let currentCount = 0;

        orderItems.forEach((item, index) => {
            // Only upgrade non-pastry items that are not free B1T1 items
            if (item.category !== 'Pastries' && !item.isB1T1 && currentCount < upgradeCount) {
                let itemUpgradeCount = Math.min(item.quantity, upgradeCount - currentCount);
                if (item.size !== '22oz' && itemUpgradeCount > 0) {
                    itemsToUpgrade.push({ index, upgradeCount: itemUpgradeCount });
                    promotionApplied = true;
                }
                currentCount += itemUpgradeCount;
            }
        });

        if (promotionApplied) {
            itemsToUpgrade.forEach(upgrade => {
                orderItems[upgrade.index].size = '22oz';
            });
            showPromotionModal();
            renderOrderItems();
            updateSummary();
        }
    }
}

function showPromotionModal() {
    const modal = document.getElementById('promotion-modal');
    modal.style.display = 'flex';
}

function closePromotionModal() {
    const modal = document.getElementById('promotion-modal');
    modal.style.display = 'none';
}

function updateSummary() {
    let promoQuantity = 0;
    let promoSets = 0;
    let pastryTotal = 0;
    const promoItemsExp = [];

    // First calculate totals for non-promo items (pastries and B1T1 items)
    orderItems.forEach(item => {
        if (item.category === 'Pastries' || item.isB1T1) {
            // Pastries and B1T1 items are not part of the 143 for 3 promo
            pastryTotal += (item.price + (item.addons ? item.addons.reduce((sum, ad) => sum + ad.BasePrice, 0) : 0)) * item.quantity;
        } else {
            // Regular drinks (not B1T1) are part of the promo
            const itemPrice = item.price + (item.addons ? item.addons.reduce((sum, ad) => sum + ad.BasePrice, 0) : 0);
            for(let i = 0; i < item.quantity; i++) {
                promoItemsExp.push(itemPrice);
            }
        }
    });

    // Calculate promo sets and leftover items
    promoQuantity = promoItemsExp.length;
    promoSets = Math.floor(promoQuantity / 3);
    const promoTotalPrice = promoSets * 143;
    const leftoverCount = promoQuantity % 3;
    let leftoverPrice = 0;

    // Calculate price for leftover items (most expensive ones)
    if(leftoverCount > 0) {
        promoItemsExp.sort((a,b) => b - a); // Sort descending to get most expensive items first
        for(let i = 0; i < leftoverCount; i++) {
            leftoverPrice += promoItemsExp[i] || 0;
        }
    }
    let subtotalPromoApplied = promoTotalPrice + leftoverPrice + pastryTotal;
    const deliveryType = document.getElementById('delivery-type')?.value;
    const deliveryFee = 20;
    const summaryTotals = document.querySelector('.summary-totals');

    // Move delivery fee message above Total
    const deliveryFeeDiv = document.getElementById('delivery-fee-message');
    if (deliveryFeeDiv) deliveryFeeDiv.remove();
    if (deliveryType === 'Delivery') {
        subtotalPromoApplied += deliveryFee;
        const div = document.createElement('div');
        div.id = 'delivery-fee-message';
        div.style.marginTop = '10px';
        div.style.fontWeight = 'bold';
        div.style.color = '#a05c2f';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.innerHTML = `<span>Delivery fee applied:</span><span style='text-align:right; min-width:70px;'>₱ ${deliveryFee.toFixed(2)}</span>`;
        const totalRow = summaryTotals.querySelector('.total-row.final');
        summaryTotals.insertBefore(div, totalRow);
    }

    const promoDiv = document.getElementById('promo-applied');
    if (promoSets > 0) {
        promoDiv.innerHTML = `<span>for ${promoSets * 3} drinks - ₱ ${(promoSets * 143).toFixed(2)}</span>`;
        promoDiv.style.fontWeight = '400';
        promoDiv.style.display = 'flex';
        promoDiv.style.justifyContent = 'space-between';
    } else {
        promoDiv.innerHTML = '<span>None</span>';
        promoDiv.style.fontWeight = '400';
        promoDiv.style.display = 'flex';
        promoDiv.style.justifyContent = 'space-between';
    }

    let totalItemsCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalItemsSpan = document.getElementById('total-items');
    if (totalItemsSpan) {
        totalItemsSpan.textContent = totalItemsCount;
    }

    updateSubtotalFromItems();
    document.getElementById('total').textContent = `₱ ${subtotalPromoApplied.toFixed(2)}`;
}

function scrollToCategory(categoryName) {
    const categoryElements = document.querySelectorAll('.section-title');
    for (let element of categoryElements) {
        if (element.textContent.trim() === categoryName) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            break;
        }
    }
}

function updateSubtotalFromItems() {
    const subtotalSpan = document.getElementById('subtotal');
    let subtotalItems = 0;
    orderItems.forEach(item => {
        subtotalItems += (item.price + (item.addons ? item.addons.reduce((sum, ad) => sum + ad.BasePrice, 0) : 0)) * item.quantity;
    });
    if (subtotalSpan) {
        subtotalSpan.textContent = `₱ ${subtotalItems.toFixed(2)}`;
    }
}

function addToOrder(name, price, size = null, category = null, productId = null, addons = [], imagelink = '', isFree = false, originalItemIndex = null) {
    // Create a unique key for the order item
    const key = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // For B1T1 items, ensure price is 0
    const finalPrice = isFree ? 0 : parseFloat(price);

    // Create the order item
    const orderItem = {
        key: key,
        name: name,
        price: finalPrice,
        quantity: 1,
        size: size,
        category: category,
        productId: productId,
        addons: addons || [],
        imagelink: imagelink || '',
        isFree: isFree,
        originalItemIndex: originalItemIndex,
        isB1T1: isFree // B1T1 items are free
    };

    // Add to order items
    orderItems.push(orderItem);

    // Save to localStorage
    saveOrderItems();

    closeSizeModal();

    // Render the order items and update summary
    renderOrderItems();
    updateSummary();
    checkAndApplyPromotion();
}

function addItem(index) {
    orderItems[index].quantity++;
    renderOrderItems();
    updateSummary();
    checkAndApplyPromotion();
}

function removeItem(index) {
    if (orderItems[index].quantity > 1) {
        orderItems[index].quantity--;
    } else {
        orderItems.splice(index, 1);
    }
    renderOrderItems();
    updateSummary();
}

function changeSizeFromDropdown(index, newSize) {
    const item = orderItems[index];
    const newKey = `${item.name} - ${newSize} - ${JSON.stringify(item.addons ? item.addons.map(a => a.AddOnID).sort() : [])}`;

    let existingItem = orderItems.find((orderItem, idx) => orderItem.key === newKey && idx !== index);

    if (existingItem) {
        existingItem.quantity += item.quantity;
        orderItems.splice(index, 1);
    } else {
        orderItems[index].size = newSize;
        orderItems[index].key = newKey;
    }

    renderOrderItems();
    updateSummary();
}

function showB1T1Modal(index) {
    currentB1T1Item = orderItems[index];
    const sameCategoryDrinks = getDrinksInSameCategory(currentB1T1Item.category);

    const modal = document.getElementById('b1t1-modal');
    const optionsContainer = document.getElementById('b1t1-drink-options');
    optionsContainer.innerHTML = '';

    if (sameCategoryDrinks.length === 0) {
        optionsContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#666;">No drinks available in this category.</div>';
        modal.style.display = 'flex';
        return;
    }

    sameCategoryDrinks.forEach(drink => {
        const drinkName = drink.Name || drink.name;
        const drinkImage = drink.imagelink || 'https://via.placeholder.com/50x50?text=No+Image';

        const drinkElement = document.createElement('div');
        drinkElement.style.display = 'flex';
        drinkElement.style.alignItems = 'center';
        drinkElement.style.padding = '12px';
        drinkElement.style.border = '1px solid #eee';
        drinkElement.style.borderRadius = '8px';
        drinkElement.style.cursor = 'pointer';
        drinkElement.style.transition = 'all 0.2s';
        drinkElement.onmouseover = () => drinkElement.style.backgroundColor = '#f9f9f9';
        drinkElement.onmouseout = () => drinkElement.style.backgroundColor = '#fff';
        drinkElement.onclick = () => selectB1T1Drink(drink);

        drinkElement.innerHTML = `
            <img src="${drinkImage}" alt="${drinkName}" style="width:50px;height:50px;border-radius:8px;object-fit:cover;margin-right:12px;">
            <div>
                <div style="font-weight:500;color:#333;">${drinkName}</div>
                <div style="font-size:12px;color:#666;">${drink.Category || ''}</div>
            </div>
        `;

        optionsContainer.appendChild(drinkElement);
    });

    modal.style.display = 'flex';
}

function getDrinksInSameCategory(category) {
    if (!Array.isArray(allProducts)) {
        console.error('allProducts is not an array:', allProducts);
        return [];
    }

    const drinks = allProducts.filter(product => {
        if (!product) return false;

        // Normalize product properties
        const productName = (product.Name || product.name || '').toLowerCase();
        const productCategory = (product.Category || product.category || '').toLowerCase().trim();
        const productType = (product.Type || product.type || '').toLowerCase().trim();
        const targetCategory = (category || '').toLowerCase().trim();

        // Check if product is a beverage and not an add-on
        const isBeverage = productType === 'beverage' || productType === 'drink' ||
            (!productType && (productCategory.includes('tea') || productCategory.includes('coffee') || productCategory.includes('drink')));
        const isAddOn = productName.includes('add-on') || productName.includes('add on');

        // Check category match (case insensitive and trimmed)
        const categoryMatches = productCategory === targetCategory;

        return categoryMatches && isBeverage && !isAddOn;
    });

    return drinks;
}

function closeB1T1Modal() {
    document.getElementById('b1t1-modal').style.display = 'none';
    currentB1T1Item = null;
}

function selectB1T1Drink(selectedDrink) {
    if (!currentB1T1Item) return;

    addToOrder(
        selectedDrink.Name || selectedDrink.name,  // name
        0,                                        // price (free)
        currentB1T1Item.size || '16oz',           // size
        selectedDrink.Category,                    // category
        selectedDrink._id || selectedDrink.ProductID,  // productId
        [],                                        // addons
        selectedDrink.imagelink,                   // imagelink
        true,                                     // isFree
        orderItems.indexOf(currentB1T1Item)        // originalItemIndex
    );

    closeB1T1Modal();
}

function renderOrderItems() {
    const container = document.getElementById('order-items');
    container.innerHTML = '';
    orderItems.forEach((item, index) => {
        const imgSrc = item.imagelink && item.imagelink !== "null" ? item.imagelink : 'https://via.placeholder.com/50x50?text=No+Image';

        const sizeDropdown = item.size && item.category !== 'Pastries' ?
            `<select class="order-item-size-dropdown" onchange="changeSizeFromDropdown(${index}, this.value)" style="font-size: 12px; padding: 2px 4px; border: 1px solid #ccc; border-radius: 4px; background: white; color: #888;">
                <option value="16oz" ${item.size === '16oz' ? 'selected' : ''}>16oz</option>
                <option value="22oz" ${item.size === '22oz' ? 'selected' : ''}>22oz</option>
            </select>` :
            (item.size ? `<div class="order-item-size">${item.size}</div>` : '');

        const addonLabel = item.addons && item.addons.length > 0
            ? `<div class="order-item-addons">+ ${item.addons.map(a => a.Name).join(', ')}</div>` : '';
        const baseAddonPrice = item.addons ? item.addons.reduce((sum, ad) => sum + ad.BasePrice, 0) : 0;
        const totalPrice = ((item.price + baseAddonPrice) * item.quantity).toFixed(2);
        const itemHTML = `
    <div class="order-item-custom">
        <div class="order-item-imgwrap">
            <img src="${imgSrc}" alt="${item.name || ''}">
        </div>
        <div class="order-item-info">
            <div class="order-item-main">
                <div>
                    <div class="order-item-title">${item.name}</div>
                    ${sizeDropdown}
                    ${addonLabel}
                    ${!item.isFree && item.category !== 'Pastries' && !orderItems.some(itm => itm.originalItemIndex === index) ?
            `<button class="b1t1-btn" onclick="showB1T1Modal(${index})">+ Free B1T1 Drink</button>` :
            item.isFree ? '<div class="free-badge">FREE</div>' : ''
        }
                </div>
                <div class="order-item-price">${item.isFree ? 'FREE B1T1' : '₱ ' + totalPrice}</div>
            </div>
            <div class="order-item-actions ${item.isFree ? 'disabled' : ''}">
                <button class="quantity-btn remove-btn" onclick="removeItem(${index})">-</button>
                <span class="order-item-qty">${item.quantity}</span>
                ${item.isFree ? '' : `<button class="quantity-btn add-btn" onclick="addItem(${index})">+</button>`}
            </div>
        </div>
    </div>
    `;
        container.innerHTML += itemHTML;
    });
    updateSubtotalFromItems();
    calculateTotals();
}

function calculateTotals() {
    const itemPriceElements = document.querySelectorAll('.item-price');
    const quantityElements = document.querySelectorAll('.quantity');

    let subtotalItems = 0;
    let totalItems = 0;

    itemPriceElements.forEach(priceEl => {
        const priceText = priceEl.textContent || priceEl.innerText;
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        if (!isNaN(price)) subtotalItems += price;
    });

    quantityElements.forEach(qtyEl => {
        const qtyText = qtyEl.textContent || qtyEl.innerText;
        const qty = parseInt(qtyText.replace(/\D/g, ''), 10);
        if (!isNaN(qty)) totalItems += qty;
    });

    const totalItemsSpan = document.getElementById('total-items');

    if(totalItemsSpan) {
        totalItemsSpan.textContent = totalItems;
    }

    return subtotalItems;
}

function selectPayment(method) {
    const options = document.querySelectorAll('.payment-option');
    let targetIndex = method === 'cash' ? 0 : 1;
    const clickedOption = options[targetIndex];
    const isSelected = clickedOption.classList.contains('selected');

    if (isSelected) {
        clickedOption.classList.remove('selected');
        const check = clickedOption.querySelector('.payment-check');
        check.style.backgroundColor = '#ddd';
        // Hide SVG when not selected
        if (check.querySelector('svg')) check.querySelector('svg').style.display = 'none';
    } else {
        options.forEach((option, index) => {
            const check = option.querySelector('.payment-check');
            if (index === targetIndex) {
                option.classList.add('selected');
                check.style.backgroundColor = '#4CAF50';
                // Show SVG when selected
                if (check.querySelector('svg')) check.querySelector('svg').style.display = 'block';
            } else {
                option.classList.remove('selected');
                check.style.backgroundColor = '#ddd';
                // Hide SVG for unselected
                if (check.querySelector('svg')) check.querySelector('svg').style.display = 'none';
            }
        });
    }
}

// Modal functions
function showSizeAndAddonModal(item) {
    // Reset modal sections
    hideAllModalSections();

    const modal = document.getElementById('size-modal');
    const productNameElem = document.getElementById('modal-product-name');
    productNameElem.textContent = item.Name;

    const lowerCategory = (item.Category || item.category || '').toLowerCase();
    const isPastry = lowerCategory === 'pastries' || lowerCategory === 'bites';

    // Show size section if item has multiple sizes and is not a pastry
    if (item.Sizes && item.Sizes.length > 1 && !isPastry) {
        showSizeSection(item.Sizes);
    }

    // Show add-ons section if not a pastry
    if (!isPastry) {
        showAddonSection();
        loadAddons()
            .then(addons => {
                const container = document.getElementById('addon-options');
                if (container) {
                    renderAddons(container, addons);
                    setupConfirmBtnForSizeAndAddon(item);
                }
                modal.style.display = 'flex';
                modal.addEventListener('click', handleModalClick);
            })
            .catch(error => {
                const container = document.getElementById('addon-options');
                if (container) {
                    container.innerHTML = `<span style="font-size:12px;color:#ff6b6b">Error loading add-ons: ${error.message}</span>`;
                }
                setupConfirmBtnForSizeAndAddon(item);
                modal.style.display = 'flex';
                modal.addEventListener('click', handleModalClick);
            });
    } else {
        // For pastries, show direct order section
        showDirectOrderSection();
        setupConfirmBtnForSizeAndAddon(item);
        modal.style.display = 'flex';
        modal.addEventListener('click', handleModalClick);
    }
}

function hideAllModalSections() {
    const sections = ['size-section', 'addon-section', 'direct-order-section'];
    sections.forEach(id => {
        const section = document.getElementById(id);
        if (section) section.style.display = 'none';
    });
}

function showSizeSection(sizes) {
    const section = document.getElementById('size-section');
    const container = document.getElementById('size-options');
    if (!section || !container) return;

    container.innerHTML = '';
    sizes.forEach((sizeObj, idx) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'size-option';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'size-choice';
        radio.value = sizeObj.Size;
        radio.dataset.price = sizeObj.BasePrice;
        if (idx === 0) {
            radio.checked = true;
            optionDiv.classList.add('selected');
        }

        const label = document.createElement('label');
        label.textContent = `${sizeObj.Size} - ₱${Number(sizeObj.BasePrice).toFixed(2)}`;

        optionDiv.appendChild(radio);
        optionDiv.appendChild(label);
        optionDiv.onclick = () => selectSizeOption(optionDiv, radio);

        container.appendChild(optionDiv);
    });

    section.style.display = 'block';
}

function showAddonSection() {
    const section = document.getElementById('addon-section');
    const container = document.getElementById('addon-options');
    if (!section || !container) return;

    container.innerHTML = '<span style="font-size:12px;color:#999;">Loading add-ons...</span>';
    section.style.display = 'block';
}

function showDirectOrderSection() {
    const section = document.getElementById('direct-order-section');
    if (section) section.style.display = 'block';
}

function selectSizeOption(optionDiv, radio) {
    // Remove selected class from all options
    const allOptions = document.querySelectorAll('.size-option');
    allOptions.forEach(opt => opt.classList.remove('selected'));

    // Select this option
    optionDiv.classList.add('selected');
    radio.checked = true;
}

function setupConfirmBtnForSizeAndAddon(item) {
    const confirmBtn = document.getElementById('modal-add-to-order-btn');
    if (confirmBtn) {
        confirmBtn.onclick = () => {
            const selectedSizeRadio = document.querySelector('input[name="size-choice"]:checked');
            if (!selectedSizeRadio) {
                alert('Please select a size');
                return;
            }
            const size = selectedSizeRadio.value;
            const price = parseFloat(selectedSizeRadio.dataset.price);

            const checked = Array.from(document.querySelectorAll('#addon-checkboxes input[type="checkbox"]:checked'));
            const selectedAddons = checked.map(c => ({
                AddOnID: c.value,
                Name: c.dataset.name,
                BasePrice: parseFloat(c.dataset.price)
            }));

            addToOrder(item.Name, price, size, item.Category, item.ProductID, selectedAddons, item.imagelink);
            closeSizeModal();
        };
    }
}

function setupConfirmButton(item, size, price) {
    const confirmBtn = document.getElementById('modal-add-to-order-btn');
    if (confirmBtn) {
        confirmBtn.onclick = null;
        confirmBtn.onclick = () => {
            const checked = Array.from(document.querySelectorAll('#addon-checkboxes input[type="checkbox"]:checked'));
            const selectedAddons = checked.map(c => ({
                AddOnID: c.value,
                Name: c.dataset.name,
                BasePrice: parseFloat(c.dataset.price)
            }));
            addToOrder(item.Name, price, size, item.Category, item.ProductID, selectedAddons, item.imagelink);
            closeSizeModal();
        };
    }
}

function showAddonModal(item, size, price) {
    // Reset modal sections
    hideAllModalSections();

    const modal = document.getElementById('size-modal');
    const productNameElem = document.getElementById('modal-product-name');
    productNameElem.textContent = item.Name;

    const lowerCategory = (item.Category || item.category || '').toLowerCase();
    const isPastry = lowerCategory === 'pastries' || lowerCategory === 'bites';

    // For pastries or items without add-ons capability, show direct order
    if (isPastry) {
        showDirectOrderSection();
        setupConfirmButton(item, size, price);
        modal.style.display = 'flex';
        modal.addEventListener('click', handleModalClick);
        return;
    }

    // For drinks, show add-ons section
    showAddonSection();
    loadAddons()
        .then(addons => {
            const container = document.getElementById('addon-options');
            if (container) {
                renderAddons(container, addons);
                setupConfirmButton(item, size, price);
            }
            modal.style.display = 'flex';
            modal.addEventListener('click', handleModalClick);
        })
        .catch(error => {
            const container = document.getElementById('addon-options');
            if (container) {
                container.innerHTML = `<span style="font-size:12px;color:#ff6b6b">Error loading add-ons: ${error.message}</span>`;
            }
            setupConfirmButton(item, size, price);
            modal.style.display = 'flex';
            modal.addEventListener('click', handleModalClick);
        });
}

// Function to handle clicking outside the modal content
function handleModalClick(event) {
    if (event.target === this) {
        closeSizeModal();
    }
}

function closeSizeModal() {
    const modal = document.getElementById('size-modal');
    modal.removeEventListener('click', handleModalClick);
    modal.style.display = 'none';
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    const deliveryTypeSelect = document.getElementById('delivery-type');
    if(deliveryTypeSelect) {
        deliveryTypeSelect.addEventListener('change', () => {
            const addressContainer = document.getElementById('address-container');
            const cashOption = document.querySelector('.payment-option:nth-child(1)');
            if (deliveryTypeSelect.value === 'Delivery') {
                addressContainer.style.display = 'block';
                cashOption.classList.add('disabled');
                cashOption.style.pointerEvents = 'none';
                cashOption.style.opacity = '0.5';
                // Deselect if selected
                if (cashOption.classList.contains('selected')) {
                    cashOption.classList.remove('selected');
                    const check = cashOption.querySelector('.payment-check');
                    check.style.backgroundColor = '#ddd';
                    // Hide SVG when not selected
                    if (check.querySelector('svg')) check.querySelector('svg').style.display = 'none';
                }
            } else {
                addressContainer.style.display = 'none';
                cashOption.classList.remove('disabled');
                cashOption.style.pointerEvents = '';
                cashOption.style.opacity = '';
            }
            updateSummary();
        });
        if(deliveryTypeSelect.value === 'Delivery') {
            document.getElementById('address-container').style.display = 'block';
        }

        const options = document.querySelectorAll('.payment-option');
        options.forEach(option => {
            if (!option.classList.contains('selected')) {
                const check = option.querySelector('.payment-check');
                check.style.backgroundColor = '#ddd';
                // Hide SVG for unselected
                if (check.querySelector('svg')) check.querySelector('svg').style.display = 'none';
            }
        });
    }

    // Render initial order items and update summary
    renderOrderItems();
    updateSummary();
});

// Order submission functions
function submitOrder(customer, contactNumber, deliveryType, paymentMode, total, itemTotal, notes) {
    const cart = orderItems.map(item => ({
        ProductID: item.productId || item.key,
        ProductName: item.name,
        Quantity: item.quantity,
        Size: item.size || null,
        BasePrice: item.price,
        AddOns: item.addons && item.addons.length > 0
            ? item.addons.map(a => ({ AddOnID: a.AddOnID, Name: a.Name, BasePrice: a.BasePrice }))
            : []
    }));

    let address = '';
    if (deliveryType === 'Delivery') {
        const streetAddress = document.getElementById('street-address').value.trim();
        const selectedArea = document.getElementById('area-select').value;
        address = `${streetAddress}, ${selectedArea}`;
    }

    const orderData = {
        OrderID: generateOrderID(),
        Date: formatDate(new Date()),
        Cart: cart,
        Customer: customer,
        ContactNumber: contactNumber || '',
        PaymentStatus: paymentMode === 'Cash on Hand' ? "Payment pending" : "Payment pending",
        PaymentMode: paymentMode,
        Total: parseFloat(total),
        ItemTotal: itemTotal,
        DeliveryStatus: deliveryType,
        Address: address,
        Notes: notes || '',
        FulfillmentStatus: "Preparing",
        Source: "POS",
        cashierName: userData.fullname || userData.staffId || "Unknown Staff"
    };

    fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
    })
        .then(res => {
            if (!res.ok) {
                throw new Error(`Network response was not ok: ${res.status} ${res.statusText}`);
            }
            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new TypeError('Oops, we haven\'t got JSON!');
            }
            return res.json();
        })
        .then(data => {
            if (data.success) {
                alert('Order submitted successfully! Your Order ID is: ' + orderData.OrderID);
                orderItems = [];
                renderOrderItems();
                document.getElementById('customer-name').value = '';
                document.getElementById('contact-number').value = '';
                const deliveryTypeSelect = document.getElementById('delivery-type');
                deliveryTypeSelect.value = 'Take-Out';
                const addressContainer = document.getElementById('address-container');
                addressContainer.style.display = 'none';
                document.getElementById('street-address').value = '';
                document.getElementById('area-select').value = '';
                document.getElementById('notes-textarea').value = '';
                updateSummary();
                const deliveryFeeDiv = document.getElementById('delivery-fee-message');
                if (deliveryFeeDiv) deliveryFeeDiv.remove();
                document.querySelectorAll('.payment-option.selected').forEach(el => {
                    el.classList.remove('selected');
                    const check = el.querySelector('.payment-check');
                    check.style.backgroundColor = '#ddd';
                    // Hide SVG for unselected
                    if (check.querySelector('svg')) check.querySelector('svg').style.display = 'none';
                });
            } else {
                alert('Failed to submit order. Please try again.');
                console.error(data.error || 'Unknown error from server.');
            }
        })
        .catch(err => {
            alert('Error submitting order.');
            console.error('Fetch error:', err);
        });
}

function generateOrderID() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');

    return `${month}${day}${hour}${minute}${second}-BLESSINGSCAFE`;
}

function formatDate(dateObj) {
    const pad = (n) => (n < 10 ? '0' + n : n);
    return dateObj.getFullYear() + '-' +
        pad(dateObj.getMonth() + 1) + '-' +
        pad(dateObj.getDate()) + ' ' +
        pad(dateObj.getHours()) + ':' +
        pad(dateObj.getMinutes()) + ':' +
        pad(dateObj.getSeconds());
}

// Proceed order button event listener
document.getElementById('proceed-order-btn').addEventListener('click', async function() {
    if (orderItems.length === 0) {
        alert('Please add at least one item to your order.');
        return;
    }

    const deliveryType = document.getElementById('delivery-type').value;
    let customerName = document.getElementById('customer-name').value.trim();

    if (deliveryType !== 'Take-Out' && !customerName) {
        alert('Please enter the customer name.');
        return;
    }

    if (deliveryType === 'Take-Out' && !customerName) {
        customerName = await generateUniqueCustomerName();
        document.getElementById('customer-name').value = customerName;
    }

    const contactNumber = document.getElementById('contact-number').value.trim();

    if (!deliveryType) {
        alert('Please select a delivery type.');
        return;
    }
    if (deliveryType === 'Delivery') {
        const streetAddress = document.getElementById('street-address').value.trim();
        const selectedArea = document.getElementById('area-select').value;
        if (!streetAddress || !selectedArea) {
            alert('Please enter both street address and select an area.');
            return;
        }
    }

    const selectedPaymentOption = document.querySelector('.payment-option.selected');
    if (!selectedPaymentOption) {
        alert('Please select a payment method.');
        return;
    }
    const paymentModeText = selectedPaymentOption.querySelector('span').textContent.trim();

    const totalText = document.querySelector('.total-row.final span:last-child').textContent;
    const totalNumber = totalText.replace(/[^0-9.]/g, '');

    let totalItemsCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);

    const notes = document.getElementById('notes-textarea').value.trim();

    // Check if E-Payment is selected
    if (paymentModeText === 'E-Payment') {
        // Show confirmation first, then proceed with Xendit payment
        let confirmMsg = `Customer: ${customerName}\n`;
        if (contactNumber) {
            confirmMsg += `Contact Number: ${contactNumber}\n`;
        }
        confirmMsg += `Items: ${totalItemsCount} items\nDelivery Type: ${deliveryType}\n`;
        if (deliveryType === 'Delivery') {
            const streetAddress = document.getElementById('street-address').value.trim();
            const selectedArea = document.getElementById('area-select').value;
            confirmMsg += `Address: ${streetAddress}, ${selectedArea}\n`;
        }
        if (notes) {
            confirmMsg += `Notes: ${notes}\n`;
        }
        confirmMsg += `Payment Method: ${paymentModeText}\nTotal: ₱${totalNumber}\n\nYou will be redirected to payment gateway.`;

        if (await showXenditConfirmModal(confirmMsg)) {
            // Prepare order data for Xendit
            const cart = orderItems.map(item => ({
                ProductID: item.productId || item.key,
                ProductName: item.name,
                Quantity: item.quantity,
                Size: item.size || null,
                BasePrice: item.price,
                AddOns: item.addons && item.addons.length > 0
                    ? item.addons.map(a => ({ AddOnID: a.AddOnID, Name: a.Name, BasePrice: a.BasePrice }))
                    : []
            }));

            let address = '';
            if (deliveryType === 'Delivery') {
                const streetAddress = document.getElementById('street-address').value.trim();
                const selectedArea = document.getElementById('area-select').value;
                address = `${streetAddress}, ${selectedArea}`;
            }

            const orderData = {
                OrderID: generateOrderID(),
                Date: formatDate(new Date()),
                Cart: cart,
                Customer: customerName,
                ContactNumber: contactNumber || '',
                PaymentStatus: "Payment pending",
                PaymentMode: paymentModeText,
                Total: parseFloat(totalNumber),
                ItemTotal: totalItemsCount,
                DeliveryStatus: deliveryType,
                Address: address,
                Notes: notes || '',
                FulfillmentStatus: "Preparing",
                Source: "POS",
                cashierName: userData.fullname || userData.staffId || "Unknown Staff"
            };

            try {
                console.log('Starting payment process...');
                // Show payment modal with loading
                const modal = document.getElementById('xendit-payment-modal');
                const loadingDiv = document.getElementById('loading-payment');
                const paymentDetails = document.getElementById('payment-details');

                if (!modal || !loadingDiv || !paymentDetails) {
                    throw new Error('Required payment elements not found');
                }

                loadingDiv.classList.remove('hidden');
                paymentDetails.classList.add('hidden');
                modal.classList.remove('hidden');

                console.log('Creating Xendit payment...');
                // Create Xendit payment
                const paymentData = await createXenditPayment(orderData);
                console.log('Payment data:', paymentData);

                if (!paymentData || !paymentData.id) {
                    throw new Error('Invalid payment data received from Xendit');
                }

                // Show payment details
                showXenditPaymentModal(paymentData);

                console.log('Submitting order to backend...');
                // Submit order to backend
                const response = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...orderData, XenditPaymentID: paymentData.id })
                });

                const responseData = await response.json();
                console.log('Backend response:', responseData);

                if (!response.ok) {
                    throw new Error(`Server error: ${response.status} - ${responseData.error || 'Unknown error'}`);
                }

                if (!responseData.success) {
                    throw new Error(responseData.error || 'Failed to process order');
                }

                // If we get here, everything was successful
                console.log('Order submitted successfully');
                return true;

            } catch (error) {
                console.error('Payment error:', {
                    error: error.toString(),
                    message: error.message,
                    stack: error.stack
                });

                let errorMessage = 'Error processing payment. Please try again.';
                if (error.message.includes('NetworkError')) {
                    errorMessage = 'Network error. Please check your connection and try again.';
                } else if (error.message.includes('Failed to fetch')) {
                    errorMessage = 'Could not connect to the server. Please check your connection.';
                } else if (error.message) {
                    errorMessage = error.message;
                }

                showXenditMessageModal(errorMessage);
                const modal = document.getElementById('xendit-payment-modal');
                if (modal) modal.classList.add('hidden');
                return false;
            }
        }
    } else {
        // Cash payment - show regular confirmation
        let confirmMsg = `Customer: ${customerName}\n`;
        if (contactNumber) {
            confirmMsg += `Contact Number: ${contactNumber}\n`;
        }
        confirmMsg += `Items: ${totalItemsCount} items\nDelivery Type: ${deliveryType}\n`;
        if (deliveryType === 'Delivery') {
            const streetAddress = document.getElementById('street-address').value.trim();
            const selectedArea = document.getElementById('area-select').value;
            confirmMsg += `Address: ${streetAddress}, ${selectedArea}\n`;
        }
        if (notes) {
            confirmMsg += `Notes: ${notes}\n`;
        }
        confirmMsg += `Payment Method: ${paymentModeText}\nTotal: ₱${totalNumber}`;

        const modal = document.getElementById('order-confirm-modal');
        const messageElem = document.getElementById('confirm-message');
        messageElem.textContent = confirmMsg;
        modal.classList.remove('hidden');

        const confirmBtn = document.getElementById('confirm-submit-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');

        confirmBtn.onclick = function() {
            submitOrder(customerName, contactNumber, deliveryType, paymentModeText, totalNumber, totalItemsCount, notes);
            modal.classList.add('hidden');
        };
        cancelBtn.onclick = function() {
            modal.classList.add('hidden');
        };
    }
});

// Utility function for take-out names
async function generateUniqueCustomerName() {
    let existingNames = [];

    try {
        const res = await fetch('/api/orders/preparing-customers');
        if (res.ok) {
            existingNames = await res.json();
        }
    } catch (e) {
        console.log('Could not fetch existing names, proceeding with generated name.');
    }

    let name;
    let tries = 0;
    do {
        name = 'Customer#' + Math.floor(10000 + Math.random() * 90000);
        tries++;
        if (tries > 100) break;
    } while (existingNames.includes(name));
    return name;
}

// Xendit Payment Functions
async function createXenditPayment(orderData) {
    try {
        const items = orderData.Cart.flatMap(item => {
            let baseItems = [{
                name: item.ProductName,
                quantity: item.Quantity,
                price: item.BasePrice,
                category: orderData.DeliveryStatus === 'Delivery' ? 'Food' : 'Food'
            }];

            if (item.AddOns && item.AddOns.length > 0) {
                item.AddOns.forEach(addon => {
                    baseItems.push({
                        name: `Add-on: ${addon.Name}`,
                        quantity: 1,
                        price: addon.BasePrice,
                        category: "Add-ons"
                    });
                });
            }

            return baseItems;
        });

        if (orderData.DeliveryStatus === 'Delivery') {
            const deliveryFee = 20;
            items.push({
                name: "Delivery Fee",
                quantity: 1,
                price: deliveryFee,
                category: "Service"
            });
        }

        const amount = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

        const invoicePayload = {
            external_id: orderData.OrderID,
            description: "Blessings Cafe Payment",
            merchant_profile_picture_url: "https://i.imgur.com/jgjiwnv.png",
            items: items,
            amount: amount,
            customer_name: orderData.Customer,
            customer_phone: orderData.ContactNumber || "",
            should_send_email: false,
            payment_methods: ["QRPH"],
            invoice_duration: 600
        };

        const response = await fetch('/api/xendit/create-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(invoicePayload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error creating Xendit payment:', error);
        throw error;
    }
}

async function checkPaymentStatus(paymentId) {
    try {
        const response = await fetch(`/api/xendit/check-payment/${paymentId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error checking payment status:', error);
        throw error;
    }
}

function showXenditPaymentModal(paymentData) {
    const modal = document.getElementById('xendit-payment-modal');
    const loadingDiv = document.getElementById('loading-payment');
    const paymentDetails = document.getElementById('payment-details');

    // Safely update UI elements if they exist
    if (loadingDiv) loadingDiv.classList.add('hidden');
    if (paymentDetails) paymentDetails.classList.remove('hidden');

    // Create payment instructions HTML
    let paymentHtml = `
        <div class="payment-instructions">
            <h3>Payment Instructions</h3>
            <div class="payment-details">
                <p><strong>Amount:</strong> ₱${paymentData.amount ? parseFloat(paymentData.amount).toFixed(2) : '0.00'}</p>
                <p><strong>Reference:</strong> ${paymentData.reference_id || 'N/A'}</p>
                <p><strong>Status:</strong> ${paymentData.status || 'Pending'}</p>
            </div>
    `;

    // Add payment button if URL is available
    if (paymentData.checkout_url || paymentData.invoice_url) {
        const paymentUrl = paymentData.checkout_url || paymentData.invoice_url;
        paymentHtml += `
            <a href="${paymentUrl}" target="_blank" class="payment-button">
                Complete Payment
            </a>
        `;
    }

    paymentHtml += '</div>';

    // Update payment details
    if (paymentDetails) {
        paymentDetails.innerHTML = paymentHtml;
    }

    currentPaymentId = paymentData.id || null;

    if (modal) modal.classList.remove('hidden');
}

function showXenditGatewayModal(paymentData) {
    const modal = document.getElementById('xendit-gateway-modal');
    const loadingDiv = document.getElementById('xendit-gateway-loading');
    const detailsDiv = document.getElementById('xendit-gateway-details');
    const paymentAmountSpan = document.getElementById('xendit-payment-amount');
    const paymentLink = document.getElementById('xendit-payment-link');
    const checkStatusBtn = document.getElementById('xendit-check-payment-status');
    const cancelBtn = document.getElementById('xendit-cancel-gateway');

    if (!modal || !loadingDiv || !detailsDiv || !paymentAmountSpan || !paymentLink || !checkStatusBtn || !cancelBtn) return;

    loadingDiv.style.display = 'none';
    detailsDiv.style.display = 'block';
    paymentAmountSpan.textContent = paymentData.amount ? parseFloat(paymentData.amount).toFixed(2) : '0.00';
    paymentLink.href = paymentData.invoice_url || paymentData.checkout_url || '#';
    currentPaymentId = paymentData.id;
    modal.classList.remove('hidden');

    checkStatusBtn.onclick = async function() {
        if (!currentPaymentId) return;
        try {
            const status = await checkPaymentStatus(currentPaymentId);
            if (status.status === 'PAID') {
                await fetch('/api/orders/update-payment-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paymentId: currentPaymentId, status: 'Completed' })
                });
                showXenditMessageModal('Payment successful! Your order has been confirmed.');
                modal.classList.add('hidden');
                orderItems = [];
                renderOrderItems();
                document.getElementById('customer-name').value = '';
                document.getElementById('contact-number').value = '';
                document.getElementById('delivery-type').value = 'Take-Out';
                document.getElementById('address-container').style.display = 'none';
                document.getElementById('street-address').value = '';
                document.getElementById('area-select').value = '';
                document.getElementById('notes-textarea').value = '';
                updateSummary();
                document.querySelectorAll('.payment-option.selected').forEach(el => {
                    el.classList.remove('selected');
                    const check = el.querySelector('.payment-check');
                    check.style.backgroundColor = '#ddd';
                    // Hide SVG for unselected
                    if (check.querySelector('svg')) check.querySelector('svg').style.display = 'none';
                });
                currentPaymentId = null;
            } else {
                showXenditMessageModal('Payment not yet completed. Please complete the payment and try again.');
            }
        } catch (error) {
            showXenditMessageModal('Error checking payment status. Please try again.');
        }
    };
    cancelBtn.onclick = function() {
        modal.classList.add('hidden');
        currentPaymentId = null;
    };
}

// Xendit Message Modal functions
function showXenditMessageModal(message) {
    const modal = document.getElementById('xendit-message-modal');
    const messageElem = document.getElementById('xendit-message');
    const okBtn = document.getElementById('xendit-message-ok-btn');

    if (!modal || !messageElem || !okBtn) return;

    messageElem.textContent = message;
    modal.classList.remove('hidden');

    okBtn.onclick = function() {
        modal.classList.add('hidden');
    };
}

// Xendit Confirm Modal functions
let xenditConfirmResolve = null;

function showXenditConfirmModal(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('xendit-confirm-modal');
        const messageElem = document.getElementById('xendit-confirm-message');
        const yesBtn = document.getElementById('xendit-confirm-yes-btn');
        const noBtn = document.getElementById('xendit-confirm-no-btn');

        if (!modal || !messageElem || !yesBtn || !noBtn) {
            resolve(false);
            return;
        }

        messageElem.textContent = message;
        modal.classList.remove('hidden');
        xenditConfirmResolve = resolve;

        const handleYes = () => {
            modal.classList.add('hidden');
            resolve(true);
        };

        const handleNo = () => {
            modal.classList.add('hidden');
            resolve(false);
        };

        yesBtn.onclick = handleYes;
        noBtn.onclick = handleNo;
    });
}

// Event listeners for Xendit modals
document.addEventListener('DOMContentLoaded', () => {
    // Xendit modal event listeners
    const closePaymentModalBtn = document.getElementById('close-payment-modal');
    const closePaymentModalBtnAlt = document.getElementById('close-payment-modal-btn');

    const closeModal = () => {
        const modal = document.getElementById('xendit-payment-modal');
        if (modal) modal.style.display = 'none';
        currentPaymentId = null;
    };

    if (closePaymentModalBtn) closePaymentModalBtn.addEventListener('click', closeModal);
    if (closePaymentModalBtnAlt) closePaymentModalBtnAlt.addEventListener('click', closeModal);

    // Add event listener for xendit-check-payment-status (button inside modal)
    const checkStatusBtn = document.getElementById('xendit-check-payment-status');
    if (checkStatusBtn) {
        checkStatusBtn.addEventListener('click', async () => {
            if (!currentPaymentId) return;

            try {
                const status = await checkPaymentStatus(currentPaymentId);
                if (status.status === 'PAID') {
                    // Update payment status in database
                    await fetch('/api/orders/update-payment-status', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ paymentId: currentPaymentId, status: 'Completed' })
                    });

                    showXenditMessageModal('Payment successful! Your order has been confirmed.');
                    document.getElementById('xendit-payment-modal').classList.add('hidden');

                    // Reset form
                    orderItems = [];
                    renderOrderItems();
                    document.getElementById('customer-name').value = '';
                    document.getElementById('contact-number').value = '';
                    const deliveryTypeSelect = document.getElementById('delivery-type');
                    deliveryTypeSelect.value = 'Take-Out';
                    const addressContainer = document.getElementById('address-container');
                    addressContainer.style.display = 'none';
                    document.getElementById('street-address').value = '';
                    document.getElementById('area-select').value = '';
                    document.getElementById('notes-textarea').value = '';
                    updateSummary();

                    document.querySelectorAll('.payment-option.selected').forEach(el => {
                        el.classList.remove('selected');
                        const check = el.querySelector('.payment-check');
                        check.style.backgroundColor = '#ddd';
                        // Hide SVG for unselected
                        if (check.querySelector('svg')) check.querySelector('svg').style.display = 'none';
                    });

                    currentPaymentId = null;
                } else {
                    showXenditMessageModal('Payment not yet completed. Please complete the payment and try again.');
                }
            } catch (error) {
                showXenditMessageModal('Error checking payment status. Please try again.');
            }
        });
    }
});

// Override showXenditPaymentModal to use new modal
const origShowXenditPaymentModal = showXenditPaymentModal;
showXenditPaymentModal = function(paymentData) {
    showXenditGatewayModal(paymentData);
};

// Additional delivery type listener for when dropdown changes
document.getElementById('delivery-type').addEventListener('change', () => {
    const deliveryType = document.getElementById('delivery-type').value;
    const addressContainer = document.getElementById('address-container');
    const cashOption = document.querySelector('.payment-option:nth-child(1)');
    if (deliveryType === 'Delivery') {
        addressContainer.style.display = 'block';
        cashOption.classList.add('disabled');
        cashOption.style.pointerEvents = 'none';
        cashOption.style.opacity = '0.5';
        // Deselect if selected
        if (cashOption.classList.contains('selected')) {
            cashOption.classList.remove('selected');
            const check = cashOption.querySelector('.payment-check');
            check.style.backgroundColor = '#ddd';
            // Hide SVG when not selected
            if (check.querySelector('svg')) check.querySelector('svg').style.display = 'none';
        }
    } else {
        addressContainer.style.display = 'none';
        cashOption.classList.remove('disabled');
        cashOption.style.pointerEvents = '';
        cashOption.style.opacity = '';
    }
    updateSummary();
});
