let orderItems = [];
let cartLastLoaded = 0;
const CART_LOAD_COOLDOWN = 5000;
let cartLoadInProgress = false;
let selectedItems = new Set();

function loadSelectedItems() {
  const saved = localStorage.getItem('selectedCartItems');
  if (saved) {
    selectedItems = new Set(JSON.parse(saved));
  }
}

function saveSelectedItems() {
  localStorage.setItem('selectedCartItems', JSON.stringify(Array.from(selectedItems)));
}

function generateItemKey(item, index) {
  return `${index}-${item.productId}-${item.size || 'nosize'}`;
}

document.addEventListener('DOMContentLoaded', async function() {
  if (window.user && window.user._id) {
    const now = Date.now();
    if (now - cartLastLoaded > CART_LOAD_COOLDOWN && !cartLoadInProgress) {
      cartLoadInProgress = true;
      try {
        const response = await fetch('/api/cart');
        if (response.status === 200 && response.headers.get('content-type')?.includes('application/json')) {
          orderItems = await response.json();
          cartLastLoaded = now;
        } else if (response.status === 429) {
          orderItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
        } else {
          orderItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
        }
      } catch (error) {
        orderItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
      } finally {
        cartLoadInProgress = false;
      }
    } else {
      orderItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
    }

    orderItems.forEach(item => {
      if (item.imagelink && item.imagelink.startsWith('https://blessingsateverysip.me')) {
        item.imagelink = item.imagelink.replace('https://blessingsateverysip.me', '');
      }
    });
  } else {
    orderItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
  }

  loadSelectedItems();
  if (selectedItems.size === 0 && orderItems.length > 0) {
    orderItems.forEach((item, index) => {
      selectedItems.add(generateItemKey(item, index));
    });
    saveSelectedItems();
  }

  const cartItemsContainer = document.getElementById('cart-items');
  if (cartItemsContainer) {
    displayCartLayout();
    updateCartTotal();
  }

  if (typeof updateCartCount === 'function') {
    updateCartCount();
  }

  updateCheckoutButtonState();

  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', async function() {
      const selectedCount = selectedItems.size;
      if (selectedCount === 0) {
        if (typeof notificationSystem !== 'undefined') {
          notificationSystem.warning('Please select at least one item to checkout.', 'No Items Selected');
        }
        return;
      }

      // Get selected items
      const selectedOrderItems = [];
      orderItems.forEach((item, index) => {
        const itemKey = generateItemKey(item, index);
        if (selectedItems.has(itemKey)) {
          selectedOrderItems.push(item);
        }
      });

      // Validate selected items before proceeding
      const validation = validateCartBeforeCheckout(selectedOrderItems);
      if (!validation.valid) {
        if (typeof notificationSystem !== 'undefined') {
          notificationSystem.error(validation.error, 'Validation Failed');
        }
        return;
      }

      if (!window.user) {
        try {
          await fetch('/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderItems: selectedOrderItems })
          });
          window.location.href = '/checkout';
        } catch (err) {
          console.error('Error submitting guest cart:', err);
        }
      } else {
        window.location.href = '/checkout';
      }
    });
    updateCheckoutButtonState();
  }
});

function displayCartLayout() {
  const cartItemsContainer = document.getElementById('cart-items');
  const layoutWrapper = document.getElementById('cart-layout-wrapper');
  const checkoutBtn = document.getElementById('checkout-btn');

  if (!cartItemsContainer) {
    console.warn('Cart items container not found');
    return;
  }

  if (orderItems.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="empty-cart">
        <h3>Your cart is empty</h3>
        <p>Let's add some delicious items to your cart!</p>
        <button onclick="window.location.href='/'" class="checkout-btn">Browse Menu</button>
      </div>
    `;
    if (layoutWrapper) layoutWrapper.style.display = 'none';
    if (checkoutBtn) checkoutBtn.style.display = 'none';
    updateCheckoutButtonState();
    return;
  }

  cartItemsContainer.innerHTML = '';
  layoutWrapper.style.display = 'grid';
  if (checkoutBtn) checkoutBtn.style.display = 'block';

  updateCheckoutButtonState();

  populateOrderInfoCard();
  populateCustomerInfoCard();
  populateItemsCard();
  initializeCardExpansion();
}

function populateOrderInfoCard() {
  const orderInfoBody = document.getElementById('order-info-body');
  if (!orderInfoBody) return;

  const orderDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const orderTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  orderInfoBody.innerHTML = `
    <div style="font-size: 0.95rem; color: var(--text-secondary);">
      <p style="margin: 0 0 8px 0;"><strong>Order Date:</strong> ${orderDate}</p>
      <p style="margin: 0;"><strong>Order Time:</strong> ${orderTime}</p>
    </div>
  `;
}

function populateCustomerInfoCard() {
  const customerInfoBody = document.getElementById('customer-info-body');
  if (!customerInfoBody) return;

  if (window.user) {
    customerInfoBody.innerHTML = `
      <div style="font-size: 0.95rem; color: var(--text-secondary);">
        <p style="margin: 0 0 6px 0;"><strong>Name:</strong> ${window.user.name || 'N/A'}</p>
        <p style="margin: 0 0 6px 0;"><strong>Email:</strong> ${window.user.email || 'N/A'}</p>
        <p style="margin: 0;"><strong>Phone:</strong> ${window.user.phone || 'N/A'}</p>
      </div>
    `;
  } else {
    customerInfoBody.innerHTML = `
      <div style="font-size: 0.95rem; color: var(--text-secondary);">
        <p style="margin: 0;">Guest checkout - provide details at checkout page</p>
      </div>
    `;
  }
}

function populateItemsCard() {
  const itemsBody = document.getElementById('items-body');
  if (!itemsBody) return;

  let itemsHTML = '';
  orderItems.forEach((item, index) => {
    const itemKey = generateItemKey(item, index);
    const isSelected = selectedItems.has(itemKey);

    let addonsTotal = 0;
    let addonsList = [];
    if (item.addons && item.addons.length > 0) {
      item.addons.forEach(addon => {
        const addonPrice = parseFloat(addon.BasePrice || addon.basePrice || 0);
        addonsTotal += addonPrice;
        addonsList.push({
          name: addon.Name || addon.name || addon.IngredientID,
          price: addonPrice
        });
      });
    }

    const itemTotal = (parseFloat(item.price) + addonsTotal) * parseInt(item.quantity);

    itemsHTML += `
      <div class="cart-item ${isSelected ? 'selected' : ''} ${item.isB1T1 ? 'b1t1-free' : ''} ${item.b1t1Used ? 'b1t1-basis' : ''}" data-index="${index}" data-product-id="${item.productId}" data-item-key="${itemKey}">
        <div class="cart-item-checkbox-container">
          <input type="checkbox" class="cart-item-checkbox" ${isSelected ? 'checked' : ''} data-item-key="${itemKey}" aria-label="Select ${item.name}">
        </div>
        <img src="${item.imagelink || '/resources/coffee-icon.png'}" alt="${item.name}" class="cart-item-image">
        <div class="cart-item-info">
          <h4>${item.name} ${item.isB1T1 ? '<span class="b1t1-free-badge">FREE (B1T1)</span>' : ''} ${item.b1t1Used ? '<span class="b1t1-basis-badge">B1T1 Basis</span>' : ''}</h4>
          <p>${item.category || 'N/A'}</p>
          ${item.size ? `<p>Size: <strong>${item.size}</strong></p>` : ''}
          ${addonsList.length > 0 ? `
            <div class="cart-item-addons">
              ${addonsList.map(a => `<span class="cart-item-addon">${a.name}</span>`).join('')}
            </div>
          ` : ''}
          <div class="cart-item-breakdown">
            <div class="cart-item-price-row">
              <span>Base: ₱${parseFloat(item.price).toFixed(2)}</span>
              <span>×${item.quantity}</span>
            </div>
            ${addonsList.length > 0 ? `
              <div class="cart-item-price-row">
                <span>Add-ons: ₱${addonsTotal.toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="cart-item-total">
              <span>Item Total:</span>
              <span>₱${itemTotal.toFixed(2)}</span>
            </div>
            ${getPromoButtons(item, index)}
          </div>
        </div>
        <div class="cart-item-actions">
          <div class="quantity-controls">
            <button type="button" class="quantity-btn quantity-decrease" onclick="changeQuantity(${index}, -1)" aria-label="Decrease quantity">−</button>
            <input type="number" class="quantity-input" value="${item.quantity}" min="1" onchange="updateQuantity(${index}, this.value)" aria-label="Quantity">
            <button type="button" class="quantity-btn quantity-increase" onclick="changeQuantity(${index}, 1)" aria-label="Increase quantity">+</button>
          </div>
          <button class="remove-btn" onclick="removeItem(${index})" title="Remove item from cart" aria-label="Remove ${item.name}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  });

  itemsBody.innerHTML = itemsHTML;
  attachCheckboxHandlers();
  attachCartItemClickHandlers();
}

function initializeCardExpansion() {
  const itemsCard = document.getElementById('items-card');
  if (!itemsCard) return;

  const header = itemsCard.querySelector('.cart-card-header');
  if (header) {
    header.style.cursor = 'default';
  }
}

function attachCheckboxHandlers() {
  const checkboxes = document.querySelectorAll('.cart-item-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const itemKey = this.dataset.itemKey;
      const index = parseInt(this.closest('.cart-item').dataset.index);
      const item = orderItems[index];

      if (this.checked) {
        selectedItems.add(itemKey);

        if (item && item.b1t1Used && typeof item.b1t1PairIndex !== 'undefined') {
          const pairItem = orderItems[item.b1t1PairIndex];
          if (pairItem) {
            const pairKey = generateItemKey(pairItem, item.b1t1PairIndex);
            selectedItems.add(pairKey);
          }
        }

        if (item && item.isB1T1 && typeof item.b1t1BasisIndex !== 'undefined') {
          const basisItem = orderItems[item.b1t1BasisIndex];
          if (basisItem) {
            const basisKey = generateItemKey(basisItem, item.b1t1BasisIndex);
            selectedItems.add(basisKey);
          }
        }
      } else {
        selectedItems.delete(itemKey);

        if (item && item.b1t1Used && typeof item.b1t1PairIndex !== 'undefined') {
          const pairItem = orderItems[item.b1t1PairIndex];
          if (pairItem) {
            const pairKey = generateItemKey(pairItem, item.b1t1PairIndex);
            selectedItems.delete(pairKey);
          }
        }

        if (item && item.isB1T1 && typeof item.b1t1BasisIndex !== 'undefined') {
          const basisItem = orderItems[item.b1t1BasisIndex];
          if (basisItem) {
            const basisKey = generateItemKey(basisItem, item.b1t1BasisIndex);
            selectedItems.delete(basisKey);
          }
        }
      }

      saveSelectedItems();
      displayCartLayout();
      updateCartTotal();
      updateCheckoutButtonState();
    });
  });
}

function attachCartItemClickHandlers() {
  const cartItems = document.querySelectorAll('.cart-item');
  cartItems.forEach((cartItem, index) => {
    cartItem.style.cursor = 'pointer';
    cartItem.addEventListener('click', function(event) {
      if (event.target.closest('.remove-btn') ||
          event.target.closest('.quantity-btn') ||
          event.target.closest('.quantity-input') ||
          event.target.closest('.cart-item-checkbox') ||
          event.target.closest('.promo-btn') ||
          event.target.closest('.cart-item-promos')) {
        return;
      }

      const item = orderItems[index];
      if (!item) return;

      const editData = {
        productId: item.productId,
        name: item.name,
        selectedSize: item.size,
        quantity: item.quantity,
        addons: item.addons || [],
        price: item.price,
        category: item.category,
        imagelink: item.imagelink,
        cartItemIndex: index
      };

      sessionStorage.setItem('editingCartItem', JSON.stringify(editData));
      window.location.href = `/product/${item.productId}`;
    });
  });
}

function changeQuantity(index, delta) {
  const item = orderItems[index];
  if (!item) return;

  if (delta === -1 && item.quantity === 1) {
    removeItem(index);
  } else {
    const newQuantity = Math.max(1, item.quantity + delta);
    if (newQuantity !== item.quantity) {
      item.quantity = newQuantity;
      saveCart();
      displayCartLayout();
      updateCartTotal();

      if (typeof updateCartCount === 'function') {
        updateCartCount();
      }
    }
  }
}

function updateQuantity(index, value) {
  const qty = parseInt(value);
  if (isNaN(qty) || qty < 1) {
    const item = orderItems[index];
    if (item) {
      document.querySelector(`.cart-item[data-index="${index}"] .quantity-input`).value = item.quantity;
    }
    return;
  }

  if (orderItems[index]) {
    orderItems[index].quantity = qty;
    saveCart();
    displayCartLayout();
    updateCartTotal();

    if (typeof updateCartCount === 'function') {
      updateCartCount();
    }
  }
}

function removeItem(index) {
  const itemToRemove = orderItems[index];
  const itemKey = generateItemKey(itemToRemove, index);

  // Handle B1T1 removal - clear paired item's B1T1 status
  if (itemToRemove.b1t1Used && typeof itemToRemove.b1t1PairIndex !== 'undefined') {
    const pairIndex = itemToRemove.b1t1PairIndex;
    const pairedItem = orderItems[pairIndex];
    if (pairedItem && pairedItem.isB1T1) {
      pairedItem.isB1T1 = false;
      pairedItem.isFree = false;
      pairedItem.price = pairedItem.originalPrice || pairedItem.price;
      delete pairedItem.originalPrice;
      delete pairedItem.b1t1BasisIndex;
    }
  }

  if (itemToRemove.isB1T1 && typeof itemToRemove.b1t1BasisIndex !== 'undefined') {
    const basisIndex = itemToRemove.b1t1BasisIndex;
    const basisItem = orderItems[basisIndex];
    if (basisItem && basisItem.b1t1Used) {
      basisItem.b1t1Used = false;
      delete basisItem.b1t1PairIndex;
    }
  }

  orderItems.splice(index, 1);
  selectedItems.delete(itemKey);

  // Update B1T1 pair indices after removal
  orderItems.forEach((item, newIndex) => {
    if (item.b1t1PairIndex !== undefined) {
      if (item.b1t1PairIndex > index) {
        item.b1t1PairIndex--;
      }
    }
    if (item.b1t1BasisIndex !== undefined) {
      if (item.b1t1BasisIndex > index) {
        item.b1t1BasisIndex--;
      }
    }
  });

  const newSelectedItems = new Set();
  orderItems.forEach((item, newIndex) => {
    const key = generateItemKey(item, newIndex);
    if (selectedItems.has(`${index + 1}-${item.productId}-${item.size || 'nosize'}`) ||
        selectedItems.has(`${index}-${item.productId}-${item.size || 'nosize'}`) ||
        selectedItems.has(key)) {
      newSelectedItems.add(key);
    }
  });
  selectedItems = newSelectedItems;

  saveCart();
  saveSelectedItems();
  displayCartLayout();
  updateCartTotal();

  if (typeof updateCartCount === 'function') {
    updateCartCount();
  }

  showCartRemoveNotification(itemToRemove);
  updateCheckoutButtonState();
}

function updateCheckoutButtonState() {
  const checkoutBtn = document.getElementById('checkout-btn');
  if (!checkoutBtn) return;

  let hasNonFreeItem = false;
  orderItems.forEach((item, index) => {
    const itemKey = generateItemKey(item, index);
    if (selectedItems.has(itemKey) && !item.isB1T1 && !item.isFree) {
      hasNonFreeItem = true;
    }
  });

  if (selectedItems.size === 0 || !hasNonFreeItem) {
    checkoutBtn.disabled = true;
    checkoutBtn.classList.add('disabled');
    checkoutBtn.setAttribute('aria-disabled', 'true');
  } else {
    checkoutBtn.disabled = false;
    checkoutBtn.classList.remove('disabled');
    checkoutBtn.removeAttribute('aria-disabled');
  }
}

function updateCartTotal() {
  const subtotalEl = document.getElementById('subtotal');
  const deliveryFeeEl = document.getElementById('delivery-fee');
  const discountEl = document.getElementById('discount-amount');
  const totalEl = document.getElementById('final-total');

  if (!totalEl) return;

  const selectedOrderItems = [];
  orderItems.forEach((item, index) => {
    const itemKey = generateItemKey(item, index);
    if (selectedItems.has(itemKey) && !item.isFree) {
      selectedOrderItems.push(item);
    }
  });

  const finalTotal = calculatePromotionalTotal(selectedOrderItems);
  totalEl.textContent = '₱' + finalTotal.toFixed(2);

  const savings = calculateBuy3For143Savings(selectedOrderItems);
  if (savings > 0) {
    showPromoSavings(savings);
  } else {
    hidePromoSavings();
  }
}

function checkBuy3For143(items) {
  let milkteaCount = 0;
  items.forEach(item => {
    if (item.isB1T1 || item.b1t1Used) return;
    if (item.category === 'Milktea') {
      milkteaCount += item.quantity || 1;
    }
  });
  return Math.floor(milkteaCount / 3);
}

function calculateBuy3For143Savings(items) {
  const promoSets = checkBuy3For143(items);
  if (promoSets === 0) return 0;

  let milkteaItems = [];
  items.forEach(item => {
    if (item.isB1T1 || item.b1t1Used) return;
    if (item.category === 'Milktea') {
      milkteaItems.push(item);
    }
  });

  let totalMilkteaCount = 0;
  milkteaItems.forEach(item => {
    totalMilkteaCount += item.quantity || 1;
  });

  const completeSets = Math.floor(totalMilkteaCount / 3);
  if (completeSets === 0) return 0;

  const allMilktea = [];
  milkteaItems.forEach(item => {
    for (let i = 0; i < (item.quantity || 1); i++) {
      allMilktea.push({ price: parseFloat(item.price) || 0 });
    }
  });

  allMilktea.sort((a, b) => a.price - b.price);

  let totalSavings = 0;
  for (let setIndex = 0; setIndex < completeSets; setIndex++) {
    const setStart = setIndex * 3;
    const setDrinks = allMilktea.slice(setStart, setStart + 3);
    const normalSetPrice = setDrinks.reduce((sum, drink) => sum + drink.price, 0);
    if (normalSetPrice > 143) {
      totalSavings += normalSetPrice - 143;
    }
  }

  return totalSavings;
}

function calculatePromotionalTotal(items) {
  let total = 0;
  const promoSets = checkBuy3For143(items);

  if (promoSets > 0) {
    let milkteaItems = [];
    let otherItems = [];
    let b1t1Items = [];

    items.forEach(item => {
      if (item.isB1T1 || item.b1t1Used) {
        b1t1Items.push(item);
      } else if (item.category === 'Milktea') {
        milkteaItems.push(item);
      } else {
        otherItems.push(item);
      }
    });

    let totalMilkteaCount = 0;
    milkteaItems.forEach(item => {
      totalMilkteaCount += item.quantity || 1;
    });

    const completeSets = Math.floor(totalMilkteaCount / 3);
    let milkteaTotal = 0;

    if (completeSets > 0) {
      const allMilktea = [];
      milkteaItems.forEach(item => {
        const addonsTotal = item.addons ? item.addons.reduce((sum, ad) => sum + (parseFloat(ad.BasePrice || ad.basePrice) || 0), 0) : 0;
        for (let i = 0; i < (item.quantity || 1); i++) {
          allMilktea.push({
            price: parseFloat(item.price) || 0,
            addonsTotal: addonsTotal
          });
        }
      });

      allMilktea.sort((a, b) => a.price - b.price);

      for (let setIndex = 0; setIndex < completeSets; setIndex++) {
        const setStart = setIndex * 3;
        const setDrinks = allMilktea.slice(setStart, setStart + 3);
        const normalSetPrice = setDrinks.reduce((sum, drink) => sum + drink.price, 0);
        const setAddonsTotal = setDrinks.reduce((sum, drink) => sum + drink.addonsTotal, 0);
        if (normalSetPrice > 143) {
          milkteaTotal += 143 + setAddonsTotal;
        } else {
          milkteaTotal += normalSetPrice + setAddonsTotal;
        }
      }

      for (let i = completeSets * 3; i < allMilktea.length; i++) {
        milkteaTotal += allMilktea[i].price + allMilktea[i].addonsTotal;
      }
    } else {
      milkteaItems.forEach(item => {
        const addonsTotal = item.addons ? item.addons.reduce((sum, ad) => sum + (parseFloat(ad.BasePrice || ad.basePrice) || 0), 0) : 0;
        milkteaTotal += (parseFloat(item.price) + addonsTotal) * (item.quantity || 1);
      });
    }

    otherItems.forEach(item => {
      const addonsTotal = item.addons ? item.addons.reduce((sum, ad) => sum + (parseFloat(ad.BasePrice || ad.basePrice) || 0), 0) : 0;
      total += (parseFloat(item.price) + addonsTotal) * (item.quantity || 1);
    });

    total += milkteaTotal;

    b1t1Items.forEach(item => {
      if (item.b1t1Used) {
        const b1t1Price = item.size === '16oz' ? 79 : 99;
        total += b1t1Price;
      }
    });
  } else {
    items.forEach(item => {
      if (item.b1t1Used) {
        const b1t1Price = item.size === '16oz' ? 79 : 99;
        total += b1t1Price;
      } else if (item.isB1T1) {
        // Free drink
      } else {
        const addonsTotal = item.addons ? item.addons.reduce((sum, ad) => sum + (parseFloat(ad.BasePrice || ad.basePrice) || 0), 0) : 0;
        total += (parseFloat(item.price) + addonsTotal) * (item.quantity || 1);
      }
    });
  }

  return total;
}

function showPromoSavings(savings) {
  let savingsEl = document.getElementById('promo-savings');
  if (!savingsEl) {
    const totalEl = document.getElementById('final-total');
    if (totalEl) {
      savingsEl = document.createElement('div');
      savingsEl.id = 'promo-savings';
      savingsEl.style.cssText = 'color: #27ae60; font-size: 0.85rem; font-weight: 600; margin-top: 8px; display: flex; align-items: center; justify-content: flex-end; gap: 6px;';
      totalEl.closest('.cart-total-row').insertAdjacentElement('afterend', savingsEl);
    }
  }
  if (savingsEl) {
    savingsEl.innerHTML = `🎉 Buy 3 for ₱143 - You save ₱${savings.toFixed(2)}!`;
    savingsEl.style.display = 'flex';
  }
}

function hidePromoSavings() {
  const savingsEl = document.getElementById('promo-savings');
  if (savingsEl) {
    savingsEl.style.display = 'none';
  }
}

function getPromoButtons(item, index) {
  if (item.isB1T1 || item.b1t1Used) return '';

  let buttons = '';
  const isB1T1Eligible = (
    (item.size === '16oz' && (item.category === 'Coffee' || item.category === 'Milktea')) ||
    (item.size === '22oz' && item.category === 'Milktea')
  );

  if (isB1T1Eligible) {
    const b1t1Price = item.size === '16oz' ? 79 : 99;
    buttons += `<button class="promo-btn b1t1-btn" onclick="showB1T1Modal('${item.category}', '${item.size}', ${index})" title="Buy 1 Take 1">🛍️ B1T1 (Pair: ₱${b1t1Price})</button>`;
  }

  if (item.category === 'Milktea') {
    const currentMilkteaCount = countMilkteaInCart();
    if (currentMilkteaCount >= 3) {
      buttons += `<div class="promo-applied-badge">🎉 Buy 3 for ₱143 Applied!</div>`;
    } else {
      const needed = 3 - currentMilkteaCount;
      buttons += `<div class="promo-hint">Add ${needed} more Milktea for Buy 3 for ₱143!</div>`;
    }
  }

  return buttons ? `<div class="cart-item-promos">${buttons}</div>` : '';
}

function countMilkteaInCart() {
  let count = 0;
  orderItems.forEach((item, index) => {
    const itemKey = generateItemKey(item, index);
    if (selectedItems.has(itemKey) && !item.isB1T1 && !item.b1t1Used && item.category === 'Milktea') {
      count += item.quantity || 1;
    }
  });
  return count;
}

function showB1T1Modal(category, basisSize, basisIndex) {
  const basisItem = orderItems[basisIndex];
  if (!basisItem) return;

  const eligibleItems = [];
  orderItems.forEach((item, idx) => {
    if (idx === basisIndex) return;
    if (item.isB1T1 || item.b1t1Used) return;
    if (item.size !== basisSize) return;

    let isEligible = false;
    if (basisSize === '16oz') {
      isEligible = item.category === 'Coffee' || item.category === 'Milktea';
    } else if (basisSize === '22oz') {
      isEligible = item.category === 'Milktea';
    }

    if (isEligible) {
      eligibleItems.push({ item, index: idx });
    }
  });

  const b1t1Price = basisSize === '16oz' ? 79 : 99;

  let modalContent = `
    <div class="b1t1-modal-overlay" id="b1t1-modal">
      <div class="b1t1-modal">
        <div class="b1t1-modal-header">
          <h3>🛍️ Buy 1 Take 1 - ₱${b1t1Price}</h3>
          <button class="b1t1-modal-close" onclick="closeB1T1Modal()">&times;</button>
        </div>
        <div class="b1t1-modal-body">
          <p class="b1t1-basis-info">Basis: <strong>${basisItem.name}</strong> (${basisSize})</p>
          <p class="b1t1-instruction">Select a drink to pair:</p>
  `;

  if (eligibleItems.length === 0) {
    modalContent += `
      <div class="b1t1-empty">
        <p>No eligible items in your cart for B1T1 pairing.</p>
        <p style="font-size: 0.85rem; color: var(--text-secondary);">Add another ${basisSize} ${basisSize === '22oz' ? 'Milktea' : 'Coffee or Milktea'} to your cart first.</p>
      </div>
    `;
  } else {
    modalContent += `<div class="b1t1-options">`;
    eligibleItems.forEach(({ item, index }) => {
      modalContent += `
        <div class="b1t1-option" onclick="applyB1T1(${basisIndex}, ${index})">
          <img src="${item.imagelink || '/resources/coffee-icon.png'}" alt="${item.name}" class="b1t1-option-img">
          <div class="b1t1-option-info">
            <span class="b1t1-option-name">${item.name}</span>
            <span class="b1t1-option-size">${item.size} - ${item.category}</span>
          </div>
          <span class="b1t1-option-price">₱${parseFloat(item.price).toFixed(2)}</span>
        </div>
      `;
    });
    modalContent += `</div>`;
  }

  modalContent += `
        </div>
        <div class="b1t1-modal-footer">
          <button class="b1t1-cancel-btn" onclick="closeB1T1Modal()">Cancel</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalContent);
}

function closeB1T1Modal() {
  const modal = document.getElementById('b1t1-modal');
  if (modal) modal.remove();
}

function applyB1T1(basisIndex, freeIndex) {
  const basisItem = orderItems[basisIndex];
  const freeItem = orderItems[freeIndex];

  if (!basisItem || !freeItem) {
    closeB1T1Modal();
    return;
  }

  basisItem.b1t1Used = true;
  basisItem.b1t1PairIndex = freeIndex;

  freeItem.isB1T1 = true;
  freeItem.isFree = true;
  freeItem.b1t1BasisIndex = basisIndex;
  freeItem.originalPrice = freeItem.price;
  freeItem.price = 0;

  closeB1T1Modal();
  saveCart();
  displayCartLayout();
  updateCartTotal();

  showPromoToast('🎉 B1T1 Applied!', 'Your paired drink is now free.');
}

function showPromoToast(title, message) {
  let toast = document.getElementById('promo-toast');
  if (toast) toast.remove();

  toast = document.createElement('div');
  toast.id = 'promo-toast';
  toast.className = 'promo-toast';
  toast.innerHTML = `
    <div class="promo-toast-icon">✓</div>
    <div class="promo-toast-content">
      <div class="promo-toast-title">${title}</div>
      <div class="promo-toast-message">${message}</div>
    </div>
  `;

  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function saveCart() {
  localStorage.setItem('orderItems', JSON.stringify(orderItems));

  if (window.user && window.user._id) {
    if (!saveCart.timeoutId) {
      saveCart.timeoutId = setTimeout(async () => {
        try {
          const response = await fetch('/api/cart', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderItems)
          });

          if (response.status === 429) {
            return;
          } else if (!response.ok) {
            console.error('Error saving cart:', response.status);
          }
        } catch (err) {
          console.error('Error saving cart:', err);
        } finally {
          saveCart.timeoutId = null;
        }
      }, 2000);
    }
  }
}

function showCartRemoveNotification(removedItem) {
  let popup = document.getElementById('cart-remove-popup');
  if (popup) {
    popup.remove();
  }

  popup = document.createElement('div');
  popup.id = 'cart-remove-popup';
  popup.className = 'cart-remove-popup';

  let detailsHtml = '';
  if (removedItem.size) {
    detailsHtml += `<span>Size: ${removedItem.size}</span>`;
  }
  if (removedItem.quantity && removedItem.quantity > 1) {
    detailsHtml += `<span>Qty: ${removedItem.quantity}</span>`;
  }
  if (removedItem.addons && removedItem.addons.length > 0) {
    const addonNames = removedItem.addons.map(addon => addon.Name || addon.name).join(', ');
    detailsHtml += `<span>Add-ons: ${addonNames}</span>`;
  }

  popup.innerHTML = `
    <div class="cart-remove-header">
      <span>✓ Item removed from cart</span>
      <button id="cart-remove-close" class="cart-remove-close" aria-label="Close notification">&times;</button>
    </div>
    <div class="cart-remove-body">
      <div class="cart-remove-item">
        <div class="cart-remove-image">
          ${removedItem.imagelink ?
            `<img src="${removedItem.imagelink}" alt="${removedItem.name}">` :
            `<div class="cart-remove-placeholder">No Image</div>`
          }
        </div>
        <div class="cart-remove-info">
          <h4>${removedItem.name}</h4>
          <div class="cart-remove-details">
            ${detailsHtml}
          </div>
        </div>
      </div>
      <p class="cart-remove-message">Your cart has been updated.</p>
    </div>
  `;

  document.body.appendChild(popup);

  const closeBtn = popup.querySelector('#cart-remove-close');
  closeBtn.addEventListener('click', () => {
    hideCartRemoveNotification();
  });

  setTimeout(() => {
    hideCartRemoveNotification();
  }, 3000);

  popup.classList.add('show');
}

function hideCartRemoveNotification() {
  const popup = document.getElementById('cart-remove-popup');
  if (popup) {
    popup.classList.remove('show');
    setTimeout(() => {
      if (popup.parentElement) {
        popup.parentElement.removeChild(popup);
      }
    }, 400);
  }
}

function validateCartBeforeCheckout(items) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { valid: false, error: 'No items selected for checkout' };
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Check required fields
    if (!item.name) {
      return { valid: false, error: `Item ${i + 1}: Product name is missing` };
    }

    if (!item.productId && !item.ProductID) {
      return { valid: false, error: `Item ${i + 1} (${item.name}): Product ID is missing` };
    }

    if (typeof item.price !== 'number' || item.price < 0) {
      return { valid: false, error: `Item ${i + 1} (${item.name}): Invalid price` };
    }

    if (typeof item.quantity !== 'number' || item.quantity < 1) {
      return { valid: false, error: `Item ${i + 1} (${item.name}): Invalid quantity` };
    }

    // Validate add-ons if present
    if (item.addons && Array.isArray(item.addons)) {
      for (let j = 0; j < item.addons.length; j++) {
        const addon = item.addons[j];
        
        if (!addon.Name && !addon.name && !addon.IngredientID && !addon.ingredientId) {
          return {
            valid: false,
            error: `Item ${i + 1} (${item.name}), Add-on ${j + 1}: Invalid add-on data`
          };
        }

        const addonPrice = addon.BasePrice || addon.basePrice;
        if (typeof addonPrice !== 'number' || addonPrice < 0) {
          const addonName = addon.Name || addon.name || 'Unknown';
          return {
            valid: false,
            error: `Item ${i + 1} (${item.name}), Add-on "${addonName}": Invalid price`
          };
        }
      }
    }
  }

  return { valid: true };
}

function clearCart() {
  orderItems = [];
  saveCart();
  displayCartLayout();
  updateCartTotal();

  if (typeof updateCartCount === 'function') {
    updateCartCount();
  }
}
