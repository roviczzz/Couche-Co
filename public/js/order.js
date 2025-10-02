if (!window.apiPrefix) window.apiPrefix = '/admin';

const ordersData = JSON.parse(document.getElementById('orders-data').textContent || '[]');
const orders = ordersData;
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
  if (!order.Cart || !order.Cart.length) {
    return { promoSets: 0, promoSavings: 0 };
  }

  let drinkCount = 0;
  order.Cart.forEach(item => {
    const itemCategory = item.Category || '';
    if (itemCategory.toLowerCase() !== 'pastries') {
      drinkCount += Number(item.Quantity) || 0;
    }
  });

  const promoSets = Math.floor(drinkCount / 3);
  const promoSavings = promoSets > 0 ? (promoSets * 143) : 0;

  return { promoSets, promoSavings, drinkCount };
}

function createProductList(order) {
  if (!order.Cart || !order.Cart.length) {
    return '<p style="text-align: center; color: #999; padding: 20px;">No products in this order.</p>';
  }

  const { promoSets, promoSavings, drinkCount } = calculatePromoInfo(order);

  let html = '<ul>';
  order.Cart.forEach(item => {
    const quantity = Number(item.Quantity) || 0;
    const sizeLabel = item.Size || null;
    const basePrice = Number(item.BasePrice) || 0;

    let addOnsTotal = 0;
    let addOnsHtml = '';

    if (item.AddOns && item.AddOns.length > 0) {
      addOnsHtml = '<div class="product-addons">';
      item.AddOns.forEach(addon => {
        const addonPrice = Number(addon.BasePrice) || 0;
        addOnsTotal += addonPrice;
        addOnsHtml += `
          <div class="addon-item">
            <span class="addon-name">+ ${addon.Name || 'Unknown Add-on'}</span>
            <span class="addon-price">${formatCurrency(addonPrice)}</span>
          </div>
        `;
      });
      addOnsHtml += '</div>';
    }

    const itemTotal = (basePrice + addOnsTotal) * quantity;

    html += `<li>
      <span class="product-name">${item.ProductName || 'N/A'}</span>
      <div class="product-quantity-price">
        <span><strong>Size:</strong> ${sizeLabel || 'N/A'}</span>
        <span><strong>Qty:</strong> ${quantity}</span>
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

  if (order.Cart && order.Cart.length) {
    order.Cart.forEach(item => {
      const quantity = Number(item.Quantity) || 0;
      const basePrice = Number(item.BasePrice) || 0;

      let addOnsTotal = 0;
      if (item.AddOns && item.AddOns.length > 0) {
        item.AddOns.forEach(addon => {
          addOnsTotal += Number(addon.BasePrice) || 0;
        });
      }

      productsSubtotal += (basePrice + addOnsTotal) * quantity;
    });
  }

  return productsSubtotal;
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

  // Limit to 6 items max
  const completedOrders = allCompletedOrders.slice(0, 6);

  const section = document.getElementById('completedOrdersSection');
  const list = document.getElementById('completedOrdersList');
  // Always show the section
  section.style.display = 'block';
  list.innerHTML = '';
  if (!allCompletedOrders.length) {
    list.innerHTML = '<p style="text-align:center;color:#999;">No completed orders found.</p>';
    return;
  }
  completedOrders.forEach(order => {
    const item = document.createElement('div');
    item.className = 'completed-order-item';
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.padding = '10px 15px';
    item.style.marginBottom = '8px';
    item.style.backgroundColor = '#fff';
    item.style.borderRadius = '6px';
    item.style.borderLeft = '4px solid #28a745';
    item.style.boxShadow = '0 1px 3px rgba(0,0,0,0.07)';
    item.innerHTML = `
      <div style="display: flex; flex-direction: column;">
        <div style="font-weight: 600; color: #333; margin-bottom: 3px;">${order.OrderID || 'N/A'}</div>
        <div style="font-size: 14px; color: #666;">${order.Customer || order.customer || 'N/A'}</div>
        <div style="font-size: 13px; color: #888;">${order.Date ? new Date(order.Date).toLocaleString() : (order.date ? new Date(order.date).toLocaleString() : 'N/A')}</div>
      </div>
      <div style="font-size: 13px; color: #28a745; font-weight: 600;">Completed</div>
    `;
    list.appendChild(item);
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

  let address = order.Address || order.address || 'N/A';
  let customer = order.Customer || order.customer || 'N/A';
  let contact = order.ContactNumber || order.contactNumber || 'N/A';
  let source = order.Source || order.source || 'N/A';
  const deliveryFee = 15;

  const productsSubtotal = calculateOrderTotals(order);
  const hasDelivery = (order.DeliveryStatus === 'Delivery' || order.DeliveryStatus === 'delivery');
  const totalPriceValue = order.Total ? Number(order.Total) : productsSubtotal + (hasDelivery ? deliveryFee : 0);

  const paymentStatusBadge = getPaymentStatusBadge(order.PaymentStatus || order.paymentStatus);
  const fulfillmentStatusBadge = getFulfillmentStatusBadge(order.FulfillmentStatus || order.fulfillmentStatus);

  const orderDate = order.Date ? new Date(order.Date).toLocaleString() :
        (order.date ? new Date(order.date).toLocaleString() : 'N/A');

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
        <span class="info-value">${source}</span>
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
        <span class="info-label">Delivery Type:</span>
        <span class="info-value">${order.DeliveryStatus || 'N/A'}</span>
      </div>
    </div>
  </div>

  <div class="order-detail-section">
    <h3>Products Ordered</h3>
    ${createProductList(order)}

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
  orderDetailButtons.style.display = 'flex';
  orderDetailPanel.classList.add('show');

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

function sortOrders(columnKey) {
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
    total: 'Total',
    delivery: 'DeliveryStatus',
    items: 'ItemTotal',
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

  renderOrdersTable();
  renderSortArrows();
}

function renderOrdersTable() {
  ordersTableBody.innerHTML = '';

  if (orders.length === 0) {
    ordersTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px;">No orders found.</td></tr>`;
    renderCancelledOrders();
    renderCompletedOrders();
    return;
  }

  const activeOrders = orders.filter(order => {
    const isCancelled = (order.FulfillmentStatus === 'Cancelled' || order.fulfillmentStatus === 'Cancelled');
    const paymentCompleted = (order.PaymentStatus || order.paymentStatus || '').toLowerCase() === 'completed';
    const fulfillmentCompleted = (order.FulfillmentStatus || order.fulfillmentStatus || '').toLowerCase() === 'completed';
    const bothCompleted = paymentCompleted && fulfillmentCompleted;

    return !isCancelled && !bothCompleted;
  });

  activeOrders.forEach((order, index) => {
    const paymentBadge = getPaymentStatusBadge(order.PaymentStatus || order.paymentStatus);
    const fulfillmentBadge = getFulfillmentStatusBadge(order.FulfillmentStatus || order.fulfillmentStatus);

    ordersTableBody.innerHTML += `
    <tr class="order-row ${selectedRowIndex === index ? 'selected' : ''}" data-idx="${orders.indexOf(order)}">
      <td>${order.OrderID || 'N/A'}</td>
      <td>${order.Date ? new Date(order.Date).toLocaleString()
            : order.date ? new Date(order.date).toLocaleString() : 'N/A'}</td>
      <td>${order.Customer || order.customer || 'N/A'}</td>
      <td>${paymentBadge}</td>
      <td>${order.Total !== undefined && order.Total !== null ? '₱ ' + Number(order.Total).toFixed(2) : 'N/A'}</td>
      <td>${order.DeliveryStatus || order.deliveryStatus || 'N/A'}</td>
      <td>${order.ItemTotal !== undefined && order.ItemTotal !== null ? order.ItemTotal : 'N/A'}</td>
      <td>${fulfillmentBadge}</td>
    </tr>
  `;
  });

  initRowEventListeners();
  renderCancelledOrders();
  renderCompletedOrders();
}

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
  } else if (normalized.includes('in delivery') || normalized.includes('delivering')) {
    return `<span class="status-fulfillment status-in-delivery" title="Out for Delivery">In Delivery</span>`;
  } else if (normalized.includes('complete') || normalized.includes('delivered')) {
    return `<span class="status-fulfillment status-completed" title="Order Completed">Completed</span>`;
  }
  return `<span class="status-fulfillment">${status}</span>`;
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

fulfillmentDropdown.querySelectorAll('.fulfill-option').forEach(option => {
  option.addEventListener('click', async () => {
    const selectedStatus = option.getAttribute('data-status');
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
  });
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

  const invoiceWindow = window.open('', 'Print Invoice', 'width=700,height=900');
  if (!invoiceWindow) {
    showMessage('Popup blocked. Please allow popups for this website.', true);
    return;
  }

  const orderDate = currentOrder.Date ? new Date(currentOrder.Date).toLocaleString() :
        (currentOrder.date ? new Date(currentOrder.date).toLocaleString() : 'N/A');

  let productsHtml = '<table style="width:100%; border-collapse: collapse; margin: 20px 0;">' +
        `<thead>
     <tr style="background-color: #f8f9fa;">
       <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Product</th>
       <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Size</th>
       <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Quantity</th>
       <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Unit Price</th>
       <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Add-ons</th>
       <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Total</th>
     </tr>
   </thead><tbody>`;

  let subtotal = 0;

  if (currentOrder.Cart && currentOrder.Cart.length) {
    currentOrder.Cart.forEach(item => {
      const quantity = Number(item.Quantity) || 0;
      const basePrice = Number(item.BasePrice) || 0;

      let addOnsTotal = 0;
      let addOnsText = 'None';

      if (item.AddOns && item.AddOns.length > 0) {
        addOnsText = item.AddOns.map(addon => {
          const addonPrice = Number(addon.BasePrice) || 0;
          addOnsTotal += addonPrice;
          return `${addon.Name} (${formatCurrency(addonPrice)})`;
        }).join(', ');
      }

      const itemTotal = (basePrice + addOnsTotal) * quantity;
      subtotal += itemTotal;

      productsHtml += `<tr>
      <td style="border: 1px solid #ddd; padding: 10px;">${item.ProductName || 'N/A'}</td>
      <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${item.Size || 'N/A'}</td>
      <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${quantity}</td>
      <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${formatCurrency(basePrice)}</td>
      <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${addOnsText}</td>
      <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${formatCurrency(itemTotal)}</td>
    </tr>`;
    });
  } else {
    productsHtml += `<tr><td colspan="6" style="text-align:center; padding: 20px; border: 1px solid #ddd;">No products in the order.</td></tr>`;
  }
  productsHtml += '</tbody></table>';

  const { promoSets, promoSavings } = calculatePromoInfo(currentOrder);
  if (promoSets > 0) {
    productsHtml += `<div style="margin: 20px 0; padding: 10px; background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; color: #155724;">
      <strong>🎉 Promo Applied: ${promoSets} set${promoSets > 1 ? 's' : ''} of 3 drinks - ₱143 each (Total Savings: ₱${promoSavings})</strong>
    </div>`;
  }

  const hasDelivery = (currentOrder.DeliveryStatus && currentOrder.DeliveryStatus.toLowerCase() === 'delivery');
  const deliveryCharge = hasDelivery ? 15 : 0;
  const total = subtotal + deliveryCharge;

  const invoiceHtml = `
  <html>
  <head>
    <title>Invoice for Order ${currentOrder.OrderID || 'N/A'}</title>
    <style>
      body {
        font-family: 'Arial', sans-serif;
        margin: 30px;
        color: #333;
        line-height: 1.6;
      }
      .header {
        text-align: center;
        margin-bottom: 40px;
        border-bottom: 3px solid #a05c2f;
        padding-bottom: 20px;
      }
      .header h1 {
        color: #a05c2f;
        font-size: 32px;
        margin: 0;
      }
      .header h2 {
        color: #666;
        font-size: 18px;
        margin: 5px 0 0 0;
        font-weight: normal;
      }
      .info-section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 30px;
        margin-bottom: 30px;
      }
      .info-block h3 {
        color: #a05c2f;
        margin-bottom: 10px;
        font-size: 16px;
      }
      .info-block p {
        margin: 5px 0;
        font-size: 14px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
        font-size: 14px;
      }
      th, td {
        padding: 12px;
        border: 1px solid #ddd;
      }
      th {
        background-color: #f8f9fa;
        font-weight: 600;
      }
      .totals {
        margin-top: 30px;
        float: right;
        width: 300px;
      }
      .totals table {
        margin: 0;
      }
      .totals .total-row {
        background-color: #a05c2f;
        color: white;
        font-weight: bold;
        font-size: 16px;
      }
      .footer {
        clear: both;
        text-align: center;
        margin-top: 60px;
        padding-top: 20px;
        border-top: 1px solid #ddd;
        color: #666;
      }
      @media print {
        body { margin: 15px; }
        .header h1 { font-size: 28px; }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>Blessings Cafe</h1>
      <h2>Invoice ${currentOrder.OrderID || 'N/A'}</h2>
    </div>

    <div class="info-section">
      <div class="info-block">
        <h3>Order Information</h3>
        <p><strong>Order ID:</strong> ${currentOrder.OrderID || 'N/A'}</p>
        <p><strong>Xendit Payment ID:</strong> ${currentOrder.XenditPaymentID || 'N/A'}</p>
        <p><strong>Date:</strong> ${orderDate}</p>
        <p><strong>Source:</strong> ${currentOrder.Source || currentOrder.source || 'N/A'}</p>
        <p><strong>Payment Status:</strong> ${currentOrder.PaymentStatus || currentOrder.paymentStatus || 'N/A'}</p>
        <p><strong>Fulfillment Status:</strong> ${currentOrder.FulfillmentStatus || currentOrder.fulfillmentStatus || 'N/A'}</p>
      </div>

      <div class="info-block">
        <h3>Customer Information</h3>
        <p><strong>Name:</strong> ${currentOrder.Customer || currentOrder.customer || 'N/A'}</p>
        <p><strong>Contact:</strong> ${currentOrder.ContactNumber || 'N/A'}</p>
        <p><strong>Address:</strong> ${currentOrder.Address || currentOrder.address || 'N/A'}</p>
        <p><strong>Delivery Type:</strong> ${currentOrder.DeliveryStatus || 'N/A'}</p>
      </div>
    </div>

    ${productsHtml}

    <div class="totals">
      <table>
        <tr>
          <td style="text-align: right; padding: 8px;"><strong>Subtotal:</strong></td>
          <td style="text-align: right; padding: 8px;">${formatCurrency(subtotal)}</td>
        </tr>
        ${hasDelivery ? `
        <tr>
          <td style="text-align: right; padding: 8px;"><strong>Delivery Fee:</strong></td>
          <td style="text-align: right; padding: 8px;">${formatCurrency(deliveryCharge)}</td>
        </tr>` : ''}
        <tr class="total-row">
          <td style="text-align: right; padding: 12px;"><strong>Total:</strong></td>
          <td style="text-align: right; padding: 12px;"><strong>${formatCurrency(total)}</strong></td>
        </tr>
      </table>
    </div>

    <div class="footer">
      <p>Thank you for your order!</p>
      <p style="font-size: 12px;">Blessings Cafe - Serving with love and gratitude</p>
    </div>
  </body>
  </html>
`;

  invoiceWindow.document.write(invoiceHtml);
  invoiceWindow.document.close();
  invoiceWindow.focus();

  setTimeout(() => {
    invoiceWindow.print();
  }, 500);
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

  modalCompletedOrdersList.innerHTML = '';

  if (completedOrders.length === 0) {
    modalCompletedOrdersList.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">No completed orders found.</p>';
  } else {
    completedOrders.forEach(order => {
      const orderDate = new Date(order.Date || order.date || 0);
      const isToday = isOrderFromToday(orderDate);

      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.padding = '15px 20px';
      item.style.marginBottom = '10px';
      item.style.backgroundColor = '#fff';
      item.style.borderRadius = '8px';
      item.style.borderLeft = '4px solid #28a745';
      item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      item.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
      item.style.cursor = 'pointer';

      item.addEventListener('mouseenter', () => {
        item.style.transform = 'translateY(-2px)';
        item.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      });

      item.addEventListener('mouseleave', () => {
        item.style.transform = 'translateY(0)';
        item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      });

      item.innerHTML = `
        <div style="display: flex; flex-direction: column;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
            <span style="font-weight: 600; color: #333; font-size: 16px;">${order.OrderID || 'N/A'}</span>
            ${isToday ? '<span style="background-color: #28a745; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">TODAY</span>' : ''}
          </div>
          <div style="font-size: 14px; color: #666; margin-bottom: 3px;">${order.Customer || order.customer || 'N/A'}</div>
          <div style="font-size: 13px; color: #888;">${orderDate.toLocaleString()}</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
          <div style="font-size: 16px; color: #28a745; font-weight: 600;">
            ${order.Total !== undefined && order.Total !== null ? formatCurrency(order.Total) : 'N/A'}
          </div>
          <div style="font-size: 12px; color: #28a745; font-weight: 600; padding: 4px 8px; background-color: #d4edda; border-radius: 4px;">
            Completed
          </div>
        </div>
      `;

      modalCompletedOrdersList.appendChild(item);
    });
  }

  completedOrdersModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeCompletedOrders() {
  completedOrdersModal.style.display = 'none';
  document.body.style.overflow = 'auto';
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
});

renderOrdersTable();
