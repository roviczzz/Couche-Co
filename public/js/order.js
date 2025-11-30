function displayOrderSummary(index) {
  const order = orders[index];
  if (!order) {
    orderSummaryContent.innerHTML = '<p style="text-align: center; color: #999; padding: 40px 20px;">Order not found.</p>';
    return;
  }
  currentOrder = order;
  selectedRowIndex = index;
  let customer = 'N/A';
  if (order.Customer) {
    if (typeof order.Customer === 'string') {
      customer = order.Customer;
    } else if (typeof order.Customer === 'object') {
      customer = order.Customer.fullname || order.Customer.name || 'Unknown';
    }
  } else if (order.customer) {
    if (typeof order.customer === 'string') {
      customer = order.customer;
    } else if (typeof order.customer === 'object') {
      customer = order.customer.fullname || order.customer.name || 'Unknown';
    }
  }
  let summaryHtml = `<div class='order-summary-header'>
    <h2>Order #${order.OrderID || 'N/A'}</h2>
    <div class='order-summary-customer'>${customer}</div>
    <div class='order-summary-date'>${order.Date ? new Date(order.Date).toLocaleString() : (order.date ? new Date(order.date).toLocaleString() : '')}</div>
  </div>`;
  summaryHtml += `<div class='order-summary-details'>
    <div><strong>Payment:</strong> ${order.PaymentStatus || order.paymentStatus || 'Unpaid'}</div>
    <div><strong>Fulfillment:</strong> ${order.FulfillmentMethod || order.fulfillmentMethod || 'N/A'}</div>
    <div><strong>Total:</strong> ₱ ${Number(order.Total || order.total || 0).toFixed(2)}</div>
  </div>`;
  const cart = order.Cart || order.cart || [];
  if (cart.length > 0) {
    summaryHtml += "<div class='order-summary-products'><h3>Items</h3><ul>";
    cart.forEach((item, i) => {
      let itemName = item.Name || item.name || '';
      if (!itemName && item.ProductName) itemName = item.ProductName;
      if (!itemName && item.productName) itemName = item.productName;
      const size = item.Size || item.size;
      const sizeDisplay = size ? ` (${size})` : '';
      summaryHtml += `<li>${item.Quantity || item.quantity} × ${itemName}${sizeDisplay}`;
      const addOns = item.AddOns || item.addOns || item.Addons || [];
      if (addOns.length > 0) {
        summaryHtml += '<div class="product-addons" style="margin-left: 20px; margin-top: 4px;">';
        addOns.forEach(addon => {
          let addonName = 'Unknown Add-on';
          if (typeof addon === 'object') {
            addonName = addon.name || addon.Name || addon.ProductName || addon.productName || 'Unknown Add-on';
          } else if (typeof addon === 'string') {
            addonName = addon;
          }
          summaryHtml += `<div style="font-size: 0.9em; color: #666;">+ ${addonName}</div>`;
        });
        summaryHtml += '</div>';
      }
      summaryHtml += '</li>';
    });
    summaryHtml += '</ul></div>';
  }
  orderSummaryContent.innerHTML = summaryHtml;
  orderDetailButtons.style.display = 'flex';
  orderDetailPanel.classList.add('show');
  document.body.style.overflow = 'hidden';
}

window.displayOrderSummary = displayOrderSummary;
if (!window.apiPrefix) window.apiPrefix = '/admin';

const ordersData = JSON.parse(document.getElementById('orders-data').textContent || '[]');
let orders = [...ordersData]; // Use let instead of const and create a copy
const menu = JSON.parse(document.getElementById('menu-data').textContent || '[]');
const orderDetailPanel = document.getElementById('orderDetailPanel');
const orderSummaryContent = document.getElementById('orderSummaryContent');
const orderDetailButtons = document.getElementById('orderDetailButtons');
const fulfillmentDropdown = document.getElementById('fulfillmentDropdown');
const ordersTableContainer = document.getElementById('ordersTableContainer');
const closePanelBtn = document.getElementById('closePanelBtn');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const cancelledOrdersSection = document.getElementById('cancelledOrdersSection');
const cancelledOrdersList = document.getElementById('cancelledOrdersList');

let currentOrder = null;
let selectedRowIndex = null;
let isTransitioning = false;
let cancelledOrders = [];

function formatCurrency(value) {
  return '₱ ' + Number(value).toFixed(2);
}

function showMessage(message, isError = false) {
  const messageEl = isError ? errorMessage : successMessage;
  const otherMessageEl = isError ? successMessage : errorMessage;

  otherMessageEl.style.display = 'none';
  messageEl.textContent = message;
  messageEl.style.display = 'block';

  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 5000);
}

function setLoading(isLoading) {
  const buttons = orderDetailButtons.querySelectorAll('button');
  buttons.forEach(btn => {
    btn.disabled = isLoading;
    if (isLoading) {
      btn.classList.add('loading');
    } else {
      btn.classList.remove('loading');
    }
  });
}

function getPriceAndSize(productName, sizeLabel) {
  const menuItem = menu.find(m => m.Name === productName);
  if (!menuItem) return { price: 0, size: sizeLabel || null };

  if (menuItem.Sizes && menuItem.Sizes.length > 0) {
    const sizeObj = menuItem.Sizes.find(s => s.Size === sizeLabel);
    if (sizeObj) {
      return { price: Number(sizeObj.BasePrice), size: sizeObj.Size };
    }
    const fallbackSize = menuItem.Sizes[0];
    return { price: Number(fallbackSize.BasePrice), size: fallbackSize.Size };
  } else if (menuItem.BasePrice) {
    return { price: Number(menuItem.BasePrice), size: null };
  }
  return { price: 0, size: null };
}

function calculatePromoInfo(order) {
  // Handle different cart field names
  const cart = order.Cart || order.cart;
  if (!cart || !cart.length) {
    return { promoSets: 0, promoSavings: 0, drinkCount: 0 };
  }

  let drinkCount = 0;
  cart.forEach(item => {
    const itemCategory = item.Category || item.category || '';
    if (itemCategory.toLowerCase() !== 'pastries') {
      drinkCount += Number(item.Quantity || item.quantity) || 0;
    }
  });

  const promoSets = Math.floor(drinkCount / 3);
  const promoSavings = promoSets > 0 ? (promoSets * 143) : 0;

  return { promoSets, promoSavings, drinkCount };
}

function createProductList(order) {
  // Handle different cart field names
  const cart = order.Cart || order.cart;
  if (!cart || !cart.length) {
    return '<p style="text-align: center; color: #999; padding: 20px;">No products in this order.</p>';
  }

  const { promoSets, promoSavings, drinkCount } = calculatePromoInfo(order);

  let html = '<ul>';
  cart.forEach(item => {
    const quantity = Number(item.Quantity || item.quantity) || 0;
    const sizeLabel = item.Size || item.size || null;
    
    // Handle different price field structures
    let basePrice = 0;
    if (item.BasePrice !== undefined) {
      basePrice = Number(item.BasePrice);
    } else if (item.basePrice !== undefined) {
      basePrice = Number(item.basePrice);
    } else if (item.Price !== undefined) {
      basePrice = Number(item.Price);
    } else if (item.price !== undefined) {
      basePrice = Number(item.price);
    }

    let addOnsHtml = '';

    // Handle different add-ons structures (AddOns, addOns, Addons)
    const addOns = item.AddOns || item.addOns || item.Addons;
    if (addOns && addOns.length > 0) {
      addOnsHtml = '<div class="product-addons">';
      addOns.forEach(addon => {
        let addonName = 'Unknown Add-on';
        
        if (typeof addon === 'object') {
          // Handle different property name variations
          addonName = addon.name || addon.Name || addon.ProductName || addon.productName || 'Unknown Add-on';
        } else if (typeof addon === 'string') {
          addonName = addon;
        }
        
        addOnsHtml += `
          <div class="addon-item">
            <span class="addon-name">+ ${addonName}</span>
          </div>
        `;
      });
      addOnsHtml += '</div>';
    }

    const itemTotal = basePrice * quantity;
    const productName = item.ProductName || item.productName || item.Name || item.name || 'N/A';
    const itemIndex = cart.indexOf(item);

    html += `<li class="order-item-clickable" data-item-index="${itemIndex}">
      <span class="product-name">${productName}</span>
      <div class="product-quantity-price">
        <div class="quantity-info">
          <span><strong>Size:</strong> ${sizeLabel || 'N/A'}</span>
          <span><strong>Qty:</strong> ${quantity}</span>
        </div>
        <span class="product-price">${formatCurrency(itemTotal)}</span>
      </div>
      ${addOnsHtml}
    </li>`;
  });
  html += '</ul>';

  if (promoSets > 0) {
    html += `<div class="promo-label">
      <span>🎉 Promo Applied: ${promoSets} set${promoSets > 1 ? 's' : ''} of 3 drinks - ₱143 each</span>
      <span>-₱${promoSavings}</span>
    </div>`;
  }

  return html;
}

function calculateOrderTotals(order) {
  let productsSubtotal = 0;

  // Handle different cart field names and structures
  const cart = order.Cart || order.cart;
  if (cart && cart.length) {
    cart.forEach(item => {
      const quantity = Number(item.Quantity || item.quantity) || 0;

      // Handle different price field structures
      let basePrice = 0;
      if (item.BasePrice !== undefined) {
        basePrice = Number(item.BasePrice);
      } else if (item.basePrice !== undefined) {
        basePrice = Number(item.basePrice);
      } else if (item.Price !== undefined) {
        basePrice = Number(item.Price);
      } else if (item.price !== undefined) {
        basePrice = Number(item.price);
      }

      let addOnsTotal = 0;
      // Handle different add-ons structures (AddOns, addOns, Addons)
      const addOns = item.AddOns || item.addOns || item.Addons;
      if (addOns && addOns.length > 0) {
        // Note: Add-on prices are already included in the order total from the database
        // No need to calculate separately
      }

      productsSubtotal += basePrice * quantity;
    });
  }

  return productsSubtotal;
}

function calculateOrderIngredients(order) {
  const ingredientMap = new Map(); // ingredientID -> { name, totalGrams }

  // Handle different cart field names and structures
  const cart = order.Cart || order.cart;
  if (!cart || !cart.length) return [];

  cart.forEach(item => {
    const quantity = Number(item.Quantity || item.quantity) || 0;
    const sizeLabel = item.Size || item.size || null;
    const productName = item.ProductName || item.productName || item.Name || item.name || '';

    // Find the menu item
    const menuItem = menu.find(m => m.Name === productName || m.ProductID === (item.ProductID || item.productID));
    if (!menuItem) return;

    // Add base ingredients from menu item
    if (menuItem.Ingredients && Array.isArray(menuItem.Ingredients)) {
      menuItem.Ingredients.forEach(ing => {
        const ingredientID = ing.ingredientID;
        const ingredientName = ing.name;
        let usedGrams = 0;

        if (typeof ing.usedGrams === 'object' && ing.usedGrams !== null) {
          // Size-specific amounts
          usedGrams = ing.usedGrams[sizeLabel] || ing.usedGrams['16oz'] || ing.usedGrams['22oz'] || 0;
        } else {
          // Fixed amount
          usedGrams = Number(ing.usedGrams) || 0;
        }

        const totalGrams = usedGrams * quantity;

        if (ingredientMap.has(ingredientID)) {
          const existing = ingredientMap.get(ingredientID);
          existing.totalGrams += totalGrams;
        } else {
          ingredientMap.set(ingredientID, {
            name: ingredientName,
            totalGrams: totalGrams
          });
        }
      });
    }

    // Add ingredients from add-ons (AddOns, addOns, Addons)
    const addOns = item.AddOns || item.addOns || item.Addons || [];
    if (addOns && addOns.length > 0) {
      addOns.forEach(addon => {
        let addonId = null;
        let addonName = 'Unknown Add-on';
        let usedGrams = 0;

        if (typeof addon === 'object') {
          addonId = addon.id || addon.AddOnID || addon.addOnID || addon.IngredientID || addon.ingredientID;
          addonName = addon.name || addon.Name || addon.ProductName || addon.productName || 'Unknown Add-on';

          // Check if this add-on has size-specific usage in menu item
          if (menuItem.AddOns && Array.isArray(menuItem.AddOns)) {
            const menuAddon = menuItem.AddOns.find(ma =>
              (ma.addOnID === addonId) ||
              (ma.name && ma.name.toLowerCase() === addonName.toLowerCase())
            );

            if (menuAddon) {
              if (sizeLabel && menuAddon[`usedGrams${sizeLabel}`] !== undefined) {
                usedGrams = Number(menuAddon[`usedGrams${sizeLabel}`]);
              } else if (menuAddon.usedGrams16oz !== undefined || menuAddon.usedGrams22oz !== undefined) {
                usedGrams = Number(menuAddon.usedGrams16oz || menuAddon.usedGrams22oz || 0);
              }
            }
          }

          // If no specific amount found, use default deduction quantity
          if (usedGrams === 0) {
            usedGrams = Number(addon.DeductionQuantityGrams || addon.deductionQuantityGrams || 10);
          }
        } else if (typeof addon === 'string') {
          addonName = addon;
          usedGrams = 10; // Default amount
        }

        const totalGrams = usedGrams * quantity;

        if (addonId && ingredientMap.has(addonId)) {
          const existing = ingredientMap.get(addonId);
          existing.totalGrams += totalGrams;
        } else if (addonId) {
          ingredientMap.set(addonId, {
            name: addonName,
            totalGrams: totalGrams
          });
        }
      });
    }
  });

  // Convert map to array and sort by name
  return Array.from(ingredientMap.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      totalGrams: Math.round(data.totalGrams * 100) / 100 // Round to 2 decimal places
    }))
    .filter(ing => ing.totalGrams > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function addToCancelledOrders(order) {
  const existingIndex = cancelledOrders.findIndex(co => co.OrderID === order.OrderID);
  if (existingIndex === -1) {
    cancelledOrders.push({ ...order });
    renderCancelledOrders();
  }
}

function removeFromCancelledOrders(orderID) {
  const index = cancelledOrders.findIndex(co => co.OrderID === orderID);
  if (index !== -1) {
    cancelledOrders.splice(index, 1);
    renderCancelledOrders();
  }
}

function renderCancelledOrders() {
  if (!cancelledOrdersSection || !cancelledOrdersList) return;
  if (cancelledOrders.length === 0) {
    cancelledOrdersSection.style.display = 'none';
    cancelledOrdersList.innerHTML = '';
    return;
  }
  cancelledOrdersSection.style.display = 'block';
  cancelledOrdersList.innerHTML = '';
  cancelledOrders.forEach(order => {
    const orderItem = document.createElement('div');
    orderItem.className = 'cancelled-order-item';
    orderItem.innerHTML = `
      <div class="cancelled-order-info">
        <div class="cancelled-order-id">${order.OrderID || 'N/A'}</div>
        <div class="cancelled-order-customer">${order.Customer || order.customer || 'N/A'}</div>
      </div>
      <div class="cancelled-order-actions">
        <button class="btn-restore" onclick="restoreOrder('${order.OrderID}')">Restore</button>
      </div>
    `;
    cancelledOrdersList.appendChild(orderItem);
  });
}

const completedOrdersSection = document.createElement('div');
const completedOrdersList = document.createElement('div');

function renderCompletedOrders() {
  const allCompletedOrders = orders.filter(order => {
    const pay = (order.PaymentStatus || order.paymentStatus || '').toLowerCase();
    const full = (order.FulfillmentStatus || order.fulfillmentStatus || '').toLowerCase();
    return pay === 'completed' && full === 'completed';
  }).sort((a, b) => {
    const dateA = new Date(a.Date || a.date || 0).getTime();
    const dateB = new Date(b.Date || b.date || 0).getTime();
    return dateB - dateA;
  });

  // Limit to 5 items max for the compact section
  const completedOrders = allCompletedOrders.slice(0, 5);

  const section = document.getElementById('completedOrdersSection');
  const list = document.getElementById('completedOrdersList');
  
  // Always show the section
  section.style.display = 'block';
  list.innerHTML = '';
  
  if (!allCompletedOrders.length) {
    list.innerHTML = `
      <tr class="empty-state-table">
        <td colspan="5">
          <h3>No completed orders found</h3>
          <p>Completed orders will appear here.</p>
        </td>
      </tr>
    `;
    return;
  }
  
  completedOrders.forEach(order => {
    const orderDate = new Date(order.Date || order.date || 0);
    const isToday = isOrderFromToday(orderDate);
    
    // Get customer name
    let customerName = 'N/A';
    if (order.Customer) {
      if (typeof order.Customer === 'string') {
        customerName = order.Customer;
      } else if (typeof order.Customer === 'object' && order.Customer.fullname) {
        customerName = order.Customer.fullname;
      } else if (typeof order.Customer === 'object' && order.Customer.firstName) {
        customerName = (order.Customer.firstName + ' ' + (order.Customer.lastName || '')).trim();
      }
    } else if (order.customer) {
      customerName = typeof order.customer === 'string' ? order.customer : 
                   (order.customer.fullname || order.customer.name || 'Unknown Customer');
    }

    const row = document.createElement('tr');
    row.className = 'completed-order-card';
    row.style.cursor = 'pointer';
    
    row.innerHTML = `
      <td class="order-id-cell">#${order.OrderID || 'N/A'}</td>
      <td class="customer-cell">
        <div class="customer-name-table">${customerName}</div>
      </td>
      <td class="date-cell">
        ${orderDate.toLocaleDateString()} ${isToday ? '<br><small style="color: #a05c2f; font-weight: 600;">Today</small>' : ''}
      </td>
      <td class="total-cell">${order.Total !== undefined && order.Total !== null ? formatCurrency(order.Total) : 'N/A'}</td>
      <td class="status-cell">
        <span class="status-badge-table">Completed</span>
      </td>
    `;

    // Add click handler to show order details
    row.addEventListener('click', () => {
      const orderRows = document.querySelectorAll('.order-row');
      orderRows.forEach((mainRow, index) => {
        const rowOrderId = mainRow.cells[0].textContent.trim();
        if (rowOrderId === (order.OrderID || 'N/A')) {
          mainRow.click();
        }
      });
    });

    list.appendChild(row);
  });
}

async function restoreOrder(orderID) {
  try {
    setLoading(true);

    const response = await fetch(`${window.apiPrefix}/orders/${orderID}/restore`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        PaymentStatus: 'Pending',
        FulfillmentStatus: 'Preparing'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to restore order: ${response.statusText}`);
    }

    const orderIndex = orders.findIndex(o => o.OrderID == orderID);
    if (orderIndex !== -1) {
      orders[orderIndex].PaymentStatus = 'Pending';
      orders[orderIndex].paymentStatus = 'Pending';
      orders[orderIndex].FulfillmentStatus = 'Preparing';
      orders[orderIndex].fulfillmentStatus = 'Preparing';

      removeFromCancelledOrders(orderID);
      renderOrdersTable();

      if (currentOrder && currentOrder.OrderID == orderID) {
        currentOrder = orders[orderIndex];
        showOrderDetails(currentOrder, selectedRowIndex);
      }

      showMessage('Order restored successfully!');
    }
  } catch (error) {
    console.error('Failed to restore order:', error);
    showMessage('Failed to restore order: ' + error.message, true);
  } finally {
    setLoading(false);
  }
}

window.restoreOrder = restoreOrder;

function calculateItemIngredients(item, order) {
  const ingredientMap = new Map();
  const quantity = Number(item.Quantity || item.quantity) || 0;
  const sizeLabel = item.Size || item.size || null;
  const productName = item.ProductName || item.productName || item.Name || item.name || '';

  // Find the menu item
  const menuItem = menu.find(m => m.Name === productName || m.ProductID === (item.ProductID || item.productID));
  if (!menuItem) return [];

  // Add base ingredients from menu item
  if (menuItem.Ingredients && Array.isArray(menuItem.Ingredients)) {
    menuItem.Ingredients.forEach(ing => {
      const ingredientID = ing.ingredientID;
      const ingredientName = ing.name;
      let usedGrams = 0;

      if (typeof ing.usedGrams === 'object' && ing.usedGrams !== null) {
        // Size-specific amounts
        usedGrams = ing.usedGrams[sizeLabel] || ing.usedGrams['16oz'] || ing.usedGrams['22oz'] || 0;
      } else {
        // Fixed amount
        usedGrams = Number(ing.usedGrams) || 0;
      }

      const totalGrams = usedGrams * quantity;

      if (ingredientMap.has(ingredientID)) {
        const existing = ingredientMap.get(ingredientID);
        existing.totalGrams += totalGrams;
      } else {
        ingredientMap.set(ingredientID, {
          name: ingredientName,
          totalGrams: totalGrams
        });
      }
    });
  }

  // Add ingredients from add-ons (AddOns, addOns, Addons)
  const addOns = item.AddOns || item.addOns || item.Addons || [];
  if (addOns && addOns.length > 0) {
    addOns.forEach(addon => {
      let addonId = null;
      let addonName = 'Unknown Add-on';
      let usedGrams = 0;

      if (typeof addon === 'object') {
        addonId = addon.id || addon.AddOnID || addon.addOnID || addon.IngredientID || addon.ingredientID;
        addonName = addon.name || addon.Name || addon.ProductName || addon.productName || 'Unknown Add-on';

        // Check if this add-on has size-specific usage in menu item
        if (menuItem.AddOns && Array.isArray(menuItem.AddOns)) {
          const menuAddon = menuItem.AddOns.find(ma =>
            (ma.addOnID === addonId) ||
            (ma.name && ma.name.toLowerCase() === addonName.toLowerCase())
          );

          if (menuAddon) {
            if (sizeLabel && menuAddon[`usedGrams${sizeLabel}`] !== undefined) {
              usedGrams = Number(menuAddon[`usedGrams${sizeLabel}`]);
            } else if (menuAddon.usedGrams16oz !== undefined || menuAddon.usedGrams22oz !== undefined) {
              usedGrams = Number(menuAddon.usedGrams16oz || menuAddon.usedGrams22oz || 0);
            }
          }
        }

        // If no specific amount found, use default deduction quantity
        if (usedGrams === 0) {
          usedGrams = Number(addon.DeductionQuantityGrams || addon.deductionQuantityGrams || 10);
        }
      } else if (typeof addon === 'string') {
        addonName = addon;
        usedGrams = 10; // Default amount
      }

      const totalGrams = usedGrams * quantity;

      if (addonId && ingredientMap.has(addonId)) {
        const existing = ingredientMap.get(addonId);
        existing.totalGrams += totalGrams;
      } else if (addonId) {
        ingredientMap.set(addonId, {
          name: addonName,
          totalGrams: totalGrams
        });
      }
    });
  }

  // Convert map to array and sort by name
  return Array.from(ingredientMap.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      totalGrams: Math.round(data.totalGrams * 100) / 100 // Round to 2 decimal places
    }))
    .filter(ing => ing.totalGrams > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function showIngredientModal(item, order) {
  const productName = item.ProductName || item.productName || item.Name || item.name || 'N/A';
  const quantity = Number(item.Quantity || item.quantity) || 0;
  const sizeLabel = item.Size || item.size || 'N/A';
  const productImage = item.ImageLink || item.imageLink || item.image || null;
  
  // Get add-ons for display (AddOns, addOns, Addons)
  const addOns = item.AddOns || item.addOns || item.Addons || [];
  let addOnsHtml = '';
  
  if (addOns && addOns.length > 0) {
    addOnsHtml = '<div class="modal-section"><h4>Add-ons / Ingredients as Add-ons:</h4><ul class="modal-addons-list">';
    addOns.forEach(addon => {
      let addonName = 'Unknown Add-on';
      
      if (typeof addon === 'object') {
        addonName = addon.name || addon.Name || addon.ProductName || addon.productName || 'Unknown Add-on';
      } else if (typeof addon === 'string') {
        addonName = addon;
      }
      
      addOnsHtml += `
        <li class="modal-addon-item">
          <span class="modal-addon-name">${addonName}</span>
        </li>
      `;
    });
    addOnsHtml += '</ul></div>';
  }
  
  // Calculate ingredients
  const ingredients = calculateItemIngredients(item, order);
  let ingredientsHtml = '<div class="modal-section"><h4>Required Ingredients:</h4>';
  
  if (ingredients.length > 0) {
    ingredientsHtml += '<ul class="modal-ingredients-list">';
    ingredients.forEach(ing => {
      ingredientsHtml += `
        <li class="modal-ingredient-item">
          <span class="modal-ingredient-name">${ing.name}</span>
          <span class="modal-ingredient-amount">${ing.totalGrams}g</span>
        </li>
      `;
    });
    ingredientsHtml += '</ul>';
  } else {
    ingredientsHtml += '<p style="text-align: center; color: #999; padding: 20px;">No ingredients data available.</p>';
  }
  ingredientsHtml += '</div>';
  
  // Create modal HTML
  const modalHtml = `
    <div class="ingredient-modal-overlay" id="ingredientModalOverlay">
      <div class="ingredient-modal-content">
        <div class="ingredient-modal-header">
          <h3>${productName}</h3>
          <button class="ingredient-modal-close" id="closeIngredientModal">&times;</button>
        </div>
        ${productImage ? `<div class="ingredient-modal-image"><img src="${productImage}" alt="${productName}"></div>` : ''}
        <div class="ingredient-modal-body">
          <div class="modal-item-info">
            <span><strong>Size:</strong> ${sizeLabel}</span>
            <span><strong>Quantity:</strong> ${quantity}</span>
          </div>
          ${addOnsHtml}
          ${ingredientsHtml}
        </div>
      </div>
    </div>
  `;
  
  // Remove existing modal if any
  const existingModal = document.getElementById('ingredientModalOverlay');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Add modal to page
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  document.body.style.overflow = 'hidden';
  
  // Add event listeners
  const modal = document.getElementById('ingredientModalOverlay');
  const closeBtn = document.getElementById('closeIngredientModal');
  
  closeBtn.addEventListener('click', closeIngredientModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeIngredientModal();
    }
  });
}

function closeIngredientModal() {
  const modal = document.getElementById('ingredientModalOverlay');
  if (modal) {
    modal.remove();
  }
  document.body.style.overflow = 'auto';
}

function showOrderDetails(order, rowIndex) {
  if (isTransitioning) return;

  isTransitioning = true;
  currentOrder = order;
  selectedRowIndex = rowIndex;

  document.querySelectorAll('.order-row').forEach(r => r.classList.remove('selected'));

  const selectedRow = document.querySelectorAll('.order-row')[rowIndex];
  if (selectedRow) {
    selectedRow.classList.add('selected');
  }

  // Enhanced data extraction to handle different document formats
  let address = 'N/A';
  let customer = 'N/A';
  let contact = 'N/A';
  let source = order.Source || order.source || 'N/A';
  
  // Handle customer data (string or object)
  if (order.Customer) {
    if (typeof order.Customer === 'string') {
      customer = order.Customer;
    } else if (typeof order.Customer === 'object') {
      if (order.Customer.fullname) {
        customer = order.Customer.fullname;
      } else if (order.Customer.firstName) {
        customer = (order.Customer.firstName + ' ' + (order.Customer.lastName || '')).trim();
      } else {
        customer = order.Customer.name || order.Customer.Name || (order.Customer.firstName ? (order.Customer.firstName + ' ' + (order.Customer.lastName || '')).trim() : '') || 'Unknown Customer';
      }
      address = order.Customer.address || address;
      contact = order.Customer.contactnumber || order.Customer.phone || contact;
    }
  } else if (order.customer) {
    if (typeof order.customer === 'string') {
      customer = order.customer;
    } else if (typeof order.customer === 'object') {
      if (order.customer.fullname) {
        customer = order.customer.fullname;
      } else if (order.customer.firstName) {
        customer = (order.customer.firstName + ' ' + (order.customer.lastName || '')).trim();
      } else {
        customer = order.customer.name || order.customer.Name || (order.customer.firstName ? (order.customer.firstName + ' ' + (order.customer.lastName || '')).trim() : '') || 'Unknown Customer';
      }
      address = order.customer.address || address;
      contact = order.customer.contactNumber || order.customer.phone || contact;
    }
  }
  
  // Handle address and contact fields separately if not found in customer object
  if (address === 'N/A') {
    address = order.Address || order.address || 'N/A';
  }
  if (contact === 'N/A') {
    contact = order.ContactNumber || order.contactNumber || 'N/A';
  }
  
  const deliveryFee = 20;

  const productsSubtotal = calculateOrderTotals(order);
  const hasDelivery = (order.FulfillmentMethod || order.fulfillmentMethod || '').toLowerCase() === 'delivery';
  const totalPriceValue = order.Total ? Number(order.Total) : productsSubtotal + (hasDelivery ? deliveryFee : 0);

  const paymentStatusBadge = getPaymentStatusBadge(order.PaymentStatus || order.paymentStatus);
  const fulfillmentStatusBadge = getFulfillmentStatusBadge(order.FulfillmentStatus || order.fulfillmentStatus);

  // Enhanced date handling
  let orderDate = 'N/A';
  if (order.Date) {
    if (typeof order.Date === 'string' && order.Date.includes('-') && !order.Date.includes('T')) {
      orderDate = new Date(order.Date.replace(' ', 'T')).toLocaleString();
    } else {
      orderDate = new Date(order.Date).toLocaleString();
    }
  } else if (order.date) {
    orderDate = new Date(order.date).toLocaleString();
  }

  const summaryHtml = `
  <div class="order-detail-section">
    <h3>Order Information</h3>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Order ID:</span>
        <span class="info-value">${order.OrderID || 'N/A'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Xendit Payment ID:</span>
        <span class="info-value">${order.XenditPaymentID || 'N/A'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Date:</span>
        <span class="info-value">${orderDate}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Source:</span>
        ${getSourceBadge(source)}
      </div>
      <div class="info-item">
        <span class="info-label">Cashier Name:</span>
        <span class="info-value">${order.cashierName || 'N/A'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Payment Status:</span>
        ${paymentStatusBadge}
      </div>
      <div class="info-item">
        <span class="info-label">Fulfillment Status:</span>
        ${fulfillmentStatusBadge}
      </div>
    </div>
  </div>

  <div class="order-detail-section">
    <h3>Customer Information</h3>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Name:</span>
        <span class="info-value">${customer}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Contact:</span>
        <span class="info-value">${contact}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Address:</span>
        <span class="info-value">${address}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Fulfillment Method:</span>
        <span class="info-value">${order.FulfillmentMethod || order.fulfillmentMethod || 'N/A'}</span>
      </div>
    </div>
  </div>

  <div class="order-detail-section">
    <h3>Products Ordered</h3>
    ${createProductList(order)}

    ${order.PromoEventApplied || order.PromoDiscountAmount ? `
    <div class="promo-section">
      <h4>🎉 Promo Applied</h4>
      ${order.PromoEventApplied ? `<div class="promo-name">${order.PromoEventApplied}</div>` : ''}
      ${order.PromoDiscountAmount ? `<div class="promo-discount">Discount: ₱${Number(order.PromoDiscountAmount).toFixed(2)}</div>` : ''}
    </div>` : ''}

    <div class="summary-totals">
      <div class="total-line">
        <span>Subtotal:</span>
        <span>${formatCurrency(productsSubtotal)}</span>
      </div>
      ${hasDelivery ? `
      <div class="total-line">
        <span>Delivery Fee:</span>
        <span>${formatCurrency(deliveryFee)}</span>
      </div>` : ''}
      <div class="total-line final">
        <span>Total Amount:</span>
        <span>${formatCurrency(totalPriceValue)}</span>
      </div>
    </div>
  </div>
`;

  orderSummaryContent.innerHTML = summaryHtml;
  setTimeout(() => {
    initExpandableCards();
    initProductItemExpansion();
  }, 100);
  orderDetailButtons.style.display = 'flex';
  orderDetailPanel.classList.add('show');

  const fulfillmentDropdown = document.getElementById('fulfillmentDropdown');
  const fulfillmentMethod = order.FulfillmentMethod || order.fulfillmentMethod || '';
  if (fulfillmentMethod.toLowerCase() === 'delivery') {
    fulfillmentDropdown.style.display = 'block';
    // Add "In Delivery" option
    const ul = fulfillmentDropdown.querySelector('ul');
    const inDeliveryLi = document.createElement('li');
    inDeliveryLi.className = 'fulfill-option';
    inDeliveryLi.setAttribute('data-status', 'In Delivery');
    inDeliveryLi.textContent = 'In Delivery';
    const completedLi = ul.querySelector('[data-status="Completed"]');
    if (completedLi && !ul.querySelector('[data-status="In Delivery"]')) {
      ul.insertBefore(inDeliveryLi, completedLi);
    }
  } else {
    fulfillmentDropdown.style.display = 'none';
  }

  const isCancelled = (order.FulfillmentStatus === 'Cancelled' || order.fulfillmentStatus === 'Cancelled');
  orderDetailButtons.querySelectorAll('button').forEach(btn => {
    btn.disabled = isCancelled;
  });

  setTimeout(() => {
    isTransitioning = false;
  }, 600);

  successMessage.style.display = 'none';
  errorMessage.style.display = 'none';
}

function hideOrderDetails() {
  if (isTransitioning) return;

  isTransitioning = true;
  orderDetailPanel.classList.remove('show');

  setTimeout(() => {
    orderDetailButtons.style.display = 'none';

    if (selectedRowIndex !== null) {
      const rows = document.querySelectorAll('.order-row');
      if (rows[selectedRowIndex]) {
        rows[selectedRowIndex].classList.remove('selected');
      }
      selectedRowIndex = null;
    }

    currentOrder = null;
    orderSummaryContent.innerHTML = '<p style="text-align: center; color: #999; padding: 40px 20px;">Select an order to see details.</p>';
    // Remove "In Delivery" option if exists
    const inDeliveryLi = fulfillmentDropdown.querySelector('[data-status="In Delivery"]');
    if (inDeliveryLi) {
      inDeliveryLi.remove();
    }
    fulfillmentDropdown.style.display = 'none';
    isTransitioning = false;
  }, 400);
}

function initRowEventListeners() {
  document.querySelectorAll('.order-row').forEach((row, index) => {
    row.addEventListener('click', () => {
      if (isTransitioning) return;

      const idx = parseInt(row.dataset.idx, 10);

      if (selectedRowIndex === index) {
        hideOrderDetails();
        return;
      }

      if (idx >= 0 && idx < orders.length) {
        const order = orders[idx];
        showOrderDetails(order, index);
      }
    });
  });
}

closePanelBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  hideOrderDetails();
});

const ordersTableBody = document.querySelector('.orders-table-container tbody');
const orderHeaders = document.querySelectorAll('.orders-table-container thead th');
let currentSort = { column: null, direction: 'asc' };
let currentPage = 1;
const ordersPerPage = 10;
let hasFiltersApplied = false;

function sortOrders(columnKey) {
  hasFiltersApplied = true;
  
  if (currentSort.column === columnKey) {
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.column = columnKey;
    currentSort.direction = 'asc';
  }

  const keyMap = {
    orderid: 'OrderID',
    created: 'Date',
    customer: 'Customer',
    payment: 'PaymentStatus',
    total: 'FulfillmentMethod',
    fulfillmentmethod: 'Total',
    fulfillment: 'FulfillmentStatus'
  };

  const key = keyMap[columnKey];
  orders.sort((a, b) => {
    let valA = a[key];
    let valB = b[key];

    if (columnKey === 'created') {
      valA = new Date(valA || a.date || 0).getTime();
      valB = new Date(valB || b.date || 0).getTime();
      return (valA - valB) * (currentSort.direction === 'asc' ? 1 : -1);
    }

    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';

    if (columnKey === 'total' || columnKey === 'items') {
      return (Number(valA) - Number(valB)) * (currentSort.direction === 'asc' ? 1 : -1);
    }

    const comp = String(valA).localeCompare(String(valB));
    return currentSort.direction === 'asc' ? comp : -comp;
  });

  currentPage = 1;
  renderOrdersTable();
  renderSortArrows();
}

function renderOrdersTable(showAllOrders = false) {
  ordersTableBody.innerHTML = '';

  if (orders.length === 0) {
    ordersTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">No orders found.</td></tr>`;
    renderCancelledOrders();
    renderCompletedOrders();
    renderPagination(0);
    return;
  }

  let ordersToDisplay = orders;

  // Always filter out completed and cancelled orders from main table
  ordersToDisplay = orders.filter(order => {
    const isCancelled = (order.FulfillmentStatus === 'Cancelled' || order.fulfillmentStatus === 'Cancelled');
    const paymentCompleted = (order.PaymentStatus || order.paymentStatus || '').toLowerCase() === 'completed';
    const fulfillmentCompleted = (order.FulfillmentStatus || order.fulfillmentStatus || '').toLowerCase() === 'completed';
    const bothCompleted = paymentCompleted && fulfillmentCompleted;

    return !isCancelled && !bothCompleted;
  });

  const totalOrders = ordersToDisplay.length;
  const startIndex = (currentPage - 1) * ordersPerPage;
  const endIndex = startIndex + ordersPerPage;
  ordersToDisplay = ordersToDisplay.slice(startIndex, endIndex);

  ordersToDisplay.forEach((order, index) => {
    const paymentBadge = getPaymentStatusBadge(order.PaymentStatus || order.paymentStatus);
    const fulfillmentBadge = getFulfillmentStatusBadge(order.FulfillmentStatus || order.fulfillmentStatus);

    ordersTableBody.innerHTML += `
    <tr class="order-row ${selectedRowIndex === index ? 'selected' : ''}" data-idx="${orders.indexOf(order)}">
      <td>${order.OrderID || 'N/A'}</td>
      <td>${order.Date ? new Date(order.Date).toLocaleString()
            : order.date ? new Date(order.date).toLocaleString() : 'N/A'}</td>
      <td>${
        (() => {
          let customerName = 'N/A';
          if (order.Customer) {
            if (typeof order.Customer === 'string') {
              customerName = order.Customer;
            } else if (typeof order.Customer === 'object' && order.Customer.fullname) {
              customerName = order.Customer.fullname;
            } else if (typeof order.Customer === 'object' && order.Customer.firstName) {
              customerName = (order.Customer.firstName + ' ' + (order.Customer.lastName || '')).trim();
            } else if (typeof order.Customer === 'object') {
              customerName = order.Customer.name || order.Customer.Name || (order.Customer.firstName ? (order.Customer.firstName + ' ' + (order.Customer.lastName || '')).trim() : '') || 'Unknown Customer';
            }
          } else if (order.customer) {
            if (typeof order.customer === 'string') {
              customerName = order.customer;
            } else if (typeof order.customer === 'object' && order.customer.fullname) {
              customerName = order.customer.fullname;
            } else if (typeof order.customer === 'object' && order.customer.firstName) {
              customerName = (order.customer.firstName + ' ' + (order.customer.lastName || '')).trim();
            } else if (typeof order.customer === 'object') {
              customerName = order.customer.name || order.customer.Name || (order.customer.firstName ? (order.customer.firstName + ' ' + (order.customer.lastName || '')).trim() : '') || 'Unknown Customer';
            }
          }
          return customerName;
        })()
      }</td>
      <td>${paymentBadge}</td>
      <td>${order.FulfillmentMethod || order.fulfillmentMethod || 'N/A'}</td>
      <td>${order.Total !== undefined && order.Total !== null ? '₱ ' + Number(order.Total).toFixed(2) : 'N/A'}</td>
      <td>${fulfillmentBadge}</td>
    </tr>
  `;
  });

  initRowEventListeners();
  renderCancelledOrders();
  renderCompletedOrders();
  renderPagination(totalOrders);

  if (typeof window.orderMobileHandler !== 'undefined') {
    window.orderMobileHandler.renderOrderCards(ordersToDisplay);
  }
}

function renderPagination(totalOrders) {
  const totalPages = Math.ceil(totalOrders / ordersPerPage);
  let paginationContainer = document.querySelector('.pagination-container');
  
  if (!paginationContainer) {
    paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-container';
    const ordersTableContainer = document.getElementById('ordersTableContainer');
    if (ordersTableContainer) {
      ordersTableContainer.appendChild(paginationContainer);
    }
  }

  if (totalPages <= 1) {
    paginationContainer.innerHTML = '';
    return;
  }

  let paginationHtml = '<div class="pagination">';
  
  paginationHtml += `<button class="page-btn arrow-btn" onclick="changePage(1)" title="First Page"><i class="fa-solid fa-angle-left"></i></button>`;
  paginationHtml += `<button class="page-btn arrow-btn" onclick="changePage(${Math.max(1, currentPage - 1)})" title="Previous Page"><i class="fa-solid fa-chevron-left"></i></button>`;

  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    paginationHtml += `<button class="page-btn" onclick="changePage(1)">1</button>`;
    if (startPage > 2) {
      paginationHtml += `<span class="page-ellipsis">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    paginationHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationHtml += `<span class="page-ellipsis">...</span>`;
    }
    paginationHtml += `<button class="page-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
  }

  paginationHtml += `<button class="page-btn arrow-btn" onclick="changePage(${Math.min(totalPages, currentPage + 1)})" title="Next Page"><i class="fa-solid fa-chevron-right"></i></button>`;
  paginationHtml += `<button class="page-btn arrow-btn" onclick="changePage(${totalPages})" title="Last Page"><i class="fa-solid fa-angle-right"></i></button>`;

  paginationHtml += '</div>';
  paginationContainer.innerHTML = paginationHtml;
}

function changePage(page) {
  currentPage = page;
  renderOrdersTable();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.changePage = changePage;

function clearSortArrows() {
  orderHeaders.forEach(th => {
    const arrowSpan = th.querySelector('.sort-arrow');
    if (arrowSpan) arrowSpan.remove();
  });
}

function renderSortArrows() {
  clearSortArrows();
  if (!currentSort.column) return;

  const header = [...orderHeaders].find(th => th.dataset.column === currentSort.column);
  if (!header) return;

  const arrow = document.createElement('span');
  arrow.classList.add('sort-arrow');
  arrow.style.marginLeft = '6px';
  arrow.style.fontSize = '12px';
  arrow.style.userSelect = 'none';
  arrow.textContent = currentSort.direction === 'asc' ? '▲' : '▼';
  header.appendChild(arrow);
}

function resetSort() {
  if (!hasFiltersApplied) {
    return;
  }

  orders = [...ordersData];
  currentSort = { column: null, direction: 'asc' };
  currentPage = 1;
  hasFiltersApplied = false;

  clearSortArrows();

  const filterInputs = document.querySelectorAll('thead input[type="text"], thead select');
  filterInputs.forEach(input => {
    input.value = '';
  });

  renderOrdersTable();
}

orderHeaders.forEach(th => {
  const columnKey = th.dataset.column;
  if (columnKey) {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      sortOrders(columnKey);
    });
  }
});

function getPaymentStatusBadge(status) {
  if (!status) return '<span class="status-payment">Unknown</span>';

  const normalized = status.toLowerCase();
  if (normalized.includes('pending')) {
    return `<span class="status-payment status-pending" title="Payment Pending">Pending</span>`;
  } else if (normalized.includes('complete') || normalized.includes('paid')) {
    return `<span class="status-payment status-complete" title="Payment Complete">Completed</span>`;
  } else if (normalized.includes('cancel')) {
    return `<span class="status-payment status-cancelled" title="Payment Cancelled">Cancelled</span>`;
  }
  return `<span class="status-payment">${status}</span>`;
}

function getFulfillmentStatusBadge(status) {
  if (!status) return '<span class="status-fulfillment">Unknown</span>';

  const normalized = status.toLowerCase();
  if (normalized.includes('cancel')) {
    return `<span class="status-fulfillment status-ful-cancelled" title="Order Cancelled">Cancelled</span>`;
  } else if (normalized.includes('preparing')) {
    return `<span class="status-fulfillment status-preparing" title="Being Prepared">Preparing</span>`;
  } else if (normalized.includes('in progress')) {
    return `<span class="status-fulfillment status-in-progress" title="Order In Progress">In Progress</span>`;
  } else if (normalized.includes('ready')) {
    return `<span class="status-fulfillment status-ready" title="Order Ready">Ready</span>`;
  } else if (normalized.includes('in delivery') || normalized.includes('delivering')) {
    return `<span class="status-fulfillment status-in-delivery" title="Out for Delivery">In Delivery</span>`;
  } else if (normalized.includes('complete') || normalized.includes('delivered')) {
    return `<span class="status-fulfillment status-completed" title="Order Completed">Completed</span>`;
  }
  return `<span class="status-fulfillment">${status}</span>`;
}

function getSourceBadge(source) {
  if (!source) return '<span class="status-source">Unknown</span>';

  const normalized = source.toLowerCase();
  if (normalized === 'chatbot') {
    return `<span class="status-source status-chatbot" title="Chatbot">🤖 Chatbot</span>`;
  } else if (normalized === 'website') {
    return `<span class="status-source status-website" title="Website">🌐 Website</span>`;
  } else if (normalized === 'pos') {
    return `<span class="status-source status-pos" title="POS">💻 POS</span>`;
  }
  return `<span class="status-source">${source}</span>`;
}

const fulfillOrderBtn = document.getElementById('fulfillOrderBtn');
const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
const cancelOrderBtn = document.getElementById('cancelOrderBtn');
const printInvoiceBtn = document.getElementById('printInvoiceBtn');

fulfillOrderBtn.addEventListener('click', e => {
  e.stopPropagation();
  if (fulfillmentDropdown.style.display === 'block') {
    fulfillmentDropdown.style.display = 'none';
  } else {
    fulfillmentDropdown.style.display = 'block';
  }
});

document.addEventListener('click', (e) => {
  if (!fulfillmentDropdown.contains(e.target) && e.target !== fulfillOrderBtn) {
    fulfillmentDropdown.style.display = 'none';
  }
});

// Use event delegation for fulfillment options to handle dynamically added elements
fulfillmentDropdown.addEventListener('click', async (e) => {
  if (e.target.classList.contains('fulfill-option')) {
    const selectedStatus = e.target.getAttribute('data-status');
    if (!currentOrder) {
      showMessage('No order selected', true);
      return;
    }

    setLoading(true);

    try {
      const orderID = currentOrder.OrderID;

      if (!orderID) {
        throw new Error('Order ID is missing');
      }

      const response = await fetch(`${window.apiPrefix}/orders/${orderID}/fulfillment`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ FulfillmentStatus: selectedStatus })
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || `Server returned ${response.status}`);
      }

      currentOrder.FulfillmentStatus = selectedStatus;
      currentOrder.fulfillmentStatus = selectedStatus;

      if (selectedStatus === 'Cancelled') {
        currentOrder.PaymentStatus = 'Cancelled';
        currentOrder.paymentStatus = 'Cancelled';
        addToCancelledOrders(currentOrder);
      }

      showOrderDetails(currentOrder, selectedRowIndex);
      renderOrdersTable();

      showMessage(`Fulfillment status updated to ${selectedStatus}`);

    } catch (error) {
      console.error('Update error:', error);
      showMessage('Error updating fulfillment status: ' + error.message, true);
    } finally {
      setLoading(false);
    }

    fulfillmentDropdown.style.display = 'none';
  }
});

confirmPaymentBtn.addEventListener('click', async () => {
  if (!currentOrder) {
    showMessage('No order selected', true);
    return;
  }

  setLoading(true);

  try {
    const orderID = currentOrder.OrderID;

    const response = await fetch(`${window.apiPrefix}/orders/${orderID}/payment-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ PaymentStatus: 'Completed' })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Update failed with status ${response.status}`);
    }

    currentOrder.PaymentStatus = 'Completed';
    currentOrder.paymentStatus = 'Completed';
    showOrderDetails(currentOrder, selectedRowIndex);
    renderOrdersTable();

    showMessage('Payment status updated to Completed!');

  } catch (error) {
    console.error('Failed to update payment status:', error);
    showMessage('Failed to update payment status: ' + error.message, true);
  } finally {
    setLoading(false);
  }
});

cancelOrderBtn.addEventListener('click', async () => {
  if (!currentOrder) {
    showMessage('No order selected', true);
    return;
  }
  const cancelModal = document.getElementById('cancelConfirmationModal');
  cancelModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  const confirmCancelBtn = document.getElementById('cancelOrderModalBtn');
  confirmCancelBtn.onclick = async () => {
    if (!currentOrder) {
      showMessage('No order selected', true);
      return;
    }
    setLoading(true);
    try {
      const orderID = currentOrder.OrderID;

      // First rollback inventory
      if (currentOrder.Cart && currentOrder.Cart.length > 0) {
        try {
          const rollbackResponse = await fetch('/api/inventory/rollback', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              orderItems: currentOrder.Cart,
              orderId: orderID
            })
          });

          if (!rollbackResponse.ok) {
            const rollbackData = await rollbackResponse.json();
            console.warn('Inventory rollback failed:', rollbackData);
            // Continue with order cancellation even if rollback fails
          } else {
            console.log('Inventory successfully rolled back for cancelled order');
          }
        } catch (rollbackError) {
          console.error('Error during inventory rollback:', rollbackError);
          // Continue with order cancellation
        }
      }

      // Then cancel the order
      const response = await fetch(`${window.apiPrefix}/orders/${orderID}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Cancel request failed with status ${response.status}`);
      }
      currentOrder.PaymentStatus = 'Cancelled';
      currentOrder.paymentStatus = 'Cancelled';
      currentOrder.FulfillmentStatus = 'Cancelled';
      currentOrder.fulfillmentStatus = 'Cancelled';
      addToCancelledOrders(currentOrder);
      renderOrdersTable();
      if (cancelledOrdersSection) cancelledOrdersSection.style.display = 'none';
      hideOrderDetails();
      showMessage('Order successfully cancelled and moved to cancelled orders.');
    } catch (error) {
      console.error('Failed to cancel order:', error);
      showMessage('Failed to cancel order: ' + error.message, true);
    } finally {
      setLoading(false);
      cancelModal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  };
  const closeCancelModalBtn = document.getElementById('closeCancelModalBtn');
  closeCancelModalBtn.onclick = () => {
    cancelModal.style.display = 'none';
    document.body.style.overflow = 'auto';
  };
});

printInvoiceBtn.addEventListener('click', () => {
  if (!currentOrder) {
    showMessage('No order selected', true);
    return;
  }

  const invoiceWindow = window.open('', 'Print Receipt', 'width=400,height=800');
  if (!invoiceWindow) {
    showMessage('Popup blocked. Please allow popups for this website.', true);
    return;
  }

  const orderDate = currentOrder.Date ? new Date(currentOrder.Date).toLocaleString() :
        (currentOrder.date ? new Date(currentOrder.date).toLocaleString() : 'N/A');

  // Get customer info
  let customerName = 'N/A';
  let customerContact = 'N/A';
  let customerAddress = 'N/A';

  if (currentOrder.Customer) {
    if (typeof currentOrder.Customer === 'string') {
      customerName = currentOrder.Customer;
    } else if (typeof currentOrder.Customer === 'object') {
      customerName = currentOrder.Customer.fullname ||
                    (currentOrder.Customer.firstName + ' ' + (currentOrder.Customer.lastName || '')).trim() ||
                    currentOrder.Customer.name || 'N/A';
      customerContact = currentOrder.Customer.contactnumber || currentOrder.Customer.contactNumber || 'N/A';
      customerAddress = currentOrder.Customer.address || 'N/A';
    }
  }

  // Build receipt items
  let receiptItems = '';
  let subtotal = 0;

  if (currentOrder.Cart && currentOrder.Cart.length) {
    currentOrder.Cart.forEach(item => {
      const quantity = Number(item.Quantity || item.quantity) || 0;
      const productName = item.ProductName || item.productName || item.Name || item.name || '';

      // Use same price calculation logic as calculateOrderTotals
      let basePrice = 0;
      if (item.BasePrice !== undefined) {
        basePrice = Number(item.BasePrice);
      } else if (item.basePrice !== undefined) {
        basePrice = Number(item.basePrice);
      } else if (item.Price !== undefined) {
        basePrice = Number(item.Price);
      } else if (item.price !== undefined) {
        basePrice = Number(item.price);
      } else {
        // Try to get price from menu
        const menuItem = menu.find(m => m.Name === productName);
        if (menuItem) {
          if (menuItem.Sizes && menuItem.Sizes.length > 0) {
            const sizeObj = menuItem.Sizes.find(s => s.Size === (item.Size || item.size));
            if (sizeObj) {
              basePrice = Number(sizeObj.BasePrice);
            }
          } else if (menuItem.BasePrice) {
            basePrice = Number(menuItem.BasePrice);
          }
        }
      }

      const productNameDisplay = item.ProductName || item.productName || item.Name || item.name || 'N/A';
      const sizeLabel = item.Size || item.size || '';

      let addOnsTotal = 0;
      let addOnsHtml = '';

      // Handle different add-ons structures (AddOns, addOns, Addons)
      const addOns = item.AddOns || item.addOns || item.Addons;
      if (addOns && addOns.length > 0) {
        addOns.forEach(addon => {
          const addonPrice = Number(addon.BasePrice || addon.basePrice) || 0;
          const addonName = addon.Name || addon.name || 'Unknown Add-on';
          addOnsTotal += addonPrice;

          // Add each add-on as a separate line
          addOnsHtml += `
            <div class="receipt-addon">
              <div class="item-name">└ ${addonName}</div>
              <div class="item-qty-price">1 x ${formatCurrency(addonPrice)}</div>
              <div class="item-total">${formatCurrency(addonPrice)}</div>
            </div>`;
        });
      }

      const itemTotal = (basePrice + addOnsTotal) * quantity;
      subtotal += itemTotal;

      // Main item line
      const displayName = sizeLabel ? `${productNameDisplay} (${sizeLabel})` : productNameDisplay;
      receiptItems += `
        <div class="receipt-item">
          <div class="item-name">${displayName}</div>
          <div class="item-qty-price">${quantity} x ${formatCurrency(basePrice)}</div>
          <div class="item-total">${formatCurrency(basePrice * quantity)}</div>
        </div>`;

      // Add add-ons HTML
      receiptItems += addOnsHtml;
    });
  }

  const { promoSets, promoSavings } = calculatePromoInfo(currentOrder);
  const hasDelivery = (currentOrder.FulfillmentMethod || currentOrder.fulfillmentMethod || '').toLowerCase() === 'delivery';
  const deliveryCharge = hasDelivery ? 20 : 0;
  const total = currentOrder.Total ? Number(currentOrder.Total) : subtotal + deliveryCharge;

  const receiptHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Receipt - Order ${currentOrder.OrderID || 'N/A'}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');

      body {
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.4;
        color: #000;
        margin: 0;
        padding: 10px;
        background: #fff;
        max-width: 320px;
        margin: 0 auto;
      }

      .receipt-container {
        border: 1px dashed #000;
        padding: 15px;
        background: #fff;
        position: relative;
      }

      .receipt-header {
        text-align: center;
        border-bottom: 1px dashed #000;
        padding-bottom: 10px;
        margin-bottom: 15px;
      }

      .store-name {
        font-size: 16px;
        font-weight: bold;
        margin: 0;
        color: #a05c2f;
      }

      .store-tagline {
        font-size: 10px;
        margin: 5px 0 0 0;
        color: #666;
      }

      .receipt-title {
        font-size: 14px;
        font-weight: bold;
        margin: 10px 0;
        text-decoration: underline;
      }

      .receipt-info {
        margin-bottom: 15px;
        font-size: 11px;
      }

      .info-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 3px;
      }

      .info-label {
        font-weight: bold;
      }

      .receipt-items {
        border-top: 1px dashed #000;
        border-bottom: 1px dashed #000;
        padding: 10px 0;
        margin: 10px 0;
      }

      .receipt-item, .receipt-addon {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 5px;
        min-height: 16px;
      }

      .receipt-addon {
        padding-left: 15px;
        font-size: 10px;
        color: #666;
      }

      .item-name {
        flex: 1;
        word-wrap: break-word;
        margin-right: 10px;
      }

      .item-qty-price {
        font-size: 10px;
        color: #666;
        margin-right: 10px;
        white-space: nowrap;
      }

      .item-total {
        font-weight: bold;
        text-align: right;
        min-width: 50px;
      }

      .promo-section {
        background: #f0f8f0;
        border: 1px solid #c3e6cb;
        padding: 8px;
        margin: 10px 0;
        font-size: 11px;
        text-align: center;
        border-radius: 3px;
      }

      .promo-section strong {
        color: #155724;
      }

      .receipt-totals {
        border-top: 1px dashed #000;
        padding-top: 10px;
        margin-top: 10px;
      }

      .total-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 5px;
        font-size: 12px;
      }

      .total-row.final {
        border-top: 2px solid #000;
        padding-top: 8px;
        font-size: 14px;
        font-weight: bold;
        margin-top: 8px;
      }

      .receipt-footer {
        text-align: center;
        border-top: 1px dashed #000;
        padding-top: 15px;
        margin-top: 15px;
        font-size: 10px;
        color: #666;
      }

      .thank-you {
        font-size: 12px;
        font-weight: bold;
        margin-bottom: 8px;
        color: #a05c2f;
      }

      .receipt-number {
        font-size: 10px;
        margin-top: 8px;
        font-weight: bold;
      }

      .cut-line {
        border-top: 1px dashed #000;
        margin: 10px 0;
        height: 1px;
      }

      @media print {
        body {
          margin: 0;
          padding: 5px;
          -webkit-print-color-adjust: exact;
          color-adjust: exact;
        }

        .receipt-container {
          border: none;
          padding: 10px;
        }

        .cut-line {
          page-break-after: always;
          border-top: 1px dashed #000;
          margin: 20px 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="receipt-container">
      <div class="receipt-header">
        <h1 class="store-name">BLESSINGS CAFE</h1>
        <p class="store-tagline">Serving with love and gratitude</p>
        <h2 class="receipt-title">OFFICIAL RECEIPT</h2>
      </div>

      <div class="receipt-info">
        <div class="info-row">
          <span class="info-label">Order ID:</span>
          <span>${currentOrder.OrderID || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date:</span>
          <span>${orderDate}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Customer:</span>
          <span>${customerName}</span>
        </div>
        ${customerContact !== 'N/A' ? `
        <div class="info-row">
          <span class="info-label">Contact:</span>
          <span>${customerContact}</span>
        </div>` : ''}
        ${hasDelivery && customerAddress !== 'N/A' ? `
        <div class="info-row">
          <span class="info-label">Address:</span>
          <span style="max-width: 150px; word-wrap: break-word;">${customerAddress}</span>
        </div>` : ''}
        <div class="info-row">
          <span class="info-label">Type:</span>
          <span>${hasDelivery ? 'Delivery' : 'Pickup'}</span>
        </div>
      </div>

      <div class="receipt-items">
        ${receiptItems}
      </div>

      ${promoSets > 0 ? `
      <div class="promo-section">
        <strong>🎉 PROMO APPLIED</strong><br>
        ${promoSets} set${promoSets > 1 ? 's' : ''} of 3 drinks - ₱143 each<br>
        Total Savings: ₱${promoSavings}
      </div>` : ''}

      <div class="receipt-totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${formatCurrency(subtotal)}</span>
        </div>
        ${hasDelivery ? `
        <div class="total-row">
          <span>Delivery Fee:</span>
          <span>${formatCurrency(deliveryCharge)}</span>
        </div>` : ''}
        <div class="total-row final">
          <span>TOTAL:</span>
          <span>${formatCurrency(total)}</span>
        </div>
      </div>

      <div class="receipt-footer">
        <div class="thank-you">Thank you for your order!</div>
        <p>We hope to serve you again soon.</p>
        <div class="receipt-number">Receipt #${currentOrder.OrderID || 'N/A'}</div>
      </div>
    </div>

    <div class="cut-line"></div>

    <script>
      window.onload = function() {
        setTimeout(function() {
          window.print();
        }, 500);
      };
    </script>
  </body>
  </html>
`;

  invoiceWindow.document.write(receiptHtml);
  invoiceWindow.document.close();
  invoiceWindow.focus();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && orderDetailPanel.classList.contains('show')) {
    hideOrderDetails();
  }
});

const completedOrdersModal = document.getElementById('completedOrdersModal');
const closeCompletedOrdersModal = document.getElementById('closeCompletedOrdersModal');
const modalCompletedOrdersList = document.getElementById('modalCompletedOrdersList');

function openCompletedOrdersModal() {
  const completedOrders = orders.filter(order => {
    const pay = (order.PaymentStatus || order.paymentStatus || '').toLowerCase();
    const full = (order.FulfillmentStatus || order.fulfillmentStatus || '').toLowerCase();
    return pay === 'completed' && full === 'completed';
  }).sort((a, b) => {
    const dateA = new Date(a.Date || a.date || 0).getTime();
    const dateB = new Date(b.Date || b.date || 0).getTime();
    return dateB - dateA;
  });

  // Update the orders count badge
  const ordersCountBadge = document.getElementById('ordersCountBadge');
  if (ordersCountBadge) {
    ordersCountBadge.textContent = `${completedOrders.length} Order${completedOrders.length !== 1 ? 's' : ''}`;
  }

  modalCompletedOrdersList.innerHTML = '';

  if (completedOrders.length === 0) {
    modalCompletedOrdersList.innerHTML = `
      <tr class="empty-state-table">
        <td colspan="6">
          <h3>No completed orders found</h3>
          <p>Completed orders will appear here once available.</p>
        </td>
      </tr>
    `;
  } else {
    completedOrders.forEach(order => {
      const orderDate = new Date(order.Date || order.date || 0);
      const isToday = isOrderFromToday(orderDate);
      
      // Get customer name
      let customerName = 'N/A';
      if (order.Customer) {
        if (typeof order.Customer === 'string') {
          customerName = order.Customer;
        } else if (typeof order.Customer === 'object' && order.Customer.fullname) {
          customerName = order.Customer.fullname;
        } else if (typeof order.Customer === 'object' && order.Customer.firstName) {
          customerName = (order.Customer.firstName + ' ' + (order.Customer.lastName || '')).trim();
        }
      } else if (order.customer) {
        customerName = typeof order.customer === 'string' ? order.customer : 
                     (order.customer.fullname || order.customer.name || 'Unknown Customer');
      }

      const row = document.createElement('tr');
      row.className = 'completed-order-card';
      row.style.cursor = 'pointer';
      
      row.innerHTML = `
        <td class="order-id-cell">#${order.OrderID || 'N/A'}</td>
        <td class="customer-cell">
          <div class="customer-name-table">${customerName}</div>
          <div class="customer-details-table">${order.Email || order.email || 'No email'}</div>
        </td>
        <td class="date-cell">
          ${orderDate.toLocaleDateString()} ${isToday ? '<br><small style="color: #a05c2f; font-weight: 600;">Today</small>' : ''}
        </td>
        <td class="total-cell">${order.Total !== undefined && order.Total !== null ? formatCurrency(order.Total) : 'N/A'}</td>
        <td class="status-cell">
          <span class="status-badge-table">Completed</span>
        </td>
        <td class="actions-cell">
          <button class="view-btn-table" onclick="viewOrderDetails('${order.OrderID}')">View</button>
        </td>
      `;

      // Add click handler to the entire row (excluding the button)
      row.addEventListener('click', (e) => {
        // Don't trigger if clicking the button itself
        if (!e.target.classList.contains('view-btn-table')) {
          viewOrderDetails(order.OrderID);
        }
      });

      modalCompletedOrdersList.appendChild(row);
    });
  }

  if (typeof window.orderMobileHandler !== 'undefined') {
    window.orderMobileHandler.renderCompletedOrderCards(completedOrders);
  }

  completedOrdersModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeCompletedOrders() {
  completedOrdersModal.style.display = 'none';
  document.body.style.overflow = 'auto';
}

function viewOrderDetails(orderId) {
  // Find the order by ID
  const order = orders.find(o => (o.OrderID || o.orderId) === orderId);
  if (order) {
    // Close the modal first
    closeCompletedOrders();
    
    // Find the order row in the main table and select it
    const orderRows = document.querySelectorAll('.order-row');
    let orderFound = false;
    
    orderRows.forEach((row, index) => {
      const rowOrderId = row.cells[0].textContent.trim();
      if (rowOrderId === orderId) {
        orderFound = true;
        
        // Get the dataset index for the order
        const idx = parseInt(row.dataset.idx, 10);
        
        if (idx >= 0 && idx < orders.length) {
          // Use the existing showOrderDetails function
          showOrderDetails(orders[idx], index);
          
          // Scroll the row into view
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
    
    if (!orderFound) {
      // If order not found in current view, find it by index
      const orderIndex = orders.findIndex(o => (o.OrderID || o.orderId) === orderId);
      if (orderIndex !== -1) {
        // Use the existing showOrderDetails function
        showOrderDetails(order, orderIndex);
      }
    }
  }
}

function isOrderFromToday(orderDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return orderDate >= today && orderDate < tomorrow;
}

document.addEventListener('DOMContentLoaded', function() {
  renderCompletedOrders();
  var viewAllBtn = document.getElementById('viewAllCompletedBtn');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', openCompletedOrdersModal);
  }
  if (closeCompletedOrdersModal) {
    closeCompletedOrdersModal.addEventListener('click', closeCompletedOrders);
  }
  document.addEventListener('click', (e) => {
    if (completedOrdersModal.style.display === 'flex' && !completedOrdersModal.contains(e.target) && e.target !== viewAllBtn) {
      closeCompletedOrders();
    }
  });

  // Add reset sort button event listener
  const resetSortBtn = document.getElementById('resetSortBtn');
  if (resetSortBtn) {
    resetSortBtn.addEventListener('click', resetSort);
  }
});

async function pollOrders() {
  try {
    const response = await fetch('/api/orders');
    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.status}`);
    }

    const latestOrders = await response.json();

    // Store the initial order IDs if this is the first run
    if (!window.lastKnownOrderIds) {
      window.lastKnownOrderIds = new Set(orders.map(order => order.OrderID));
    }

    // Compare with current orders to detect new additions from any source
    const currentOrderIds = new Set(orders.map(order => order.OrderID));
    const newOrders = latestOrders.filter(latestOrder => 
      !currentOrderIds.has(latestOrder.OrderID)
    );

    if (newOrders.length > 0) {
      // Sort new orders by date to show them in chronological order
      newOrders.sort((a, b) => new Date(a.Date) - new Date(b.Date));
      
      console.log(`🔔 Detected ${newOrders.length} new order(s):`, newOrders.map(o => ({
        id: o.OrderID,
        customer: o.Customer?.fullname || o.Customer,
        source: o.Source,
        total: o.Total
      })));
      
      // Add new orders to the current orders array
      orders.push(...newOrders);
      renderOrdersTable(); // Re-render the orders table with the updated list
      
      // Create detailed notification for each new order
      newOrders.forEach(order => {
        const customerName = order.Customer?.fullname || order.Customer || 'Unknown Customer';
        const orderSource = order.Source || 'Unknown';
        const orderTotal = order.Total || 0;
        
        // Show notification for new orders
        if (typeof showMessage === 'function') {
          showMessage(
            `New ${orderSource} order: ${order.OrderID} from ${customerName} (₱${orderTotal})`,
            false
          );
        }
      });

      // Update the known order IDs
      window.lastKnownOrderIds = new Set(latestOrders.map(order => order.OrderID));
    }
  } catch (error) {
    console.error('❌ Error polling orders:', error);
  }
}

// Start polling every 5 seconds for more responsive detection of user/chatbot orders
setInterval(pollOrders, 5000);

// Also run immediately when the script loads
pollOrders();

renderOrdersTable();