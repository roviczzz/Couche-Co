// Products Page JavaScript
document.addEventListener("DOMContentLoaded", () => {
  // ========== UTILITY FUNCTIONS ==========
  const $ = id => document.getElementById(id);
  const $$ = selector => document.querySelectorAll(selector);

  const createImageHTML = src => `<img src="${src}" style="width:100px;height:100px;object-fit:cover;border-radius:8px;">`;

  // ========== MODAL MANAGEMENT ==========
  const ModalManager = {
    show: modal => modal.classList.remove("hidden"),
    hide: modal => modal.classList.add("hidden"),
    toggle: modal => modal.classList.toggle("hidden")
  };

  // ========== IMAGE DROPBOX SETUP ==========
  const setupImageDropbox = (dropboxId, inputId, previewId) => {
    const dropbox = $(dropboxId);
    const input = $(inputId);
    const preview = $(previewId);

    const handleFile = file => {
      const reader = new FileReader();
      reader.onload = e => preview.innerHTML = createImageHTML(e.target.result);
      reader.readAsDataURL(file);
    };

    dropbox.addEventListener("click", () => input.click());
    input.addEventListener("change", () => input.files[0] && handleFile(input.files[0]));

    ["dragover", "dragleave", "drop"].forEach(event => {
      dropbox.addEventListener(event, e => {
        e.preventDefault();
        if (event === "drop") {
          dropbox.classList.remove("dragover");
          e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]);
        } else {
          dropbox.classList.toggle("dragover", event === "dragover");
        }
      });
    });
  };

  setupImageDropbox("addImageDropbox", "addImageFile", "addImagePreview");
  setupImageDropbox("editImageDropbox", "editImageFile", "editImagePreview");

  // ========== CHIP SYSTEM ==========
  const ChipSystem = {
    ingredients: [],
    addOns: [],

    init(containerId, inputId, hiddenId, suggestionsId, isAddOn = false) {
      const container = $(containerId);
      const input = $(inputId);
      const hidden = $(hiddenId);
      const suggestions = $(suggestionsId);
      const items = isAddOn ? this.addOns : this.ingredients;

      const updateHidden = () => hidden.value = JSON.stringify(items);

      const createChip = (id, name, isMilktea = false) => {
        if (!id || items.some(item => item[isAddOn ? 'addOnID' : 'ingredientID'] === id)) return;

        const itemObj = {
          [isAddOn ? 'addOnID' : 'ingredientID']: id,
          name,
          [isAddOn ? 'usedGrams16oz' : 'usedGrams']: isAddOn ? 0 : (isMilktea ? { "16oz": 0, "22oz": 0 } : 0),
          ...(isAddOn && { usedGrams22oz: 0 })
        };

        items.push(itemObj);
        const chip = document.createElement("div");
        chip.className = "chip";

        const inputsHtml = isAddOn ? `
          <span class="chip-separator">|</span>
          <span class="chip-grams-label">16oz:</span>
          <input type="number" class="chip-grams-input chip-grams-16oz" value="0" min="0" step="0.1" placeholder="g">
          <span class="chip-grams-label">22oz:</span>
          <input type="number" class="chip-grams-input chip-grams-22oz" value="0" min="0" step="0.1" placeholder="g">
          <span class="chip-unit">g</span>
        ` : (isMilktea ? `
          <span class="chip-separator">|</span>
          <span class="chip-grams-label">16oz:</span>
          <input type="number" class="chip-grams-input chip-grams-16oz" value="0" min="0" step="0.1" placeholder="g">
          <span class="chip-grams-label">22oz:</span>
          <input type="number" class="chip-grams-input chip-grams-22oz" value="0" min="0" step="0.1" placeholder="g">
          <span class="chip-unit">g</span>
        ` : `
          <span class="chip-separator">|</span>
          <span class="chip-grams-label">Used:</span>
          <input type="number" class="chip-grams-input" value="0" min="0" step="0.1" placeholder="g">
          <span class="chip-unit">g</span>
        `);

        chip.innerHTML = `<span class="chip-name">${name}</span>${inputsHtml}<span class="chip-remove">&times;</span>`;

        // Event listeners for inputs
        if (isAddOn) {
          chip.querySelector(".chip-grams-16oz").addEventListener("input", e => {
            itemObj.usedGrams16oz = parseFloat(e.target.value) || 0;
            updateHidden();
          });
          chip.querySelector(".chip-grams-22oz").addEventListener("input", e => {
            itemObj.usedGrams22oz = parseFloat(e.target.value) || 0;
            updateHidden();
          });
        } else if (isMilktea) {
          chip.querySelector(".chip-grams-16oz").addEventListener("input", e => {
            itemObj.usedGrams["16oz"] = parseFloat(e.target.value) || 0;
            updateHidden();
          });
          chip.querySelector(".chip-grams-22oz").addEventListener("input", e => {
            itemObj.usedGrams["22oz"] = parseFloat(e.target.value) || 0;
            updateHidden();
          });
        } else {
          chip.querySelector(".chip-grams-input").addEventListener("input", e => {
            itemObj.usedGrams = parseFloat(e.target.value) || 0;
            updateHidden();
          });
        }

        chip.querySelector(".chip-remove").addEventListener("click", () => {
          const index = items.findIndex(item => item[isAddOn ? 'addOnID' : 'ingredientID'] === id);
          if (index > -1) items.splice(index, 1);
          chip.remove();
          updateHidden();
        });

        container.insertBefore(chip, input);
        input.value = "";
        updateHidden();
      };

      // Debounced search
      let debounceTimeout;
      input.addEventListener("input", () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(async () => {
          const query = input.value.trim();
          suggestions.innerHTML = "";
          if (!query) return;

          try {
            const endpoint = isAddOn ? '/api/addons/search' : '/api/ingredients/search';
            const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`);
            const results = await res.json();

            const uniqueNames = new Set();
            const filteredResults = results.filter(item => {
              const name = item.Name || item.itemName || item.name || `Unknown ${isAddOn ? 'Add-on' : 'Ingredient'}`;
              const lowerName = name.toLowerCase();
              const id = item[isAddOn ? 'AddOnID' : 'IngredientID'] || item[isAddOn ? 'addOnID' : 'ingredientID'] || item.id || 'unknown';
              if (uniqueNames.has(lowerName) || items.some(existing => existing[isAddOn ? 'addOnID' : 'ingredientID'] === id)) return false;
              uniqueNames.add(lowerName);
              return true;
            });

            filteredResults.forEach(item => {
              const name = item.Name || item.itemName || item.name || `Unknown ${isAddOn ? 'Add-on' : 'Ingredient'}`;
              const id = item[isAddOn ? 'AddOnID' : 'addOnID'] || item[isAddOn ? 'addOnID' : 'ingredientID'] || item.id || 'unknown';
              const div = document.createElement("div");
              div.textContent = name;
              div.addEventListener("click", () => {
                const isMilktea = !isAddOn && $("categorySelect").value === "MT";
                createChip(id, name, isMilktea);
                suggestions.innerHTML = "";
              });
              suggestions.appendChild(div);
            });
          } catch (err) {
            console.error(err);
          }
        }, 200);
      });

      // Clear suggestions on outside click
      document.addEventListener("click", e => {
        if (e.target !== input) suggestions.innerHTML = "";
      });

      // Prevent Enter key submission
      input.addEventListener("keydown", e => {
        if (e.key === "Enter") e.preventDefault();
      });

      return { createChip, updateHidden };
    }
  };

  // Initialize chip systems
  const ingredientsSystem = ChipSystem.init("chipContainer", "chipInput", "hiddenIngredients", "suggestions");
  const addOnsSystem = ChipSystem.init("addOnsChipContainer", "addOnsChipInput", "hiddenAddOns", "addOnsSuggestions", true);

  // ---------- PRICE INPUT VALIDATION ----------
  function restrictToNumeric(input) {
    input.addEventListener('keydown', function(e) {
      // Allow: backspace, delete, tab, escape, enter, and decimal point
      if ([46, 8, 9, 27, 13, 110, 190].indexOf(e.keyCode) !== -1 ||
          // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
          (e.keyCode === 65 && e.ctrlKey === true) ||
          (e.keyCode === 67 && e.ctrlKey === true) ||
          (e.keyCode === 86 && e.ctrlKey === true) ||
          (e.keyCode === 88 && e.ctrlKey === true) ||
          (e.keyCode === 90 && e.ctrlKey === true) ||
          // Allow: home, end, left, right
          (e.keyCode >= 35 && e.keyCode <= 39)) {
        // Let it happen, don't do anything
        return;
      }
      // Ensure that it is a number and stop the keypress
      if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
        e.preventDefault();
      }
    });

    input.addEventListener('input', function(e) {
      // Remove any non-numeric characters except decimal point
      let value = this.value;
      value = value.replace(/[^0-9.]/g, '');
      // Ensure only one decimal point
      const parts = value.split('.');
      if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
      }
      this.value = value;
    });

    input.addEventListener('paste', function(e) {
      // Allow paste but clean it up
      setTimeout(() => {
        let value = this.value;
        value = value.replace(/[^0-9.]/g, '');
        const parts = value.split('.');
        if (parts.length > 2) {
          value = parts[0] + '.' + parts.slice(1).join('');
        }
        this.value = value;
      }, 0);
    });
  }

  // Apply numeric restriction to all price inputs
  const priceInputs = [
    document.querySelector('input[name="size16"]'),
    document.querySelector('input[name="size22"]'),
    document.querySelector('input[name="BasePrice"]'),
    document.getElementById('editSize16'),
    document.getElementById('editSize22'),
    document.getElementById('editBasePrice')
  ];

  priceInputs.forEach(input => {
    if (input) restrictToNumeric(input);
  });

  // ========== CATEGORY FIELD MANAGEMENT ==========
  const CategoryManager = {
    elements: {
      select: $("categorySelect"),
      basePriceContainer: $("basePriceContainer"),
      priceRow: $("priceRow"),
      quantityContainer: $("quantityContainer"),
      ingredientsContainer: $("ingredientsContainer"),
      addOnsContainer: $("addOnsContainer")
    },

    toggleFields() {
      const category = this.elements.select.value;
      const isPastries = category === "BK";
      const isDrink = ["CF", "FT", "MT"].includes(category);

      // Toggle visibility based on category
      this.elements.basePriceContainer.classList.toggle("hidden", !isPastries);
      this.elements.priceRow.classList.toggle("hidden", isPastries);
      this.elements.quantityContainer.classList.toggle("hidden", !isPastries);
      this.elements.ingredientsContainer.classList.toggle("hidden", isPastries);
      this.elements.addOnsContainer.classList.toggle("hidden", !isDrink);
    },

    clearChips() {
      // Clear ingredients
      ChipSystem.ingredients.length = 0;
      $$('.chip').forEach(chip => chip.remove());
      ingredientsSystem.updateHidden();

      // Clear add-ons
      ChipSystem.addOns.length = 0;
      $$('.chip').forEach(chip => chip.remove());
      addOnsSystem.updateHidden();
    },

    init() {
      this.elements.select.addEventListener("change", () => {
        this.toggleFields();
        this.clearChips();
      });
      this.toggleFields(); // Initial state
    }
  };

  CategoryManager.init();

  // ---------- EDIT PRODUCT MODAL ----------
  const editModal = document.getElementById("editProductModal");
  const editForm = document.getElementById("editProductForm");

  // Cache DOM elements for better performance
  const editElements = {
    name: document.getElementById("editName"),
    categoryDisplay: document.getElementById("editCategoryDisplay"),
    categoryHidden: document.getElementById("editCategoryHidden"),
    basePriceContainer: document.getElementById("editBasePriceContainer"),
    quantityContainer: document.getElementById("editQuantityContainer"),
    priceRow: document.getElementById("editPriceRow"),
    basePrice: document.getElementById("editBasePrice"),
    quantity: document.getElementById("editQuantity"),
    size16: document.getElementById("editSize16"),
    size22: document.getElementById("editSize22"),
    description: document.getElementById("editDescription"),
    allergen: document.getElementById("editAllergen"),
    enabled: document.getElementById("editEnabled"),
    imagePreview: document.getElementById("editImagePreview"),
    cancelBtn: document.getElementById("cancelEdit")
  };

  // Optimized modal state management
  const editModalState = {
    show: () => editModal.classList.remove("hidden"),
    hide: () => editModal.classList.add("hidden"),
    reset: () => {
      // Clear all form fields efficiently
      Object.values(editElements).forEach(element => {
        if (element) {
          if (element.type === 'checkbox') {
            element.checked = false;
          } else if (element.tagName === 'SELECT' || element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.value = '';
          } else if (element.id === 'editImagePreview') {
            element.innerHTML = '';
          }
        }
      });
      // Reset container visibility
      editElements.basePriceContainer.style.display = 'none';
      editElements.quantityContainer.style.display = 'none';
      editElements.priceRow.style.display = 'none';
    }
  };

  // Optimized data population functions
  const populateDrinkFields = (product) => {
    editElements.basePriceContainer.style.display = 'none';
    editElements.quantityContainer.style.display = 'none';
    editElements.priceRow.style.display = 'block';

    if (product.Sizes && Array.isArray(product.Sizes)) {
      const size16 = product.Sizes.find(s => (s.Size || s.size) === "16oz");
      const size22 = product.Sizes.find(s => (s.Size || s.size) === "22oz");
      editElements.size16.value = size16 ? (size16.BasePrice || size16.basePrice || '') : '';
      editElements.size22.value = size22 ? (size22.BasePrice || size22.basePrice || '') : '';
    } else {
      editElements.size16.value = '';
      editElements.size22.value = '';
    }
  };

  const populatePastryFields = (product) => {
    editElements.basePriceContainer.style.display = 'block';
    editElements.quantityContainer.style.display = 'block';
    editElements.priceRow.style.display = 'none';

    editElements.basePrice.value = product.BasePrice || product.basePrice || '';
    editElements.quantity.value = product.Quantity || '';
  };

  // Ultra-fast product data loading with minimal DOM manipulation delays
  const loadProductData = async (productId) => {
    try {
      const response = await fetch(`/admin/api/products/${productId}`);
      if (!response.ok) throw new Error('Failed to fetch product data');

      const data = await response.json();
      const product = data.product;

      // Handle category-specific fields first for immediate field setup
      const isPastry = product.Category === "Pastries" || product.Category === "BK";
      isPastry ? populatePastryFields(product) : populateDrinkFields(product);

      // Ultra-fast DOM updates using direct property access and requestAnimationFrame for smooth rendering
      requestAnimationFrame(() => {
        // Batch all updates in a single animation frame for maximum performance
        editElements.name.value = product.Name || '';
        editElements.categoryDisplay.value = product.Category || '';
        editElements.categoryHidden.value = product.Category || '';
        editElements.description.value = product.Description || product.description || '';
        editElements.allergen.value = product.Allergen || product.allergen || '';
        editElements.enabled.checked = !!product.isEnabled;

        const imageSrc = product.imagelink || product.imageLink;
        editElements.imagePreview.innerHTML = imageSrc
          ? createImageHTML(imageSrc)
          : '';
      });

      return true;
    } catch (error) {
      console.error('Error loading product data:', error);
      alert('Failed to load product data');
      return false;
    }
  };

  // Optimized edit button event delegation - Show modal immediately, load data in background
  document.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.edit-btn');
    if (!editBtn) return;

    e.preventDefault();
    const productCard = editBtn.closest('.product-card');
    if (!productCard) return;

    const productId = productCard.dataset.id;
    if (!productId) return;

    // Show modal immediately for instant feedback
    editModalState.reset();
    editForm.action = `/admin/products/edit/${productId}`;
    editModalState.show();

    // Load data in background and update modal content
    loadProductData(productId).catch(error => {
      console.error('Failed to load product data for edit modal:', error);
      editModalState.hide();
      alert('Failed to load product data');
    });
  });

  // Optimized cancel button
  editElements.cancelBtn.addEventListener('click', editModalState.hide);



  // ---------- EDIT MODAL: ENABLE/DISABLE LIKE OUTSIDE TOGGLE ----------
  editElements.enabled.addEventListener("change", async () => {
    const productId = editForm.action.split("/").pop(); // get ID from form action
    const newValue = editElements.enabled.checked;

    try {
      const res = await fetch(`/admin/toggle-availability/${productId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: newValue })
      });

      if (!res.ok) throw new Error("Failed to toggle availability");

      // Update the product card outside modal if exists
      const card = document.querySelector(`.product-card[data-id='${productId}']`);
      if (card) {
        card.dataset.enabled = newValue;
        if (newValue) card.classList.add("enabled");
        else card.classList.remove("enabled");
      }

    } catch (err) {
      console.error(err);
      alert("Failed to update product availability");
      // revert checkbox in case of error
      editElements.enabled.checked = !newValue;
    }
  });

  // ========== CONFIRMATION MODALS ==========
  const ConfirmationModal = {
    delete: {
      modal: $("deleteConfirmModal"),
      productId: "",
      confirmBtn: $("confirmDelete"),
      cancelBtn: $("cancelDelete"),

      init() {
        // Delete button event delegation
        document.addEventListener('click', (e) => {
          const deleteBtn = e.target.closest('.delete-btn');
          if (!deleteBtn) return;

          e.preventDefault();
          this.productId = deleteBtn.getAttribute("data-url").split('/').pop();
          ModalManager.show(this.modal);
        });

        // Confirm delete
        this.confirmBtn.addEventListener('click', async () => {
          try {
            const response = await fetch(`/admin/delete-product/${this.productId}`, { method: "POST" });
            const data = await response.json();

            if (data.success) {
              const card = document.querySelector(`.product-card[data-id='${this.productId}']`);
              card?.remove();
              ModalManager.hide(this.modal);
            } else {
              alert(data.message || "Failed to delete product.");
            }
          } catch (error) {
            console.error('Delete error:', error);
            alert("Error deleting product.");
          }
        });

        // Cancel delete
        this.cancelBtn.addEventListener('click', () => {
          ModalManager.hide(this.modal);
          this.productId = "";
        });
      }
    },

    toggle: {
      modal: $("toggleConfirmModal"),
      productId: "",
      confirmBtn: $("confirmToggle"),
      cancelBtn: $("cancelToggle"),

      init() {
        // Product card click for toggle (excluding edit/delete buttons)
        document.addEventListener('click', (e) => {
          const productCard = e.target.closest('.product-card');
          if (!productCard || e.target.closest('.edit-btn') || e.target.closest('.delete-btn')) return;

          e.preventDefault();
          this.productId = productCard.dataset.id;
          ModalManager.show(this.modal);
        });

        // Confirm toggle
        this.confirmBtn.addEventListener('click', async () => {
          try {
            const currentCard = document.querySelector(`.product-card[data-id="${this.productId}"]`);
            const currentlyEnabled = currentCard.dataset.enabled === "true";
            const newValue = !currentlyEnabled;

            const response = await fetch(`/admin/toggle-availability/${this.productId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isEnabled: newValue })
            });

            if (response.ok) {
              // Update UI on success
              currentCard.dataset.enabled = newValue;
              currentCard.classList.toggle("enabled", newValue);
              ModalManager.hide(this.modal);
            } else {
              alert("Failed to toggle availability");
            }
          } catch (error) {
            console.error("Toggle error:", error);
            alert("Request failed: " + error.message);
          }
        });

        // Cancel toggle
        this.cancelBtn.addEventListener('click', () => ModalManager.hide(this.modal));
      }
    }
  };

  // Initialize confirmation modals
  ConfirmationModal.delete.init();
  ConfirmationModal.toggle.init();

  // ========== ADD PRODUCT MODAL ==========
  const addModal = $("addProductModal");
  const openAddBtn = $("openAddModal");
  const cancelAddBtn = $("cancelAdd");

  openAddBtn.addEventListener('click', () => ModalManager.show(addModal));
  cancelAddBtn.addEventListener('click', () => ModalManager.hide(addModal));
});
