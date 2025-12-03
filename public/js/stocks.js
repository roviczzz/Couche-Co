// Enhanced Stock Management System JavaScript
// Based on Enhanced Promo Management System V9 - SEARCH AND SORT FIXED by MathDaenniel
// Adapted for Stocks by MathDaenniel - 2025-10-15

// ===============================================
// NOTIFICATION SYSTEM
// ===============================================

function showNotification(message, type = 'success', duration = 3000) {
  const container = document.querySelector('.notification-container') || createNotificationContainer();
  
  const notification = document.createElement('div');
  notification.className = `stocks-notification ${type}`;
  
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  
  notification.innerHTML = `
    <div class="notification-icon">${icons[type] || icons.info}</div>
    <div class="notification-content">
      <div class="notification-message">${message}</div>
    </div>
    <button class="notification-close">×</button>
  `;
  
  container.appendChild(notification);
  
  setTimeout(() => notification.classList.add('show'), 10);
  
  const closeBtn = notification.querySelector('.notification-close');
  closeBtn.addEventListener('click', () => removeNotification(notification));
  
  if (duration > 0) {
    setTimeout(() => removeNotification(notification), duration);
  }
  
  return notification;
}

function createNotificationContainer() {
  const container = document.createElement('div');
  container.className = 'notification-container';
  document.body.appendChild(container);
  return container;
}

function removeNotification(notification) {
  notification.classList.remove('show');
  setTimeout(() => notification.remove(), 300);
}

// ===============================================
// TABLE ROW CREATION HELPERS
// ===============================================

function createIngredientRow(data) {
  const tr = document.createElement('tr');
  tr.setAttribute('data-item-id', data._id);
  tr.setAttribute('data-type', 'ingredient');
  
  const suffix = data.IngredientID ? data.IngredientID.split('-')[1] || '' : data.IngredientSuffix || '';
  const amountPerPack = data.AmountPerPack ? data.AmountPerPack.split(' ') : [data.Amount || 0, data.Unit || 'g'];
  const amount = parseFloat(amountPerPack[0]) || 0;
  const unit = amountPerPack[1] || 'g';
  
  tr.innerHTML = `
    <td class="ingredient-id-cell">
      <div class="ingredient-id-group-table">
        <div class="prefix-display-table">ING</div>
        <input type="text" name="IngredientSuffix" value="${suffix}" class="table-input suffix-input" data-field="suffix" data-original="${suffix}" required>
      </div>
    </td>
    <td><input type="text" name="Name" value="${data.Name || ''}" class="table-input" data-field="name" data-original="${data.Name || ''}" required></td>
    <td>${data.Amount || 0} ${unit}</td>
    <td>
      <div class="amount-pack-group">
        <input type="number" name="Amount" value="${amount}" class="table-input number-input" data-field="amount" data-original="${amount}" required min="0">
        <select name="Unit" class="table-input unit-select" data-field="unit" data-original="${unit}" required>
          <option value="g" ${unit === 'g' ? 'selected' : ''}> G</option>
          <option value="mL" ${unit === 'mL' ? 'selected' : ''}> mL</option>
        </select>
      </div>
    </td>
    <td>Ingredients</td>
    <td><input type="text" name="Allergen" value="${data.Allergen || ''}" class="table-input" data-field="allergen" data-original="${data.Allergen || ''}" required></td>
    <td>
      <label class="toggle-switch">
        <input type="checkbox" name="isEnabled" data-field="enabled" data-original="${data.isEnabled || false}" ${data.isEnabled ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </td>
    <td class="actions-cell">
      <div class="button-wrapper">
        <button type="button" class="stocks-btn update" data-action="update" data-type="ingredient" data-item-id="${data._id}">Update</button>
        <button type="button" class="stocks-btn delete" data-action="delete" data-type="ingredient" data-item-id="${data._id}">Delete</button>
      </div>
    </td>
  `;
  
  return tr;
}

function createAddonRow(data) {
  const tr = document.createElement('tr');
  tr.setAttribute('data-item-id', data._id);
  tr.setAttribute('data-type', 'addon');
  
  const suffix = data.AddOnID ? data.AddOnID.split('-')[1] || '' : data.AddOnSuffix || '';
  const amountPerPack = data.AmountPerPack ? data.AmountPerPack.split(' ') : [data.Amount || 0, data.Unit || 'g'];
  const amount = parseFloat(amountPerPack[0]) || 0;
  const unit = amountPerPack[1] || 'g';
  
  tr.innerHTML = `
    <td class="ingredient-id-cell">
      <div class="ingredient-id-group-table">
        <div class="prefix-display-table">AD</div>
        <input type="text" name="AddOnSuffix" value="${suffix}" class="table-input suffix-input" data-field="suffix" data-original="${suffix}" required>
      </div>
    </td>
    <td><input type="text" name="Name" value="${data.Name || ''}" class="table-input" data-field="name" data-original="${data.Name || ''}" required></td>
    <td>${data.Amount || 0} ${unit}</td>
    <td>
      <div class="amount-pack-group">
        <input type="number" name="Amount" value="${amount}" class="table-input number-input" data-field="amount" data-original="${amount}" required min="0">
        <select name="Unit" class="table-input unit-select" data-field="unit" data-original="${unit}" required>
          <option value="g" ${unit === 'g' ? 'selected' : ''}> G</option>
          <option value="mL" ${unit === 'mL' ? 'selected' : ''}> mL</option>
        </select>
      </div>
    </td>
    <td>Add-Ons</td>
    <td><input type="text" name="Allergen" value="${data.Allergen || ''}" class="table-input" data-field="allergen" data-original="${data.Allergen || ''}" required></td>
    <td>
      <label class="toggle-switch">
        <input type="checkbox" name="isEnabled" data-field="enabled" data-original="${data.isEnabled || false}" ${data.isEnabled ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </td>
    <td class="actions-cell">
      <div class="button-wrapper">
        <button type="button" class="stocks-btn update" data-action="update" data-type="addon" data-item-id="${data._id}">Update</button>
        <button type="button" class="stocks-btn delete" data-action="delete" data-type="addon" data-item-id="${data._id}">Delete</button>
      </div>
    </td>
  `;
  
  return tr;
}

document.addEventListener('DOMContentLoaded', function() {
  console.log(`[2025-10-15 17:45:23] Initializing Enhanced Stock Management System - SEARCH AND SORT FIXED by MathDaenniel`);
  console.log(`[2025-10-15 17:45:23] Repository: roviczzz/Couche-Co by MathDaenniel`);

  // ===============================================
  // DASHBOARD REFRESH INTEGRATION
  // ===============================================
  
  function triggerDashboardRefresh() {
    console.log(`[2025-10-15 17:45:23] Triggering dashboard refresh for low stock updates by MathDaenniel`);
    
    // Method 1: Dispatch custom event for same-page dashboard
    const stockUpdateEvent = new CustomEvent('stockUpdated', {
      detail: {
        timestamp: new Date().toISOString(),
        source: 'stocks-management',
        action: 'stock-updated'
      }
    });
    window.dispatchEvent(stockUpdateEvent);
    
    // Method 2: Update localStorage for cross-tab communication
    localStorage.setItem('stockDataChanged', Date.now().toString());
    
    // Method 3: Direct call if dashboard functions are available
    if (typeof window.forceDashboardRefresh === 'function') {
      window.forceDashboardRefresh();
    }
    
    console.log(`[2025-10-15 17:45:23] Dashboard refresh triggers sent by MathDaenniel`);
  }

  // ===============================================
  // ENHANCED FIXED NAVBAR - CONTENT ONLY SCROLLING
  // ===============================================

  function setupFixedNavbar() {
    if (window.innerWidth <= 768) {
      console.log(`[2025-10-15 17:45:23] Mobile view detected, skipping fixed navbar setup by MathDaenniel`);
      return;
    }
    
    console.log(`[2025-10-15 17:45:23] Setting up fixed navbar with content-only scrolling by MathDaenniel`);

    const navbarSelectors = [
      '.navbar:not(.bottom-nav-mobile)', '.nav:not(.bottom-nav-mobile)', 
      '.header-nav', '.main-nav', 'nav:not(.bottom-nav-mobile)',
      'header', '.header', '.site-header', '.page-header',
      '.navigation', '.top-nav', '.primary-nav'
    ];

    let navbar = null;

    for (const selector of navbarSelectors) {
      const element = document.querySelector(selector);
      if (element && !element.classList.contains('bottom-nav-mobile')) {
        navbar = element;
        break;
      }
    }

    if (navbar) {
      console.log(`[2025-10-15 17:45:23] Navbar found, applying fixed positioning by MathDaenniel`);

      Object.assign(navbar.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        width: '100%',
        zIndex: '9999',
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 2px 20px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease'
      });

      navbar.classList.add('navbar-fixed');

      const navbarHeight = navbar.offsetHeight;
      const container = document.querySelector('.stocks-container');

      if (container) {
        container.style.marginTop = '0';
        container.style.height = `calc(100vh - ${navbarHeight}px)`;
        container.style.overflowY = 'auto';
        container.style.overflowX = 'hidden';

        console.log(`[2025-10-15 17:45:23] Container adjusted: height=calc(100vh - ${navbarHeight}px) by MathDaenniel`);
      }

      console.log(`[2025-10-15 17:45:23] Fixed navbar setup complete: height=${navbarHeight}px by MathDaenniel`);
    } else {
      console.log(`[2025-10-15 17:45:23] No navbar found, applying default content scrolling by MathDaenniel`);

      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      const container = document.querySelector('.stocks-container');
      if (container) {
        container.style.height = 'calc(100vh - 80px)';
        container.style.overflowY = 'auto';
        container.style.overflowX = 'hidden';
      }
    }
  }

  setupFixedNavbar();
  window.addEventListener('resize', setupFixedNavbar);

  // ===============================================
  // ENHANCED SCROLL BEHAVIOR FOR CONTENT ONLY
  // ===============================================
  const scrollContainer = document.querySelector('.stocks-container');
  const navbar = document.querySelector('.navbar-fixed:not(.bottom-nav-mobile), .navbar:not(.bottom-nav-mobile), header');

  if (scrollContainer && navbar && window.innerWidth > 768) {
    scrollContainer.addEventListener('scroll', function() {
      const scrollTop = scrollContainer.scrollTop;

      if (navbar) {
        if (scrollTop > 10) {
          navbar.style.boxShadow = '0 4px 25px rgba(0,0,0,0.15)';
          navbar.style.background = 'rgba(255, 255, 255, 0.99)';
          navbar.style.backdropFilter = 'blur(15px)';
        } else {
          navbar.style.boxShadow = '0 2px 20px rgba(0,0,0,0.1)';
          navbar.style.background = 'rgba(255, 255, 255, 0.98)';
          navbar.style.backdropFilter = 'blur(12px)';
        }
      }
    });

    console.log(`[2025-10-15 17:45:23] Content scroll listener attached by MathDaenniel`);
  }

  // ===============================================
  // FLASH MESSAGE HANDLING
  // ===============================================

  const messageDiv = document.getElementById('message');
  if (messageDiv) {
    const urlParams = new URLSearchParams(window.location.search);
    const msg = urlParams.get('msg');

    let text = '';
    if (msg === 'add_success') text = 'Item successfully added.';
    else if (msg === 'update_success') text = 'Item successfully updated.';
    else if (msg === 'delete_success') text = 'Item successfully deleted.';
    else if (msg === 'bulk_update_success') text = 'Bulk update completed successfully.';
    else if (msg === 'bulk_delete_success') text = 'Bulk delete completed successfully.';
    else if (msg === 'duplicate_id') text = 'Error: Item ID already exists. Please use a different ID.';
    else if (msg === 'duplicate_id_name') text = 'Error: An item with this ID and name already exists. Please use a different ID or name.';
    else if (msg === 'duplicate_data') text = 'Error: An item with identical name, quantity, allergen, and status already exists.';
    else if (msg === 'delete_failed') text = 'Error: Failed to delete item. It may not exist.';
    else if (msg === 'item_not_found') text = 'Error: Item not found.';
    else if (msg === 'item_in_use') text = 'Error: Cannot delete item as it is being used in recipes.';

    if (text) {
      messageDiv.textContent = text;
      messageDiv.style.display = 'block';

      if (msg === 'duplicate_id' || msg === 'duplicate_id_name' || msg === 'duplicate_data' || msg === 'delete_failed' || msg === 'item_not_found' || msg === 'item_in_use') {
        messageDiv.classList.add('error');
      }

      const isError = msg === 'duplicate_id' || msg === 'duplicate_id_name' || msg === 'duplicate_data' || msg === 'delete_failed' || msg === 'item_not_found' || msg === 'item_in_use';
      const fadeTime = isError ? 5000 : 4000;
      setTimeout(() => {
        messageDiv.style.transition = 'opacity 1s ease';
        messageDiv.style.opacity = 0;
        setTimeout(() => {
          messageDiv.style.display = 'none';
          messageDiv.style.opacity = 1;
        }, 1000);
      }, fadeTime);
    }
  }

  // ===============================================
  // MODAL ELEMENTS AND GLOBAL VARIABLES
  // ===============================================

  const addItemBtn = document.getElementById('addItemBtn');
  const itemTypeModalOverlay = document.getElementById('itemTypeModalOverlay');
  const cancelTypeSelect = document.getElementById('cancelTypeSelect');
  const selectIngredientBtn = document.getElementById('selectIngredientBtn');
  const selectAddonBtn = document.getElementById('selectAddonBtn');

  // Unit selection modal
  const unitTypeModalOverlay = document.getElementById('unitTypeModalOverlay');
  const cancelUnitSelect = document.getElementById('cancelUnitSelect');
  const selectGramsBtn = document.getElementById('selectGramsBtn');
  const selectMilliLitersBtn = document.getElementById('selectMilliLitersBtn');

  const confirmationModal = document.getElementById('confirmationModal');
  const confirmationTitle = document.getElementById('confirmationTitle');
  const confirmationMessage = document.getElementById('confirmationMessage');
  const confirmCancel = document.getElementById('confirmCancel');
  const confirmProceed = document.getElementById('confirmProceed');

  const ingredientModalOverlay = document.getElementById('ingredientModalOverlay');
  const addonModalOverlay = document.getElementById('addonModalOverlay');

  // Close and cancel buttons for add modals
  const closeIngredientModal = document.getElementById('closeIngredientModal');
  const cancelIngredientModal = document.getElementById('cancelIngredientModal');
  const closeAddonModal = document.getElementById('closeAddonModal');
  const cancelAddonModal = document.getElementById('cancelAddonModal');

  let currentAction = null;
  let currentItemId = null;
  let currentItemType = null;
  let selectedItemType = null; // For unit selection flow

  let originalItemData = new Map();
  let updateActiveItemsTimeout = null;

  console.log(`[2025-10-15 17:45:23] Modal elements found:`, {
    addItemBtn: !!addItemBtn,
    itemTypeModalOverlay: !!itemTypeModalOverlay,
    confirmationModal: !!confirmationModal,
    confirmProceed: !!confirmProceed,
    confirmCancel: !!confirmCancel
  }, 'by MathDaenniel');

  // ===============================================
  // MODAL FUNCTIONS
  // ===============================================

  function showTypeSelectionModal() {
    console.log(`[2025-10-15 17:45:23] Opening type selection modal by MathDaenniel`);

    if (!itemTypeModalOverlay) {
      console.error(`[2025-10-15 17:45:23] Modal overlay not found by MathDaenniel`);
      return;
    }

    itemTypeModalOverlay.style.display = 'flex';
    itemTypeModalOverlay.style.visibility = 'visible';
    itemTypeModalOverlay.style.opacity = '0';

    setTimeout(() => {
      itemTypeModalOverlay.classList.add('show');
      itemTypeModalOverlay.style.opacity = '1';
    }, 10);

    setTimeout(() => {
      console.log(`[2025-10-15 17:45:23] Focus set to type selection by MathDaenniel`);
    }, 300);

    console.log(`[2025-10-15 17:45:23] Modal opened successfully by MathDaenniel`);
  }

  function hideTypeSelectionModal() {
    console.log(`[2025-10-15 17:45:23] Closing type selection modal by MathDaenniel`);

    if (!itemTypeModalOverlay) return;

    itemTypeModalOverlay.classList.remove('show');
    itemTypeModalOverlay.style.opacity = '0';

    setTimeout(() => {
      itemTypeModalOverlay.style.display = 'none';
      itemTypeModalOverlay.style.visibility = 'hidden';
    }, 200);

    console.log(`[2025-10-15 17:45:23] Type selection modal closed successfully by MathDaenniel`);
  }

  // FIX: Make showIngredientModal global so it can be called from EJS onclick attribute
  window.showIngredientModal = function() {
    console.log(`[2025-10-15 17:45:23] Opening ingredient modal by MathDaenniel`);

    if (!ingredientModalOverlay) {
      console.error(`[2025-10-15 17:45:23] Ingredient modal overlay not found by MathDaenniel`);
      return;
    }

    ingredientModalOverlay.style.display = 'flex';
    ingredientModalOverlay.style.visibility = 'visible';
    ingredientModalOverlay.style.opacity = '0';

    setTimeout(() => {
      ingredientModalOverlay.classList.add('show');
      ingredientModalOverlay.style.opacity = '1';
    }, 10);

    setTimeout(() => {
      const suffixInput = document.getElementById('IngredientSuffix');
      if (suffixInput) {
        suffixInput.focus();
        console.log(`[2025-10-15 17:45:23] Focus set to ingredient suffix input by MathDaenniel`);
      }
    }, 300);

    console.log(`[2025-10-15 17:45:23] Ingredient modal opened successfully by MathDaenniel`);
  }

  // FIX: Make hideIngredientModal global so it can be called from EJS onclick attribute
  window.hideIngredientModal = function() {
    console.log(`[2025-10-15 17:45:23] Closing ingredient modal by MathDaenniel`);

    if (!ingredientModalOverlay) return;

    ingredientModalOverlay.classList.remove('show');
    ingredientModalOverlay.style.opacity = '0';

    setTimeout(() => {
      ingredientModalOverlay.style.display = 'none';
      ingredientModalOverlay.style.visibility = 'hidden';

      const form = ingredientModalOverlay.querySelector('form');
      if (form) {
        form.reset();
        const switches = form.querySelectorAll('.switch-input');
        switches.forEach(switchInput => switchInput.checked = true);
      }
    }, 200);

    console.log(`[2025-10-15 17:45:23] Ingredient modal closed successfully by MathDaenniel`);
  }

  // FIX: Make showAddonModal global so it can be called from EJS onclick attribute
  window.showAddonModal = function() {
    console.log(`[2025-10-15 17:45:23] Opening add-on modal by MathDaenniel`);

    if (!addonModalOverlay) {
      console.error(`[2025-10-15 17:45:23] Add-on modal overlay not found by MathDaenniel`);
      return;
    }

    addonModalOverlay.style.display = 'flex';
    addonModalOverlay.style.visibility = 'visible';
    addonModalOverlay.style.opacity = '0';

    setTimeout(() => {
      addonModalOverlay.classList.add('show');
      addonModalOverlay.style.opacity = '1';
    }, 10);

    setTimeout(() => {
      const suffixInput = document.getElementById('AddOnSuffix');
      if (suffixInput) {
        suffixInput.focus();
        console.log(`[2025-10-15 17:45:23] Focus set to add-on suffix input by MathDaenniel`);
      }
    }, 300);

    console.log(`[2025-10-15 17:45:23] Add-on modal opened successfully by MathDaenniel`);
  }

  // FIX: Make hideAddonModal global so it can be called from EJS onclick attribute
  window.hideAddonModal = function() {
    console.log(`[2025-10-15 17:45:23] Closing add-on modal by MathDaenniel`);

    if (!addonModalOverlay) return;

    addonModalOverlay.classList.remove('show');
    addonModalOverlay.style.opacity = '0';

    setTimeout(() => {
      addonModalOverlay.style.display = 'none';
      addonModalOverlay.style.visibility = 'hidden';

      const form = addonModalOverlay.querySelector('form');
      if (form) {
        form.reset();
        const switches = form.querySelectorAll('.switch-input');
        switches.forEach(switchInput => switchInput.checked = true);
      }
    }, 200);

    console.log(`[2025-10-15 17:45:23] Add-on modal closed successfully by MathDaenniel`);
  }

  function showUnitSelectionModal() {
    console.log(`[2025-10-15 17:45:23] Opening unit selection modal by MathDaenniel`);

    if (!unitTypeModalOverlay) {
      console.error(`[2025-10-15 17:45:23] Unit modal overlay not found by MathDaenniel`);
      return;
    }

    unitTypeModalOverlay.style.display = 'flex';
    unitTypeModalOverlay.style.visibility = 'visible';
    unitTypeModalOverlay.style.opacity = '0';

    setTimeout(() => {
      unitTypeModalOverlay.classList.add('show');
      unitTypeModalOverlay.style.opacity = '1';
    }, 10);

    console.log(`[2025-10-15 17:45:23] Unit selection modal opened successfully by MathDaenniel`);
  }

  function hideUnitSelectionModal() {
    console.log(`[2025-10-15 17:45:23] Closing unit selection modal by MathDaenniel`);

    if (!unitTypeModalOverlay) return;

    unitTypeModalOverlay.classList.remove('show');
    unitTypeModalOverlay.style.opacity = '0';

    setTimeout(() => {
      unitTypeModalOverlay.style.display = 'none';
      unitTypeModalOverlay.style.visibility = 'hidden';
    }, 200);

    console.log(`[2025-10-15 17:45:23] Unit selection modal closed successfully by MathDaenniel`);
  }

  function showConfirmationModal(action, itemId, itemType) {
    console.log(`[2025-10-15 17:45:23] Opening confirmation modal for ${action} on ${itemType} ${itemId} by MathDaenniel`);

    currentAction = action;
    currentItemId = itemId;
    currentItemType = itemType || 'all';

    if (action === 'bulk_update') {
      confirmationTitle.textContent = 'Update All Changes';
      confirmationMessage.textContent = 'Are you sure you want to update all changes in the tables? This will save all modified item data.';
    } else if (action === 'bulk_delete') {
      confirmationTitle.textContent = 'Delete All Items';
      confirmationMessage.textContent = 'Are you sure you want to DELETE ALL ITEMS? This action cannot be undone and will permanently remove all inventory data from the system.';
    } else {
      // Individual confirmations
      const itemLabel = itemType === 'ingredient' ? 'ingredient' : 'add-on';
      if (action === 'update') {
        confirmationTitle.textContent = `Update ${itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)}`;
        confirmationMessage.textContent = `Are you sure you want to update this ${itemLabel} with the current values`;
      } else if (action === 'delete') {
        confirmationTitle.textContent = `Delete ${itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)}`;
        confirmationMessage.textContent = `Are you sure you want to permanently delete this ${itemLabel}? This action cannot be undone and will remove all ${itemLabel} data.`;
      }
    }

    confirmationModal.style.display = 'flex';
    confirmationModal.style.visibility = 'visible';
    confirmationModal.style.opacity = '0';

    setTimeout(() => {
      confirmationModal.classList.add('show');
      confirmationModal.style.opacity = '1';
    }, 10);

    console.log(`[2025-10-15 17:45:23] Confirmation modal opened for ${action} action by MathDaenniel`);
  }

  function hideConfirmationModal() {
    console.log(`[2025-10-15 17:45:23] Closing confirmation modal by MathDaenniel`);

    if (!confirmationModal) return;

    confirmationModal.classList.remove('show');
    confirmationModal.style.opacity = '0';

    setTimeout(() => {
      confirmationModal.style.display = 'none';
      confirmationModal.style.visibility = 'hidden';
      currentAction = null;
      currentItemId = null;
      currentItemType = null;
    }, 200);
  }

  function handleConfirmationProceed() {
    console.log(`[2025-10-15 17:45:23] Handling confirmation proceed: ${currentAction} for ${currentItemId} by MathDaenniel`);

    hideConfirmationModal();

    if (currentAction === 'bulk_update') {
      handleUpdateAll();
    } else if (currentAction === 'bulk_delete') {
      handleDeleteAll();
    } else if (currentAction === 'update' && currentItemId) {
      handleUpdateItem(currentItemId, currentItemType);
    } else if (currentAction === 'delete' && currentItemId) {
      handleDeleteItem(currentItemId, currentItemType);
    } else {
      console.error(`[2025-10-15 17:45:23] Unknown action: ${currentAction} by MathDaenniel`);
      alert('Error: Unknown action. Please try again.');
    }
  }

  // ===============================================
  // ENHANCED EVENT LISTENERS
  // ===============================================

  if (addItemBtn) {
    addItemBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[2025-10-15 17:45:23] Add item button clicked by MathDaenniel`);
      showTypeSelectionModal();
    });
    console.log(`[2025-10-15 17:45:23] Add item button listener attached by MathDaenniel`);
  } else {
    console.error(`[2025-10-15 17:45:23] Add item button not found by MathDaenniel`);
  }

  // Reset Sort Button Event Listener
  const resetSortBtn = document.getElementById('resetSortBtn');
  if (resetSortBtn) {
    resetSortBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[2025-10-15 17:45:23] Reset sort button clicked by MathDaenniel`);
      resetSort();
    });
    console.log(`[2025-10-15 17:45:23] Reset sort button listener attached by MathDaenniel`);
  } else {
    console.error(`[2025-10-15 17:45:23] Reset sort button not found by MathDaenniel`);
  }

  if (cancelTypeSelect) {
    cancelTypeSelect.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      hideTypeSelectionModal();
    });
  }

  if (selectIngredientBtn) {
    selectIngredientBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      selectedItemType = 'ingredient';
      hideTypeSelectionModal();
      setTimeout(() => showUnitSelectionModal(), 100);
      console.log(`[2025-10-15 17:45:23] Ingredient selected from type modal, showing unit selection by MathDaenniel`);
    });
  }

  if (selectAddonBtn) {
    selectAddonBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      selectedItemType = 'addon';
      hideTypeSelectionModal();
      setTimeout(() => showUnitSelectionModal(), 100);
      console.log(`[2025-10-15 17:45:23] Add-on selected from type modal, showing unit selection by MathDaenniel`);
    });
  }

  // Unit selection modal listeners
  if (cancelUnitSelect) {
    cancelUnitSelect.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      hideUnitSelectionModal();
    });
  }

  if (selectGramsBtn) {
    selectGramsBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[2025-10-15 17:45:23] Grams selected, selectedItemType: ${selectedItemType} by MathDaenniel`);

      // Hide unit selection modal
      hideUnitSelectionModal();

      // Set unit and show appropriate modal
      if (selectedItemType === 'ingredient') {
        const unitField = ingredientModalOverlay.querySelector('select[name="Unit"]');
        if (unitField) {
          unitField.value = 'g';
          console.log(`[2025-10-15 17:45:23] Set unit to grams in ingredient form, showing modal by MathDaenniel`);
          showIngredientModal();
        } else {
          console.error(`[2025-10-15 17:45:23] Could not find Unit field in ingredient modal by MathDaenniel`);
        }
      } else if (selectedItemType === 'addon') {
        const unitField = addonModalOverlay.querySelector('select[name="Unit"]');
        if (unitField) {
          unitField.value = 'g';
          console.log(`[2025-10-15 17:45:23] Set unit to grams in addon form, showing modal by MathDaenniel`);
          showAddonModal();
        } else {
          console.error(`[2025-10-15 17:45:23] Could not find Unit field in addon modal by MathDaenniel`);
        }
      } else {
        console.error(`[2025-10-15 17:45:23] Invalid selectedItemType: ${selectedItemType}, cannot show modal by MathDaenniel`);
      }
    });
  }

  if (selectMilliLitersBtn) {
    selectMilliLitersBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[2025-10-15 17:45:23] MilliLiters selected, selectedItemType: ${selectedItemType} by MathDaenniel`);

      // Hide unit selection modal
      hideUnitSelectionModal();

      // Set unit and show appropriate modal
      if (selectedItemType === 'ingredient') {
        const unitField = ingredientModalOverlay.querySelector('select[name="Unit"]');
        if (unitField) {
          unitField.value = 'mL';
          console.log(`[2025-10-15 17:45:23] Set unit to mL in ingredient form, showing modal by MathDaenniel`);
          showIngredientModal();
        } else {
          console.error(`[2025-10-15 17:45:23] Could not find Unit field in ingredient modal by MathDaenniel`);
        }
      } else if (selectedItemType === 'addon') {
        const unitField = addonModalOverlay.querySelector('select[name="Unit"]');
        if (unitField) {
          unitField.value = 'mL';
          console.log(`[2025-10-15 17:45:23] Set unit to mL in addon form, showing modal by MathDaenniel`);
          showAddonModal();
        } else {
          console.error(`[2025-10-15 17:45:23] Could not find Unit field in addon modal by MathDaenniel`);
        }
      } else {
        console.error(`[2025-10-15 17:45:23] Invalid selectedItemType: ${selectedItemType}, cannot show modal by MathDaenniel`);
      }
    });
  }

  // Event listeners for close and cancel buttons of add modals
  if (closeIngredientModal) {
    closeIngredientModal.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      hideIngredientModal();
    });
  }

  if (cancelIngredientModal) {
    cancelIngredientModal.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      hideIngredientModal();
    });
  }

  if (closeAddonModal) {
    closeAddonModal.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      hideAddonModal();
    });
  }

  if (cancelAddonModal) {
    cancelAddonModal.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      hideAddonModal();
    });
  }

  if (confirmCancel) {
    confirmCancel.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[2025-10-15 17:45:23] Confirmation cancelled by MathDaenniel`);
      hideConfirmationModal();
    });
  }

  if (confirmProceed) {
    confirmProceed.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[2025-10-15 17:45:23] Confirmation proceed clicked: ${currentAction} for ${currentItemId} by MathDaenniel`);
      handleConfirmationProceed();
    });
  }

  // Close modals on overlay click
  if (unitTypeModalOverlay) {
    unitTypeModalOverlay.addEventListener('click', function(e) {
      if (e.target === unitTypeModalOverlay) {
        hideUnitSelectionModal();
      }
    });
  }

  if (itemTypeModalOverlay) {
    itemTypeModalOverlay.addEventListener('click', function(e) {
      if (e.target === itemTypeModalOverlay) {
        hideTypeSelectionModal();
      }
    });
  }

  if (ingredientModalOverlay) {
    ingredientModalOverlay.addEventListener('click', function(e) {
      if (e.target === ingredientModalOverlay) {
        hideIngredientModal();
      }
    });
  }

  if (addonModalOverlay) {
    addonModalOverlay.addEventListener('click', function(e) {
      if (e.target === addonModalOverlay) {
        hideAddonModal();
      }
    });
  }

  if (confirmationModal) {
    confirmationModal.addEventListener('click', function(e) {
      if (e.target === confirmationModal) {
        hideConfirmationModal();
      }
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (confirmationModal && confirmationModal.classList.contains('show')) {
        hideConfirmationModal();
      } else if (ingredientModalOverlay && ingredientModalOverlay.classList.contains('show')) {
        hideIngredientModal();
      } else if (addonModalOverlay && addonModalOverlay.classList.contains('show')) {
        hideAddonModal();
      } else if (unitTypeModalOverlay && unitTypeModalOverlay.classList.contains('show')) {
        hideUnitSelectionModal();
      } else if (itemTypeModalOverlay && itemTypeModalOverlay.classList.contains('show')) {
        hideTypeSelectionModal();
      }
    }

    // Enter key for confirmation modal proceed
    if (e.key === 'Enter' && confirmationModal && confirmationModal.classList.contains('show')) {
      e.preventDefault();
      if (confirmProceed) {
        confirmProceed.click();
      }
    }
  });

  // Handle individual update and delete button clicks
  document.addEventListener('click', function(e) {
    const stocksBtn = e.target.closest('.stocks-btn');

    if (stocksBtn) {
      e.preventDefault();
      e.stopPropagation();

      const action = stocksBtn.getAttribute('data-action');
      const itemId = stocksBtn.getAttribute('data-item-id');
      const itemType = stocksBtn.getAttribute('data-type');

      console.log(`Action button clicked:`, { action, itemId, itemType });

      if (!action || !itemId || !itemType) {
        const parentRow = stocksBtn.closest('tr');
        if (parentRow) {
          const fallbackItemId = parentRow.getAttribute('data-item-id');
          const fallbackItemType = parentRow.getAttribute('data-type');

          console.log(`Fallback from row:`, { fallbackItemId, fallbackItemType });

          if (fallbackItemId && fallbackItemType) {
            const fallbackAction = stocksBtn.classList.contains('update') ? 'update' :
                                   stocksBtn.classList.contains('delete') ? 'delete' : null;

            if (fallbackAction) {
              showConfirmationModal(fallbackAction, fallbackItemId, fallbackItemType);
              return;
            }
          }
        }

        console.error('Could not determine action/item details');
        alert('Error: Could not determine the action or item details. Please refresh the page.');
        return;
      }

      showConfirmationModal(action, itemId, itemType);
    }
  });

  // Handle toggle switch changes for instant updates
  document.addEventListener('change', async function(e) {
    if (e.target.type === 'checkbox' && e.target.name === 'isEnabled') {
      const row = e.target.closest('tr');
      if (!row) return;
      
      const itemId = row.getAttribute('data-item-id');
      const itemType = row.getAttribute('data-type');
      
      if (!itemId || !itemType) return;
      
      console.log(`Toggle switch changed for ${itemType} ${itemId}`);
      
      // Get all row data
      let suffix, name, amount, unit, category, allergen, enabled, basePrice;
      
      if (itemType === 'ingredient') {
        suffix = row.querySelector('input[name="IngredientSuffix"]')?.value?.trim();
      } else {
        suffix = row.querySelector('input[name="AddOnSuffix"]')?.value?.trim();
        basePrice = row.querySelector('input[name="BasePrice"]')?.value?.trim() || '10';
      }
      
      name = row.querySelector('input[name="Name"]')?.value?.trim();
      amount = row.querySelector('.amount-pack-group input[name="Amount"]')?.value?.trim();
      unit = row.querySelector('.amount-pack-group select[name="Unit"]')?.value?.trim();
      category = itemType === 'ingredient' ? 'Ingredients' : 'Add-Ons';
      allergen = row.querySelector('input[name="Allergen"]')?.value?.trim() || 'None';
      enabled = e.target.checked ? 'true' : 'false';
      
      if (!suffix || !name || !amount || !unit) {
        showNotification('Cannot update status. Please fill in all required fields first.', 'error');
        e.target.checked = !e.target.checked; // Revert toggle
        return;
      }
      
      const amountPerPack = `${amount} ${unit}`;
      const prefix = itemType === 'ingredient' ? 'ING' : 'AD';
      const fullId = `${prefix}-${suffix}`;
      
      const data = {
        Name: name,
        Amount: amount,
        AmountPerPack: amountPerPack,
        Category: category,
        Allergen: allergen,
        isEnabled: enabled,
        DeductionQuantityGrams: '10'
      };
      
      if (itemType === 'ingredient') {
        data.IngredientID = fullId;
        data.IngredientPrefix = prefix;
        data.IngredientSuffix = suffix;
      } else {
        data.AddOnID = fullId;
        data.AddOnPrefix = prefix;
        data.AddOnSuffix = suffix;
        data.BasePrice = parseInt(basePrice, 10) || 10;
      }
      
      const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
      
      try {
        const response = await fetch(`${basePath}/stocks/edit/${itemId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(data)
        });
        
        if (response.ok) {
          // Update original value
          e.target.setAttribute('data-original', enabled);
          
          triggerDashboardRefresh();
          showNotification(`${itemType === 'ingredient' ? 'Ingredient' : 'Add-on'} ${enabled === 'true' ? 'enabled' : 'disabled'} successfully!`, 'success');
          console.log(`\u2705 Toggle updated successfully`);
        } else {
          showNotification('Failed to update status. Please try again.', 'error');
          e.target.checked = !e.target.checked; // Revert toggle
        }
      } catch (error) {
        console.error('Error updating toggle:', error);
        showNotification('Error updating status. Please try again.', 'error');
        e.target.checked = !e.target.checked; // Revert toggle
      }
    }
  });

  // ===============================================
  // FORM VALIDATION AND PROCESSING
  // ===============================================

  function validateIngredientForm(form) {
    console.log(`[2025-10-15 17:45:23] Validating ingredient form by MathDaenniel`);

    const suffix = form.querySelector('input[name="IngredientSuffix"]');
    const name = form.querySelector('input[name="Name"]');
    const amount = form.querySelector('input[name="Amount"]');
    const unit = form.querySelector('select[name="Unit"]');
    const allergen = form.querySelector('input[name="Allergen"]');

    if (!suffix || !suffix.value.trim()) {
      alert('Please enter an ingredient ID suffix');
      if (suffix) suffix.focus();
      return false;
    }

    if (!name || !name.value.trim()) {
      alert('Please enter an ingredient name');
      if (name) name.focus();
      return false;
    }

    if (!allergen || !allergen.value.trim()) {
      alert('Please enter allergen information');
      if (allergen) allergen.focus();
      return false;
    }

    if (!amount || amount.value === '' || parseFloat(amount.value) < 0) {
      alert('Please enter a valid amount (0 or more)');
      if (amount) amount.focus();
      return false;
    }

    if (!unit || !unit.value || (unit.value !== 'g' && unit.value !== 'mL')) {
      alert('Please select a valid unit (g or mL)');
      if (unit) unit.focus();
      return false;
    }

    // Check for existing ingredient with same ID and name
    const fullId = `ING-${suffix.value.trim()}`;
    const nameValue = name.value.trim();
    const existingIngredient = ingredientRowsData.find(row =>
      row.itemId === `${fullId}_${nameValue}` ||
      (row.name.toLowerCase() === nameValue.toLowerCase() &&
       row.row.querySelector('input[name="IngredientSuffix"]').getAttribute('data-original') === suffix.value.trim())
    );

    if (existingIngredient) {
      alert('An ingredient with this ID and name already exists. Please choose a different ID or name.');
      if (suffix) suffix.focus();
      return false;
    }

    console.log(`[2025-10-15 17:45:23] Ingredient form validation passed by MathDaenniel`);
    return true;
  }

  function validateAddonForm(form) {
    console.log(`[2025-10-15 17:45:23] Validating add-on form by MathDaenniel`);

    const suffix = form.querySelector('input[name="AddOnSuffix"]');
    const name = form.querySelector('input[name="Name"]');
    const amount = form.querySelector('input[name="Amount"]');
    const unit = form.querySelector('select[name="Unit"]');
    const allergen = form.querySelector('input[name="Allergen"]');

    if (!suffix || !suffix.value.trim()) {
      alert('Please enter an add-on ID suffix');
      if (suffix) suffix.focus();
      return false;
    }

    if (!name || !name.value.trim()) {
      alert('Please enter an add-on name');
      if (name) name.focus();
      return false;
    }

    if (!allergen || !allergen.value.trim()) {
      alert('Please enter allergen information');
      if (allergen) allergen.focus();
      return false;
    }

    if (!amount || amount.value === '' || parseFloat(amount.value) < 0) {
      alert('Please enter a valid amount (0 or more)');
      if (amount) amount.focus();
      return false;
    }

    if (!unit || !unit.value || (unit.value !== 'g' && unit.value !== 'mL')) {
      alert('Please select a valid unit (g or mL)');
      if (unit) unit.focus();
      return false;
    }

    // Check for existing add-on with same ID and name
    const fullId = `AD-${suffix.value.trim()}`;
    const nameValue = name.value.trim();
    const existingAddon = addonRowsData.find(row =>
      row.itemId === `${fullId}_${nameValue}` ||
      (row.name.toLowerCase() === nameValue.toLowerCase() &&
       row.row.querySelector('input[name="AddOnSuffix"]').getAttribute('data-original') === suffix.value.trim())
    );

    if (existingAddon) {
      alert('An add-on with this ID and name already exists. Please choose a different ID or name.');
      if (suffix) suffix.focus();
      return false;
    }

    console.log(`[2025-10-15 17:45:23] Add-on form validation passed by MathDaenniel`);
    return true;
  }

  // Form processing for ingredient modal
  const ingredientModalForm = ingredientModalOverlay?.querySelector('.stocks-form-vertical');
  if (ingredientModalForm) {
    ingredientModalForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      console.log(`[2025-10-15 17:45:23] Ingredient form submission by MathDaenniel`);

      if (!validateIngredientForm(ingredientModalForm)) {
        return;
      }

      const prefix = 'ING';
      const suffix = ingredientModalForm.querySelector('input[name="IngredientSuffix"]').value.trim();
      const fullId = `${prefix}-${suffix}`;
      
      // Capture isEnabled state early before any form modifications
      const enabledSwitchElement = ingredientModalForm.querySelector('input[name="isEnabledStock"]');
      const isEnabledValue = enabledSwitchElement ? enabledSwitchElement.checked : true;

    // Remove any existing hidden fields first (only remove hidden ones, keep visible form inputs)
    ['IngredientID', 'IngredientPrefix', 'AmountPerPack', 'Category', 'isAvailable', 'isEnabled', 'DeductionQuantityGrams'].forEach(fieldName => {
      const existing = ingredientModalForm.querySelector(`input[name="${fieldName}"][type="hidden"]`);
      if (existing) existing.remove();
    });

      // Add IngredientID (derived field)
      const hiddenIngredientID = document.createElement('input');
      hiddenIngredientID.type = 'hidden';
      hiddenIngredientID.name = 'IngredientID';
      hiddenIngredientID.value = fullId;
      ingredientModalForm.appendChild(hiddenIngredientID);

      // Add IngredientPrefix (derived field)
      const hiddenIngredientPrefix = document.createElement('input');
      hiddenIngredientPrefix.type = 'hidden';
      hiddenIngredientPrefix.name = 'IngredientPrefix';
      hiddenIngredientPrefix.value = prefix;
      ingredientModalForm.appendChild(hiddenIngredientPrefix);

      // Get values from existing visible form fields
      const amount = ingredientModalForm.querySelector('input[name="Amount"]').value.trim();
      const unit = ingredientModalForm.querySelector('select[name="Unit"]').value;
      const amountPerPack = `${amount} ${unit}`;

      // Add AmountPerPack (derived field)
      const hiddenAmountPerPack = document.createElement('input');
      hiddenAmountPerPack.type = 'hidden';
      hiddenAmountPerPack.name = 'AmountPerPack';
      hiddenAmountPerPack.value = amountPerPack;
      ingredientModalForm.appendChild(hiddenAmountPerPack);

      // Add Category
      const hiddenCategory = document.createElement('input');
      hiddenCategory.type = 'hidden';
      hiddenCategory.name = 'Category';
      hiddenCategory.value = 'Ingredients';
      ingredientModalForm.appendChild(hiddenCategory);

      // Add isAvailable
      const hiddenIsAvailable = document.createElement('input');
      hiddenIsAvailable.type = 'hidden';
      hiddenIsAvailable.name = 'isAvailable';
      hiddenIsAvailable.value = 'true';
      ingredientModalForm.appendChild(hiddenIsAvailable);

      // Handle isEnabled switch
      const enabledSwitch = ingredientModalForm.querySelector('input[name="isEnabledStock"]');
      if (enabledSwitch) {
        const newHiddenEnabled = document.createElement('input');
        newHiddenEnabled.type = 'hidden';
        newHiddenEnabled.name = 'isEnabled';
        newHiddenEnabled.value = enabledSwitch.checked ? 'true' : 'false';
        ingredientModalForm.appendChild(newHiddenEnabled);

        enabledSwitch.removeAttribute('name');
      }

      // Add DeductionQuantityGrams
      const hiddenDeductionQuantityGrams = document.createElement('input');
      hiddenDeductionQuantityGrams.type = 'hidden';
      hiddenDeductionQuantityGrams.name = 'DeductionQuantityGrams';
      hiddenDeductionQuantityGrams.value = '10';
      ingredientModalForm.appendChild(hiddenDeductionQuantityGrams);

      console.log(`[2025-10-15 17:45:23] Adding new ingredient with ID: ${fullId}, AmountPerPack: ${amountPerPack}, Amount: ${amount}, Unit: ${unit} by MathDaenniel`);
      
      // Submit via AJAX - Convert FormData to JSON for proper parsing
      const formData = new FormData(ingredientModalForm);
      const jsonData = {};
      formData.forEach((value, key) => {
        jsonData[key] = value;
      });
      const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
      
      try {
        const response = await fetch(`${basePath}/stocks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(jsonData)
        });
        
        if (response.ok) {
          // Add new row to table immediately
          const tbody = document.querySelector('#ingredientTableContainer table tbody');
          const newRow = createIngredientRow({
            _id: 'temp_' + Date.now(),
            IngredientID: fullId,
            IngredientSuffix: suffix,
            Name: ingredientModalForm.querySelector('input[name="Name"]').value.trim(),
            Amount: parseInt(amount),
            AmountPerPack: amountPerPack,
            Unit: unit,
            Allergen: ingredientModalForm.querySelector('input[name="Allergen"]').value.trim(),
            isEnabled: isEnabledValue
          });
          
          // Remove "No ingredients found" row if it exists
          const noDataRow = tbody.querySelector('td[colspan]');
          if (noDataRow) {
            noDataRow.parentElement.remove();
          }
          
          tbody.insertBefore(newRow, tbody.firstChild);
          
          // Close modal and reset form
          hideIngredientModal();
          ingredientModalForm.reset();
          
          // Trigger dashboard refresh
          triggerDashboardRefresh();
          
          // Reinitialize row data
          initializeRowsData();
          
          showNotification('Ingredient added successfully!', 'success');
          console.log('✅ Ingredient added successfully');
        } else {
          showNotification('Failed to add ingredient. Please try again.', 'error');
        }
      } catch (error) {
        console.error('Error adding ingredient:', error);
        showNotification('Error adding ingredient. Please try again.', 'error');
      }
    });
  }

  // Form processing for add-on modal
  const addonModalForm = addonModalOverlay?.querySelector('.stocks-form-vertical');
  if (addonModalForm) {
    addonModalForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      console.log(`[2025-10-15 17:45:23] Add-on form submission by MathDaenniel`);

      if (!validateAddonForm(addonModalForm)) {
        console.log(`[2025-10-15 17:45:23] Add-on form validation failed, preventing submission by MathDaenniel`);
        return;
      }

      const prefix = 'AD';
      const suffix = addonModalForm.querySelector('input[name="AddOnSuffix"]').value.trim();
      const fullId = `${prefix}-${suffix}`;
      
      // Capture isEnabled state early before any form modifications
      const enabledSwitchElement = addonModalForm.querySelector('input[name="isEnabledStock"]');
      const isEnabledValue = enabledSwitchElement ? enabledSwitchElement.checked : true;

      // Remove any existing hidden fields first (only remove hidden ones, keep visible form inputs)
      ['AddOnID', 'AddOnPrefix', 'AmountPerPack', 'Category', 'BasePrice', 'isEnabled', 'DeductionQuantityGrams'].forEach(fieldName => {
        const existing = addonModalForm.querySelector(`input[name="${fieldName}"][type="hidden"]`);
        if (existing) existing.remove();
      });

      // Add AddOnID (derived field)
      const hiddenAddOnID = document.createElement('input');
      hiddenAddOnID.type = 'hidden';
      hiddenAddOnID.name = 'AddOnID';
      hiddenAddOnID.value = fullId;
      addonModalForm.appendChild(hiddenAddOnID);

      // Add AddOnPrefix (derived field)
      const hiddenAddOnPrefix = document.createElement('input');
      hiddenAddOnPrefix.type = 'hidden';
      hiddenAddOnPrefix.name = 'AddOnPrefix';
      hiddenAddOnPrefix.value = prefix;
      addonModalForm.appendChild(hiddenAddOnPrefix);

      // Get values from existing visible form fields
      const amount = addonModalForm.querySelector('input[name="Amount"]').value.trim();
      const unit = addonModalForm.querySelector('select[name="Unit"]').value;
      const basePrice = addonModalForm.querySelector('input[name="BasePrice"]')?.value?.trim() || '10';
      const amountPerPack = `${amount} ${unit}`;

      // Add AmountPerPack (derived field)
      const hiddenAmountPerPack = document.createElement('input');
      hiddenAmountPerPack.type = 'hidden';
      hiddenAmountPerPack.name = 'AmountPerPack';
      hiddenAmountPerPack.value = amountPerPack;
      addonModalForm.appendChild(hiddenAmountPerPack);

      // Add Category
      const hiddenCategory = document.createElement('input');
      hiddenCategory.type = 'hidden';
      hiddenCategory.name = 'Category';
      hiddenCategory.value = 'Add-Ons';
      addonModalForm.appendChild(hiddenCategory);

      // Add BasePrice - get it from the form field
      const hiddenBasePrice = document.createElement('input');
      hiddenBasePrice.type = 'hidden';
      hiddenBasePrice.name = 'BasePrice';
      hiddenBasePrice.value = parseInt(basePrice, 10) || 10;
      addonModalForm.appendChild(hiddenBasePrice);

      // Handle isEnabled switch
      const enabledSwitch = addonModalForm.querySelector('input[name="isEnabledStock"]');
      if (enabledSwitch) {
        const newHiddenEnabled = document.createElement('input');
        newHiddenEnabled.type = 'hidden';
        newHiddenEnabled.name = 'isEnabled';
        newHiddenEnabled.value = enabledSwitch.checked ? 'true' : 'false';
        addonModalForm.appendChild(newHiddenEnabled);

        enabledSwitch.removeAttribute('name');
      }

      // Add DeductionQuantityGrams
      const hiddenDeductionQuantityGrams = document.createElement('input');
      hiddenDeductionQuantityGrams.type = 'hidden';
      hiddenDeductionQuantityGrams.name = 'DeductionQuantityGrams';
      hiddenDeductionQuantityGrams.value = '10';
      addonModalForm.appendChild(hiddenDeductionQuantityGrams);

      console.log(`[2025-10-15 17:45:23] Adding new add-on with ID: ${fullId}, AmountPerPack: ${amountPerPack}, BasePrice: ${basePrice} by MathDaenniel`);
      
      // Submit via AJAX - Convert FormData to JSON for proper parsing
      const formData = new FormData(addonModalForm);
      const jsonData = {};
      formData.forEach((value, key) => {
        jsonData[key] = value;
      });
      // Ensure BasePrice is an integer
      if (jsonData.BasePrice) {
        jsonData.BasePrice = parseInt(jsonData.BasePrice, 10) || 10;
      }
      const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
      
      try {
        const response = await fetch(`${basePath}/stocks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(jsonData)
        });
        
        if (response.ok) {
          // Add new row to table immediately
          const tbody = document.querySelector('#addonTableContainer table tbody');
          const newRow = createAddonRow({
            _id: 'temp_' + Date.now(),
            AddOnID: fullId,
            AddOnSuffix: suffix,
            Name: addonModalForm.querySelector('input[name="Name"]').value.trim(),
            Amount: parseInt(amount),
            AmountPerPack: amountPerPack,
            Unit: unit,
            Allergen: addonModalForm.querySelector('input[name="Allergen"]')?.value?.trim() || 'None',
            isEnabled: isEnabledValue
          });
          
          // Remove "No add-ons found" row if it exists
          const noDataRow = tbody.querySelector('td[colspan]');
          if (noDataRow) {
            noDataRow.parentElement.remove();
          }
          
          tbody.insertBefore(newRow, tbody.firstChild);
          
          // Close modal and reset form
          hideAddonModal();
          addonModalForm.reset();
          
          // Trigger dashboard refresh
          triggerDashboardRefresh();
          
          // Reinitialize row data
          initializeRowsData();
          
          showNotification('Add-on added successfully!', 'success');
          console.log('✅ Add-on added successfully');
        } else {
          showNotification('Failed to add add-on. Please try again.', 'error');
        }
      } catch (error) {
        console.error('Error adding add-on:', error);
        showNotification('Error adding add-on. Please try again.', 'error');
      }
    });
  }

  // ===============================================
  // SEARCH, FILTER AND SORT FUNCTIONS - FIXED
  // ===============================================

  // Search and filter functionality variables
  let ingredientSearchText = '';
  let ingredientSortMode = 'default';
  let ingredientRowsData = [];
  let ingredientFilteredData = [];

  let addonSearchText = '';
  let addonSortMode = 'default';
  let addonRowsData = [];
  let addonFilteredData = [];
  
  function initializeRowsData() {
    ingredientRowsData = [];
    addonRowsData = [];
    
    const allTables = document.querySelectorAll('table.stocks-table');
    const ingredientTableBody = allTables[0]?.querySelector('tbody');
    const addonTableBody = allTables[1]?.querySelector('tbody');
    
    if (ingredientTableBody) {
      const ingredientRows = ingredientTableBody.querySelectorAll('tr[data-item-id][data-type="ingredient"]');
      ingredientRows.forEach(row => {
        const nameInput = row.querySelector('input[name="Name"]');
        if (!nameInput) return;
        
        const itemName = nameInput.getAttribute("data-original") || nameInput.value || "";
        const clonedRow = row.cloneNode(true);
        const itemId = row.getAttribute('data-item-id');
        const itemType = row.getAttribute('data-type');
        
        clonedRow.setAttribute('data-item-id', itemId);
        clonedRow.setAttribute('data-type', itemType);
        
        ingredientRowsData.push({
          name: itemName.toLowerCase(),
          displayName: itemName,
          itemId: itemId,
          itemType: itemType,
          row: clonedRow
        });
      });
      ingredientFilteredData = [...ingredientRowsData];
    }
    
    if (addonTableBody) {
      const addonRows = addonTableBody.querySelectorAll('tr[data-item-id][data-type="addon"]');
      addonRows.forEach(row => {
        const nameInput = row.querySelector('input[name="Name"]');
        if (!nameInput) return;
        
        const itemName = nameInput.getAttribute("data-original") || nameInput.value || "";
        const clonedRow = row.cloneNode(true);
        const itemId = row.getAttribute('data-item-id');
        const itemType = row.getAttribute('data-type');
        
        clonedRow.setAttribute('data-item-id', itemId);
        clonedRow.setAttribute('data-type', itemType);
        
        addonRowsData.push({
          name: itemName.toLowerCase(),
          displayName: itemName,
          itemId: itemId,
          itemType: itemType,
          row: clonedRow
        });
      });
      addonFilteredData = [...addonRowsData];
    }
  }

  const ingredientCounter = document.createElement("div");
  ingredientCounter.className = "results-counter";
  ingredientCounter.id = "ingredientResultsCounter";

  const addonCounter = document.createElement("div");
  addonCounter.className = "results-counter";
  addonCounter.id = "addonResultsCounter";

  function initializeSearchAndFilter() {
    try {
      const ingredientSearchInput = document.getElementById("ingredientSearchInput");
      const addonSearchInput = document.getElementById("addonSearchInput");

      const ingredientSortButtons = document.querySelectorAll(".sort-btn.ingredient-sort");
      const addonSortButtons = document.querySelectorAll(".sort-btn.addon-sort");

      const ingredientTableContainer = document.getElementById("ingredientTableContainer");
      const addonTableContainer = document.getElementById("addonTableContainer");

      if (!ingredientSearchInput || !addonSearchInput) {
        console.error("Search inputs not found");
        return;
      }

      if (ingredientTableContainer) {
        ingredientTableContainer.appendChild(ingredientCounter);
      }

      if (addonTableContainer) {
        addonTableContainer.appendChild(addonCounter);
      }

      const allTables = document.querySelectorAll('table.stocks-table');
      const ingredientTableBody = allTables[0]?.querySelector('tbody');
      const addonTableBody = allTables[1]?.querySelector('tbody');

      if (ingredientTableBody) {
        const ingredientRows = ingredientTableBody.querySelectorAll('tr[data-item-id][data-type="ingredient"]');

        ingredientRows.forEach(row => {
          const nameInput = row.querySelector('input[name="Name"]');
          if (!nameInput) return;

          const itemName = nameInput.getAttribute("data-original") || nameInput.value || "";
          const clonedRow = row.cloneNode(true);

          const itemId = row.getAttribute('data-item-id');
          const itemType = row.getAttribute('data-type');

          clonedRow.setAttribute('data-item-id', itemId);
          clonedRow.setAttribute('data-type', itemType);

          const updateBtn = clonedRow.querySelector('.stocks-btn.update');
          const deleteBtn = clonedRow.querySelector('.stocks-btn.delete');

          if (updateBtn) {
            updateBtn.setAttribute('data-action', 'update');
            updateBtn.setAttribute('data-item-id', itemId);
            updateBtn.setAttribute('data-type', itemType);
          }

          if (deleteBtn) {
            deleteBtn.setAttribute('data-action', 'delete');
            deleteBtn.setAttribute('data-item-id', itemId);
            deleteBtn.setAttribute('data-type', itemType);
          }

          ingredientRowsData.push({
            name: itemName.toLowerCase(),
            displayName: itemName,
            itemId: itemId,
            itemType: itemType,
            row: clonedRow
          });
        });

        ingredientFilteredData = [...ingredientRowsData];
      }

      if (addonTableBody) {
        const addonRows = addonTableBody.querySelectorAll('tr[data-item-id][data-type="addon"]');

        addonRows.forEach(row => {
          const nameInput = row.querySelector('input[name="Name"]');
          if (!nameInput) return;

          const itemName = nameInput.getAttribute("data-original") || nameInput.value || "";
          const clonedRow = row.cloneNode(true);

          const itemId = row.getAttribute('data-item-id');
          const itemType = row.getAttribute('data-type');

          clonedRow.setAttribute('data-item-id', itemId);
          clonedRow.setAttribute('data-type', itemType);

          const updateBtn = clonedRow.querySelector('.stocks-btn.update');
          const deleteBtn = clonedRow.querySelector('.stocks-btn.delete');

          if (updateBtn) {
            updateBtn.setAttribute('data-action', 'update');
            updateBtn.setAttribute('data-item-id', itemId);
            updateBtn.setAttribute('data-type', itemType);
          }

          if (deleteBtn) {
            deleteBtn.setAttribute('data-action', 'delete');
            deleteBtn.setAttribute('data-item-id', itemId);
            deleteBtn.setAttribute('data-type', itemType);
          }

          addonRowsData.push({
            name: itemName.toLowerCase(),
            displayName: itemName,
            itemId: itemId,
            itemType: itemType,
            row: clonedRow
          });
        });

        addonFilteredData = [...addonRowsData];
      }

      ingredientSearchInput.addEventListener("input", function(e) {
        ingredientSearchText = e.target.value.toLowerCase().trim();
        processIngredientTable();
      });

      addonSearchInput.addEventListener("input", function(e) {
        addonSearchText = e.target.value.toLowerCase().trim();
        processAddonTable();
      });

      ingredientSortButtons.forEach((button) => {
        button.addEventListener("click", function(e) {
          e.preventDefault();
          e.stopPropagation();

          const sortMode = this.getAttribute("data-sort");

          ingredientSortButtons.forEach(btn => btn.classList.remove("active"));
          this.classList.add("active");

          ingredientSortMode = sortMode;
          processIngredientTable();
        });
      });

      addonSortButtons.forEach((button) => {
        button.addEventListener("click", function(e) {
          e.preventDefault();
          e.stopPropagation();

          const sortMode = this.getAttribute("data-sort");

          addonSortButtons.forEach(btn => btn.classList.remove("active"));
          this.classList.add("active");

          addonSortMode = sortMode;
          processAddonTable();
        });
      });

    } catch (error) {
      console.error("Initialization error:", error);
    }
  }

  function processIngredientTable() {
    try {
      let filtered = ingredientRowsData.filter(rowData => {
        if (ingredientSearchText === "") return true;
        return rowData.name.includes(ingredientSearchText);
      });

      if (ingredientSortMode === "a-z") {
        filtered.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
      } else if (ingredientSortMode === "z-a") {
        filtered.sort((a, b) => b.name.localeCompare(a.name, 'en', { sensitivity: 'base' }));
      }

      ingredientFilteredData = filtered;
      refreshIngredientTable();
      updateIngredientCounter();

    } catch (error) {
      console.error("Ingredient processing error:", error);
    }
  }

  function processAddonTable() {
    try {
      let filtered = addonRowsData.filter(rowData => {
        if (addonSearchText === "") return true;
        return rowData.name.includes(addonSearchText);
      });

      if (addonSortMode === "a-z") {
        filtered.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
      } else if (addonSortMode === "z-a") {
        filtered.sort((a, b) => b.name.localeCompare(a.name, 'en', { sensitivity: 'base' }));
      }

      addonFilteredData = filtered;
      refreshAddonTable();
      updateAddonCounter();

    } catch (error) {
      console.error("Add-on processing error:", error);
    }
  }

  function refreshIngredientTable() {
    try {
      const ingredientTableBody = document.querySelector('table.stocks-table:first-of-type tbody');
      if (!ingredientTableBody) return;

      const existingRows = ingredientTableBody.querySelectorAll('tr');
      existingRows.forEach(row => {
        if (!row.innerHTML.includes('No ingredients')) {
          row.remove();
        }
      });

      ingredientFilteredData.forEach((rowData) => {
        const clonedRow = rowData.row.cloneNode(true);

        const itemId = clonedRow.getAttribute('data-item-id');
        const itemType = clonedRow.getAttribute('data-type');

        const updateBtn = clonedRow.querySelector('.stocks-btn.update');
        const deleteBtn = clonedRow.querySelector('.stocks-btn.delete');

        if (updateBtn && itemId && itemType) {
          updateBtn.setAttribute('data-action', 'update');
          updateBtn.setAttribute('data-item-id', itemId);
          updateBtn.setAttribute('data-type', itemType);
        }

        if (deleteBtn && itemId && itemType) {
          deleteBtn.setAttribute('data-action', 'delete');
          deleteBtn.setAttribute('data-item-id', itemId);
          deleteBtn.setAttribute('data-type', itemType);
        }

        ingredientTableBody.appendChild(clonedRow);
      });

      const noDataRow = ingredientTableBody.querySelector('tr td[colspan]');
      if (noDataRow) {
        noDataRow.parentElement.style.display = ingredientFilteredData.length > 0 ? 'none' : 'table-row';
      }

    } catch (error) {
      console.error("Ingredient table refresh error:", error);
    }
  }

  function refreshAddonTable() {
    try {
      const allTables = document.querySelectorAll('table.stocks-table');
      const addonTableBody = allTables[1]?.querySelector('tbody');

      if (!addonTableBody) return;

      const existingRows = addonTableBody.querySelectorAll('tr');
      existingRows.forEach(row => {
        if (!row.innerHTML.includes('No add-ons')) {
          row.remove();
        }
      });

      addonFilteredData.forEach((rowData) => {
        const clonedRow = rowData.row.cloneNode(true);

        const itemId = clonedRow.getAttribute('data-item-id');
        const itemType = clonedRow.getAttribute('data-type');

        const updateBtn = clonedRow.querySelector('.stocks-btn.update');
        const deleteBtn = clonedRow.querySelector('.stocks-btn.delete');

        if (updateBtn && itemId && itemType) {
          updateBtn.setAttribute('data-action', 'update');
          updateBtn.setAttribute('data-item-id', itemId);
          updateBtn.setAttribute('data-type', itemType);
        }

        if (deleteBtn && itemId && itemType) {
          deleteBtn.setAttribute('data-action', 'delete');
          deleteBtn.setAttribute('data-item-id', itemId);
          deleteBtn.setAttribute('data-type', itemType);
        }

        addonTableBody.appendChild(clonedRow);
      });

      const noDataRow = addonTableBody.querySelector('tr td[colspan]');
      if (noDataRow) {
        noDataRow.parentElement.style.display = addonFilteredData.length > 0 ? 'none' : 'table-row';
      }

    } catch (error) {
      console.error("Add-on table refresh error:", error);
    }
  }

  function updateIngredientCounter() {
    try {
      if (!ingredientCounter) return;

      const total = ingredientRowsData.length;
      const showing = ingredientFilteredData.length;

      if (showing === total && ingredientSearchText === "" && ingredientSortMode === "default") {
        ingredientCounter.textContent = "";
        ingredientCounter.style.display = "none";
      } else {
        ingredientCounter.textContent = `Showing ${showing} of ${total} ingredients`;
        if (ingredientSearchText) {
          ingredientCounter.textContent += ` (search: "${ingredientSearchText}")`;
        }
        if (ingredientSortMode !== "default") {
          ingredientCounter.textContent += ` (sorted: ${ingredientSortMode.toUpperCase()})`;
        }
        ingredientCounter.style.display = "block";
      }

    } catch (error) {
      console.error("Ingredient counter error:", error);
    }
  }

  function updateAddonCounter() {
    try {
      if (!addonCounter) return;

      const total = addonRowsData.length;
      const showing = addonFilteredData.length;

      if (showing === total && addonSearchText === "" && addonSortMode === "default") {
        addonCounter.textContent = "";
        addonCounter.style.display = "none";
      } else {
        addonCounter.textContent = `Showing ${showing} of ${total} add-ons`;
        if (addonSearchText) {
          addonCounter.textContent += ` (search: "${addonSearchText}")`;
        }
        if (addonSortMode !== "default") {
          addonCounter.textContent += ` (sorted: ${addonSortMode.toUpperCase()})`;
        }
        addonCounter.style.display = "block";
      }

    } catch (error) {
      console.error("Add-on counter error:", error);
    }
  }

 

  // ===============================================
  // BULK ACTIONS - UPDATE AND DELETE
  // ===============================================

  function handleUpdateAll() {
    console.log(`[2025-10-15 17:45:23] Handling bulk update by MathDaenniel`);

    const allRowsWithChanges = [];
    const allRows = [...document.querySelectorAll('table.stocks-table tr[data-item-id]')];

    if (allRows.length === 0) {
      alert('No items found to update.');
      return;
    }

    allRows.forEach(row => {
      const itemId = row.getAttribute('data-item-id');
      const itemType = row.getAttribute('data-type');

      const inputs = row.querySelectorAll('.table-input');
      let hasChanges = false;

      inputs.forEach(input => {
        const originalValue = input.getAttribute('data-original');
        const currentValue = input.value || input.options?.[input.selectedIndex]?.value;

        if (originalValue !== currentValue) {
          hasChanges = true;
        }
      });

      if (hasChanges) {
        allRowsWithChanges.push({ itemId, itemType, row });
      }
    });

    if (allRowsWithChanges.length === 0) {
      alert('No changes detected to update.');
      return;
    }

    console.log(`[2025-10-15 17:45:23] Found ${allRowsWithChanges.length} items to update by MathDaenniel`);

    const updatePromises = allRowsWithChanges.map(({ itemId, itemType, row }) =>
      handleIndividualUpdate(itemId, itemType, row, true)
    );

    Promise.allSettled(updatePromises).then(results => {
      const successful = results.filter(result => result.status === 'fulfilled' && result.value).length;
      const failed = results.filter(result => result.status === 'rejected' || !result.value).length;

      console.log(`[2025-10-15 17:45:23] Bulk update results: ${successful} success, ${failed} failed by MathDaenniel`);

      if (successful > 0) {
        // Trigger dashboard refresh for low stock updates
        triggerDashboardRefresh();
      }

      setTimeout(() => {
        if (successful > 0) {
          window.location.href = '/admin/stocks?msg=bulk_update_success';
        } else {
          alert('No items were updated. Please check for errors.');
        }
      }, 2000);
    });
  }

  function handleDeleteAll() {
    console.log(`[2025-10-15 17:45:23] Handling bulk delete by MathDaenniel`);

    const allRows = [...document.querySelectorAll('table.stocks-table tr[data-item-id]')];
    if (allRows.length === 0) {
      alert('No items found to delete.');
      return;
    }

    const deletePromises = allRows.map(row => {
      const itemId = row.getAttribute('data-item-id');
      const itemType = row.getAttribute('data-type');

      return handleIndividualDelete(itemId, itemType, true);
    });

    Promise.allSettled(deletePromises).then(results => {
      const successful = results.filter(result => result.status === 'fulfilled' && result.value).length;
      const failed = results.filter(result => result.status === 'rejected' || !result.value).length;

      console.log(`[2025-10-15 17:45:23] Bulk delete results: ${successful} success, ${failed} failed by MathDaenniel`);

      if (successful > 0) {
        // Trigger dashboard refresh for low stock updates after deletion
        triggerDashboardRefresh();
      }

      setTimeout(() => {
        if (successful > 0) {
          window.location.href = '/admin/stocks?msg=bulk_delete_success';
        } else {
          alert('No items were deleted. Please check for errors.');
        }
      }, 2000);
    });
  }

  async function handleUpdateItem(itemId, itemType) {
    console.log(`[2025-10-15 17:45:23] Handling individual update: ${itemId} (${itemType}) by MathDaenniel`);

    const row = document.querySelector(`tr[data-item-id="${itemId}"][data-type="${itemType}"]`);
    if (!row) {
      alert('Error: Could not find item to update');
      return;
    }

    let suffix, name, amount, unit, category, allergen, enabled, basePrice;

    if (itemType === 'ingredient') {
      suffix = row.querySelector('input[name="IngredientSuffix"]')?.value?.trim();
    } else {
      suffix = row.querySelector('input[name="AddOnSuffix"]')?.value?.trim();
      basePrice = row.querySelector('input[name="BasePrice"]')?.value?.trim() || '10';
    }

    name = row.querySelector('input[name="Name"]')?.value?.trim();
    amount = row.querySelector('.amount-pack-group input[name="Amount"]')?.value?.trim();
    unit = row.querySelector('.amount-pack-group select[name="Unit"]')?.value?.trim();
    category = itemType === 'ingredient' ? 'Ingredients' : 'Add-Ons';
    allergen = row.querySelector('input[name="Allergen"]')?.value?.trim() || 'None';
    enabled = row.querySelector('input[name="isEnabled"][type="checkbox"]')?.checked ? 'true' : 'false';

    if (!suffix || !name || !amount || !unit) {
      showNotification('Please fill in all required fields.', 'error');
      return;
    }

    const amountPerPack = `${amount} ${unit}`;
    const prefix = itemType === 'ingredient' ? 'ING' : 'AD';
    const fullId = `${prefix}-${suffix}`;
    
    const data = {
      Name: name,
      Amount: amount,
      AmountPerPack: amountPerPack,
      Category: category,
      Allergen: allergen,
      isEnabled: enabled,
      DeductionQuantityGrams: '10'
    };
    
    if (itemType === 'ingredient') {
      data.IngredientID = fullId;
      data.IngredientPrefix = prefix;
      data.IngredientSuffix = suffix;
    } else {
      data.AddOnID = fullId;
      data.AddOnPrefix = prefix;
      data.AddOnSuffix = suffix;
      data.BasePrice = parseInt(basePrice, 10) || 10;
    }

    const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
    
    try {
      const response = await fetch(`${basePath}/stocks/edit/${itemId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        // Update current stock cell
        const currentStockCell = row.cells[2];
        if (currentStockCell) {
          const response = await fetch(`${basePath}/stocks`);
          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const updatedRow = doc.querySelector(`tr[data-item-id="${itemId}"]`);
          if (updatedRow && updatedRow.cells[2]) {
            currentStockCell.textContent = updatedRow.cells[2].textContent;
          }
        }
        
        // Update original values
        row.querySelectorAll('[data-original]').forEach(field => {
          field.setAttribute('data-original', field.value);
        });
        
        triggerDashboardRefresh();
        showNotification('Item updated successfully!', 'success');
        console.log('✅ Item updated successfully');
      } else {
        showNotification('Failed to update item. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error updating item:', error);
      showNotification('Error updating item. Please try again.', 'error');
    }
  }

  async function handleDeleteItem(itemId, itemType) {
    console.log(`[2025-10-15 17:45:23] Handling individual delete: ${itemId} (${itemType}) by MathDaenniel`);

    const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
    
    try {
      const response = await fetch(`${basePath}/stocks/delete/${itemId}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        // Remove row from table
        const row = document.querySelector(`tr[data-item-id="${itemId}"]`);
        if (row) {
          row.remove();
          
          // Check if table is empty
          const tbody = row.closest('tbody');
          if (tbody && tbody.querySelectorAll('tr').length === 0) {
            const noDataRow = document.createElement('tr');
            noDataRow.innerHTML = `<td colspan="8" class="stocks-center">No ${itemType}s found.</td>`;
            tbody.appendChild(noDataRow);
          }
        }
        
        // Reinitialize row data
        initializeRowsData();
        
        triggerDashboardRefresh();
        showNotification('Item deleted successfully!', 'success');
        console.log('✅ Item deleted successfully');
      } else {
        showNotification('Failed to delete item. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      showNotification('Error deleting item. Please try again.', 'error');
    }
  }

  async function handleIndividualUpdate(itemId, itemType, row, silent = false) {
    console.log(`[2025-10-15 17:45:23] Handling individual update for ${itemType} ${itemId} by MathDaenniel`);

    try {
      const prefix = itemType === 'ingredient' ? 'ING' : 'AD';
      const suffixField = itemType === 'ingredient' ? 'IngredientSuffix' : 'AddOnSuffix';
      const suffix = row.querySelector(`input[name="${suffixField}"]`).value.trim();
      const fullId = `${prefix}-${suffix}`;

      let formId, fullIdField;
      if (itemType === 'ingredient') {
        formId = `update-ingredient-form-${itemId}`;
        fullIdField = 'IngredientID';
      } else {
        formId = `update-addon-form-${itemId}`;
        fullIdField = 'AddOnID';
      }

      const form = document.getElementById(formId);
      if (!form) {
        console.error(`[Form not found: ${formId}`);
        return false;
      }

      // Get Amount and Unit from table row
      const amount = row.querySelector('input[name="Amount"]').value;
      const unit = row.querySelector('select[name="Unit"]').value;
      const amountPerPack = `${amount} ${unit}`;

      form.querySelector(`input[name="${fullIdField}"]`).value = fullId;
      form.querySelector(`input[name="${itemType === 'ingredient' ? 'IngredientPrefix' : 'AddOnPrefix'}"]`).value = prefix;
      form.querySelector(`input[name="${suffixField}"]`).value = suffix;
      form.querySelector('input[name="Name"]').value = row.querySelector('input[name="Name"]').value;
      form.querySelector('input[name="AmountPerPack"]').value = amountPerPack;
      form.querySelector('input[name="Category"]').value = itemType === 'ingredient' ? 'Ingredients' : 'Add-Ons';
      form.querySelector('input[name="Allergen"]').value = row.querySelector('input[name="Allergen"]').value || 'None';
      form.querySelector('input[name="isEnabled"]').value = row.querySelector('select[name="isEnabled"]').value;

      if (silent) {
        return new Promise((resolve) => {
          fetch(form.action, {
            method: 'POST',
            body: new FormData(form)
          })
          .then(response => {
            const success = response.ok;
            if (success) {
              // Trigger dashboard refresh on successful update
              triggerDashboardRefresh();
            }
            resolve(success);
          })
          .catch(() => resolve(false));
        });
      } else {
        // Trigger dashboard refresh before form submission for non-silent updates
        triggerDashboardRefresh();
        form.submit();
        return true;
      }
    } catch (error) {
      console.error('Individual update error:', error);
      return false;
    }
  }

  async function handleIndividualDelete(itemId, itemType, silent = false) {
    try {
      const formId = itemType === 'ingredient' ? `delete-ingredient-form-${itemId}` : `delete-addon-form-${itemId}`;
      const form = document.getElementById(formId);

      if (!form) return false;

      if (silent) {
        return new Promise((resolve) => {
          fetch(form.action, {
            method: 'POST',
            body: new FormData(form)
          })
          .then(response => {
            const success = response.ok;
            if (success) {
              // Trigger dashboard refresh on successful delete
              triggerDashboardRefresh();
            }
            resolve(success);
          })
          .catch(() => resolve(false));
        });
      } else {
        // Trigger dashboard refresh before form submission for non-silent deletes
        triggerDashboardRefresh();
        form.submit();
        return true;
      }
    } catch (error) {
      console.error('Individual delete error:', error);
      return false;
    }
  }

  // ===============================================
  // INITIALIZATION ON WINDOW LOAD
  // ===============================================

  window.addEventListener('load', () => {
    setTimeout(() => {
      initializeSearchAndFilter();
      console.log(`[2025-10-15 17:45:23] Search and filter initialized after window load by MathDaenniel`);
    }, 200);
  });

  console.log(`[2025-10-15 17:45:23] Enhanced Stock Management System V10 - SEARCH AND SORT FIXED by MathDaenniel`);
  console.log(`[2025-10-15 17:45:23] Repository: roviczzz/Couche-Co by MathDaenniel`);
  console.log(`[2025-10-15 17:45:23] Features: Fixed Update/Delete Buttons, Search & Sort, Bulk Actions by MathDaenniel`);
  console.log(`[2025-10-15 17:45:23] System Status: Ready for production use by MathDaenniel`);

  const updateAllBtn = document.getElementById('updateAllBtn');
  const deleteAllBtn = document.getElementById('deleteAllBtn');

  if (updateAllBtn) {
    updateAllBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[2025-10-15 17:45:23] Bulk update button clicked by MathDaenniel`);
      showConfirmationModal('bulk_update', null, 'all');
    });
  }

  if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[2025-10-15 17:45:23] Bulk delete button clicked by MathDaenniel`);
      showConfirmationModal('bulk_delete', null, 'all');
    });
  }

  const updateAllIngredientsBtn = document.getElementById('updateAllIngredientsBtn');
  if (updateAllIngredientsBtn) {
    updateAllIngredientsBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[2025-10-15 17:45:23] Update All Ingredients clicked by MathDaenniel`);
      
      const ingredientRows = document.querySelectorAll('tr[data-type="ingredient"][data-item-id]');
      if (ingredientRows.length === 0) {
        showNotification('No ingredients to update', 'warning');
        return;
      }
      
      const updatingNotification = showNotification('Updating all ingredients...', 'info', 0);
      
      let successful = 0;
      let failed = 0;
      
      for (const row of ingredientRows) {
        const itemId = row.getAttribute('data-item-id');
        try {
          const suffix = row.querySelector('input[name="IngredientSuffix"]')?.value?.trim();
          const name = row.querySelector('input[name="Name"]')?.value?.trim();
          const amount = row.querySelector('.amount-pack-group input[name="Amount"]')?.value?.trim();
          const unit = row.querySelector('.amount-pack-group select[name="Unit"]')?.value?.trim();
          const allergen = row.querySelector('input[name="Allergen"]')?.value?.trim() || 'None';
          const enabled = row.querySelector('input[name="isEnabled"][type="checkbox"]')?.checked ? 'true' : 'false';
          
          if (!suffix || !name || !amount || !unit) {
            failed++;
            continue;
          }
          
          const amountPerPack = `${amount} ${unit}`;
          const fullId = `ING-${suffix}`;
          
          const data = {
            IngredientID: fullId,
            IngredientPrefix: 'ING',
            IngredientSuffix: suffix,
            Name: name,
            Amount: amount,
            AmountPerPack: amountPerPack,
            Category: 'Ingredients',
            Allergen: allergen,
            isEnabled: enabled,
            DeductionQuantityGrams: '10'
          };
          
          const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
          
          const response = await fetch(`${basePath}/stocks/edit/${itemId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(data)
          });
          
          if (response.ok) {
            row.querySelectorAll('[data-original]').forEach(field => {
              field.setAttribute('data-original', field.value);
            });
            successful++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`Error updating ingredient ${itemId}:`, error);
          failed++;
        }
      }
      
      removeNotification(updatingNotification);
      
      if (successful > 0) {
        const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
        try {
          const response = await fetch(`${basePath}/stocks`);
          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          
          for (const row of ingredientRows) {
            const itemId = row.getAttribute('data-item-id');
            const updatedRow = doc.querySelector(`tr[data-item-id="${itemId}"]`);
            if (updatedRow && row.cells[2] && updatedRow.cells[2]) {
              row.cells[2].textContent = updatedRow.cells[2].textContent;
            }
          }
        } catch (e) {
          console.error('Error refreshing table:', e);
        }
      }
      
      if (failed === 0) {
        showNotification(`Successfully updated ${successful} ingredients`, 'success');
      } else {
        showNotification(`Updated ${successful} ingredients, ${failed} failed`, 'warning');
      }
      
      triggerDashboardRefresh();
    });
  }

  const updateAllAddonsBtn = document.getElementById('updateAllAddonsBtn');
  if (updateAllAddonsBtn) {
    updateAllAddonsBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[2025-10-15 17:45:23] Update All Add-ons clicked by MathDaenniel`);
      
      const addonRows = document.querySelectorAll('tr[data-type="addon"][data-item-id]');
      if (addonRows.length === 0) {
        showNotification('No add-ons to update', 'warning');
        return;
      }
      
      const updatingNotification = showNotification('Updating all add-ons...', 'info', 0);
      
      let successful = 0;
      let failed = 0;
      
      for (const row of addonRows) {
        const itemId = row.getAttribute('data-item-id');
        try {
          const suffix = row.querySelector('input[name="AddOnSuffix"]')?.value?.trim();
          const name = row.querySelector('input[name="Name"]')?.value?.trim();
          const amount = row.querySelector('.amount-pack-group input[name="Amount"]')?.value?.trim();
          const unit = row.querySelector('.amount-pack-group select[name="Unit"]')?.value?.trim();
          const allergen = row.querySelector('input[name="Allergen"]')?.value?.trim() || 'None';
          const enabled = row.querySelector('input[name="isEnabled"][type="checkbox"]')?.checked ? 'true' : 'false';
          const basePrice = row.querySelector('input[name="BasePrice"]')?.value?.trim() || '10';
          
          if (!suffix || !name || !amount || !unit) {
            failed++;
            continue;
          }
          
          const amountPerPack = `${amount} ${unit}`;
          const fullId = `AD-${suffix}`;
          
          const data = {
            AddOnID: fullId,
            AddOnPrefix: 'AD',
            AddOnSuffix: suffix,
            Name: name,
            Amount: amount,
            AmountPerPack: amountPerPack,
            Category: 'Add-Ons',
            Allergen: allergen,
            isEnabled: enabled,
            BasePrice: parseInt(basePrice, 10) || 10,
            DeductionQuantityGrams: '10'
          };
          
          const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
          
          const response = await fetch(`${basePath}/stocks/edit/${itemId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(data)
          });
          
          if (response.ok) {
            row.querySelectorAll('[data-original]').forEach(field => {
              field.setAttribute('data-original', field.value);
            });
            successful++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`Error updating addon ${itemId}:`, error);
          failed++;
        }
      }
      
      removeNotification(updatingNotification);
      
      if (successful > 0) {
        const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
        try {
          const response = await fetch(`${basePath}/stocks`);
          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          
          for (const row of addonRows) {
            const itemId = row.getAttribute('data-item-id');
            const updatedRow = doc.querySelector(`tr[data-item-id="${itemId}"]`);
            if (updatedRow && row.cells[2] && updatedRow.cells[2]) {
              row.cells[2].textContent = updatedRow.cells[2].textContent;
            }
          }
        } catch (e) {
          console.error('Error refreshing table:', e);
        }
      }
      
      if (failed === 0) {
        showNotification(`Successfully updated ${successful} add-ons`, 'success');
      } else {
        showNotification(`Updated ${successful} add-ons, ${failed} failed`, 'warning');
      }
      
      triggerDashboardRefresh();
    });
  }

});
