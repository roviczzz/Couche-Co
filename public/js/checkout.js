document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('checkoutForm');
  const placeOrderBtn = document.getElementById('placeOrderBtn');

  // Payment overlay elements
  const overlay = document.getElementById('paymentProcessingOverlay');
  const processingMessage = document.getElementById('processingMessage');
  const paymentInstructions = document.getElementById('paymentInstructions');
  const paymentWindowStatus = document.getElementById('paymentWindowStatus');
  const paymentLinkContainer = document.getElementById('paymentLinkContainer');
  const paymentUrlLink = document.getElementById('paymentUrlLink');
  const checkStatusBtn = document.getElementById('checkPaymentStatusBtn');
  const closeModalBtn = document.getElementById('closePaymentModalBtn');

  // Retrieve and populate saved user data
  async function loadUserData() {
    if (window.user) {
      console.log('User data available:', window.user); // Debug log
      
      const nameField = document.getElementById('name');
      const emailField = document.getElementById('email');
      const phoneField = document.getElementById('phone');
      const cityField = document.getElementById('city');
      const addressField = document.getElementById('address');

      // Try to fetch complete user profile from the server
      try {
        const response = await fetch('/user/profile', {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const profileData = await response.json();
          console.log('Profile data:', profileData); // Debug log
          
          const userDoc = profileData.userDoc || {};
          const sessionUser = profileData.user || window.user;
          
          // Populate fields with complete user data
          if (nameField && (userDoc.fullname || sessionUser.fullname || sessionUser.name)) {
            nameField.value = userDoc.fullname || sessionUser.fullname || sessionUser.name;
          }
          if (emailField && (sessionUser.email)) {
            emailField.value = sessionUser.email;
          }
          if (phoneField && userDoc.phone) {
            phoneField.value = userDoc.phone;
          }
          if (cityField && userDoc.city) {
            cityField.value = userDoc.city;
          }
          if (addressField && userDoc.address) {
            addressField.value = userDoc.address;
          }
        } else {
          // Fallback to session user data
          populateFromSessionUser();
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        // Fallback to session user data
        populateFromSessionUser();
      }
    } else {
      console.log('No user data available'); // Debug log
    }
  }

  function populateFromSessionUser() {
    const nameField = document.getElementById('name');
    const emailField = document.getElementById('email');
    const phoneField = document.getElementById('phone');
    const cityField = document.getElementById('city');
    const addressField = document.getElementById('address');

    // Populate fields with session user data if available
    if (nameField && (window.user.fullname || window.user.name)) {
      nameField.value = window.user.fullname || window.user.name;
    }
    if (emailField && window.user.email) {
      emailField.value = window.user.email;
    }
    if (phoneField && window.user.phone) {
      phoneField.value = window.user.phone;
    }
    if (cityField && window.user.city) {
      cityField.value = window.user.city;
    }
    if (addressField && window.user.address) {
      addressField.value = window.user.address;
    }
  }

  // Load user data when page loads
  loadUserData();

  // Phone number formatting
  document.getElementById('phone').addEventListener('input', function() {
    let val = this.value.replace(/\D/g, ''); // remove non-digits
    if (val.match(/^[1-8]/)) {
      val = '09' + val;
    } else if (val.startsWith('9') && val.length >= 1) {
      val = '0' + val;
    }
    val = val.substring(0, 11); // limit to 11 digits
    this.value = val;
  });

  // Modal event handlers
  checkStatusBtn.addEventListener('click', checkPaymentStatus);
  closeModalBtn.addEventListener('click', closePaymentModal);

  let currentOrderId = null;
  let paymentUrl = null;
  let paymentStatusInterval = null;

  async function checkPaymentStatus() {
    try {
      const response = await fetch(`/api/xendit/check-payment-by-order/${currentOrderId}`);
      if (response.ok) {
        const paymentData = await response.json();
        if (paymentData.status === 'PAID') {
          // Clear the polling interval
          if (paymentStatusInterval) {
            clearInterval(paymentStatusInterval);
            paymentStatusInterval = null;
          }

          // Update progress to step 3 (Confirmation)
          if (window.updateProgressStep) window.updateProgressStep(3);

          // Clear user's cart upon successful payment
          await clearUserCart();

          processingMessage.textContent = 'Payment successful! Redirecting...';
          processingMessage.style.display = 'block';
          paymentInstructions.style.display = 'none';

          // Replace spinner with checkmark
          const loadingSpinner = document.querySelector('.loading-spinner');
          loadingSpinner.innerHTML = '<div class="payment-checkmark"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M480 96C515.3 96 544 124.7 544 160L544 480C544 515.3 515.3 544 480 544L160 544C124.7 544 96 515.3 96 480L96 160C96 124.7 124.7 96 160 96L480 96zM438 209.7C427.3 201.9 412.3 204.3 404.5 215L285.1 379.2L233 327.1C223.6 317.7 208.4 317.7 199.1 327.1C189.8 336.5 189.7 351.7 199.1 361L271.1 433C276.1 438 283 440.5 289.9 440C296.8 439.5 303.3 435.9 307.4 430.2L443.3 243.2C451.1 232.5 448.7 217.5 438 209.7z"/></svg></div>';

          setTimeout(() => {
            window.location.href = `/order/success?orderId=${currentOrderId}`;
          }, 3000);
        } else if (!paymentStatusInterval) {
          // This is from manual check, show alert
          alert('Payment not yet confirmed. Please complete the payment in the new tab.');
        } // If polling, just continue without alert
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Payment check error:', errorData);

        // Use user-friendly error message from API
        const errorMessage = errorData.message ||
                            errorData.error ||
                            'Unable to check payment status. Please try again.';
        if (!paymentStatusInterval) {
          // Only show alert if manual check
          alert(errorMessage);
        }
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      if (!paymentStatusInterval) {
        // Only show alert if manual check
        alert('Error checking payment status. Please try again or contact support.');
      }
    }
  }

  function closePaymentModal() {
    overlay.classList.add('hidden');
    // Clear the polling interval when closing modal
    if (paymentStatusInterval) {
      clearInterval(paymentStatusInterval);
      paymentStatusInterval = null;
    }
    // Re-enable the button after closing modal
    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = 'Place Order & Pay';
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    // Collect form data early for validation
    const formData = new FormData(form);
    const deliveryMethod = formData.get('deliveryMethod');

    // Validate delivery method and agreement
    if (deliveryMethod === 'Pick-up' && !formData.get('pickupAgreed')) {
      alert('Please agree to the pick-up terms.');
      return;
    }

    // Check if cart data is ready before proceeding
    if (!window.checkoutCartReady) {
      console.log('Cart not ready, refreshing page data...');
      // Refresh cart data if not ready
      const cartData = localStorage.getItem('orderItems');
      if (!cartData || !JSON.parse(cartData || '[]').length) {
        alert('Your cart appears to be empty. Please add items and try again.');
        window.location.href = '/user/menu';
        return;
      }
    }

    // Disable button to prevent double submission
    placeOrderBtn.disabled = true;
    placeOrderBtn.textContent = 'Processing...';

    try {
      // Show overlay
      overlay.classList.remove('hidden');
      processingMessage.textContent = 'Creating your order...';
      paymentInstructions.style.display = 'none';

      // Build customer data
      const customerData = {
        fullname: formData.get('name'),
        email: formData.get('email'),
        contactnumber: formData.get('phone'),
        deliveryMethod: deliveryMethod
      };

      // Add delivery details conditionally
      if (deliveryMethod === 'Delivery') {
        customerData.city = formData.get('city');
        customerData.address = formData.get('address');
      } else {
        customerData.city = null;
        customerData.address = null;
      }

      const paymentMethod = formData.get('paymentMethod');

      // Get order items from localStorage
      const orderItems = JSON.parse(localStorage.getItem('orderItems') || '[]');

      // Calculate subtotals (cart items only)
      const subtotalAmount = orderItems.reduce((sum, item) => {
        if (item.isFree) return sum;
        const addonsTotal = item.addons ? item.addons.reduce((sum, ad) => sum + (ad.BasePrice || 0), 0) : 0;
        return sum + ((item.price + addonsTotal) * item.quantity);
      }, 0);

      // Add delivery fee if delivery method is selected
      const deliveryFee = deliveryMethod === 'Delivery' ? 20 : 0;
      const totalAmount = subtotalAmount + deliveryFee;

      // Create order data
      const orderData = {
        OrderID: generateOrderID(),
        Date: new Date().toISOString(),
        Source: 'Website',
        Cart: orderItems.map(item => ({
          ProductName: item.name,
          ProductID: item.ProductID || item.productId,
          Size: item.size || null,
          Addons: item.addons || [],
          Quantity: item.quantity,
          Price: item.price,
          ImageLink: item.imagelink
        })),
        Customer: customerData,
        Total: totalAmount,
        Notes: formData.get('notes') || '',
        PaymentStatus: 'Pending',
        FulfillmentStatus: 'Preparing',
        FulfillmentMethod: deliveryMethod,
        PaymentMethod: paymentMethod,
        PaymentMode: 'E-Payment'
      };

      // Store order ID for payment checking
      currentOrderId = orderData.OrderID;

      // Create order
      processingMessage.textContent = 'Creating your order...';
      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      if (!orderResponse.ok) {
        throw new Error('Failed to create order');
      }

      const orderResult = await orderResponse.json();

      // Create Xendit payment invoice
      processingMessage.textContent = 'Generating payment link...';
      const invoicePayload = {
        external_id: orderResult.orderId,
        amount: totalAmount,
        currency: 'PHP',
        description: `Payment for Order ${orderResult.orderId}`,
        customer: {
          given_names: customerData.fullname,
          email: customerData.email,
          mobile_number: customerData.contactnumber
        },
        customer_notification_preference: {
          invoice_created: ['email'],
          reminding: ['email'],
          payment_attempt: ['email']
        },
        payment_methods: [paymentMethod]
      };

      const paymentResponse = await fetch('/api/xendit/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invoicePayload)
      });

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.text();
        throw new Error(`Failed to create payment: ${errorData}`);
      }

      const paymentData = await paymentResponse.json();

      // Save payment ID to order
      await fetch(`/api/orders/update-payment-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentId: paymentData.external_id,
          invoiceId: paymentData.id,
          status: 'Pending'
        })
      });

      // Cart will be cleared only after successful payment

      // Store payment URL and open payment gateway in new tab
      processingMessage.textContent = 'Opening payment gateway...';
      if (paymentData.invoice_url) {
        // Store payment URL for fallback
        paymentUrl = paymentData.invoice_url;

        // Try to open in new tab
        let paymentWindow;
        try {
          paymentWindow = window.open(paymentData.invoice_url, '_blank');

          // Check if popup was blocked
          if (!paymentWindow || paymentWindow.closed || typeof paymentWindow.closed === 'undefined') {
            // Popup blocked - show fallback link
            paymentWindowStatus.textContent = 'The payment window was blocked by your browser.';
            paymentLinkContainer.style.display = 'block';
            paymentUrlLink.href = paymentData.invoice_url;
          } else {
            paymentWindowStatus.textContent = 'Please complete your payment in the new tab that just opened.';
          }
        } catch (error) {
          // Fallback if popup is blocked
          paymentWindowStatus.textContent = 'The payment window was blocked by your browser.';
          paymentLinkContainer.style.display = 'block';
          paymentUrlLink.href = paymentData.invoice_url;
        }

        // Always display the fallback link
        paymentLinkContainer.style.display = 'block';
        paymentUrlLink.href = paymentData.invoice_url;

        // Show payment instructions
        setTimeout(() => {
          processingMessage.style.display = 'none';
          paymentInstructions.style.display = 'block';
          // Update progress to step 2 (Payment)
          if (window.updateProgressStep) window.updateProgressStep(2);
          // Start automatic payment status checking
          paymentStatusInterval = setInterval(checkPaymentStatus, 3000); // Check every 3 seconds
        }, 1000);

      } else {
        alert('Invoice created successfully. Please check your email for payment instructions.');
        window.location.href = '/';
      }

    } catch (error) {
      console.error('Checkout error:', error);
      alert('An error occurred during checkout. Please try again.');
      overlay.classList.add('hidden');
    }
  });
});

// Clear user's cart from both localStorage and database upon successful payment
async function clearUserCart() {
  try {
    // Clear localStorage cart
    localStorage.removeItem('orderItems');

    // Delete database cart document via API
    const response = await fetch('/api/cart', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('Failed to delete database cart, but localStorage was cleared');
    } else {
      const result = await response.json();
      console.log(`Cart document deleted successfully from database (deleted: ${result.deletedCount})`);
    }
  } catch (error) {
    console.error('Error clearing cart:', error);
    // Still clear localStorage even if database delete fails
    localStorage.removeItem('orderItems');
  }
}

// Generate unique order ID
function generateOrderID() {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return yy + mm + dd + hh + min + '-BLESSINGSCAFE';
}
