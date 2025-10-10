// Initialize orderItems array with data from localStorage
var orderItems = JSON.parse(localStorage.getItem('orderItems') || '[]');

// Get product data from EJS
var product = JSON.parse(document.getElementById('product-data').textContent);

// Save order to localStorage and update cart count
function saveOrderItems() {
    localStorage.setItem('orderItems', JSON.stringify(orderItems));
    // Update navbar cart count if function exists
    if (typeof window.updateCartCount === 'function') {
        window.updateCartCount();
    }
}

// Add item to order (similar to menu.js addToOrder)
function addToOrder(name, price, size, category, productId, addons, imagelink, isFree, originalItemIndex, quantity) {
    // Create a unique key for the order item
    const key = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // For B1T1 items, ensure price is 0
    const finalPrice = isFree ? 0 : parseFloat(price);

    // Create the order item
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
        isB1T1: isFree // B1T1 items are free
    };

    // Add to order items
    orderItems.push(orderItem);

    // Save to localStorage
    saveOrderItems();

    // Show success message
    alert(`${quantity} x ${name}${size ? ' (' + size + ')' : ''} added to cart!`);
}

document.addEventListener('DOMContentLoaded', function() {
    // Size option click handlers
    const sizeOptions = document.querySelectorAll('.size-option-btn');
    sizeOptions.forEach(option => {
        option.addEventListener('click', function(e) {
            e.preventDefault(); // Prevent default label behavior
            const radio = this.querySelector('input[name="size-radio"]');
            if (radio.checked) {
                radio.checked = false;
            } else {
                document.querySelectorAll('input[name="size-radio"]').forEach(r => r.checked = false);
                radio.checked = true;
            }
        });
    });

    // Add to cart button event listener
    document.getElementById('add-to-cart-btn').addEventListener('click', function() {
        const quantity = document.getElementById('quantity').value;

        const selectedRadio = document.querySelector('input[name="size-radio"]:checked');
        let size = selectedRadio ? selectedRadio.value : null;
        let price = selectedRadio ? parseFloat(selectedRadio.closest('.size-option-btn').dataset.price) : parseFloat(product.BasePrice || 0);

        // Add to order
        addToOrder(product.Name, price, size, product.Category, product.ProductID, [], product.imagelink, false, null, quantity);
    });
});
