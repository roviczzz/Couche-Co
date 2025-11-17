document.addEventListener('DOMContentLoaded', function() {
    const searchLink = document.getElementById('search-link');
    const searchPopup = document.getElementById('search-popup');
    const searchClose = document.getElementById('search-close');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    let debounceTimer;

    // Show search popup
    function showSearchPopup() {
        if (searchPopup) searchPopup.classList.add('active');
        if (searchInput) searchInput.focus(); // Focus the input when opened
    }

    // Hide search popup
    function hideSearchPopup() {
        if (searchPopup) searchPopup.classList.remove('active');
        if (searchResults) {
            searchResults.innerHTML = '';
            searchResults.style.display = 'none';
        }
        if (searchInput) searchInput.value = '';
    }

    // Event listeners for show/hide
    if (searchLink) {
        searchLink.addEventListener('click', function(e) {
            e.preventDefault();
            showSearchPopup();
        });
    }

    if (searchClose) {
        searchClose.addEventListener('click', hideSearchPopup);
    }

    // Hide on ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && searchPopup && searchPopup.classList.contains('active')) {
            hideSearchPopup();
        }
    });

    // Debounced search function
    function performSearch(query) {
        if (query.length < 2) {
            searchResults.innerHTML = '';
            searchResults.style.display = 'none';
            return;
        }

        fetch(`/api/search?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(results => {
                displayResults(results);
            })
            .catch(error => {
                console.error('Search error:', error);
                searchResults.innerHTML = '';
                searchResults.style.display = 'none';
            });
    }

    // Display search results
    function displayResults(results) {
        if (results.length === 0) {
            searchResults.innerHTML = '<div class="no-results">No products found</div>';
            searchResults.style.display = 'block';
            return;
        }

        const html = results.map(result => {
            const unavailableClass = result.isAvailable === false ? 'unavailable' : '';
            const imageUrl = result.imagelink && result.imagelink.startsWith('https://blessingsateverysip.me') 
                ? result.imagelink.replace('https://blessingsateverysip.me', '') 
                : result.imagelink;
            
            return `
            <div class="search-result-item ${unavailableClass}" data-product-id="${result._id || result.id}">
                <div class="search-result-image">
                    ${imageUrl && imageUrl.length > 0 ?
                        `<img src="${imageUrl}" alt="${result.Name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.no-image').style.display='flex';">` : ''}
                    <div class="no-image" style="display: ${imageUrl && imageUrl.length > 0 ? 'none' : 'flex'};">No Image</div>
                </div>
                <div class="search-result-info">
                    <div class="search-result-name">${result.Name}</div>
                    <div class="search-result-category">${result.Category}</div>
                    ${result.isAvailable === false ? '<div class="search-result-unavailable">Currently Unavailable</div>' : ''}
                </div>
            </div>
        `;
        }).join('');

        searchResults.innerHTML = html;
        searchResults.style.display = 'block';

        // Add click event listeners to search result items
        document.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', function() {
                const productId = this.dataset.productId;
                if (productId) {
                    window.location.href = `/product/${productId}`;
                } else {
                    // Fallback to menu search if no product ID
                    const productName = this.querySelector('.search-result-name').textContent;
                    window.location.href = `/menu?search=${encodeURIComponent(productName)}`;
                }
            });
        });
    }

    // Input event listener with debounce
    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.trim();

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            performSearch(query);
        }, 300); // 300ms debounce
    });
});
