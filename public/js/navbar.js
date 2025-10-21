// Shared Navbar JavaScript Functionality

// Add active class to current page link
document.addEventListener('DOMContentLoaded', function() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-links a');

  navLinks.forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });
});

// Toggle account dropdown
function toggleAccountDropdown() {
  const dropdown = document.getElementById('account-dropdown');
  if (dropdown) {
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
  } else {
    console.warn('Account dropdown element not found');
  }
}

// Toggle cart dropdown
function toggleCartDropdown() {
  const dropdown = document.getElementById('cart-dropdown');
  if (dropdown) {
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    updateCartSummary();
  } else {
    console.warn('Cart dropdown element not found');
  }
}

// Update cart count and summary
function updateCartCount() {
  const cartCount = document.getElementById('cart-count');
  if (!cartCount) return;

  const orderItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
  const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  cartCount.textContent = totalItems.toString();

  // Hide badge if zero
  cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
}

// Update cart summary in dropdown
function updateCartSummary() {
  const cartSummary = document.getElementById('cart-summary');
  if (!cartSummary) return;

  const orderItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
  if (orderItems.length === 0) {
    cartSummary.innerHTML = '<p>Cart is empty</p>';
    return;
  }

  let summaryHTML = orderItems.map(item => {
    const priceText = item.isFree ? 'FREE' : `₱ ${(item.price + (item.addons ? item.addons.reduce((sum, ad) => sum + ad.BasePrice, 0) : 0)) * item.quantity}.00`;
    return `<p>${item.quantity}x ${item.name} - ${priceText}</p>`;
  }).join('');

  const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = orderItems.reduce((sum, item) => {
    if (item.isFree) return sum;
    const itemPrice = item.price + (item.addons ? item.addons.reduce((sum, ad) => sum + ad.BasePrice, 0) : 0);
    return sum + (itemPrice * item.quantity);
  }, 0);

  summaryHTML += `<hr><p><strong>Total Items: ${totalItems}</strong></p>`;
  summaryHTML += `<p><strong>Total Price: ₱ ${totalPrice.toFixed(2)}</strong></p>`;

  cartSummary.innerHTML = summaryHTML;
}

// Initialize cart on page load
document.addEventListener('DOMContentLoaded', function() {
  updateCartCount();
});

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
  const accountMenu = document.querySelector('.account-menu');
  const dropdown = document.getElementById('account-dropdown');

  if (accountMenu && dropdown && !accountMenu.contains(event.target)) {
    dropdown.style.display = 'none';
  }

  const cartMenu = document.querySelector('.cart-menu');
  const cartDropdown = document.getElementById('cart-dropdown');

  if (cartMenu && cartDropdown && !cartMenu.contains(event.target)) {
    cartDropdown.style.display = 'none';
  }
});
