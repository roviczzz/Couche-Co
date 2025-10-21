// Load cart items from localStorage
let orderItems = JSON.parse(localStorage.getItem('orderItems') || '[]');

document.addEventListener('DOMContentLoaded', function() {
  displayCartItems();
  updateCartTotal();

  // Update navbar cart count if function exists
  if (typeof updateCartCount === 'function') {
    updateCartCount();
  }

  // Handle checkout button click
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function() {
      console.log('Checkout button clicked, window.user:', window.user);
      if (!window.user) {
        // Redirect to login if not logged in
        console.log('Redirecting to login');
        window.location.href = '/auth/login';
      } else {
        // Redirect to checkout if logged in
        console.log('Redirecting to /user/checkout');
        window.location.href = '/user/checkout';
      }
    });
  }
});

// Display cart items
function displayCartItems() {
  const cartItemsContainer = document.getElementById('cart-items');
  const cartTotalContainer = document.getElementById('cart-total');
  const checkoutBtn = document.getElementById('checkout-btn');

  if (orderItems.length === 0) {
    if (checkoutBtn) checkoutBtn.style.display = 'none';
    cartItemsContainer.innerHTML = `
      <div class="empty-cart">
        <h3>Your cart is empty</h3>
        <p>Let's add some delicious items to your cart!</p>
        <button onclick="window.location.href='/menu'" class="checkout-btn">Browse Menu</button>
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
  if (confirm('Are you sure you want to remove this item from your cart?')) {
    orderItems.splice(index, 1);
    saveCart();
    displayCartItems();
    updateCartTotal();

    if (typeof updateCartCount === 'function') {
      updateCartCount();
    }
  }
}

// Update cart total display
function updateCartTotal() {
  const cartTotalContainer = document.getElementById('cart-total');

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
    <div">
      <p>Subtotal: ₱${totalPrice.toFixed(2)} PHP</p>
      <p style="font-size: 1rem;">Shipping calculated at checkout</p>
    </div>
  `;
}

// Save cart to localStorage and server for logged-in users
function saveCart() {
  localStorage.setItem('orderItems', JSON.stringify(orderItems));

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
