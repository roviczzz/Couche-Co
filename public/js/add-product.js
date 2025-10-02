// Add Product Page JavaScript
const chipContainer = document.getElementById("chipContainer");
const chipInput = document.getElementById("chipInput");
const hiddenIngredients = document.getElementById("hiddenIngredients");
const suggestionsBox = document.getElementById("suggestions");
const categorySelect = document.getElementById("categorySelect");
const basePriceContainer = document.getElementById("basePriceContainer");
const priceRow = document.getElementById("priceRow");

let ingredients = [];

function updateHiddenInput() {
  hiddenIngredients.value = ingredients.join(", ");
}

function addChip(value) {
  if (!value || ingredients.includes(value)) return;
  ingredients.push(value);
  const chip = document.createElement("div");
  chip.className = "chip";
  chip.innerHTML = `${value} <span>&times;</span>`;
  chip.querySelector("span").addEventListener("click", () => {
    ingredients = ingredients.filter(i => i !== value);
    chip.remove();
    updateHiddenInput();
  });
  chipContainer.insertBefore(chip, chipInput);
  chipInput.value = "";
  updateHiddenInput();
}

chipInput.addEventListener("input", async () => {
  const query = chipInput.value.trim();
  suggestionsBox.innerHTML = "";
  if (query.length === 0) return;
  try {
    const res = await fetch(`/ingredients/search?q=${encodeURIComponent(query)}`);
    const results = await res.json();
    results.forEach(item => {
      const div = document.createElement("div");
      div.textContent = item;
      div.addEventListener("click", () => {
        addChip(item);
        suggestionsBox.innerHTML = "";
      });
      suggestionsBox.appendChild(div);
    });
  } catch (err) {
    console.error("Autocomplete error:", err);
  }
});

chipInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && chipInput.value.trim() !== "") {
    e.preventDefault();
    addChip(chipInput.value.trim());
  }
});

document.addEventListener("click", (e) => {
  if (e.target !== chipInput) {
    suggestionsBox.innerHTML = "";
  }
});

categorySelect.addEventListener("change", () => {
  if (categorySelect.value === "BK") {
    basePriceContainer.style.display = "block";
    priceRow.style.display = "none";
  } else {
    basePriceContainer.style.display = "none";
    priceRow.style.display = "block";
  }
});
