// Products Page JavaScript
document.addEventListener("DOMContentLoaded", () => {
  // ---------- ADD PRODUCT MODAL ----------
  const addModal = document.getElementById("addProductModal");
  document.getElementById("openAddModal").addEventListener("click", () => addModal.classList.remove("hidden"));
  document.getElementById("cancelAdd").addEventListener("click", () => addModal.classList.add("hidden"));



  // ---------- IMAGE DROPBOX SETUP ----------
  function setupImageDropbox(dropboxId, inputId, previewId) {
    const dropbox = document.getElementById(dropboxId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);

    dropbox.addEventListener("click", () => input.click());

    // Handle file selection
    input.addEventListener("change", () => {
      if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => preview.innerHTML = `<img src="${e.target.result}" style="width:100px;height:100px;object-fit:cover;border-radius:8px;">`;
        reader.readAsDataURL(input.files[0]);
      }
    });

    // Drag & Drop
    dropbox.addEventListener("dragover", e => {
      e.preventDefault();
      dropbox.classList.add("dragover");
    });
    dropbox.addEventListener("dragleave", e => {
      e.preventDefault();
      dropbox.classList.remove("dragover");
    });
    dropbox.addEventListener("drop", e => {
      e.preventDefault();
      dropbox.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        input.files = e.dataTransfer.files;
        const reader = new FileReader();
        reader.onload = ev => preview.innerHTML = `<img src="${ev.target.result}" style="width:100px;height:100px;object-fit:cover;border-radius:8px;">`;
        reader.readAsDataURL(e.dataTransfer.files[0]);
      }
    });
  }

  setupImageDropbox("addImageDropbox", "addImageFile", "addImagePreview");
  setupImageDropbox("editImageDropbox", "editImageFile", "editImagePreview");

  // ---------- INGREDIENT CHIPS ----------
  const chipContainer = document.getElementById("chipContainer");
  const chipInput = document.getElementById("chipInput");
  const hiddenIngredients = document.getElementById("hiddenIngredients");
  const suggestionsBox = document.getElementById("suggestions");
  let ingredients = []; // array of { ingredientID: string, usedGrams: number }

  function updateHiddenInput() {
    hiddenIngredients.value = JSON.stringify(ingredients);
  }

  // ---------- ADD-ONS CHIPS ----------
  const addOnsChipContainer = document.getElementById("addOnsChipContainer");
  const addOnsChipInput = document.getElementById("addOnsChipInput");
  const hiddenAddOns = document.getElementById("hiddenAddOns");
  const addOnsSuggestionsBox = document.getElementById("addOnsSuggestions");
  let addOns = []; // array of { addOnID: string, name: string, usedGrams16oz: number, usedGrams22oz: number }

  function updateHiddenAddOns() {
    hiddenAddOns.value = JSON.stringify(addOns);
  }

  function addAddOnChip(id, name) {
    if (!id || addOns.some(addOn => addOn.addOnID === id)) return;

    const addOnObj = {
      addOnID: id,
      name: name,
      usedGrams16oz: 0,
      usedGrams22oz: 0
    };
    addOns.push(addOnObj);

    const chip = document.createElement("div");
    chip.className = "chip";

    chip.innerHTML = `
      <span class="chip-name">${name}</span>
      <span class="chip-separator">|</span>
      <span class="chip-grams-label">16oz:</span>
      <input type="number" class="chip-grams-input chip-grams-16oz" value="0" min="0" step="0.1" placeholder="g">
      <span class="chip-grams-label">22oz:</span>
      <input type="number" class="chip-grams-input chip-grams-22oz" value="0" min="0" step="0.1" placeholder="g">
      <span class="chip-unit">g</span>
      <span class="chip-remove">&times;</span>
    `;

    // Handle grams input changes
    const grams16oz = chip.querySelector(".chip-grams-16oz");
    const grams22oz = chip.querySelector(".chip-grams-22oz");

    grams16oz.addEventListener("input", (e) => {
      addOnObj.usedGrams16oz = parseFloat(e.target.value) || 0;
      updateHiddenAddOns();
    });

    grams22oz.addEventListener("input", (e) => {
      addOnObj.usedGrams22oz = parseFloat(e.target.value) || 0;
      updateHiddenAddOns();
    });

    // Handle remove button
    chip.querySelector(".chip-remove").addEventListener("click", () => {
      addOns = addOns.filter(addOn => addOn.addOnID !== id);
      chip.remove();
      updateHiddenAddOns();
    });

    addOnsChipContainer.insertBefore(chip, addOnsChipInput);
    addOnsChipInput.value = "";
    updateHiddenAddOns();
  }

  function addChip(id, name) {
    if (!id || ingredients.some(ing => ing.ingredientID === id)) return;

    const categorySelect = document.getElementById("categorySelect");
    const isMilktea = categorySelect.value === "MT"; // MT = Milktea

    const ingredientObj = {
      ingredientID: id,
      name: name,
      usedGrams: isMilktea ? { "16oz": 0, "22oz": 0 } : 0
    };
    ingredients.push(ingredientObj);

    const chip = document.createElement("div");
    chip.className = "chip";

    let inputsHtml = "";
    if (isMilktea) {
      inputsHtml = `
        <span class="chip-separator">|</span>
        <span class="chip-grams-label">16oz:</span>
        <input type="number" class="chip-grams-input chip-grams-16oz" value="0" min="0" step="0.1" placeholder="g">
        <span class="chip-grams-label">22oz:</span>
        <input type="number" class="chip-grams-input chip-grams-22oz" value="0" min="0" step="0.1" placeholder="g">
        <span class="chip-unit">g</span>
      `;
    } else {
      inputsHtml = `
        <span class="chip-separator">|</span>
        <span class="chip-grams-label">Used:</span>
        <input type="number" class="chip-grams-input" value="0" min="0" step="0.1" placeholder="g">
        <span class="chip-unit">g</span>
      `;
    }

    chip.innerHTML = `
      <span class="chip-name">${name}</span>
      ${inputsHtml}
      <span class="chip-remove">&times;</span>
    `;

    // Handle grams input changes
    if (isMilktea) {
      const grams16oz = chip.querySelector(".chip-grams-16oz");
      const grams22oz = chip.querySelector(".chip-grams-22oz");

      grams16oz.addEventListener("input", (e) => {
        ingredientObj.usedGrams["16oz"] = parseFloat(e.target.value) || 0;
        updateHiddenInput();
      });

      grams22oz.addEventListener("input", (e) => {
        ingredientObj.usedGrams["22oz"] = parseFloat(e.target.value) || 0;
        updateHiddenInput();
      });
    } else {
      const gramsInput = chip.querySelector(".chip-grams-input");
      gramsInput.addEventListener("input", (e) => {
        ingredientObj.usedGrams = parseFloat(e.target.value) || 0;
        updateHiddenInput();
      });
    }

    // Handle remove button
    chip.querySelector(".chip-remove").addEventListener("click", () => {
      ingredients = ingredients.filter(ing => ing.ingredientID !== id);
      chip.remove();
      updateHiddenInput();
    });

    chipContainer.insertBefore(chip, chipInput);
    chipInput.value = "";
    updateHiddenInput();
  }

  let debounceTimeout;
  chipInput.addEventListener("input", () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(async () => {
      const query = chipInput.value.trim();
      suggestionsBox.innerHTML = "";
      if (!query) return;
      try {
        const res = await fetch(`/api/ingredients/search?q=${encodeURIComponent(query)}`);
        let results = await res.json();

        const uniqueNames = new Set();
        const filteredResults = results.filter(item => {
          const name = item.Name || item.itemName || item.name || 'Unknown Ingredient';
          const lowerName = name.toLowerCase();
          const id = item.IngredientID || item.ingredientID || item.id || 'unknown';
          if (uniqueNames.has(lowerName) || ingredients.some(ing => ing.ingredientID === id)) return false;
          uniqueNames.add(lowerName);
          return true;
        });

        filteredResults.forEach(item => {
          const name = item.Name || item.itemName || item.name || 'Unknown Ingredient';
          const id = item.IngredientID || item.ingredientID || item.id || 'unknown';
          const div = document.createElement("div");
          div.textContent = name;
          div.addEventListener("click", () => {
            addChip(id, name);
            suggestionsBox.innerHTML = "";
          });
          suggestionsBox.appendChild(div);
        });

      } catch (err) {
        console.error(err);
      }
    }, 200);
  });

  document.addEventListener("click", e => {
    if (e.target !== chipInput) suggestionsBox.innerHTML = "";
  });

  chipInput.addEventListener("keydown", e => {
    if (e.key === "Enter") e.preventDefault();
  });

  // ---------- ADD-ONS INPUT HANDLING ----------
  let addOnsDebounceTimeout;
  addOnsChipInput.addEventListener("input", () => {
    clearTimeout(addOnsDebounceTimeout);
    addOnsDebounceTimeout = setTimeout(async () => {
      const query = addOnsChipInput.value.trim();
      addOnsSuggestionsBox.innerHTML = "";
      if (!query) return;
      try {
        const res = await fetch(`/api/addons/search?q=${encodeURIComponent(query)}`);
        let results = await res.json();

        const uniqueNames = new Set();
        const filteredResults = results.filter(item => {
          const name = item.Name || item.itemName || item.name || 'Unknown Add-on';
          const lowerName = name.toLowerCase();
          const id = item.AddOnID || item.addOnID || item.id || 'unknown';
          if (uniqueNames.has(lowerName) || addOns.some(addOn => addOn.addOnID === id)) return false;
          uniqueNames.add(lowerName);
          return true;
        });

        filteredResults.forEach(item => {
          const name = item.Name || item.itemName || item.name || 'Unknown Add-on';
          const id = item.AddOnID || item.addOnID || item.id || 'unknown';
          const div = document.createElement("div");
          div.textContent = name;
          div.addEventListener("click", () => {
            addAddOnChip(id, name);
            addOnsSuggestionsBox.innerHTML = "";
          });
          addOnsSuggestionsBox.appendChild(div);
        });

      } catch (err) {
        console.error(err);
      }
    }, 200);
  });

  document.addEventListener("click", e => {
    if (e.target !== addOnsChipInput) addOnsSuggestionsBox.innerHTML = "";
  });

  addOnsChipInput.addEventListener("keydown", e => {
    if (e.key === "Enter") e.preventDefault();
  });

  // ---------- CATEGORY TOGGLE ----------
  const categorySelect = document.getElementById("categorySelect");
  const basePriceContainer = document.getElementById("basePriceContainer");
  const priceRow = document.getElementById("priceRow");
  const quantityContainer = document.getElementById("quantityContainer");
  const ingredientsContainer = document.getElementById("ingredientsContainer");
  const addOnsContainer = document.getElementById("addOnsContainer");

  function toggleFields() {
    const isPastries = categorySelect.value === "BK"; // BK = Pastries
    const isDrink = ["CF", "FT", "MT"].includes(categorySelect.value); // CF = Coffee, FT = Fruit Tea, MT = Milktea

    if (isPastries) {
      basePriceContainer.classList.remove("hidden");
      priceRow.classList.add("hidden");
      quantityContainer.classList.remove("hidden");
      ingredientsContainer.classList.add("hidden");
      addOnsContainer.classList.add("hidden");
    } else {
      basePriceContainer.classList.add("hidden");
      priceRow.classList.remove("hidden");
      quantityContainer.classList.add("hidden");
      ingredientsContainer.classList.remove("hidden");

      // Show add-ons for all drink categories (Coffee, Fruit Tea, Milktea)
      if (isDrink) {
        addOnsContainer.classList.remove("hidden");
      } else {
        addOnsContainer.classList.add("hidden");
      }
    }
  }

  categorySelect.addEventListener("change", () => {
    toggleFields();
    // Clear ingredients when category changes, since different categories have different formats
    ingredients = [];
    chipContainer.querySelectorAll('.chip').forEach(chip => chip.remove());
    updateHiddenInput();

    // Clear add-ons when category changes
    addOns = [];
    addOnsChipContainer.querySelectorAll('.chip').forEach(chip => chip.remove());
    updateHiddenAddOns();
  });
  toggleFields();

  // ---------- EDIT PRODUCT MODAL ----------
  const editModal = document.getElementById("editProductModal");
  const editForm = document.getElementById("editProductForm");
  const editCategoryHidden = document.getElementById("editCategoryHidden");
  const editBasePriceContainer = document.getElementById("editBasePriceContainer");
  const editPriceRow = document.getElementById("editPriceRow");
  const editEnabledCheckbox = document.getElementById("editEnabled");



  // Open edit modal
  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", async e => {
      e.preventDefault();
      const card = btn.closest(".product-card");
      const id = card.dataset.id;

      editForm.action = `/admin/products/edit/${id}`;

      try {
        const res = await fetch(`/admin/api/products/${id}`);
        const data = await res.json();
        const p = data.product;

        document.getElementById("editName").value = p.Name || "";
        document.getElementById("editCategoryDisplay").value = p.Category || "";
        editCategoryHidden.value = p.Category || "";

        // Check if this is a pastries product
        const isPastries = p.Category === "Pastries" || p.Category === "BK";

        if (isPastries) {
          // For pastries: show BasePrice, hide size-specific prices
          editBasePriceContainer.style.display = "block";
          editPriceRow.style.display = "none";
          document.getElementById("editBasePrice").value = p.BasePrice || p.basePrice || "";
        } else {
          // For drinks: show size-specific prices, hide BasePrice
          editBasePriceContainer.style.display = "none";
          editPriceRow.style.display = "block";

          if (p.Sizes && Array.isArray(p.Sizes)) {
            const size16 = p.Sizes.find(s => s.Size === "16oz" || s.size === "16oz");
            const size22 = p.Sizes.find(s => s.Size === "22oz" || s.size === "22oz");
            document.getElementById("editSize16").value = size16 ? (size16.BasePrice || size16.basePrice) : "";
            document.getElementById("editSize22").value = size22 ? (size22.BasePrice || size22.basePrice) : "";
          } else {
            document.getElementById("editSize16").value = "";
            document.getElementById("editSize22").value = "";
          }
        }

        document.getElementById("editDescription").value = p.Description || p.description || "";
        document.getElementById("editAllergen").value = p.Allergen || p.allergen || "";
        editEnabledCheckbox.checked = !!p.isEnabled;

        if (p.imagelink || p.imageLink) {
          document.getElementById("editImagePreview").innerHTML =
            `<img src="${p.imagelink || p.imageLink}" style="width:100px;height:100px;object-fit:cover;border-radius:8px;">`;
        } else {
          document.getElementById("editImagePreview").innerHTML = "";
        }

        editModal.classList.remove("hidden");
      } catch (err) {
        console.error(err);
        alert("Failed to load product data");
      }
    });
  });

  // Cancel edit modal
  document.getElementById("cancelEdit").addEventListener("click", () => editModal.classList.add("hidden"));



  // ---------- EDIT MODAL: ENABLE/DISABLE LIKE OUTSIDE TOGGLE ----------
  editEnabledCheckbox.addEventListener("change", async () => {
    const productId = editForm.action.split("/").pop(); // get ID from form action
    const newValue = editEnabledCheckbox.checked;

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
      editEnabledCheckbox.checked = !newValue;
    }
  });

  // ---------- DELETE MODAL ----------
  let deleteProductId = "";
  const deleteModal = document.getElementById("deleteConfirmModal");
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      deleteProductId = btn.getAttribute("data-url").split('/').pop();
      deleteModal.classList.remove("hidden");
    });
  });

  document.getElementById("confirmDelete").addEventListener("click", () => {
    fetch(`/admin/delete-product/${deleteProductId}`, { method: "POST" })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const card = document.querySelector(`.product-card[data-id='${deleteProductId}']`);
          if (card) card.remove();
          deleteModal.classList.add("hidden");
        } else {
          alert(data.message || "Failed to delete product.");
        }
      })
      .catch(err => {
        console.error(err);
        alert("Error deleting product.");
      });
  });

  document.getElementById("cancelDelete").addEventListener("click", () => {
    deleteModal.classList.add("hidden");
    deleteProductId = "";
  });

  // ---------- TOGGLE AVAILABILITY ----------
  let toggleProductId = "";
  const toggleModal = document.getElementById("toggleConfirmModal");
  document.querySelectorAll(".product-card").forEach(card => {
    card.addEventListener("click", e => {
      if (e.target.closest(".edit-btn") || e.target.closest(".delete-btn")) return;
      toggleProductId = card.dataset.id;
      toggleModal.classList.remove("hidden");
    });
  });

  document.getElementById("confirmToggle").addEventListener("click", () => {
    const currentCard = document.querySelector(`.product-card[data-id="${toggleProductId}"]`);
    const currentlyEnabled = currentCard.dataset.enabled === "true";
    const newValue = !currentlyEnabled;
    fetch(`/admin/toggle-availability/${toggleProductId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled: newValue })
    })
    .then(res => res.ok ? location.reload() : alert("Failed"))
    .catch(err => {
      console.error("Toggle error:", err);
      alert("Request failed: " + err);
    });
    toggleModal.classList.add("hidden");
  });

  document.getElementById("cancelToggle").addEventListener("click", () => toggleModal.classList.add("hidden"));
});
