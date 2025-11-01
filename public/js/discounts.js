document.addEventListener('DOMContentLoaded', function() {
  console.log(`[2025-10-06 13:11:03] Initializing Enhanced Promo Management System V9 - SEARCH AND SORT FIXED by MathDaenniel`);
  console.log(`[2025-10-06 13:11:03] Repository: roviczzz/Couche-Co by MathDaenniel`);

  // ===============================================
  // ENHANCED FIXED NAVBAR - CONTENT ONLY SCROLLING
  // ===============================================

  function setupFixedNavbar() {
    console.log(`[2025-10-06 13:11:03] Setting up fixed navbar with content-only scrolling by MathDaenniel`);

    const navbarSelectors = [
      'nav', '.navbar', '.nav', '.header-nav', '.main-nav',
      'header', '.header', '.site-header', '.page-header',
      '.navigation', '.top-nav', '.primary-nav'
    ];

    let navbar = null;

    for (const selector of navbarSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        navbar = element;
        break;
      }
    }

    if (navbar) {
      console.log(`[2025-10-06 13:11:03] Navbar found, applying fixed positioning by MathDaenniel`);

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

        console.log(`[2025-10-06 13:11:03] Container adjusted: height=calc(100vh - ${navbarHeight}px) by MathDaenniel`);
      }

      console.log(`[2025-10-06 13:11:03] Fixed navbar setup complete: height=${navbarHeight}px by MathDaenniel`);
    } else {
      console.log(`[2025-10-06 13:11:03] No navbar found, applying default content scrolling by MathDaenniel`);

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
  const navbar = document.querySelector('.navbar-fixed, nav, .navbar, header');

  if (scrollContainer) {
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

    console.log(`[2025-10-06 13:11:03] Content scroll listener attached by MathDaenniel`);
  }

  // ===============================================
  // FLASH MESSAGE HANDLING
  // ===============================================

  const messageDiv = document.getElementById('message');
  if (messageDiv) {
    const urlParams = new URLSearchParams(window.location.search);
    const msg = urlParams.get('msg');

    let text = '';
    if (msg === 'add_success') text = 'Promo successfully added.';
    else if (msg === 'update_success') text = 'Promo successfully updated.';
    else if (msg === 'delete_success') text = 'Promo successfully deleted.';
    else if (msg === 'duplicate_id') text = 'Error: Promo already exists. Please use different details.';
    else if (msg === 'delete_failed') text = 'Error: Failed to delete promo. It may not exist.';
    else if (msg === 'item_not_found') text = 'Error: Promo not found.';
    else if (msg === 'validation_error') text = 'Error: Please check all required fields.';

    if (text) {
      messageDiv.textContent = text;
      messageDiv.style.display = 'block';

      if (msg === 'duplicate_id' || msg === 'delete_failed' || msg === 'item_not_found' || msg === 'validation_error') {
        messageDiv.classList.add('error');
      }

      const isError = msg === 'duplicate_id' || msg === 'delete_failed' || msg === 'item_not_found' || msg === 'validation_error';
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

  const addPromoBtn = document.getElementById('addPromoBtn');
  const promoModalOverlay = document.getElementById('promoModalOverlay');
  const cancelPromoBtn = document.getElementById('cancelPromo');
  const closePromoModalBtn = document.getElementById('closePromoModal');
  const savePromoBtn = document.getElementById('savePromoBtn');

  const confirmationModal = document.getElementById('confirmationModal');
  const confirmationTitle = document.getElementById('confirmationTitle');
  const confirmationMessage = document.getElementById('confirmationMessage');
  const confirmProceed = document.getElementById('confirmProceed');
  const confirmCancel = document.getElementById('confirmCancel');

  const promoForm = document.getElementById('promoForm');
  const eventInput = document.getElementById('eventInput');
  const descriptionInput = document.getElementById('descriptionInput');
  const discountPercentageInput = document.getElementById('discountPercentageInput');
  const startDateInput = document.getElementById('startDateInput');
  const endDateInput = document.getElementById('endDateInput');

  let currentAction = null;
  let currentPromoId = null;

  let originalPromoData = new Map();
  let updateActivePromosTimeout = null;

  console.log(`[2025-10-06 13:11:03] Modal elements found:`, {
    addPromoBtn: !!addPromoBtn,
    promoModalOverlay: !!promoModalOverlay,
    savePromoBtn: !!savePromoBtn,
    confirmationModal: !!confirmationModal,
    confirmProceed: !!confirmProceed,
    confirmCancel: !!confirmCancel
  }, 'by MathDaenniel');

  // ===============================================
  // V9 ENHANCEMENT: INITIALIZE ORIGINAL PROMO DATA CACHE
  // ===============================================

  function initializePromoDataCache() {
    console.log(`[2025-10-06 13:11:03] V9 Initializing promo data cache and original rows for search/filter/sort by MathDaenniel`);

    const rows = document.querySelectorAll('#promoTableBody tr[data-promo-id]');
    originalRows = Array.from(rows);

    rows.forEach(row => {
      const promoId = row.dataset.promoId;
      const eventInput = row.querySelector('.event-input');
      const startDateInput = row.querySelector('.start-date-input');
      const endDateInput = row.querySelector('.end-date-input');
      const descriptionInput = row.querySelector('.description-input');
      const discountInput = row.querySelector('.discount-percentage-input');

      if (promoId && eventInput && startDateInput && endDateInput && descriptionInput && discountInput) {
        originalPromoData.set(promoId, {
          event: eventInput.value,
          startDate: startDateInput.value,
          endDate: endDateInput.value,
          description: descriptionInput.value,
          discountPercentage: discountInput.value
        });
      }
    });

    console.log(`[2025-10-06 13:11:03] V9 Cached ${originalPromoData.size} promo records and ${originalRows.length} original rows by MathDaenniel`);
  }

  // ===============================================
  // V9 CRITICAL FIX: ACTIVE PROMOS SECTION UPDATE
  // ===============================================

  function updateActivePromosSection() {
    console.log(`[2025-10-06 13:11:03] V9 CRITICAL FIX: Updating active promos section by MathDaenniel`);

    const activePromosGrid = document.getElementById('activePromosGrid');
    const activePromosCount = document.getElementById('activePromosCount');

    if (!activePromosGrid || !activePromosCount) {
      console.log(`[2025-10-06 13:11:03] Active promos elements not found by MathDaenniel`);
      return;
    }

    const rows = document.querySelectorAll('#promoTableBody tr[data-promo-id]');
    const now = new Date();
    const activePromos = [];

    console.log(`[2025-10-06 13:11:03] V9 Processing ${rows.length} promo rows for active status by MathDaenniel`);

    rows.forEach((row, index) => {
      const promoId = row.dataset.promoId;
      const startDateInput = row.querySelector('.start-date-input');
      const endDateInput = row.querySelector('.end-date-input');
      const eventInput = row.querySelector('.event-input');
      const descriptionInput = row.querySelector('.description-input');
      const discountInput = row.querySelector('.discount-percentage-input');

      if (startDateInput && endDateInput && eventInput && descriptionInput && discountInput) {
        const startDateValue = startDateInput.value;
        const endDateValue = endDateInput.value;

        console.log(`[2025-10-06 13:11:03] V9 Processing promo ${promoId}: start=${startDateValue}, end=${endDateValue} by MathDaenniel`);

        if (startDateValue && endDateValue && startDateValue.trim() && endDateValue.trim()) {
          const startDate = new Date(startDateValue + 'T00:00:00');
          const endDate = new Date(endDateValue + 'T23:59:59');

          const isValidStartDate = !isNaN(startDate.getTime()) && startDate instanceof Date;
          const isValidEndDate = !isNaN(endDate.getTime()) && endDate instanceof Date;

          console.log(`[2025-10-06 13:11:03] V9 Date validation for ${promoId}: startValid=${isValidStartDate}, endValid=${isValidEndDate} by MathDaenniel`);

          if (isValidStartDate && isValidEndDate) {
            const isActive = now >= startDate && now <= endDate;

            console.log(`[2025-10-06 13:11:03] V9 Promo ${promoId} active status: ${isActive} by MathDaenniel`);

            if (isActive) {
              const promoData = {
                _id: promoId,
                event: eventInput.value || 'Unnamed Event',
                description: descriptionInput.value || 'No description',
                discountPercentage: discountInput.value || '0',
                startDate: startDateValue,
                endDate: endDateValue
              };

              activePromos.push(promoData);
              console.log(`[2025-10-06 13:11:03] V9 Added active promo: ${promoData.event} by MathDaenniel`);
            }
          } else {
            console.warn(`[2025-10-06 13:11:03] V9 Invalid dates for promo ${promoId} by MathDaenniel`);
          }
        } else {
          console.warn(`[2025-10-06 13:11:03] V9 Missing or empty date values for promo ${promoId} by MathDaenniel`);
        }
      } else {
        console.warn(`[2025-10-06 13:11:03] V9 Missing input elements for promo ${promoId} by MathDaenniel`);
      }
    });

    console.log(`[2025-10-06 13:11:03] V9 Found ${activePromos.length} active promos by MathDaenniel`);

    const currentCount = parseInt(activePromosCount.textContent) || 0;
    const newCount = activePromos.length;

    if (currentCount !== newCount) {
      activePromosCount.style.transform = 'scale(1.2)';
      activePromosCount.style.transition = 'transform 0.3s ease';
      setTimeout(() => {
        activePromosCount.textContent = newCount;
        activePromosCount.style.transform = 'scale(1)';
      }, 150);
    }

    activePromos.sort((a, b) => parseFloat(b.discountPercentage) - parseFloat(a.discountPercentage));

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
        } catch (error) {
          console.error(`[2025-10-06 13:11:03] V9 Date formatting error for promo ${promo._id}:`, error, 'by MathDaenniel');
        }

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

      activePromosGrid.innerHTML = promoCardsHTML;
    } else {
      activePromosGrid.innerHTML = `
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

    console.log(`[2025-10-06 13:11:03] V9 CRITICAL FIX COMPLETE: Active promos section updated with ${activePromos.length} active promos by MathDaenniel`);
  }

  function debounceUpdateActivePromos(delay = 300) {
    clearTimeout(updateActivePromosTimeout);
    updateActivePromosTimeout = setTimeout(() => {
      updateActivePromosSection();
    }, delay);
  }

  // ===============================================
  // MODAL FUNCTIONS - V9 ENHANCED
  // ===============================================

  function showPromoModal() {
    console.log(`[2025-10-06 13:11:03] V9 Opening add promo modal by MathDaenniel`);

    if (!promoModalOverlay) {
      console.error(`[2025-10-06 13:11:03] Modal overlay not found by MathDaenniel`);
      return;
    }

    if (promoForm) {
      promoForm.reset();
    }

    promoModalOverlay.style.display = 'flex';
    promoModalOverlay.style.visibility = 'visible';
    promoModalOverlay.style.opacity = '0';

    setTimeout(() => {
      promoModalOverlay.classList.add('show');
      promoModalOverlay.style.opacity = '1';
    }, 10);

    setTimeout(() => {
      if (eventInput) {
        eventInput.focus();
        console.log(`[2025-10-06 13:11:03] V9 Focus set to event input by MathDaenniel`);
      }
    }, 300);

    console.log(`[2025-10-06 13:11:03] V9 Modal opened successfully by MathDaenniel`);
  }

  function hidePromoModal() {
    console.log(`[2025-10-06 13:11:03] V9 Closing add promo modal by MathDaenniel`);

    if (!promoModalOverlay) return;

    promoModalOverlay.classList.remove('show');
    promoModalOverlay.style.opacity = '0';

    setTimeout(() => {
      promoModalOverlay.style.display = 'none';
      promoModalOverlay.style.visibility = 'hidden';
      if (promoForm) {
        promoForm.reset();
      }
    }, 200);

    console.log(`[2025-10-06 13:11:03] V9 Modal closed successfully by MathDaenniel`);
  }

  function showConfirmationModal(action, promoId) {
    console.log(`[2025-10-06 13:11:03] V9 Opening confirmation modal: ${action} for ${promoId} by MathDaenniel`);

    currentAction = action;
    currentPromoId = promoId;

    if (!confirmationModal || !confirmationTitle || !confirmationMessage) {
      console.error(`[2025-10-06 13:11:03] Confirmation modal elements not found by MathDaenniel`);
      return;
    }

    if (action === 'update') {
      confirmationTitle.textContent = 'Update Promo';
      confirmationMessage.textContent = 'Are you sure you want to update this promo with the current values? This action will modify the existing promo data and refresh the active promos display.';
    } else if (action === 'delete') {
      confirmationTitle.textContent = 'Delete Promo';
      confirmationMessage.textContent = 'Are you sure you want to permanently delete this promo? This action cannot be undone and will remove all promo data.';
    } else if (action === 'bulk_update') {
      confirmationTitle.textContent = 'Update All Changes';
      confirmationMessage.textContent = 'Are you sure you want to update all changes in the table? This will save all modified promo data and refresh the active promos display.';
    } else if (action === 'bulk_delete') {
      confirmationTitle.textContent = 'Delete All Promos';
      confirmationMessage.textContent = 'Are you sure you want to DELETE ALL PROMOS? This action cannot be undone and will permanently remove all promotional data from the system.';
    }

    confirmationModal.style.display = 'flex';
    confirmationModal.style.visibility = 'visible';
    confirmationModal.style.opacity = '0';

    setTimeout(() => {
      confirmationModal.classList.add('show');
      confirmationModal.style.opacity = '1';
    }, 10);

    console.log(`[2025-10-06 13:11:03] V9 Confirmation modal opened for ${action} action by MathDaenniel`);
  }

  function hideConfirmationModal() {
    console.log(`[2025-10-06 13:11:03] V9 Closing confirmation modal by MathDaenniel`);

    if (!confirmationModal) return;

    confirmationModal.classList.remove('show');
    confirmationModal.style.opacity = '0';

    setTimeout(() => {
      confirmationModal.style.display = 'none';
      confirmationModal.style.visibility = 'hidden';
      currentAction = null;
      currentPromoId = null;
    }, 200);
  }

  // ===============================================
  // ENHANCED EVENT LISTENERS - V9 FIXED DELETE FUNCTIONALITY
  // ===============================================

  if (addPromoBtn) {
    addPromoBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[2025-10-06 13:11:03] V9 Add promo button clicked by MathDaenniel`);
      showPromoModal();
    });
    console.log(`[2025-10-06 13:11:03] V9 Add promo button listener attached by MathDaenniel`);
  } else {
    console.error(`[2025-10-06 13:11:03] Add promo button not found by MathDaenniel`);
  }

  if (cancelPromoBtn) {
    cancelPromoBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      hidePromoModal();
    });
  }

  if (closePromoModalBtn) {
    closePromoModalBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      hidePromoModal();
    });
  }

  if (savePromoBtn) {
    savePromoBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[2025-10-06 13:11:03] V9 Save promo button clicked by MathDaenniel`);
      handleSavePromo();
    });
    console.log(`[2025-10-06 13:11:03] V9 Save promo button listener attached by MathDaenniel`);
  } else {
    console.error(`[2025-10-06 13:11:03] Save promo button not found by MathDaenniel`);
  }

  document.addEventListener('click', function(e) {
    const stocksBtn = e.target.closest('.stocks-btn');

    if (stocksBtn) {
      e.preventDefault();
      e.stopPropagation();

      const action = stocksBtn.getAttribute('data-action') || stocksBtn.dataset.action;
      const promoId = stocksBtn.getAttribute('data-promo-id') || stocksBtn.dataset.promoId;

      let finalAction = action;
      let finalPromoId = promoId;

      if (!action || !promoId) {
        const parentRow = stocksBtn.closest('tr');
        if (parentRow) {
          finalPromoId = finalPromoId || parentRow.getAttribute('data-promo-id') || parentRow.dataset.promoId;
          finalAction = finalAction || (stocksBtn.classList.contains('update') ? 'update' : stocksBtn.classList.contains('delete') ? 'delete' : null);
        }
      }

      console.log(`[2025-10-06 13:11:03] V9 Action button clicked:`, {
        originalAction: action,
        originalPromoId: promoId,
        finalAction: finalAction,
        finalPromoId: finalPromoId,
        element: stocksBtn,
        classList: Array.from(stocksBtn.classList)
      }, 'by MathDaenniel');

      if (finalAction && finalPromoId) {
        console.log(`[2025-10-06 13:11:03] V9 Triggering ${finalAction} action for promo ${finalPromoId} by MathDaenniel`);
        showConfirmationModal(finalAction, finalPromoId);
      } else {
        console.error(`[2025-10-06 13:11:03] V9 Could not determine action or promo ID:`, {
          finalAction: finalAction,
          finalPromoId: finalPromoId,
          buttonHTML: stocksBtn.outerHTML
        }, 'by MathDaenniel');

        alert('Error: Could not determine the action or promo ID. Please refresh the page and try again.');
      }
    }
  });

  if (confirmProceed) {
    confirmProceed.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[2025-10-06 13:11:03] V9 Confirmation proceed clicked: ${currentAction} for ${currentPromoId} by MathDaenniel`);
      handleConfirmationProceed();
    });
  }

  if (confirmCancel) {
    confirmCancel.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[2025-10-06 13:11:03] V9 Confirmation cancelled by MathDaenniel`);
      hideConfirmationModal();
    });
  }

  if (promoModalOverlay) {
    promoModalOverlay.addEventListener('click', function(e) {
      if (e.target === promoModalOverlay) {
        hidePromoModal();
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
      } else if (promoModalOverlay && promoModalOverlay.classList.contains('show')) {
        hidePromoModal();
      }
    }
  });

  // ===============================================
  // FORM VALIDATION AND SUBMISSION - V9 ENHANCED
  // ===============================================

  function validateDates(startDate, endDate) {
    if (startDate && endDate) {
      return new Date(startDate) <= new Date(endDate);
    }
    return true;
  }

  function validateForm() {
    console.log(`[2025-10-06 13:11:03] V9 Validating form by MathDaenniel`);

    const event = eventInput ? eventInput.value.trim() : '';
    const description = descriptionInput ? descriptionInput.value.trim() : '';
    const discountPercentage = discountPercentageInput ? discountPercentageInput.value : '';
    const startDate = startDateInput ? startDateInput.value : '';
    const endDate = endDateInput ? endDateInput.value : '';

    console.log(`[2025-10-06 13:11:03] V9 Form values:`, {
      event, description, discountPercentage, startDate, endDate
    }, 'by MathDaenniel');

    if (!event) {
      alert('Please enter an event name for the promo');
      if (eventInput) eventInput.focus();
      return false;
    }

    if (event.length < 3) {
      alert('Event name must be at least 3 characters long');
      if (eventInput) eventInput.focus();
      return false;
    }

    if (!description) {
      alert('Please enter a description for the promo');
      if (descriptionInput) descriptionInput.focus();
      return false;
    }

    if (description.length < 10) {
      alert('Description must be at least 10 characters long');
      if (descriptionInput) descriptionInput.focus();
      return false;
    }

    if (!discountPercentage) {
      alert('Please enter a discount percentage');
      if (discountPercentageInput) discountPercentageInput.focus();
      return false;
    }

    const discountNum = parseFloat(discountPercentage);
    if (isNaN(discountNum) || discountNum < 1 || discountNum > 10) {
      alert('Discount percentage must be a valid number between 1 and 10');
      if (discountPercentageInput) discountPercentageInput.focus();
      return false;
    }

    if (!startDate) {
      alert('Please select a starting date for the promo');
      if (startDateInput) startDateInput.focus();
      return false;
    }

    if (!endDate) {
      alert('Please select a closing date for the promo');
      if (endDateInput) endDateInput.focus();
      return false;
    }

    if (!validateDates(startDate, endDate)) {
      alert('Closing date must be after or equal to starting date');
      if (endDateInput) endDateInput.focus();
      return false;
    }

    const today = new Date();
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());

    if (endDateObj < oneYearAgo) {
      const confirmOldDate = confirm('The end date is more than a year ago. Are you sure you want to create this promo?');
      if (!confirmOldDate) {
        if (endDateInput) endDateInput.focus();
        return false;
      }
    }

    console.log(`[2025-10-06 13:11:03] V9 Form validation passed by MathDaenniel`);
    return true;
  }

  function handleSavePromo() {
    console.log(`[2025-10-06 13:11:03] V9 Handling save promo by MathDaenniel`);

    if (!validateForm()) {
      console.log(`[2025-10-06 13:11:03] V9 Form validation failed by MathDaenniel`);
      return;
    }

    if (!savePromoBtn) {
      console.error(`[2025-10-06 13:11:03] Save button not found by MathDaenniel`);
      return;
    }

    const event = eventInput.value.trim();
    const description = descriptionInput.value.trim();
    const discountPercentage = parseFloat(discountPercentageInput.value);
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    const payload = {
      event: event,
      description: description,
      discountPercentage: discountPercentage,
      startDate: startDate,
      endDate: endDate,
      metadata: {
        createdBy: 'MathDaenniel',
        repository: 'roviczzz/Couche-Co',
        timestamp: new Date().toISOString(),
        version: 'V9-SortingFeature'
      }
    };

    console.log(`[2025-10-06 13:11:03] V9 Sending payload:`, payload, 'by MathDaenniel');

    savePromoBtn.disabled = true;
    savePromoBtn.textContent = 'Adding...';
    savePromoBtn.style.opacity = '0.7';

    fetch('/admin/discounts/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(payload)
    })
    .then(response => {
      console.log(`[2025-10-06 13:11:03] V9 Response status: ${response.status} by MathDaenniel`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log(`[2025-10-06 13:11:03] V9 Server response:`, data, 'by MathDaenniel');

      if (data.success) {
        console.log(`[2025-10-06 13:11:03] V9 Promo added successfully by MathDaenniel`);

        savePromoBtn.textContent = 'Success!';
        savePromoBtn.style.backgroundColor = '#28a745';

        setTimeout(() => {
          hidePromoModal();
          window.location.href = '/admin/discounts?msg=add_success';
        }, 1000);
      } else {
        console.error(`[2025-10-06 13:11:03] V9 Server error:`, data.message, 'by MathDaenniel');
        alert(data.message || 'Error saving promo. Please check your input and try again.');
      }
    })
    .catch(error => {
      console.error(`[2025-10-06 13:11:03] V9 Fetch error:`, error, 'by MathDaenniel');
      alert('Error connecting to server. Please check your internet connection and try again.');
    })
    .finally(() => {
      savePromoBtn.disabled = false;
      savePromoBtn.textContent = 'Add Promo';
      savePromoBtn.style.opacity = '1';
      savePromoBtn.style.backgroundColor = '';
    });
  }

  function handleConfirmationProceed() {
    console.log(`[2025-10-06 13:11:03] V9 Handling confirmation proceed: ${currentAction} for ${currentPromoId} by MathDaenniel`);

    hideConfirmationModal();

    if (currentAction === 'update') {
      if (!currentPromoId) {
        alert('Error: Missing promo ID for update action.');
        return;
      }
      handleUpdatePromo(currentPromoId);
    } else if (currentAction === 'delete') {
      if (!currentPromoId) {
        alert('Error: Missing promo ID for delete action.');
        return;
      }
      handleDeletePromo(currentPromoId);
    } else if (currentAction === 'bulk_update') {
      handleUpdateAll();
    } else if (currentAction === 'bulk_delete') {
      handleDeleteAll();
    } else {
      console.error(`[2025-10-06 13:11:03] V9 Unknown action: ${currentAction} by MathDaenniel`);
      alert('Error: Unknown action. Please try again.');
    }
  }

  function handleUpdatePromo(promoId) {
    console.log(`[2025-10-06 13:11:03] V9 COMPLETE FIX: Handling update promo: ${promoId} by MathDaenniel`);

    const updateButton = document.querySelector(`[data-promo-id="${promoId}"][data-action="update"]`);
    if (!updateButton) {
      console.error(`[2025-10-06 13:11:03] V9 Update button not found for ${promoId} by MathDaenniel`);
      alert('Error: Could not find promo to update');
      return;
    }

    const row = updateButton.closest('tr');
    if (!row) {
      console.error(`[2025-10-06 13:11:03] V9 Row not found for ${promoId} by MathDaenniel`);
      alert('Error: Could not find promo row');
      return;
    }

    const eventInput = row.querySelector('.event-input');
    const startDateInput = row.querySelector('.start-date-input');
    const endDateInput = row.querySelector('.end-date-input');
    const descriptionInput = row.querySelector('.description-input');
    const discountInput = row.querySelector('.discount-percentage-input');

    if (!eventInput || !startDateInput || !endDateInput || !descriptionInput || !discountInput) {
      console.error(`[2025-10-06 13:11:03] V9 Required inputs not found for ${promoId} by MathDaenniel`);
      alert('Error: Could not find all required fields');
      return;
    }

    const event = eventInput.value.trim();
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    const description = descriptionInput.value.trim();
    const discountPercentage = parseFloat(discountInput.value);

    if (!event || event.length < 3) {
      alert('Event name must be at least 3 characters long');
      eventInput.focus();
      return;
    }

    if (!description || description.length < 10) {
      alert('Description must be at least 10 characters long');
      descriptionInput.focus();
      return;
    }

    if (!startDate || !endDate) {
      alert('Both start date and end date are required');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      alert('End date must be after or equal to start date');
      endDateInput.focus();
      return;
    }

    if (!event || !description || isNaN(discountPercentage) || !startDate || !endDate) {
      alert('All fields are required and discount percentage must be a valid number');
      return;
    }

    if (discountPercentage < 1 || discountPercentage > 10) {
      alert('Discount percentage must be between 1 and 10');
      discountInput.focus();
      return;
    }

    const originalValues = {
      event: eventInput.getAttribute('data-original'),
      startDate: startDateInput.getAttribute('data-original'),
      endDate: endDateInput.getAttribute('data-original'),
      description: descriptionInput.getAttribute('data-original'),
      discountPercentage: discountInput.getAttribute('data-original')
    };

    console.log(`[2025-10-06 13:11:03] V9 CRITICAL: Stored original values for rollback:`, originalValues, 'by MathDaenniel');

    const payload = {
      event: event,
      startDate: startDate,
      endDate: endDate,
      description: description,
      discountPercentage: discountPercentage,
      metadata: {
        updatedBy: 'MathDaenniel',
        repository: 'roviczzz/Couche-Co',
        timestamp: new Date().toISOString(),
        version: 'V9-SortingFeature'
      }
    };

    console.log(`[2025-10-06 13:11:03] V9 Update payload:`, payload, 'by MathDaenniel');

    updateButton.disabled = true;
    updateButton.textContent = 'Updating...';
    updateButton.style.opacity = '0.7';

    fetch(`/admin/discounts/edit/${promoId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(payload)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log(`[2025-10-06 13:11:03] V9 Update response:`, data, 'by MathDaenniel');

      if (data.success) {
        console.log(`[2025-10-06 13:11:03] V9 Promo updated successfully by MathDaenniel`);

        updateButton.textContent = 'Updated!';
        updateButton.style.backgroundColor = '#28a745';

        eventInput.setAttribute('data-original', event);
        startDateInput.setAttribute('data-original', startDate);
        endDateInput.setAttribute('data-original', endDate);
        descriptionInput.setAttribute('data-original', description);
        discountInput.setAttribute('data-original', discountPercentage.toString());

        originalPromoData.set(promoId, {
          event: event,
          startDate: startDate,
          endDate: endDate,
          description: description,
          discountPercentage: discountPercentage.toString()
        });

        console.log(`[2025-10-06 13:11:03] V9 CRITICAL: Updated data-original attributes and cache for promo ${promoId} by MathDaenniel`);

        updateActivePromosSection();

        console.log(`[2025-10-06 13:11:03] V9 CRITICAL: Active promos section immediately updated after successful promo update by MathDaenniel`);

        setTimeout(() => {
          window.location.href = '/admin/discounts?msg=update_success';
        }, 1500);
      } else {
        console.error(`[2025-10-06 13:11:03] V9 Update error:`, data.message, 'by MathDaenniel');

        eventInput.value = originalValues.event;
        startDateInput.value = originalValues.startDate;
        endDateInput.value = originalValues.endDate;
        descriptionInput.value = originalValues.description;
        discountInput.value = originalValues.discountPercentage;

        updateActivePromosSection();

        alert(data.message || 'Error updating promo. Values have been restored. Please check your input and try again.');
      }
    })
    .catch(error => {
      console.error(`[2025-10-06 13:11:03] V9 Update fetch error:`, error, 'by MathDaenniel');

      eventInput.value = originalValues.event;
      startDateInput.value = originalValues.startDate;
      endDateInput.value = originalValues.endDate;
      descriptionInput.value = originalValues.description;
      discountInput.value = originalValues.discountPercentage;

      updateActivePromosSection();

      alert('Error updating promo. Values have been restored. Please check your internet connection and try again.');
    })
    .finally(() => {
      updateButton.disabled = false;
      updateButton.textContent = 'Update';
      updateButton.style.opacity = '1';
      updateButton.style.backgroundColor = '';
    });
  }

  function handleDeletePromo(promoId) {
    console.log(`[2025-10-06 13:11:03] V9 Handling delete promo: ${promoId} by MathDaenniel`);

    fetch(`/admin/discounts/delete/${promoId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log(`[2025-10-06 13:11:03] V9 Delete response:`, data, 'by MathDaenniel');

      if (data.success) {
        console.log(`[2025-10-06 13:11:03] V9 Promo deleted successfully by MathDaenniel`);
        window.location.href = '/admin/discounts?msg=delete_success';
      } else {
        console.error(`[2025-10-06 13:11:03] V9 Delete error:`, data.message, 'by MathDaenniel');
        alert(data.message || 'Error deleting promo. Please try again.');
      }
    })
    .catch(error => {
      console.error(`[2025-10-06 13:11:03] V9 Delete fetch error:`, error, 'by MathDaenniel');
      alert('Error deleting promo. Please check your internet connection and try again.');
    });
  }

  // ===============================================
  // BULK ACTION EVENT LISTENERS - V9 Enhanced
  // ===============================================

  const updateAllBtn = document.getElementById('updateAllBtn');
  if (updateAllBtn) {
    updateAllBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[2025-10-06 13:11:03] V9 Update all button clicked by MathDaenniel`);
      showConfirmationModal('bulk_update', null);
    });
    console.log(`[2025-10-06 13:11:03] V9 Update all button listener attached by MathDaenniel`);
  } else {
    console.error(`[2025-10-06 13:11:03] Update all button not found by MathDaenniel`);
  }

  const deleteAllBtn = document.getElementById('deleteAllBtn');
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[2025-10-06 13:11:03] V9 Delete all button clicked by MathDaenniel`);
      showConfirmationModal('bulk_delete', null);
    });
    console.log(`[2025-10-06 13:11:03] V9 Delete all button listener attached by MathDaenniel`);
  } else {
    console.error(`[2025-10-06 13:11:03] Delete all button not found by MathDaenniel`);
  }

  // ===============================================
  // SEARCH, FILTER AND SORT FUNCTIONS - FIXED
  // ===============================================

  // Search and filter functionality variables
  let totalRowsCount = 0;
  let currentSearchText = '';
  let currentSortOrder = 'default'; // Track current sort order
  let originalRows = []; // Store original complete dataset
  let filteredRows = []; // Store filtered results

  const resultsCounter = document.createElement("div");
  resultsCounter.className = "results-counter";
  resultsCounter.id = "resultsCounter";

  function initializeSearchAndFilter() {
    try {
      const searchInput = document.getElementById("promoSearchInput");
      const sortButtons = document.querySelectorAll(".sort-btn");
      const tableContainer = document.querySelector(".table-container");

      if (!searchInput || !tableContainer) {
        console.error("Search/Filter: Required elements not found");
        return;
      }

      tableContainer.appendChild(resultsCounter);

      // Search input event listener
      searchInput.addEventListener("input", function(e) {
        currentSearchText = e.target.value.toLowerCase().trim();
        console.log("Search/Filter: Search input changed to:", currentSearchText);
        applySearchAndFilter();
      });

      // Sort button event listeners
      sortButtons.forEach(button => {
        button.addEventListener("click", function(e) {
          e.preventDefault();
          e.stopPropagation();

          const sortMode = this.getAttribute("data-sort");
          console.log("Search/Filter: Sort button clicked:", sortMode);

          if (!sortMode) {
            console.error("Search/Filter: No sort mode found on button");
            return;
          }

          // Update active button state
          sortButtons.forEach(btn => btn.classList.remove("active"));
          this.classList.add("active");

          // Update sort mode and re-apply filtering/sorting
          currentSortOrder = sortMode;
          console.log("Search/Filter: New sort order set to:", currentSortOrder);
          applySearchAndFilter();
        });
      });

      console.log("Search/Filter/Sort: Initialized successfully with", sortButtons.length, "sort buttons");
    } catch (error) {
      console.error("Search/Filter initialization error:", error);
      alert("Error initializing search and filter functionality.");
    }
  }

  function applySearchAndFilter() {
    try {
      console.log("Search/Filter: Starting applySearchAndFilter with:", {
        originalRowsCount: originalRows.length,
        currentSearchText: currentSearchText,
        currentSortOrder: currentSortOrder
      });

      if (originalRows.length === 0) {
        console.log("Search/Filter: No original rows found");
        filteredRows = [];
        updateTableDisplay();
        updateResultsCounter();
        return;
      }

      // Apply search filter
      let searchFiltered = originalRows.filter(row => {
        const eventCell = row.cells?.[0];
        const eventInput = eventCell?.querySelector(".event-input");

        if (!eventInput) {
          console.log("Search/Filter: No event input found in row");
          return false;
        }

        const eventName = eventInput.getAttribute("data-original") || eventInput.value || "";
        const eventNameLower = eventName.toLowerCase().trim();

        const matches = currentSearchText === "" || eventNameLower.startsWith(currentSearchText);
        console.log(`Search/Filter: Checking "${eventName}" against "${currentSearchText}" = ${matches}`);

        return matches;
      });

      console.log(`Search/Filter: After search filter: ${searchFiltered.length} rows`);

      // Apply sorting - Sort BY EVENT NAME - Compare ALL data by event names ONLY
      if (currentSortOrder === "a-z") {
        console.log("Search/Filter: Sorting A-Z by Event Name...");
        console.log("Search/Filter: Before sort:", searchFiltered.map(row => {
          const eventInput = row.cells?.[0]?.querySelector(".event-input");
          return eventInput?.getAttribute("data-original") || eventInput?.value || "";
        }));

        searchFiltered.sort((rowA, rowB) => {
          const eventInputA = rowA.cells?.[0]?.querySelector(".event-input");
          const eventInputB = rowB.cells?.[0]?.querySelector(".event-input");

          // Get event name from data-original attribute (saved value) for consistent sorting
          const eventNameA = (eventInputA?.getAttribute("data-original") || eventInputA?.value || "").trim();
          const eventNameB = (eventInputB?.getAttribute("data-original") || eventInputB?.value || "").trim();

          console.log(`Search/Filter: Comparing A-Z: "${eventNameA}" vs "${eventNameB}"`);

          // Case-insensitive comparison - A should come before Z
          const comparison = eventNameA.localeCompare(eventNameB, 'en', {
            numeric: true,
            sensitivity: 'base'
          });

          console.log(`Search/Filter: "${eventNameA}" vs "${eventNameB}" = ${comparison} (negative = A before B, positive = B before A)`);

          // If comparison is positive, we need to swap (return positive to put B after A)
          // If comparison is negative, A comes before B (return negative)
          // If comparison is 0, they're equal (return 0)
          return comparison;
        });

        console.log("Search/Filter: After sort:", searchFiltered.map(row => {
          const eventInput = row.cells?.[0]?.querySelector(".event-input");
          return eventInput?.getAttribute("data-original") || eventInput?.value || "";
        }));

      } else if (currentSortOrder === "z-a") {
        console.log("Search/Filter: Sorting Z-A by Event Name...");
        searchFiltered.sort((rowA, rowB) => {
          const eventInputA = rowA.cells?.[0]?.querySelector(".event-input");
          const eventInputB = rowB.cells?.[0]?.querySelector(".event-input");

          // Get event name from data-original attribute (saved value) for consistent sorting
          const eventNameA = (eventInputA?.getAttribute("data-original") || eventInputA?.value || "").trim();
          const eventNameB = (eventInputB?.getAttribute("data-original") || eventInputB?.value || "").trim();

          console.log(`Search/Filter: Comparing Z-A: "${eventNameA}" vs "${eventNameB}"`);

          // Case-insensitive reverse comparison
          const comparison = eventNameA.localeCompare(eventNameB, 'en', {
            numeric: true,
            sensitivity: 'base'
          });

          console.log(`Search/Filter: Comparison result: ${comparison}`);
          return -comparison; // Reverse the order
        });

        console.log("Search/Filter: Final Z-A order:", searchFiltered.map(row => {
          const eventInput = row.cells?.[0]?.querySelector(".event-input");
          return eventInput?.getAttribute("data-original") || eventInput?.value || "";
        }));

      } else if (currentSortOrder === "default") {
        console.log("Search/Filter: Default sort - maintaining original order");
        // For default sort, we don't need to sort - just use the filtered results as-is
        // This maintains the original order from the database
      }

      filteredRows = searchFiltered;
      console.log(`Search/Filter: Final filtered rows count: ${filteredRows.length}`);

      updateTableDisplay();
      updateResultsCounter();

    } catch (error) {
      console.error("Search/Filter apply error:", error);
      alert("Error applying search or filter.");
    }
  }

  function updateTableDisplay() {
    try {
      const tableBody = document.getElementById("promoTableBody");
      if (!tableBody) {
        console.error("Table display: Table body not found");
        return;
      }

      console.log(`Table display: Updating display with ${filteredRows.length} rows`);

      // Force clear all rows including no-results row
      tableBody.innerHTML = '';

      // Add filtered rows back in the new sorted order
      filteredRows.forEach((row, index) => {
        // Clone the row to avoid any potential issues with the original
        const clonedRow = row.cloneNode(true);
        tableBody.appendChild(clonedRow);
        console.log(`Table display: Added row ${index + 1} with event: ${clonedRow.cells?.[0]?.querySelector(".event-input")?.value || 'Unknown'}`);
      });

      console.log(`Table display: Display updated successfully with ${filteredRows.length} rows`);

      // Force a DOM refresh
      tableBody.style.display = 'none';
      tableBody.offsetHeight; // Trigger reflow
      tableBody.style.display = 'table-row-group';

    } catch (error) {
      console.error("Table display error:", error);
    }
  }

  function updateResultsCounter() {
    try {
      if (!resultsCounter) return;

      const total = originalRows.length;
      const showing = filteredRows.length;

      if (showing === total && currentSearchText === "" && currentSortOrder === "default") {
        resultsCounter.textContent = "";
      } else {
        resultsCounter.textContent = `Showing ${showing} of ${total} promos`;
        if (currentSearchText) {
          resultsCounter.textContent += ` (search: "${currentSearchText}")`;
        }
        if (currentSortOrder !== "default") {
          resultsCounter.textContent += ` (sorted: ${currentSortOrder.toUpperCase()})`;
        }
      }

    } catch (error) {
      console.error("Results counter error:", error);
    }
  }

  function clearSearchAndFilter() {
    try {
      currentSearchText = "";
      currentSortOrder = "default";

      const searchInput = document.getElementById("promoSearchInput");
      const sortButtons = document.querySelectorAll(".sort-btn");

      if (searchInput) {
        searchInput.value = "";
        console.log("Search/Filter: Search input cleared");
      }

      sortButtons.forEach(btn => {
        btn.classList.remove("active");
        const sortMode = btn.getAttribute("data-sort");
        if (sortMode === "default") {
          btn.classList.add("active");
          console.log("Search/Filter: Default sort button activated");
        }
      });

      console.log("Search/Filter: Applying default sort order");
      applySearchAndFilter();
    } catch (error) {
      console.error("Clear search/filter error:", error);
    }
  }

  // ===============================================
  // BULK ACTION FUNCTIONS - V9 Enhanced
  // ===============================================

  function handleUpdateAll() {
    console.log(`[2025-10-06 13:11:03] V9 Handling update all changes by MathDaenniel`);

    const rows = document.querySelectorAll('#promoTableBody tr[data-promo-id]');
    if (rows.length === 0) {
      alert('No promos found to update.');
      return;
    }

    const updatePromises = [];
    let updatesPending = 0;

    rows.forEach(row => {
      const promoId = row.dataset.promoId;
      const inputs = row.querySelectorAll('input, select');
      let hasChanges = false;

      inputs.forEach(input => {
        const originalValue = input.getAttribute('data-original');
        const currentValue = input.value;

        let original = originalValue;
        let current = currentValue;

        if (input.type === 'number' || input.integerValue) {
          original = parseFloat(originalValue) || 0;
          current = parseFloat(currentValue) || 0;
        }

        if (original != current) {
          hasChanges = true;
        }
      });

      if (hasChanges) {
        updatesPending++;
                updatePromises.push(handleUpdatePromo(promoId, true)); // true = silent mode for bulk
      }
    });

    if (updatesPending === 0) {
      alert('No changes detected to update.');
      return;
    }

    console.log(`[2025-10-06 13:11:03] V9 Updating ${updatesPending} promos by MathDaenniel`);

    Promise.allSettled(updatePromises).then(results => {
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      console.log(`[2025-10-06 13:11:03] V9 Update all results: ${successful} success, ${failed} failed by MathDaenniel`);

      setTimeout(() => {
        if (successful > 0) {
          window.location.href = `/admin/discounts?msg=bulk_update_success_${successful}`;
        } else {
          alert('No promos were updated. Check for errors.');
        }
      }, 1000);
    });
  }

  function handleDeleteAll() {
    console.log(`[2025-10-06 13:11:03] V9 Handling delete all promos by MathDaenniel`);

    const rows = document.querySelectorAll('#promoTableBody tr[data-promo-id]');
    if (rows.length === 0) {
      alert('No promos found to delete.');
      return;
    }

    const promoIds = Array.from(rows).map(row => row.dataset.promoId);
    console.log(`[2025-10-06 13:11:03] V9 Deleting ${promoIds.length} promos by MathDaenniel`);

    const deletePromises = promoIds.map(id => handleDeletePromoAsync(id));

    Promise.allSettled(deletePromises).then(results => {
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      console.log(`[2025-10-06 13:11:03] V9 Delete all results: ${successful} success, ${failed} failed by MathDaenniel`);

      setTimeout(() => {
        if (successful > 0) {
          window.location.href = `/admin/discounts?msg=bulk_delete_success_${successful}`;
        } else {
          alert('No promos were deleted. Check for errors.');
        }
      }, 1000);
    });
  }

  function handleDeletePromoAsync(promoId) {
    return fetch(`/admin/discounts/delete/${promoId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        console.log(`[2025-10-06 13:11:03] V9 Promo ${promoId} deleted successfully by MathDaenniel`);
        return data;
      } else {
        throw new Error(data.message || 'Delete failed');
      }
    });
  }

  // ===============================================
  // INITIALIZE ALL FUNCTIONALITY
  // ===============================================

  initializePromoDataCache();
  initializeSearchAndFilter();

  console.log(`[2025-10-06 13:11:03] V9 Enhanced Promo Management System with Search and Sort Fixed by MathDaenniel`);
});
