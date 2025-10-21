let currentSection = 'orders';
let isLoading = false; // Prevent multiple loading calls

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
  // Ensure loading state is cleared first
  hideLoadingSpinner();
  
  // Populate orders
  const ordersContainer = document.querySelector('.orders-table-container');
  if (data.orders && data.orders.length > 0) {
    let html = `<table class="orders-table">
      <thead>
        <tr>
          <th>Order ID</th>
          <th>Date</th>
          <th>Status</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>`;
    data.orders.forEach(order => {
      html += `<tr class="order-row" onclick="viewOrderDetails('${order.OrderID}')" style="cursor: pointer;">
        <td>${order.OrderID}</td>
        <td>${order.CreationTime ? new Date(order.CreationTime).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
        <td><span class="status-badge status-${order.FulfillmentStatus ? order.FulfillmentStatus.toLowerCase().replace(' ', '-') : 'unknown'}">${order.FulfillmentStatus || 'Unknown'}</span></td>
        <td>₱${order.Total ? order.Total.toFixed(2) : '0.00'}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    ordersContainer.innerHTML = html;
  } else {
    ordersContainer.innerHTML = `<div class="no-orders">
      <i class="fas fa-shopping-bag"></i>
      <h4>No orders found</h4>
      <p>You haven't placed any orders yet.</p>
      <a href="/menu" class="btn-primary">Start Shopping</a>
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
});