document.addEventListener('DOMContentLoaded', async function() {
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

  // Promo variables
  let currentDiscountPercentage = 0;
  let selectedPromoId = null;
  let selectedPromo = null;
  let availablePromos = [];

  // Rate limiting for cart API calls
  let lastCartApiCall = 0;
  const CART_API_COOLDOWN = 2000; // 2 seconds between cart API calls
  let cartApiInProgress = false; // Prevent simultaneous cart API calls
  
  // Rate limiting for promo API calls
  let lastPromoApiCall = 0;
  const PROMO_API_COOLDOWN = 5000; // 5 seconds between promo API calls
  let promoApiInProgress = false; // Prevent simultaneous promo API calls

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

  // Load cart data and update totals
  await loadCheckoutData();

  async function loadCheckoutData() {
    // Wait for cart data to be ready, then update totals and load promos
    const checkCartReady = () => {
      if (window.checkoutCartReady) {
        updateTotalDisplay();
        loadActivePromos();
      } else {
        setTimeout(checkCartReady, 50);
      }
    };
    checkCartReady();
  }

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

          // Update PaymentStatus to "Paid"
          try {
            // Extract payment method from various possible locations in Xendit response
            const invoiceId = paymentData.id || paymentData.invoice_id || 'unknown';
            const paymentMethod = paymentData.payment_method || 
                                (paymentData.payments && paymentData.payments[0] && 
                                 (paymentData.payments[0].payment_method || 
                                  paymentData.payments[0].payment_channel || 
                                  paymentData.payments[0].channel_code)) || 
                                null;

            const updatePayload = {
              paymentId: currentOrderId,
              invoiceId: invoiceId,
              status: 'Paid'
            };

            // Add PaymentMethod to payload if available
            if (paymentMethod) {
              updatePayload.PaymentMethod = paymentMethod;
            }

            console.log('Updating payment with payload:', updatePayload);

            const updateResponse = await fetch(`/api/orders/update-payment-status`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(updatePayload)
            });

            if (!updateResponse.ok) {
              console.error('Failed to update payment status:', await updateResponse.text());
            } else {
              console.log('Payment status updated successfully to Paid');
            }
          } catch (error) {
            console.error('Error updating payment status:', error);
          }

          // Update progress to step 3 (Confirmation)
          if (window.updateProgressStep) window.updateProgressStep(3);

          // Clear user's cart upon successful payment
          await clearUserCart();

          processingMessage.textContent = 'Payment successful! Redirecting...';
          processingMessage.style.display = 'block';
          paymentInstructions.style.display = 'none';

          setTimeout(() => {
            window.location.href = `/order/success?orderId=${currentOrderId}`;
          }, 1500);
        } else if (!paymentStatusInterval) {
          // This is from manual check, show notification and restore UI
          notificationSystem.warning('Payment not yet confirmed. Please complete the payment in the new tab.', 'Payment Status');
          overlay.classList.add('hidden');
          placeOrderBtn.disabled = false;
          placeOrderBtn.textContent = 'Place Order';
        } else {
          // If polling, just continue without notification
          console.log('Still waiting for payment confirmation...');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Payment check error:', errorData);

        // Use user-friendly error message from API
        const errorMessage = errorData.message ||
                            errorData.error ||
                            'Unable to check payment status. Please try again.';
        if (!paymentStatusInterval) {
          // Only show notification if manual check
          notificationSystem.error(errorMessage, 'Payment Check Failed');
          overlay.classList.add('hidden');
          placeOrderBtn.disabled = false;
          placeOrderBtn.textContent = 'Place Order';
        }
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      if (!paymentStatusInterval) {
        // Only show notification if manual check
        notificationSystem.error('Error checking payment status. Please try again or contact support.', 'Connection Error');
        overlay.classList.add('hidden');
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = 'Place Order';
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
    // Re-enable and show the button after closing modal
    placeOrderBtn.disabled = false;
    placeOrderBtn.style.display = 'block';
    placeOrderBtn.textContent = 'Place Order';
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    // Collect form data early for validation
    const formData = new FormData(form);
    const deliveryMethod = formData.get('deliveryMethod');

    // Validate delivery method and agreement
    if (deliveryMethod === 'Pick-up' && !formData.get('pickupAgreed')) {
      notificationSystem.warning('Please agree to the pick-up terms.', 'Validation Required');
      return;
    }

    // Check if cart data is ready before proceeding
    if (!window.checkoutCartReady) {
      console.log('Cart not ready, refreshing page data...');
      // Refresh cart data if not ready
      const cartData = localStorage.getItem('orderItems');
      if (!cartData || !JSON.parse(cartData || '[]').length) {
        notificationSystem.warning('Your cart appears to be empty. Please add items and try again.', 'Empty Cart');
        window.location.href = '/user/menu';
        return;
      }
    }

    // Disable button to prevent double submission
    placeOrderBtn.disabled = true;

    try {
      // Show overlay
      overlay.classList.remove('hidden');
      processingMessage.textContent = 'Checking inventory availability...';
      paymentInstructions.style.display = 'none';

      // Get order items from localStorage
      const cartItems = JSON.parse(localStorage.getItem('orderItems') || '[]');

      if (!cartItems || cartItems.length === 0) {
        throw new Error('No items in cart');
      }

      // Check inventory availability before creating order
      processingMessage.textContent = 'Verifying product availability...';
      const inventoryCheck = await fetch('/api/inventory/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          Cart: cartItems.map(item => ({
            ProductName: item.name,
            ProductID: item.ProductID || item.productId,
            Size: item.size || null,
            Addons: item.addons || [],
            Quantity: item.quantity,
            Price: item.price,
            ImageLink: item.imagelink,
            isFree: item.isFree || false
          })) 
        })
      });

      if (!inventoryCheck.ok) {
        if (inventoryCheck.status === 429) {
          // Rate limited - show user-friendly message
          notificationSystem.error('Too many requests. Please wait a moment and try again.', 'Rate Limited');
          overlay.classList.add('hidden');
          placeOrderBtn.disabled = false;
          placeOrderBtn.textContent = 'Place Order';
          return;
        }
        
        let inventoryError;
        try {
          inventoryError = await inventoryCheck.json();
        } catch (parseError) {
          console.error('Failed to parse inventory check response:', parseError);
          throw new Error('Inventory check failed. Please try again.');
        }
        
        if (inventoryCheck.status === 409) {
          // Log detailed error information for debugging
          console.log('Inventory check failed - detailed information:');
          console.log('Full error response:', inventoryError);
          
          // Log each unavailable item with details
          if (inventoryError.unavailableItems && Array.isArray(inventoryError.unavailableItems)) {
            inventoryError.unavailableItems.forEach(item => {
              console.log(`Unavailable item: ${item.item} - Reason: ${item.reason}`);
              if (item.missingIngredients && item.missingIngredients.length > 0) {
                item.missingIngredients.forEach(ing => {
                  if (ing.type === 'addon') {
                    console.log(`  Missing add-on: ${ing.name} - Need: ${ing.needed}, Available: ${ing.available}`);
                  } else {
                    console.log(`  Missing ingredient: ${ing.name} - Need: ${ing.needed}g, Available: ${ing.available}g`);
                  }
                });
              }
            });
            
            // Customer-friendly message
            const unavailableItemNames = inventoryError.unavailableItems.map(item => item.item);
            let customerMessage;
            
            if (unavailableItemNames.length === 1) {
              customerMessage = `Sorry, ${unavailableItemNames[0]} is currently unavailable due to insufficient ingredients.\n\nPlease choose a different item or modify your order.`;
            } else {
              customerMessage = `Sorry, the following items are currently unavailable:\n\n${unavailableItemNames.map(name => `• ${name}`).join('\n')}\n\nPlease choose different items or modify your order.`;
            }
            
            notificationSystem.error(customerMessage, 'Item Unavailable');
          } else {
            notificationSystem.error('Some items in your cart are unavailable. Please modify your order.', 'Item Unavailable');
          }
          overlay.classList.add('hidden');
          placeOrderBtn.disabled = false;
          placeOrderBtn.textContent = 'Place Order';
          return;
        } else {
          throw new Error(inventoryError.error || 'Inventory check failed');
        }
      }

      // Continue with order creation if inventory is available
      processingMessage.textContent = 'Creating your order...';

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

      // Apply discount if promo selected
      const discountAmount = subtotalAmount * (currentDiscountPercentage / 100);
      const discountedSubtotal = subtotalAmount - discountAmount;

      // Add delivery fee if delivery method is selected
      const deliveryFee = deliveryMethod === 'Delivery' ? 20 : 0;
      const totalAmount = discountedSubtotal + deliveryFee;

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
        PaymentMode: 'E-Payment',
        PromoEventApplied: selectedPromo ? selectedPromo.event : null,
        PromoDiscountAmount: selectedPromo ? selectedPromo.discountPercentage / 100 : null
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
        notificationSystem.success('Invoice created successfully. Please check your email for payment instructions.', 'Payment Setup Complete');
        window.location.href = '/';
      }

    } catch (error) {
      console.error('Checkout error:', error);
      notificationSystem.error('An error occurred during checkout. Please try again.', 'Checkout Failed');
      overlay.classList.add('hidden');
      placeOrderBtn.disabled = false;
      placeOrderBtn.textContent = 'Place Order';
    }
  });

  // Load active promos and set up promo selection
  async function loadActivePromos() {
    const now = Date.now();
    if (now - lastPromoApiCall < PROMO_API_COOLDOWN || promoApiInProgress) {
      console.log('Promo API rate limited or in progress, skipping load');
      return;
    }
    
    promoApiInProgress = true;
    try {
      const response = await fetch('/api/discounts/active');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch promos`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error(`Invalid content-type: ${contentType}`);
      }
      
      availablePromos = await response.json();
      lastPromoApiCall = now;
      
      if (!Array.isArray(availablePromos)) {
        console.warn('Promos response is not an array:', availablePromos);
        availablePromos = [];
        return;
      }
      
      console.log('Successfully loaded promos:', availablePromos.length);
      populatePromoSelect();
    } catch (error) {
      console.error('Error loading active promos:', error);
      availablePromos = [];
    } finally {
      promoApiInProgress = false;
    }
  }

  // Get unique categories from cart items
  async function getCartCategories() {
    let cartItems = [];
    
    if (window.user && window.user._id) {
      // For logged-in users, load from server first (with rate limiting)
      const now = Date.now();
      if (now - lastCartApiCall > CART_API_COOLDOWN && !cartApiInProgress) {
        cartApiInProgress = true;
        try {
          const response = await fetch('/api/cart');
          if (response.status === 200 && response.headers.get('content-type')?.includes('application/json')) {
            cartItems = await response.json();
            lastCartApiCall = now;
          } else if (response.status === 429) {
            console.warn('Rate limited, using localStorage fallback for categories');
            cartItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
          } else {
            console.error('Failed to load cart from server, status:', response.status);
            // Fallback to localStorage
            cartItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
          }
        } catch (error) {
          console.error('Error loading cart from server:', error);
          // Fallback to localStorage
          cartItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
        } finally {
          cartApiInProgress = false;
        }
      } else {
        console.log('Cart API rate limited or in progress, using cached data for categories');
        cartItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
      }
    } else {
      // For guests, use localStorage
      cartItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
    }
    
    const categories = new Set();
    cartItems.forEach(item => {
      if (item.category) {
        categories.add(item.category);
      }
    });
    return Array.from(categories);
  }

  function populatePromoSelect() {
    const promoSelect = document.getElementById('promoCode');
    if (!promoSelect) {
      console.error('Promo code select element not found');
      return;
    }
    
    promoSelect.innerHTML = '<option value="">No promo selected</option>';

    if (!availablePromos || availablePromos.length === 0) {
      console.log('No available promos to display');
      return;
    }

    getCartCategories().then(cartCategories => {
      console.log('Cart categories:', cartCategories);
      console.log('Available promos:', availablePromos.length);
      
      const filteredPromos = availablePromos.filter(promo => {
        if (!promo || !promo._id) {
          console.warn('Invalid promo object:', promo);
          return false;
        }
        
        if (cartCategories.length > 0) {
          const matchesCategory = cartCategories.includes(promo.category);
          const appliesToAll = promo.applicableToAll === true || !promo.category;
          const isApplicable = matchesCategory || appliesToAll;
          console.log(`Promo "${promo.event}" - Category: ${promo.category}, Matches: ${isApplicable}`);
          return isApplicable;
        }
        return promo.applicableToAll === true || !promo.category;
      });

      console.log('Filtered promos:', filteredPromos.length);
      
      if (filteredPromos.length === 0) {
        if (availablePromos.length > 0) {
          const option = document.createElement('option');
          option.value = '';
          option.textContent = 'No applicable promos for your order';
          option.disabled = true;
          promoSelect.appendChild(option);
        }
        return;
      }

      filteredPromos.forEach(promo => {
        const option = document.createElement('option');
        option.value = promo._id;
        option.textContent = `${promo.event} - ${promo.discountPercentage}% OFF`;
        promoSelect.appendChild(option);
      });
    }).catch(error => {
      console.error('Error populating promo select:', error);
    });
  }

  // Promo selection handler
  document.getElementById('promoCode').addEventListener('change', async function() {
    const selectedValue = this.value;
    if (selectedValue) {
      const promo = availablePromos.find(promo => promo._id === selectedValue);
      if (promo) {
        currentDiscountPercentage = promo.discountPercentage;
        selectedPromoId = promo._id;
        selectedPromo = promo;
      }
    } else {
      currentDiscountPercentage = 0;
      selectedPromoId = null;
      selectedPromo = null;
    }
    await updateTotalDisplay();
  });

  // Function to calculate subtotal from cart
  async function calculateSubtotal() {
    let cartItems = [];
    
    if (window.user && window.user._id) {
      // For logged-in users, load from server first (with rate limiting)
      const now = Date.now();
      if (now - lastCartApiCall > CART_API_COOLDOWN && !cartApiInProgress) {
        cartApiInProgress = true;
        try {
          const response = await fetch('/api/cart');
          if (response.status === 200 && response.headers.get('content-type')?.includes('application/json')) {
            cartItems = await response.json();
            lastCartApiCall = now;
          } else if (response.status === 429) {
            console.warn('Rate limited, using localStorage fallback for subtotal');
            cartItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
          } else {
            console.error('Failed to load cart from server, status:', response.status);
            // Fallback to localStorage
            cartItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
          }
        } catch (error) {
          console.error('Error loading cart from server:', error);
          // Fallback to localStorage
          cartItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
        } finally {
          cartApiInProgress = false;
        }
      } else {
        console.log('Cart API rate limited or in progress, using cached data for subtotal');
        cartItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
      }
    } else {
      // For guests, use localStorage
      cartItems = JSON.parse(localStorage.getItem('orderItems') || '[]');
    }
    
    return cartItems.reduce((sum, item) => {
      if (item.isFree) return sum;
      const addonsTotal = item.addons ? item.addons.reduce((sum, ad) => sum + (ad.BasePrice || 0), 0) : 0;
      return sum + ((item.price + addonsTotal) * item.quantity);
    }, 0);
  }

  // Function to update total display
  async function updateTotalDisplay() {
    const subtotal = await calculateSubtotal();
    const deliveryMethod = document.getElementById('deliveryMethod').value;
    const deliveryFee = deliveryMethod === 'Delivery' ? 20 : 0;
    const discountAmount = subtotal * (currentDiscountPercentage / 100);
    const discountedSubtotal = subtotal - discountAmount;
    const total = discountedSubtotal + deliveryFee;

    document.getElementById('totalAmountDisplay').textContent = '₱' + total.toFixed(2);

    // Update delivery fee display
    const deliveryFeeRow = document.getElementById('deliveryFeeRow');
    const deliveryFeeAmount = document.getElementById('deliveryFeeAmount');
    if (deliveryFee > 0) {
      deliveryFeeRow.style.display = 'flex';
      deliveryFeeAmount.textContent = '+₱' + deliveryFee.toFixed(2);
    } else {
      deliveryFeeRow.style.display = 'none';
    }

    // Update promo discount display
    const promoDiscountRow = document.getElementById('promoDiscountRow');
    const promoDiscountAmount = document.getElementById('promoDiscountAmount');
    if (discountAmount > 0) {
      promoDiscountRow.style.display = 'flex';
      promoDiscountAmount.textContent = '-₱' + discountAmount.toFixed(2);
    } else {
      promoDiscountRow.style.display = 'none';
    }
  }

  // Delivery method toggle
  const deliveryMethodSelect = document.getElementById('deliveryMethod');
  deliveryMethodSelect.addEventListener('change', async function() {
    const method = this.value;
    const pickupAgreement = document.getElementById('pickupAgreement');
    const deliveryAgreement = document.getElementById('deliveryAgreement');
    const deliveryFields = document.getElementById('deliveryFields');
    const pickupCheckbox = document.getElementById('pickupAgreed');
    const deliveryCheckbox = document.getElementById('deliveryAgreed');
    const cityInput = document.getElementById('city');
    const addressInput = document.getElementById('address');

    if (method === 'Pick-up') {
      pickupAgreement.style.display = 'block';
      deliveryAgreement.style.display = 'none';
      deliveryFields.style.display = 'none';
      pickupCheckbox.setAttribute('required', '');
      deliveryCheckbox.removeAttribute('required');
      cityInput.removeAttribute('required');
      addressInput.removeAttribute('required');
    } else if (method === 'Delivery') {
      pickupAgreement.style.display = 'none';
      deliveryAgreement.style.display = 'block';
      deliveryFields.style.display = 'block';
      pickupCheckbox.removeAttribute('required');
      deliveryCheckbox.setAttribute('required', '');
      cityInput.setAttribute('required', '');
      addressInput.setAttribute('required', '');
    } else {
      // Default/unselected state
      pickupAgreement.style.display = 'none';
      deliveryAgreement.style.display = 'none';
      deliveryFields.style.display = 'none';
      pickupCheckbox.removeAttribute('required');
      deliveryCheckbox.removeAttribute('required');
      cityInput.removeAttribute('required');
      addressInput.removeAttribute('required');
    }
    // Update total display
    await updateTotalDisplay();
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
