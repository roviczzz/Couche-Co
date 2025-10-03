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
  let ingredients = []; // selected ingredient IDs

  function updateHiddenInput() {
    hiddenIngredients.value = ingredients.join(",");
  }

  function addChip(id, name) {
    if (!id || ingredients.includes(id)) return;
    ingredients.push(id);
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.innerHTML = `${name} <span>&times;</span>`;
    chip.querySelector("span").addEventListener("click", () => {
      ingredients = ingredients.filter(i => i !== id);
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
          const lowerName = item.Name.toLowerCase();
          if (uniqueNames.has(lowerName) || ingredients.includes(item.IngredientID)) return false;
          uniqueNames.add(lowerName);
          return true;
        });

        filteredResults.forEach(item => {
          const div = document.createElement("div");
          div.textContent = item.Name;
          div.addEventListener("click", () => {
            addChip(item.IngredientID, item.Name);
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

  // ---------- CATEGORY TOGGLE ----------
  const categorySelect = document.getElementById("categorySelect");
  const basePriceContainer = document.getElementById("basePriceContainer");
  const priceRow = document.getElementById("priceRow");

  function togglePriceFields() {
    if (categorySelect.value === "BK") { // BK = Pastries
      basePriceContainer.classList.remove("hidden");
      priceRow.classList.add("hidden");
    } else {
      basePriceContainer.classList.add("hidden");
      priceRow.classList.remove("hidden");
    }
  }

  categorySelect.addEventListener("change", togglePriceFields);
  togglePriceFields();

  // ---------- EDIT PRODUCT MODAL ----------
  const editModal = document.getElementById("editProductModal");
  const editForm = document.getElementById("editProductForm");
  const editCategoryHidden = document.getElementById("editCategoryHidden");
  const editBasePriceContainer = document.getElementById("editBasePriceContainer");
  const editPriceRow = document.getElementById("editPriceRow");
  const editEnabledCheckbox = document.getElementById("editEnabled");

  function toggleEditFields() {
    if (editCategoryHidden.value === "BK") {
      editBasePriceContainer.classList.remove("hidden");
      editPriceRow.classList.add("hidden");
    } else {
      editBasePriceContainer.classList.add("hidden");
      editPriceRow.classList.remove("hidden");
    }
  }

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

        if (p.Sizes && Array.isArray(p.Sizes)) {
          const size16 = p.Sizes.find(s => s.Size === "16oz" || s.size === "16oz");
          const size22 = p.Sizes.find(s => s.Size === "22oz" || s.size === "22oz");
          document.getElementById("editSize16").value = size16 ? (size16.BasePrice || size16.basePrice) : "";
          document.getElementById("editSize22").value = size22 ? (size22.BasePrice || size22.basePrice) : "";
        } else {
          document.getElementById("editSize16").value = "";
          document.getElementById("editSize22").value = "";
        }

        document.getElementById("editBasePrice").value = p.BasePrice || p.basePrice || "";
        document.getElementById("editDescription").value = p.Description || p.description || "";
        document.getElementById("editAllergen").value = p.Allergen || p.allergen || "";
        editEnabledCheckbox.checked = !!p.isEnabled;

        if (p.imagelink || p.imageLink) {
          document.getElementById("editImagePreview").innerHTML =
            `<img src="${p.imagelink || p.imageLink}" style="width:100px;height:100px;object-fit:cover;border-radius:8px;">`;
        } else {
          document.getElementById("editImagePreview").innerHTML = "";
        }

        toggleEditFields();
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
