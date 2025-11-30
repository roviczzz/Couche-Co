let currentSection = 'orders';
let isLoading = false;
let allOrders = [];
let currentPage = 1;
const itemsPerPage = 10;

async function openProfileModal() {
  // Prevent multiple simultaneous calls
  if (isLoading) return;
  
  document.getElementById('profileModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    document.getElementById('profileModal').style.opacity = '1';
  }, 10);

  // Show loading spinner while fetching data
  showLoadingSpinner();

  try {
    isLoading = true;
    const response = await fetch('/user/profile', {
      headers: { 'Accept': 'application/json' }
    });
    if (response.ok) {
      const data = await response.json();
      populateModal(data);
    } else {
      throw new Error('Failed to fetch profile data');
    }
  } catch (error) {
    console.error('Error fetching profile data:', error);
    // Clear loading state first
    hideLoadingSpinner();
    
    // Show error message in the orders section
    const container = document.querySelector('.orders-table-container');
    container.innerHTML = `
      <div class="no-orders">
        <i class="fas fa-exclamation-triangle"></i>
        <h4>Failed to load orders</h4>
        <p>Please try again later.</p>
      </div>
    `;
  } finally {
    isLoading = false;
    hideLoadingSpinner();
  }
}

function populateModal(data) {
  hideLoadingSpinner();
  
  const ordersContainer = document.querySelector('.orders-table-container');
  if (data.orders && data.orders.length > 0) {
    allOrders = data.orders;
    currentPage = 1;
    renderOrdersPage();
  } else {
    ordersContainer.innerHTML = `<div class="no-orders">
      <i class="fas fa-shopping-bag"></i>
      <h4>No orders found</h4>
      <p>You haven't placed any orders yet.</p>
      <button type="button" class="btn-primary" onclick="window.location.href='/menu'">Discover Our Blends</button>
    </div>`;
  }

  // Populate form
  if (data.userDoc) {
    document.getElementById('name').value = data.userDoc.fullname || '';
    document.getElementById('name').setAttribute('data-original', data.userDoc.fullname || '');
    document.getElementById('phone').value = data.userDoc.phone || '';
    document.getElementById('phone').setAttribute('data-original', data.userDoc.phone || '');
    document.getElementById('city').value = data.userDoc.city || '';
    document.getElementById('city').setAttribute('data-original', data.userDoc.city || '');
    document.getElementById('address').value = data.userDoc.address || '';
    document.getElementById('address').setAttribute('data-original', data.userDoc.address || '');
  }

  // Email from user
  if (data.user) {
    document.getElementById('email').value = data.user.email || '';
    document.getElementById('email').setAttribute('data-original', data.user.email || '');
  }
}

function showLoadingSpinner() {
  const container = document.querySelector('.orders-table-container');
  
  // Ensure we're working with the profile modal, not cart elements
  if (!container || !document.querySelector('#profileModal')) {
    return;
  }
  
  // Immediately clear any existing content and spinners
  hideLoadingSpinner();
  
  // Double-check no loading is already in progress visually
  if (container.querySelector('.profile-loading-spinner')) {
    return;
  }
  
  // Set loading state
  container.classList.add('loading');
  
  // Create single spinner with unique class to avoid conflicts with cart spinner
  container.innerHTML = `
    <div class="profile-loading-spinner">
      <div class="spinner"></div>
      <div class="loading-text">Loading your orders...</div>
    </div>
  `;
}

function hideLoadingSpinner() {
  const container = document.querySelector('.orders-table-container');
  
  // Ensure we're working with the profile modal, not cart elements
  if (!container || !document.querySelector('#profileModal')) {
    return;
  }
  
  if (container) {
    container.classList.remove('loading');
    
    // Remove ALL existing spinners aggressively - but only within the profile modal context
    const profileSpinners = container.querySelectorAll('.profile-loading-spinner');
    const generalSpinners = container.querySelectorAll('.loading-spinner');
    
    profileSpinners.forEach(spinner => spinner.remove());
    // Only remove general spinners if they're within the orders container, not the cart
    generalSpinners.forEach(spinner => {
      if (spinner.closest('.orders-table-container')) {
        spinner.remove();
      }
    });
  }
}

function renderOrdersPage() {
  const ordersContainer = document.querySelector('.orders-table-container');
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageOrders = allOrders.slice(startIndex, endIndex);
  const totalPages = Math.ceil(allOrders.length / itemsPerPage);
  
  let html = `<table class="orders-table">
    <thead>
      <tr>
        <th>Order ID</th>
        <th>Date</th>
        <th>Items</th>
        <th>Status</th>
        <th>Amount</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>`;
  
  pageOrders.forEach(order => {
    const orderDate = order.Date || order.CreationTime;
    let formattedDate = 'N/A';
    if (orderDate) {
      const dateObj = new Date(orderDate);
      if (!isNaN(dateObj.getTime())) {
        formattedDate = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      } else if (typeof orderDate === 'string') {
        formattedDate = orderDate;
      }
    }
    
    const cartItems = order.Cart || [];
    const itemCount = cartItems.reduce((sum, item) => sum + (item.Quantity || 1), 0);
    const itemsTooltip = cartItems.map(item => {
      const size = item.Size ? ` (${item.Size})` : '';
      return `${item.Quantity || 1}x ${item.ProductName || 'Item'}${size}`;
    }).join('\n');
    
    const cartDataAttr = encodeURIComponent(JSON.stringify(cartItems));
    
    html += `<tr class="order-row">
      <td onclick="viewOrderDetails('${order.OrderID}')" style="cursor: pointer;">${order.OrderID}</td>
      <td onclick="viewOrderDetails('${order.OrderID}')" style="cursor: pointer;">${formattedDate}</td>
      <td onclick="viewOrderDetails('${order.OrderID}')" style="cursor: pointer;">
        <span class="items-badge" title="${itemsTooltip.replace(/"/g, '&quot;')}">${itemCount} item${itemCount !== 1 ? 's' : ''} <i class="fas fa-info-circle"></i></span>
      </td>
      <td onclick="viewOrderDetails('${order.OrderID}')" style="cursor: pointer;"><span class="status-badge status-${order.FulfillmentStatus ? order.FulfillmentStatus.toLowerCase().replace(' ', '-') : 'unknown'}">${order.FulfillmentStatus || 'Unknown'}</span></td>
      <td onclick="viewOrderDetails('${order.OrderID}')" style="cursor: pointer;">₱${order.Total ? order.Total.toFixed(2) : '0.00'}</td>
      <td><button type="button" class="order-again-btn" onclick="orderAgain(event, '${cartDataAttr}')"><i class="fas fa-redo"></i> Order Again</button></td>
    </tr>`;
  });
  
  html += `</tbody></table>`;
  
  if (totalPages > 1) {
    html += `<div class="pagination">
      <button class="pagination-btn prev-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
        <i class="fas fa-chevron-left"></i> Previous
      </button>
      <div class="pagination-numbers">`;
    
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="pagination-number ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    
    html += `</div>
      <button class="pagination-btn next-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
        Next <i class="fas fa-chevron-right"></i>
      </button>
    </div>`;
  }
  
  ordersContainer.innerHTML = html;
}

function goToPage(page) {
  const totalPages = Math.ceil(allOrders.length / itemsPerPage);
  if (page >= 1 && page <= totalPages) {
    currentPage = page;
    renderOrdersPage();
  }
}

function closeProfileModal() {
  document.getElementById('profileModal').style.opacity = '0';
  setTimeout(() => {
    document.getElementById('profileModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    hideMessage();
  }, 300);
}

function switchSection(sectionName) {
  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

  // Hide all sections
  document.querySelectorAll('.profile-section').forEach(section => {
    section.style.display = 'none';
  });

  // Show selected section
  document.getElementById(`${sectionName}-section`).style.display = 'block';
  currentSection = sectionName;
}

function viewOrderDetails(orderId) {
  window.location.href = `/order/success?orderId=${orderId}`;
}

async function orderAgain(event, cartDataEncoded) {
  event.stopPropagation();
  
  const btn = event.currentTarget;
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  btn.disabled = true;
  
  try {
    const cartItems = JSON.parse(decodeURIComponent(cartDataEncoded));
    
    const productIds = [...new Set(cartItems.map(item => item.ProductID))];
    
    let productsMap = {};
    let addonsMap = {};
    
    try {
      const [productsRes, addonsRes, ingredientsRes] = await Promise.all([
        fetch(`/api/products/batch?ids=${productIds.join(',')}`),
        fetch('/api/addons'),
        fetch('/api/ingredients')
      ]);
      
      if (productsRes.ok) {
        const products = await productsRes.json();
        products.forEach(p => {
          productsMap[p.ProductID] = p;
        });
      }
      
      if (addonsRes.ok) {
        const addons = await addonsRes.json();
        addons.forEach(a => {
          addonsMap[a.AddOnID] = a;
          addonsMap[a.Name] = a;
          if (a.name) addonsMap[a.name] = a;
        });
      }
      
      if (ingredientsRes.ok) {
        const ingredients = await ingredientsRes.json();
        ingredients.forEach(ing => {
          const ingredientData = {
            IngredientID: ing.IngredientID,
            Name: ing.Name,
            BasePrice: 15
          };
          addonsMap[ing.IngredientID] = ingredientData;
          addonsMap[ing.Name] = ingredientData;
          if (ing.name) addonsMap[ing.name] = ingredientData;
        });
      }
    } catch (err) {
      console.warn('Could not fetch product/addon details, using order data only');
    }
    
    const newOrderItems = cartItems.map(item => {
      const product = productsMap[item.ProductID] || {};
      const key = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      const addons = (item.Addons || item.AddOns || item.addons || []).map(addon => {
        let addonId = null;
        let addonName = 'Add-on';
        let addonPrice = 0;
        
        if (typeof addon === 'string') {
          addonId = addon;
          addonName = addon;
          const foundAddon = addonsMap[addon];
          if (foundAddon) {
            addonName = foundAddon.Name || addon;
            addonPrice = foundAddon.BasePrice || 15;
          }
        } else {
          addonId = addon.AddOnID || addon.addOnID || addon.IngredientID || null;
          addonName = addon.Name || addon.name || addonId || 'Add-on';
          addonPrice = addon.BasePrice || addon.Price || addon.price || 0;
          
          if (addonPrice === 0) {
            const foundAddon = addonsMap[addonId] || addonsMap[addonName];
            if (foundAddon) {
              addonPrice = foundAddon.BasePrice || 15;
              addonName = foundAddon.Name || addonName;
            } else {
              addonPrice = 15;
            }
          }
        }
        
        return {
          name: addonName,
          Name: addonName,
          price: addonPrice,
          Price: addonPrice,
          BasePrice: addonPrice,
          AddOnID: addonId,
          IngredientID: addon.IngredientID || addonId
        };
      });
      
      let itemPrice = item.Price || item.BasePrice || 0;
      if (itemPrice === 0 && product.Sizes && item.Size) {
        const sizeObj = product.Sizes.find(s => s.Size === item.Size);
        if (sizeObj) {
          itemPrice = sizeObj.BasePrice || 0;
        }
      }
      if (itemPrice === 0 && product.BasePrice) {
        itemPrice = product.BasePrice;
      }
      
      return {
        key: key,
        name: item.ProductName || product.Name || 'Unknown Product',
        price: itemPrice,
        quantity: item.Quantity || 1,
        size: item.Size || null,
        category: product.Category || '',
        productId: item.ProductID,
        addons: addons,
        imagelink: product.imagelink || item.ImageLink || '/resources/coffee-icon.png',
        isFree: false,
        isB1T1: false
      };
    });
    
    const existingCart = JSON.parse(localStorage.getItem('orderItems') || '[]');
    const mergedCart = [...existingCart, ...newOrderItems];
    localStorage.setItem('orderItems', JSON.stringify(mergedCart));
    
    if (window.user && window.user._id) {
      try {
        await fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mergedCart)
        });
      } catch (err) {
        console.warn('Could not sync cart to server');
      }
    }
    
    closeProfileModal();
    window.location.href = '/cart';
  } catch (error) {
    console.error('Error adding items to cart:', error);
    showMessage('Failed to add items to cart. Please try again.', 'error');
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
}

function showMessage(message, type = 'success') {
  const container = document.getElementById('messageContainer');
  const content = document.getElementById('messageText');

  content.textContent = message;
  container.querySelector('.message-content').className = `message-content ${type}`;

  container.style.display = 'block';
  setTimeout(() => {
    container.style.opacity = '1';
  }, 10);

  // Auto-hide after 5 seconds
  setTimeout(hideMessage, 5000);
}

function hideMessage() {
  const container = document.getElementById('messageContainer');
  container.style.opacity = '0';
  setTimeout(() => {
    container.style.display = 'none';
  }, 300);
}

function resetForm() {
  // Reset to original values using data-original attributes
  document.getElementById('name').value = document.getElementById('name').getAttribute('data-original') || '';
  document.getElementById('email').value = document.getElementById('email').getAttribute('data-original') || '';
  document.getElementById('phone').value = document.getElementById('phone').getAttribute('data-original') || '';
  document.getElementById('city').value = document.getElementById('city').getAttribute('data-original') || '';
  document.getElementById('address').value = document.getElementById('address').getAttribute('data-original') || '';

  // Clear errors
  document.querySelectorAll('.field-error').forEach(error => {
    error.style.display = 'none';
    error.textContent = '';
  });
}

document.addEventListener('DOMContentLoaded', function() {
  // Navigation event listeners
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
      const section = this.dataset.section;
      switchSection(section);
    });
  });

  // Form submission
  document.getElementById('profileForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(this);
    const data = {
      name: formData.get('name').trim(),
      email: formData.get('email').trim(),
      phone: formData.get('phone').trim(),
      city: formData.get('city'),
      address: formData.get('address').trim()
    };

    // Clear previous errors
    document.querySelectorAll('.field-error').forEach(error => {
      error.style.display = 'none';
      error.textContent = '';
    });

    // Basic validation
    let hasErrors = false;

    if (!data.name) {
      document.getElementById('name-error').textContent = 'Full name is required';
      document.getElementById('name-error').style.display = 'block';
      hasErrors = true;
    }

    if (!data.email) {
      document.getElementById('email-error').textContent = 'Email is required';
      document.getElementById('email-error').style.display = 'block';
      hasErrors = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      document.getElementById('email-error').textContent = 'Please enter a valid email address';
      document.getElementById('email-error').style.display = 'block';
      hasErrors = true;
    }

    if (data.phone && !/^09\d{9}$/.test(data.phone)) {
      document.getElementById('phone-error').textContent = 'Please enter a valid Philippine mobile number';
      document.getElementById('phone-error').style.display = 'block';
      hasErrors = true;
    }

    if (hasErrors) return;

    // Show loading state
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    saveBtn.disabled = true;

    try {
      const response = await fetch('/user/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.success) {
        showMessage(result.message, 'success');
        // Update UI with new values if email changed
        if (data.email !== '<%= user.email %>') {
          // Email changed, might need to reload or show specific message
          showMessage('Profile updated! Please log in again with your new email.', 'success');
        }
      } else {
        if (result.field) {
          document.getElementById(`${result.field}-error`).textContent = result.message;
          document.getElementById(`${result.field}-error`).style.display = 'block';
        } else {
          showMessage(result.message, 'error');
        }
      }
    } catch (error) {
      console.error('Profile update error:', error);
      showMessage('An error occurred while updating your profile', 'error');
    } finally {
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
    }
  });

  // Close modal on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeProfileModal();
    }
  });

  // Close modal on overlay click
  document.getElementById('profileModal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeProfileModal();
    }
  });

  // Phone number formatting
  document.getElementById('phone').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.startsWith('0')) {
      // Keep as is
    } else if (value.startsWith('63') && value.length >= 10) {
      value = '0' + value.substring(2);
    }
    e.target.value = value;
  });

  // Password change form submission
  const passwordForm = document.getElementById('passwordForm');
  if (passwordForm) {
    passwordForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      // Clear previous errors
      ['currentPassword', 'newPassword', 'confirmPassword'].forEach(field => {
        const errorEl = document.getElementById(`${field}-error`);
        if (errorEl) {
          errorEl.style.display = 'none';
          errorEl.textContent = '';
        }
      });

      let hasErrors = false;

      if (!currentPassword) {
        document.getElementById('currentPassword-error').textContent = 'Current password is required';
        document.getElementById('currentPassword-error').style.display = 'block';
        hasErrors = true;
      }

      if (!newPassword) {
        document.getElementById('newPassword-error').textContent = 'New password is required';
        document.getElementById('newPassword-error').style.display = 'block';
        hasErrors = true;
      } else if (newPassword.length < 8) {
        document.getElementById('newPassword-error').textContent = 'Password must be at least 8 characters';
        document.getElementById('newPassword-error').style.display = 'block';
        hasErrors = true;
      }

      if (!confirmPassword) {
        document.getElementById('confirmPassword-error').textContent = 'Please confirm your new password';
        document.getElementById('confirmPassword-error').style.display = 'block';
        hasErrors = true;
      } else if (newPassword !== confirmPassword) {
        document.getElementById('confirmPassword-error').textContent = 'Passwords do not match';
        document.getElementById('confirmPassword-error').style.display = 'block';
        hasErrors = true;
      }

      if (currentPassword === newPassword) {
        document.getElementById('newPassword-error').textContent = 'New password must be different from current password';
        document.getElementById('newPassword-error').style.display = 'block';
        hasErrors = true;
      }

      if (hasErrors) return;

      const changePasswordBtn = document.getElementById('changePasswordBtn');
      const originalText = changePasswordBtn.innerHTML;
      changePasswordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Changing...';
      changePasswordBtn.disabled = true;

      try {
        const response = await fetch('/user/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ currentPassword, newPassword })
        });

        const result = await response.json();

        if (result.success) {
          showMessage('Password changed successfully!', 'success');
          passwordForm.reset();
        } else {
          if (result.field) {
            const errorEl = document.getElementById(`${result.field}-error`);
            if (errorEl) {
              errorEl.textContent = result.message;
              errorEl.style.display = 'block';
            }
          } else {
            showMessage(result.message || 'Failed to change password', 'error');
          }
        }
      } catch (error) {
        console.error('Password change error:', error);
        showMessage('An error occurred while changing your password', 'error');
      } finally {
        changePasswordBtn.innerHTML = originalText;
        changePasswordBtn.disabled = false;
      }
    });
  }
});

function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  const button = input.nextElementSibling;
  const icon = button.querySelector('i');

  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}