// Initialize cart items (will be loaded asynchronously)
let orderItems = [];
let cartLastLoaded = 0;
const CART_LOAD_COOLDOWN = 5000; // 5 seconds cooldown between cart loads
let cartLoadInProgress = false; // Prevent simultaneous cart loads

document.addEventListener('DOMContentLoaded', async function() {
  // Load cart data based on user type
  if (window.user && window.user._id) {
    // For logged-in users, load from server with rate limiting
    const now = Date.now();
    if (now - cartLastLoaded > CART_LOAD_COOLDOWN && !cartLoadInProgress) {
      cartLoadInProgress = true;
      try {
        const response = await fetch('/api/cart');
        if (response.status === 200 && response.headers.get('content-type')?.includes('application/json')) {
          orderItems = await response.json();
          cartLastLoaded = now;
          console.log('Loaded cart from server:', orderItems);
        } else if (response.status === 429) {
          console.warn('Rate limited, using localStorage fallback');
          // Fallback to localStorage for rate limiting
          orderItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
        } else {
          console.error('Failed to load cart from server, status:', response.status);
          // Fallback to localStorage
          orderItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
        }
      } catch (error) {
        console.error('Error loading cart from server:', error);
        // Fallback to localStorage
        orderItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
      } finally {
        cartLoadInProgress = false;
      }
    } else {
      console.log('Cart loaded recently or in progress, using cached data');
      orderItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
    }
  } else {
    // For guests, use localStorage
    orderItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
  }

  // Only run cart functions if cart elements exist
  const cartItemsContainer = document.getElementById('cart-items');
  if (cartItemsContainer) {
    displayCartItems();
    updateCartTotal();
  }

  // Update navbar cart count if function exists
  if (typeof updateCartCount === 'function') {
    updateCartCount();
  }

  // Handle checkout button click
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', async function() {
      console.log('Checkout button clicked, window.user:', window.user);
      if (!window.user) {
        // For guests, POST cart data to server
        console.log('Posting guest cart data');
        try {
          await fetch('/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderItems })
          });
          console.log('Posted guest cart, redirecting to /checkout');
          window.location.href = '/checkout';
        } catch (err) {
          console.error('Error submitting guest cart:', err);
        }
      } else {
        // Redirect to checkout if logged in
        console.log('Redirecting to /checkout');
        window.location.href = '/checkout';
      }
    });
  }
});

// Display cart items
function displayCartItems() {
  const cartItemsContainer = document.getElementById('cart-items');
  const cartTotalContainer = document.getElementById('cart-total');
  const checkoutBtn = document.getElementById('checkout-btn');

  // Check if cart elements exist (they might not exist on all pages)
  if (!cartItemsContainer) {
    console.warn('Cart items container not found on this page');
    return;
  }

  if (orderItems.length === 0) {
    if (checkoutBtn) checkoutBtn.style.display = 'none';
    cartItemsContainer.innerHTML = `
      <div class="empty-cart">
        <h3>Your cart is empty</h3>
        <p>Let's add some delicious items to your cart!</p>
        <button onclick="window.location.href='/'" class="checkout-btn">Browse Menu</button>
      </div>
    `;
    cartTotalContainer.innerHTML = '';
    return;
  }

  if (checkoutBtn) checkoutBtn.style.display = 'block';

  let itemsHTML = '';
  orderItems.forEach((item, index) => {
    // Calculate addons total
    let addonsTotal = 0;
    let addonsList = [];

    if (item.addons && item.addons.length > 0) {
      item.addons.forEach(addon => {
        addonsTotal += addon.BasePrice || 0;
        addonsList.push(`${addon.Name || addon.IngredientID} (+₱${addon.BasePrice || 0})`);
      });
    }

    const itemTotal = (item.price + addonsTotal) * item.quantity;

    itemsHTML += `
      <div class="cart-item" data-index="${index}">
        <img src="${item.imagelink || '/resources/coffee-icon.png'}" alt="${item.name}" class="cart-item-image">
        <div class="cart-item-details">
          <div class="cart-item-info">
            <h3>${item.name}</h3>
            <p>Category: ${item.category || 'N/A'}</p>
            ${item.size ? `<p>Size: ${item.size}</p>` : ''}
            ${addonsList.length > 0 ? `
              <div class="cart-item-addons">
                ${addonsList.map(addon => `<span class="cart-item-addon">${addon}</span>`).join('')}
              </div>
            ` : ''}
          </div>
          <div class="cart-item-quantity">
            <div class="quantity-controls">
              <button type="button" class="quantity-btn quantity-decrease" onclick="changeQuantity(${index}, -1)">-</button>
              <input type="number" class="quantity-input" value="${item.quantity}" min="1" onchange="updateQuantity(${index}, this.value)" onkeypress="return /^[0-9]$/.test(event.key) || event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Tab' || event.key === 'Enter' || event.key === 'ArrowLeft' || event.key === 'ArrowRight'">
              <button type="button" class="quantity-btn quantity-increase" onclick="changeQuantity(${index}, 1)">+</button>
            </div>
            <div class="cart-item-price">
              ₱${itemTotal.toFixed(2)}
            </div>
          </div>
          <div class="cart-item-remove">
            <button class="remove-btn" onclick="removeItem(${index})">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  });

  cartItemsContainer.innerHTML = itemsHTML;
}

// Change quantity (increase/decrease)
function changeQuantity(index, delta) {
  const item = orderItems[index];
  if (!item) return;

  if (delta === -1 && item.quantity === 1) {
    // Remove item if decreasing from 1
    removeItem(index);
  } else {
    const newQuantity = Math.max(1, item.quantity + delta);
    if (newQuantity !== item.quantity) {
      item.quantity = newQuantity;
      saveCart();
      displayCartItems();
      updateCartTotal();

      if (typeof updateCartCount === 'function') {
        updateCartCount();
      }
    }
  }
}

// Update quantity directly from input
function updateQuantity(index, value) {
  const qty = parseInt(value);
  if (isNaN(qty) || qty < 1) {
    // Reset to current if invalid
    const item = orderItems[index];
    document.querySelector(`.cart-item[data-index="${index}"] .quantity-input`).value = item ? item.quantity : 1;
    return;
  }

  if (orderItems[index]) {
    orderItems[index].quantity = qty;
    saveCart();
    displayCartItems();
    updateCartTotal();

    if (typeof updateCartCount === 'function') {
      updateCartCount();
    }
  }
}

// Remove item
function removeItem(index) {
  const itemToRemove = orderItems[index];
  orderItems.splice(index, 1);
  saveCart();
  displayCartItems();
  updateCartTotal();

  if (typeof updateCartCount === 'function') {
    updateCartCount();
  }

  // Show cart removal notification with item details
  showCartRemoveNotification(itemToRemove);
}

// Update cart total display
function updateCartTotal() {
  const cartTotalContainer = document.getElementById('cart-total');

  // Check if cart total element exists
  if (!cartTotalContainer) {
    return;
  }

  if (orderItems.length === 0) {
    cartTotalContainer.innerHTML = '';
    return;
  }

  const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = orderItems.reduce((sum, item) => {
    if (item.isFree) return sum;
    const addonsTotal = item.addons ? item.addons.reduce((sum, ad) => sum + (ad.BasePrice || 0), 0) : 0;
    return sum + ((item.price + addonsTotal) * item.quantity);
  }, 0);

  cartTotalContainer.innerHTML = `
    <div>
      <p>Subtotal: ₱${totalPrice.toFixed(2)} PHP</p>
      <p style="font-size: 1rem;">Shipping calculated at checkout</p>
    </div>
  `;
}

// Save cart to localStorage and server for logged-in users
function saveCart() {
  localStorage.setItem('orderItems', JSON.stringify(orderItems));

  // Sync with server for logged-in users (with rate limiting)
  if (window.user && window.user._id) {
    // Debounce server saves to prevent excessive API calls
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
            console.warn('Cart save rate limited, will retry later');
            // Don't clear timeout, let it retry
            return;
          } else if (!response.ok) {
            console.error('Error saving cart to server:', response.status);
          }
        } catch (err) {
          console.error('Error saving cart to server:', err);
        } finally {
          saveCart.timeoutId = null;
        }
      }, 2000); // Wait 2 seconds before saving to server
    }
  }
}

// Show cart removal notification (matches add-to-cart popup style)
function showCartRemoveNotification(removedItem) {
  // Create the popup element if it doesn't exist
  let popup = document.getElementById('cart-remove-popup');
  if (popup) {
    // Remove existing popup to recreate with new item details
    popup.remove();
  }

  popup = document.createElement('div');
  popup.id = 'cart-remove-popup';
  popup.className = 'cart-remove-popup';

  // Build item details HTML similar to add-to-cart popup
  let detailsHtml = '';

  if (removedItem.size) {
    detailsHtml += `<span>Size: ${removedItem.size}</span><br>`;
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
      <span>✓ Item removed from your cart</span>
      <button id="cart-remove-close" class="cart-remove-close">&times;</button>
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
      <p class="cart-remove-message">Your cart has been updated successfully.</p>
    </div>
  `;

  document.body.appendChild(popup);

  // Add close functionality
  const closeBtn = popup.querySelector('#cart-remove-close');
  closeBtn.addEventListener('click', () => {
    hideCartRemoveNotification();
  });

  // Auto-hide after 3 seconds
  setTimeout(() => {
    hideCartRemoveNotification();
  }, 3000);

  // Show the popup
  popup.classList.add('show');
}

// Hide cart removal notification
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

// Clear cart (if needed for testing)
function clearCart() {
  orderItems = [];
  saveCart();
  displayCartItems();
  updateCartTotal();

  if (typeof updateCartCount === 'function') {
    updateCartCount();
  }
}
