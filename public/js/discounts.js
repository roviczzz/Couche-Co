document.addEventListener('DOMContentLoaded', function() {
  // Application state
  let currentAction = null;
  let currentPromoId = null;
  let isProcessing = false;

  // Cache DOM elements
  const elements = {
    addPromoBtn: document.getElementById('addPromoBtn'),
    promoModalOverlay: document.getElementById('promoModalOverlay'),
    cancelPromoBtn: document.getElementById('cancelPromo'),
    closePromoModalBtn: document.getElementById('closePromoModal'),
    savePromoBtn: document.getElementById('savePromoBtn'),
    confirmationModal: document.getElementById('confirmationModal'),
    confirmationTitle: document.getElementById('confirmationTitle'),
    confirmationMessage: document.getElementById('confirmationMessage'),
    confirmProceed: document.getElementById('confirmProceed'),
    confirmCancel: document.getElementById('confirmCancel'),
    promoForm: document.getElementById('promoForm'),
    eventInput: document.getElementById('eventInput'),
    descriptionInput: document.getElementById('descriptionInput'),
    discountPercentageInput: document.getElementById('discountPercentageInput'),
    modalCategoryInput: document.getElementById('categoryInput'),
    startDateInput: document.getElementById('startDateInput'),
    endDateInput: document.getElementById('endDateInput'),
    updateAllBtn: document.getElementById('updateAllBtn'),
    deleteAllBtn: document.getElementById('deleteAllBtn'),
    activePromosGrid: document.getElementById('activePromosGrid'),
    activePromosCount: document.getElementById('activePromosCount'),
    promoSearchInput: document.getElementById('promoSearchInput'),
    promoTableBody: document.getElementById('promoTableBody'),
    message: document.getElementById('message')
  };

  // Initialize application
  initializeApp();

  function initializeApp() {
    setupEventListeners();
    handleFlashMessage();
    updateActivePromosSection();
    
    // Initial search setup
    if (elements.promoSearchInput) {
      elements.promoSearchInput.addEventListener('input', handleSearch);
    }
    
    // Setup modal close handlers
    if (elements.promoModalOverlay) {
      elements.promoModalOverlay.addEventListener('click', function(e) {
        if (e.target === elements.promoModalOverlay) {
          hidePromoModal();
        }
      });
    }

    if (elements.confirmationModal) {
      elements.confirmationModal.addEventListener('click', function(e) {
        if (e.target === elements.confirmationModal) {
          hideConfirmationModal();
        }
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeydown);
  }

  function handleSortButton(sortMode) {
    // Update button active states
    const allSortBtns = document.querySelectorAll('.sort-btn');
    allSortBtns.forEach(btn => btn.classList.remove('active'));

    const activeBtn = document.querySelector(`.sort-btn[data-sort="${sortMode}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }

    // Apply sorting
    applySorting(sortMode);
  }

  function setupEventListeners() {
    // Add promo button
    if (elements.addPromoBtn) {
      elements.addPromoBtn.addEventListener('click', function(e) {
        e.preventDefault();
        showPromoModal();
      });
    }

    // Modal controls
    if (elements.cancelPromoBtn) {
      elements.cancelPromoBtn.addEventListener('click', function(e) {
        e.preventDefault();
        hidePromoModal();
      });
    }

    if (elements.closePromoModalBtn) {
      elements.closePromoModalBtn.addEventListener('click', function(e) {
        e.preventDefault();
        hidePromoModal();
      });
    }

    if (elements.savePromoBtn) {
      elements.savePromoBtn.addEventListener('click', function(e) {
        e.preventDefault();
        handleSavePromo();
      });
    }

    // Confirmation modal controls
    if (elements.confirmProceed) {
      elements.confirmProceed.addEventListener('click', function(e) {
        e.preventDefault();
        handleConfirmationProceed();
      });
    }

    if (elements.confirmCancel) {
      elements.confirmCancel.addEventListener('click', function(e) {
        e.preventDefault();
        hideConfirmationModal();
      });
    }

    // Bulk action buttons
    if (elements.updateAllBtn) {
      elements.updateAllBtn.addEventListener('click', function(e) {
        e.preventDefault();
        showConfirmationModal('bulk_update', null);
      });
    }

    if (elements.deleteAllBtn) {
      elements.deleteAllBtn.addEventListener('click', function(e) {
        e.preventDefault();
        showConfirmationModal('bulk_delete', null);
      });
    }

    // Table action buttons (event delegation)
    if (elements.promoTableBody) {
      elements.promoTableBody.addEventListener('click', function(e) {
        const button = e.target.closest('.stocks-btn');
        if (button) {
          e.preventDefault();
          e.stopPropagation();

          const action = button.getAttribute('data-action');
          const promoId = button.getAttribute('data-promo-id');

          if (action && promoId) {
            showConfirmationModal(action, promoId);
          }
        }
      });
    }

    // Sort buttons
    const sortAZBtn = document.getElementById('sortAZBtn');
    const sortZABtn = document.getElementById('sortZABtn');
    const showAllBtn = document.getElementById('showAllBtn');

    if (sortAZBtn) {
      sortAZBtn.addEventListener('click', function(e) {
        e.preventDefault();
        handleSortButton('a-z');
      });
    }

    if (sortZABtn) {
      sortZABtn.addEventListener('click', function(e) {
        e.preventDefault();
        handleSortButton('z-a');
      });
    }

    if (showAllBtn) {
      showAllBtn.addEventListener('click', function(e) {
        e.preventDefault();
        handleSortButton('default');
      });
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      if (elements.confirmationModal?.classList.contains('show')) {
        hideConfirmationModal();
      } else if (elements.promoModalOverlay?.classList.contains('show')) {
        hidePromoModal();
      }
    }
  }

  function showPromoModal() {
    if (!elements.promoModalOverlay || !elements.promoForm) return;

    // Reset form
    elements.promoForm.reset();
    
    // Show modal
    elements.promoModalOverlay.style.display = 'flex';
    elements.promoModalOverlay.style.visibility = 'visible';
    elements.promoModalOverlay.style.opacity = '0';
    elements.promoModalOverlay.classList.add('show');
    elements.promoModalOverlay.style.opacity = '1';

    // Focus first input
    setTimeout(() => {
      if (elements.eventInput) {
        elements.eventInput.focus();
      }
    }, 300);
  }

  function hidePromoModal() {
    if (!elements.promoModalOverlay || !elements.promoForm) return;

    elements.promoModalOverlay.classList.remove('show');
    elements.promoModalOverlay.style.opacity = '0';

    setTimeout(() => {
      elements.promoModalOverlay.style.display = 'none';
      elements.promoModalOverlay.style.visibility = 'hidden';
      elements.promoForm.reset();
    }, 200);
  }

  function showConfirmationModal(action, promoId) {
    currentAction = action;
    currentPromoId = promoId;

    if (!elements.confirmationModal || !elements.confirmationTitle || !elements.confirmationMessage) return;

    const messages = {
      update: {
        title: 'Update Promo',
        message: 'Are you sure you want to update this promo? This action will modify the existing promo data.'
      },
      delete: {
        title: 'Delete Promo',
        message: 'Are you sure you want to permanently delete this promo? This action cannot be undone.'
      },
      bulk_update: {
        title: 'Update All Changes',
        message: 'Are you sure you want to update all changes in the table? This will save all modified promo data.'
      },
      bulk_delete: {
        title: 'Delete All Promos',
        message: 'Are you sure you want to DELETE ALL PROMOS? This action cannot be undone and will permanently remove all promotional data.'
      }
    };

    const msgConfig = messages[action];
    if (msgConfig) {
      elements.confirmationTitle.textContent = msgConfig.title;
      elements.confirmationMessage.textContent = msgConfig.message;
    }

    elements.confirmationModal.style.display = 'flex';
    elements.confirmationModal.style.visibility = 'visible';
    elements.confirmationModal.style.opacity = '0';
    elements.confirmationModal.classList.add('show');
    elements.confirmationModal.style.opacity = '1';
  }

  function hideConfirmationModal() {
    if (!elements.confirmationModal) return;

    elements.confirmationModal.classList.remove('show');
    elements.confirmationModal.style.opacity = '0';

    setTimeout(() => {
      elements.confirmationModal.style.display = 'none';
      elements.confirmationModal.style.visibility = 'hidden';
      currentAction = null;
      currentPromoId = null;
    }, 200);
  }

  function validatePromoForm() {
    const event = elements.eventInput?.value.trim();
    const description = elements.descriptionInput?.value.trim();
    const discountPercentage = elements.discountPercentageInput?.value;
    const category = elements.modalCategoryInput?.value;
    const startDate = elements.startDateInput?.value;
    const endDate = elements.endDateInput?.value;

    if (!event || event.length < 3) {
      showErrorMessage('Event name must be at least 3 characters long');
      elements.eventInput?.focus();
      return false;
    }

    if (!description || description.length < 10) {
      showErrorMessage('Description must be at least 10 characters long');
      elements.descriptionInput?.focus();
      return false;
    }

    if (!discountPercentage) {
      showErrorMessage('Please select a discount percentage');
      elements.discountPercentageInput?.focus();
      return false;
    }

    const discountNum = parseFloat(discountPercentage);
    if (isNaN(discountNum) || discountNum < 1 || discountNum > 10) {
      showErrorMessage('Discount percentage must be between 1 and 10');
      elements.discountPercentageInput?.focus();
      return false;
    }

    if (!category) {
      showErrorMessage('Please select a category');
      elements.modalCategoryInput?.focus();
      return false;
    }

    const validCategories = ['All', 'Coffee', 'Milktea', 'Fruit Tea', 'Pastries'];
    if (!validCategories.includes(category)) {
      showErrorMessage('Please select a valid category');
      elements.modalCategoryInput?.focus();
      return false;
    }

    if (!startDate || !endDate) {
      showErrorMessage('Both start date and end date are required');
      return false;
    }

    if (new Date(startDate) > new Date(endDate)) {
      showErrorMessage('End date must be after or equal to start date');
      elements.endDateInput?.focus();
      return false;
    }

    return {
      event,
      description,
      discountPercentage: discountNum,
      category,
      startDate,
      endDate
    };
  }

  function validateTableRow(promoId) {
    const row = document.querySelector(`tr[data-promo-id="${promoId}"]`);
    if (!row) return false;

    const eventInput = row.querySelector('.event-input');
    const startDateInput = row.querySelector('.start-date-input');
    const endDateInput = row.querySelector('.end-date-input');
    const descriptionInput = row.querySelector('.description-input');
    const discountInput = row.querySelector('.discount-percentage-input');
    const categoryInput = row.querySelector('.category-input');

    if (!eventInput || !startDateInput || !endDateInput || !descriptionInput || !discountInput || !categoryInput) {
      return false;
    }

    let event = eventInput.value.trim();
    let startDate = startDateInput.value;
    let endDate = endDateInput.value;
    let description = descriptionInput.value.trim();
    let discountPercentage = parseFloat(discountInput.value);
    let category = categoryInput.value;

    if (!event || event.length < 3) {
      showErrorMessage('Event name must be at least 3 characters long');
      eventInput.focus();
      return false;
    }

    if (!description || description.length < 10) {
      showErrorMessage('Description must be at least 10 characters long');
      descriptionInput.focus();
      return false;
    }

    if (!startDate || !endDate) {
      showErrorMessage('Both start date and end date are required');
      return false;
    }

    if (new Date(startDate) > new Date(endDate)) {
      showErrorMessage('End date must be after or equal to start date');
      endDateInput.focus();
      return false;
    }

    if (isNaN(discountPercentage) || discountPercentage < 1 || discountPercentage > 10) {
      showErrorMessage('Discount percentage must be between 1 and 10');
      discountInput.focus();
      return false;
    }

    const validCategories = ['All', 'Coffee', 'Milktea', 'Fruit Tea', 'Pastries'];
    if (!validCategories.includes(category)) {
      showErrorMessage('Please select a valid category');
      categoryInput.focus();
      return false;
    }

    return {
      event,
      startDate,
      endDate,
      description,
      discountPercentage,
      category
    };
  }

  async function handleSavePromo() {
    if (isProcessing) return;
    
    const validatedData = validatePromoForm();
    if (!validatedData) return;

    isProcessing = true;
    
    // Update button state
    elements.savePromoBtn.disabled = true;
    elements.savePromoBtn.textContent = 'Adding...';
    elements.savePromoBtn.style.opacity = '0.7';

    try {
      const response = await fetch('/admin/discounts/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(validatedData)
      });

      const data = await response.json();

      if (data.success) {
        elements.savePromoBtn.textContent = 'Success!';
        elements.savePromoBtn.style.backgroundColor = '#28a745';

        setTimeout(() => {
          hidePromoModal();
          updateActivePromosSection();
          window.location.href = '/admin/discounts?msg=add_success';
        }, 1000);
      } else {
        throw new Error(data.error || data.message || 'Failed to add promo');
      }
    } catch (error) {
      console.error('Add promo error:', error);
      showErrorMessage(error.message || 'Error connecting to server. Please try again.');
    } finally {
      isProcessing = false;
      elements.savePromoBtn.disabled = false;
      elements.savePromoBtn.textContent = 'Add Promo';
      elements.savePromoBtn.style.opacity = '1';
      elements.savePromoBtn.style.backgroundColor = '';
    }
  }

  async function handleConfirmationProceed() {
    hideConfirmationModal();

    if (currentAction === 'update' && currentPromoId) {
      await handleUpdatePromo(currentPromoId);
    } else if (currentAction === 'delete' && currentPromoId) {
      await handleDeletePromo(currentPromoId);
    } else if (currentAction === 'bulk_update') {
      await handleUpdateAll();
    } else if (currentAction === 'bulk_delete') {
      await handleDeleteAll();
    }
  }

  async function handleUpdatePromo(promoId) {
    if (isProcessing) return;
    
    const validatedData = validateTableRow(promoId);
    if (!validatedData) return;

    const updateButton = document.querySelector(`[data-promo-id="${promoId}"][data-action="update"]`);
    if (!updateButton) {
      showErrorMessage('Update button not found');
      return;
    }

    isProcessing = true;
    updateButton.disabled = true;
    updateButton.textContent = 'Updating...';
    updateButton.style.opacity = '0.7';

    try {
      const response = await fetch(`/admin/discounts/edit/${promoId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(validatedData)
      });

      const data = await response.json();

      if (data.success) {
        updateButton.textContent = 'Success!';
        updateButton.style.backgroundColor = '#28a745';
        
        showSuccessMessage('Promo successfully updated.');
        updateActivePromosSection();

        setTimeout(() => {
          updateButton.disabled = false;
          updateButton.textContent = 'Update';
          updateButton.style.opacity = '1';
          updateButton.style.backgroundColor = '';
        }, 1500);
      } else {
        throw new Error(data.error || data.message || 'Failed to update promo');
      }
    } catch (error) {
      console.error('Update promo error:', error);
      showErrorMessage(error.message || 'Error updating promo. Please try again.');
      
      updateButton.disabled = false;
      updateButton.textContent = 'Update';
      updateButton.style.opacity = '1';
      updateButton.style.backgroundColor = '';
    } finally {
      isProcessing = false;
    }
  }

  async function handleDeletePromo(promoId) {
    if (isProcessing) return;
    
    const deleteButton = document.querySelector(`[data-promo-id="${promoId}"][data-action="delete"]`);
    if (!deleteButton) {
      showErrorMessage('Delete button not found');
      return;
    }

    isProcessing = true;
    deleteButton.disabled = true;
    deleteButton.textContent = 'Deleting...';
    deleteButton.style.opacity = '0.7';

    try {
      const response = await fetch(`/admin/discounts/delete/${promoId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      const data = await response.json();

      if (data.success) {
        deleteButton.textContent = 'Success!';
        deleteButton.style.backgroundColor = '#28a745';
        
        // Remove row from table
        const row = document.querySelector(`tr[data-promo-id="${promoId}"]`);
        if (row) {
          row.remove();
        }
        
        showSuccessMessage('Promo successfully deleted.');
        updateActivePromosSection();

        setTimeout(() => {
          deleteButton.disabled = false;
          deleteButton.textContent = 'Delete';
          deleteButton.style.opacity = '1';
          deleteButton.style.backgroundColor = '';
        }, 1500);
      } else {
        throw new Error(data.error || data.message || 'Failed to delete promo');
      }
    } catch (error) {
      console.error('Delete promo error:', error);
      showErrorMessage(error.message || 'Error deleting promo. Please try again.');
      
      deleteButton.disabled = false;
      deleteButton.textContent = 'Delete';
      deleteButton.style.opacity = '1';
      deleteButton.style.backgroundColor = '';
    } finally {
      isProcessing = false;
    }
  }

  async function handleUpdateAll() {
    if (isProcessing) return;
    
    const rows = document.querySelectorAll('#promoTableBody tr[data-promo-id]');
    if (rows.length === 0) {
      showErrorMessage('No promos found to update.');
      return;
    }

    const bulkUpdateBtn = elements.updateAllBtn;
    if (!bulkUpdateBtn) return;

    // Check for changes
    const rowsWithChanges = [];
    rows.forEach(row => {
      const promoId = row.dataset.promoId;
      const inputs = row.querySelectorAll('input, select');
      let hasChanges = false;

      inputs.forEach(input => {
        const originalValue = input.getAttribute('data-original') || '';
        const currentValue = input.value;
        
        if (originalValue !== currentValue) {
          hasChanges = true;
        }
      });

      if (hasChanges) {
        rowsWithChanges.push({ row, promoId });
      }
    });

    if (rowsWithChanges.length === 0) {
      showErrorMessage('No changes detected to update.');
      return;
    }

    isProcessing = true;
    bulkUpdateBtn.disabled = true;
    bulkUpdateBtn.textContent = `Updating (${rowsWithChanges.length})...`;
    bulkUpdateBtn.style.opacity = '0.7';

    try {
      const updatePromises = rowsWithChanges.map(async ({ row, promoId }) => {
        const validatedData = validateTableRow(promoId);
        if (!validatedData) {
          throw new Error(`Validation failed for promo ${promoId}`);
        }

        const response = await fetch(`/admin/discounts/edit/${promoId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify(validatedData)
        });

        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || data.message || `Failed to update promo ${promoId}`);
        }
        
        return { promoId, success: true };
      });

      const results = await Promise.allSettled(updatePromises);
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.length - successful;

      if (successful > 0) {
        showSuccessMessage(`Successfully updated ${successful} out of ${results.length} promos.`);
        updateActivePromosSection();
        
        // Update data-original attributes
        rowsWithChanges.forEach(({ row }) => {
          const inputs = row.querySelectorAll('input, select');
          inputs.forEach(input => {
            input.setAttribute('data-original', input.value);
          });
        });
      }

      if (failed > 0) {
        showErrorMessage(`${failed} promos failed to update.`);
      }

    } catch (error) {
      console.error('Bulk update error:', error);
      showErrorMessage('Error updating promos. Please try again.');
    } finally {
      isProcessing = false;
      setTimeout(() => {
        bulkUpdateBtn.disabled = false;
        bulkUpdateBtn.textContent = 'Update All Changes';
        bulkUpdateBtn.style.opacity = '1';
      }, 1500);
    }
  }

  async function handleDeleteAll() {
    if (isProcessing) return;
    
    const rows = document.querySelectorAll('#promoTableBody tr[data-promo-id]');
    if (rows.length === 0) {
      showErrorMessage('No promos found to delete.');
      return;
    }

    const bulkDeleteBtn = elements.deleteAllBtn;
    if (!bulkDeleteBtn) return;

    isProcessing = true;
    bulkDeleteBtn.disabled = true;
    bulkDeleteBtn.textContent = `Deleting (${rows.length})...`;
    bulkDeleteBtn.style.opacity = '0.7';

    try {
      const deletePromises = Array.from(rows).map(async (row) => {
        const promoId = row.dataset.promoId;
        
        const response = await fetch(`/admin/discounts/delete/${promoId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || data.message || `Failed to delete promo ${promoId}`);
        }
        
        return { promoId, success: true };
      });

      const results = await Promise.allSettled(deletePromises);
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.length - successful;

      if (successful > 0) {
        showSuccessMessage(`Successfully deleted ${successful} out of ${results.length} promos.`);
        
        // Remove successful deletions from DOM
        const fulfilledPromises = results.filter(result => result.status === 'fulfilled');
        fulfilledPromises.forEach((result, index) => {
          const row = Array.from(rows)[index];
          if (row) {
            row.remove();
          }
        });
        
        updateActivePromosSection();
      }

      if (failed > 0) {
        showErrorMessage(`${failed} promos failed to delete.`);
      }

    } catch (error) {
      console.error('Bulk delete error:', error);
      showErrorMessage('Error deleting promos. Please try again.');
    } finally {
      isProcessing = false;
      setTimeout(() => {
        bulkDeleteBtn.disabled = false;
        bulkDeleteBtn.textContent = 'Delete All Promos';
        bulkDeleteBtn.style.opacity = '1';
      }, 1500);
    }
  }

  function handleSearch() {
    if (!elements.promoSearchInput || !elements.promoTableBody) return;

    const searchTerm = elements.promoSearchInput.value.toLowerCase().trim();
    const rows = elements.promoTableBody.querySelectorAll('tr[data-promo-id]');

    rows.forEach(row => {
      const eventInput = row.querySelector('.event-input');
      if (eventInput) {
        const eventName = eventInput.value.toLowerCase();
        const shouldShow = !searchTerm || eventName.startsWith(searchTerm);
        row.style.display = shouldShow ? '' : 'none';
      }
    });
  }

  function applySorting(sortMode) {
    if (!elements.promoTableBody) return;

    const rows = Array.from(elements.promoTableBody.querySelectorAll('tr[data-promo-id]'));
    if (rows.length === 0) return;

    let sortedRows;

    if (sortMode === 'a-z') {
      sortedRows = rows.sort((rowA, rowB) => {
        const eventInputA = rowA.querySelector('.event-input');
        const eventInputB = rowB.querySelector('.event-input');

        const eventNameA = eventInputA ? eventInputA.value.toLowerCase().trim() : '';
        const eventNameB = eventInputB ? eventInputB.value.toLowerCase().trim() : '';

        return eventNameA.localeCompare(eventNameB);
      });
    } else if (sortMode === 'z-a') {
      sortedRows = rows.sort((rowA, rowB) => {
        const eventInputA = rowA.querySelector('.event-input');
        const eventInputB = rowB.querySelector('.event-input');

        const eventNameA = eventInputA ? eventInputA.value.toLowerCase().trim() : '';
        const eventNameB = eventInputB ? eventInputB.value.toLowerCase().trim() : '';

        return eventNameB.localeCompare(eventNameA);
      });
    } else {
      // 'default' or any other mode - keep original order
      sortedRows = rows;
    }

    // Re-append rows in sorted order
    elements.promoTableBody.innerHTML = '';
    sortedRows.forEach(row => {
      elements.promoTableBody.appendChild(row);
    });

    // Scroll to top of table to show sorted results
    elements.promoTableBody.scrollTop = 0;

    console.log('Sorted table by:', sortMode);
  }

  function updateActivePromosSection() {
    if (!elements.activePromosGrid || !elements.activePromosCount) return;

    const now = new Date();
    const activePromos = [];
    const tableRows = document.querySelectorAll('#promoTableBody tr[data-promo-id]');

    tableRows.forEach((row) => {
      const promoId = row.dataset.promoId;
      const startDateInput = row.querySelector('.start-date-input');
      const endDateInput = row.querySelector('.end-date-input');
      const eventInput = row.querySelector('.event-input');
      const descriptionInput = row.querySelector('.description-input');
      const discountInput = row.querySelector('.discount-percentage-input');

      if (startDateInput && endDateInput && eventInput && descriptionInput && discountInput) {
        const startDateValue = startDateInput.value;
        const endDateValue = endDateInput.value;

        if (startDateValue && endDateValue) {
          const startDate = new Date(startDateValue);
          const endDate = new Date(endDateValue);

          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            const isActive = now >= startDate && now <= endDate;

            if (isActive) {
              activePromos.push({
                _id: promoId,
                event: eventInput.value || 'Unnamed Event',
                description: descriptionInput.value || 'No description',
                discountPercentage: discountInput.value || '0',
                startDate: startDateValue,
                endDate: endDateValue
              });
            }
          }
        }
      }
    });

    // Update count
    const currentCount = parseInt(elements.activePromosCount.textContent) || 0;
    const newCount = activePromos.length;

    if (currentCount !== newCount) {
      elements.activePromosCount.style.transform = 'scale(1.2)';
      elements.activePromosCount.style.transition = 'transform 0.3s ease';
      setTimeout(() => {
        elements.activePromosCount.textContent = newCount;
        elements.activePromosCount.style.transform = 'scale(1)';
      }, 150);
    }

    // Update display
    if (activePromos.length > 0) {
      const promoCardsHTML = activePromos.map((promo, index) => {
        const cardClass = index % 3 === 0 ? 'featured' : index % 3 === 1 ? 'special' : 'standard';

        let startDateFormatted = 'Invalid Date';
        let endDateFormatted = 'Invalid Date';
        let daysRemaining = 0;

        try {
          const startDate = new Date(promo.startDate);
          const endDate = new Date(promo.endDate);

          if (!isNaN(startDate.getTime())) {
            startDateFormatted = startDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
          }

          if (!isNaN(endDate.getTime())) {
            endDateFormatted = endDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
          }
        } catch (error) {}

        const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;

        return `
          <div class="active-promo-card ${cardClass} ${isExpiringSoon ? 'expiring-soon' : ''}" data-promo-id="${promo._id}">
            <div class="promo-card-header">
              <div class="promo-icon-large">🥤</div>
              <div class="promo-status-dot active"></div>
              <div class="promo-discount-badge">${promo.discountPercentage}% OFF</div>
              ${isExpiringSoon ? '<div class="expiring-badge">Expires Soon!</div>' : ''}
            </div>
            <div class="promo-card-content">
              <h4 class="promo-title">${promo.event}</h4>
              <p class="promo-description">${promo.description}</p>
              <div class="promo-dates">
                <div class="promo-date-item">
                  <span class="date-label">Started:</span>
                  <span class="date-value">${startDateFormatted}</span>
                </div>
                <div class="promo-date-item">
                  <span class="date-label">Ends:</span>
                  <span class="date-value">${endDateFormatted}</span>
                </div>
                <div class="promo-date-item ${isExpiringSoon ? 'urgent' : ''}">
                  <span class="date-label">Days Left:</span>
                  <span class="date-value">${Math.max(0, daysRemaining)}</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      elements.activePromosGrid.innerHTML = promoCardsHTML;
    } else {
      elements.activePromosGrid.innerHTML = `
        <div class="no-active-promos">
          <div class="no-promos-icon">📅</div>
          <h4>No Active Promos</h4>
          <p>There are currently no active promotional offers. Check back later or add new promos!</p>
          <button class="quick-add-btn" onclick="document.getElementById('addPromoBtn').click()">
            <span>Add Promo</span>
          </button>
        </div>
      `;
    }
  }

  function handleFlashMessage() {
    if (!elements.message) return;

    const urlParams = new URLSearchParams(window.location.search);
    const msg = urlParams.get('msg');

    const messages = {
      add_success: 'Promo successfully added.',
      update_success: 'Promo successfully updated.',
      delete_success: 'Promo successfully deleted.',
      bulk_update_success: 'All promo changes successfully updated.',
      bulk_delete_success: 'All promos successfully deleted.',
      duplicate_id: 'Error: Promo already exists. Please use different details.',
      delete_failed: 'Error: Failed to delete promo. It may not exist.',
      item_not_found: 'Error: Promo not found.',
      validation_error: 'Error: Please check all required fields.'
    };

    const text = messages[msg];
    if (!text) return;

    elements.message.textContent = text;
    elements.message.style.display = 'block';

    const isError = ['duplicate_id', 'delete_failed', 'item_not_found', 'validation_error'].includes(msg);
    if (isError) {
      elements.message.classList.add('error');
    }

    const fadeTime = isError ? 5000 : 4000;
    setTimeout(() => {
      elements.message.style.transition = 'opacity 1s ease';
      elements.message.style.opacity = '0';
      setTimeout(() => {
        elements.message.style.display = 'none';
        elements.message.style.opacity = '1';
      }, 1000);
    }, fadeTime);
  }

  // ===============================================
  // NOTIFICATION SYSTEM
  // ===============================================

  function showNotification(message, type = 'success') {
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

    setTimeout(() => removeNotification(notification), 3000);
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

  function showSuccessMessage(message) {
    showNotification(message, 'success');
  }

  function showErrorMessage(message) {
    showNotification(message, 'error');
  }
});
