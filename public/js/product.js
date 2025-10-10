// Initialize orderItems array with data from localStorage
var orderItems = JSON.parse(localStorage.getItem('orderItems') || '[]');

// Get product data from EJS
var product = JSON.parse(document.getElementById('product-data').textContent);

// Save order to localStorage and update cart count
function saveOrderItems() {
    localStorage.setItem('orderItems', JSON.stringify(orderItems));
    if (typeof window.updateCartCount === 'function') {
        window.updateCartCount();
    }
}

// Add item to order (similar to menu.js addToOrder)
function addToOrder(name, price, size, category, productId, addons, imagelink, isFree, originalItemIndex, quantity) {
    const key = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const finalPrice = isFree ? 0 : parseFloat(price);
    const orderItem = {
        key: key,
        name: name,
        price: finalPrice,
        quantity: parseInt(quantity) || 1,
        size: size,
        category: category,
        productId: productId,
        addons: addons || [],
        imagelink: imagelink || '',
        isFree: isFree,
        originalItemIndex: originalItemIndex,
        isB1T1: isFree
    };
    orderItems.push(orderItem);
    saveOrderItems();
    alert(`${quantity} x ${name}${size ? ' (' + size + ')' : ''} added to cart!`);
}

// Initialize function
function initializePage() {
    console.log('Initializing page...'); // Debug

    // Ensure all size options are unselected on load
    document.querySelectorAll('input[name="size-checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    // Add event listeners to checkboxes for radio button behavior
    const allCheckboxes = document.querySelectorAll('input[name="size-checkbox"]');
    allCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                // This checkbox was checked: uncheck all others
                allCheckboxes.forEach(other => {
                    if (other !== this) {
                        other.checked = false;
                    }
                });
            } else {
                // This checkbox was unchecked: prevent unselection by checking it again
                // This mimics radio button behavior where selection is mandatory
                this.checked = true;
            }
        });
    });

    // Add to cart button event listener
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', function() {
            const quantity = document.getElementById('quantity').value;
            const selectedCheckbox = document.querySelector('input[name="size-checkbox"]:checked');
            let size = selectedCheckbox ? selectedCheckbox.value : null;
            let price = selectedCheckbox ? parseFloat(selectedCheckbox.closest('.size-option-btn').dataset.price) : parseFloat(product.BasePrice || 0);

            addToOrder(product.Name, price, size, product.Category, product.ProductID, [], product.imagelink, false, null, quantity);
        });
    }
}

console.log('EJS template script loading...'); // Keep this line that works

// Just run initialization immediately since DOM is already loaded
initializePage();
