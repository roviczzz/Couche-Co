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

  // Hamburger menu toggle
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navLinksDiv = document.getElementById('nav-links');

  if (hamburgerBtn && navLinksDiv) {
    hamburgerBtn.addEventListener('click', function() {
      navLinksDiv.classList.toggle('active');
    });

    // Close mobile menu when clicking a link
    navLinksDiv.addEventListener('click', function(e) {
      if (e.target.tagName === 'A') {
        navLinksDiv.classList.remove('active');
      }
    });
  }

  // Scroll-responsive navbar functionality
  const header = document.querySelector('header');
  if (!header) return;
  
  let lastScrollTop = 0;
  let scrollThreshold = 50; // Reduced threshold for more responsive behavior
  let isNavbarVisible = true;
  let scrollDirection = 'up';

  function handleNavbarScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Determine scroll direction
    if (scrollTop > lastScrollTop) {
      scrollDirection = 'down';
    } else if (scrollTop < lastScrollTop) {
      scrollDirection = 'up';
    }
    
    // Add shadow when scrolled past header
    if (scrollTop > scrollThreshold) {
      header.classList.add('scrolled-past-header');
    } else {
      header.classList.remove('scrolled-past-header');
      // Always show navbar when near top
      header.classList.remove('navbar-hidden');
      header.classList.add('navbar-visible');
      isNavbarVisible = true;
    }

    // Hide navbar when scrolling down, show when scrolling up
    if (scrollDirection === 'down' && scrollTop > scrollThreshold) {
      // Scrolling down - hide navbar
      if (isNavbarVisible) {
        header.classList.remove('navbar-visible');
        header.classList.add('navbar-hidden');
        isNavbarVisible = false;
      }
    } else if (scrollDirection === 'up') {
      // Scrolling up - show navbar
      if (!isNavbarVisible) {
        header.classList.remove('navbar-hidden');
        header.classList.add('navbar-visible');
        isNavbarVisible = true;
      }
    }

    // Always ensure navbar is visible at the very top
    if (scrollTop <= 10) {
      header.classList.remove('navbar-hidden');
      header.classList.add('navbar-visible');
      header.classList.remove('scrolled-past-header');
      isNavbarVisible = true;
    }

    lastScrollTop = Math.max(scrollTop, 0); // Prevent negative values
  }

  // Throttle scroll events for performance
  let ticking = false;
  let scrollDelta = 0;
  
  function requestTick() {
    if (!ticking) {
      requestAnimationFrame(() => {
        handleNavbarScroll();
        ticking = false;
      });
      ticking = true;
    }
  }

  // More sensitive scroll detection
  window.addEventListener('scroll', () => {
    scrollDelta++;
    if (scrollDelta > 2) { // Only process every 3rd scroll event for performance
      requestTick();
      scrollDelta = 0;
    } else {
      requestTick();
    }
  }, { passive: true });

  // Initial setup - ensure navbar is visible on load
  header.classList.remove('navbar-hidden');
  header.classList.add('navbar-visible');
  
  // Force a style recalculation
  header.offsetHeight;

  // Search popup functionality
  const searchLink = document.getElementById('search-link');
  const searchPopup = document.getElementById('search-popup');
  const searchClose = document.getElementById('search-close');
  const searchInput = document.getElementById('search-input');

  if (searchLink && searchPopup) {
    searchLink.addEventListener('click', function(e) {
      e.preventDefault();
      searchPopup.classList.add('active');
      setTimeout(() => searchInput?.focus(), 100);
    });

    if (searchClose) {
      searchClose.addEventListener('click', function() {
        searchPopup.classList.remove('active');
      });
    }

    searchPopup.addEventListener('click', function(e) {
      if (e.target === searchPopup) {
        searchPopup.classList.remove('active');
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && searchPopup.classList.contains('active')) {
        searchPopup.classList.remove('active');
      }
    });
  }
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
