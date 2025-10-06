document.addEventListener('DOMContentLoaded', function() {
    const searchLink = document.getElementById('search-link');
    const searchPopup = document.getElementById('search-popup');
    const searchClose = document.getElementById('search-close');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    let debounceTimer;

    // Show search popup
    function showSearchPopup() {
        searchPopup.classList.add('active');
        searchInput.focus(); // Focus the input when opened
    }

    // Hide search popup
    function hideSearchPopup() {
        searchPopup.classList.remove('active');
        searchResults.innerHTML = '';
        searchInput.value = '';
    }

    // Event listeners for show/hide
    searchLink.addEventListener('click', function(e) {
        e.preventDefault();
        showSearchPopup();
    });

    searchClose.addEventListener('click', hideSearchPopup);

    // Hide on ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && searchPopup.classList.contains('active')) {
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

        const html = results.map(result => `
            <div class="search-result-item" onclick="window.location.href='/menu?search=${encodeURIComponent(result.Name)}'">
                <div class="search-result-name">${result.Name}</div>
                <div class="search-result-category">${result.Category}</div>
            </div>
        `).join('');

        searchResults.innerHTML = html;
        searchResults.style.display = 'block';
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
