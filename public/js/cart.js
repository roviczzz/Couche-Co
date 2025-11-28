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
      if (!window.user) {
        try {
          await fetch('/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderItems })
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
      <div class="cart-item ${isSelected ? 'selected' : ''}" data-index="${index}" data-product-id="${item.productId}" data-item-key="${itemKey}">
        <div class="cart-item-checkbox-container">
          <input type="checkbox" class="cart-item-checkbox" ${isSelected ? 'checked' : ''} data-item-key="${itemKey}" aria-label="Select ${item.name}">
        </div>
        <img src="${item.imagelink || '/resources/coffee-icon.png'}" alt="${item.name}" class="cart-item-image">
        <div class="cart-item-info">
          <h4>${item.name}</h4>
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
      if (this.checked) {
        selectedItems.add(itemKey);
      } else {
        selectedItems.delete(itemKey);
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
          event.target.closest('.cart-item-checkbox')) {
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

  orderItems.splice(index, 1);
  selectedItems.delete(itemKey);

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
  if (selectedItems.size === 0) {
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

  let subtotal = 0;
  orderItems.forEach((item, index) => {
    const itemKey = generateItemKey(item, index);
    if (selectedItems.has(itemKey) && !item.isFree) {
      const addonsTotal = item.addons ? item.addons.reduce((sum, ad) => sum + (parseFloat(ad.BasePrice || ad.basePrice) || 0), 0) : 0;
      subtotal += (parseFloat(item.price) + addonsTotal) * parseInt(item.quantity);
    }
  });

  const finalTotal = subtotal;
  totalEl.textContent = '₱' + finalTotal.toFixed(2);
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

function clearCart() {
  orderItems = [];
  saveCart();
  displayCartLayout();
  updateCartTotal();

  if (typeof updateCartCount === 'function') {
    updateCartCount();
  }
}
