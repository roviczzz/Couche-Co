// Shared Navbar JavaScript Functionality

// Add active class to current page link
document.addEventListener('DOMContentLoaded', function() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-links a');

  navLinks.forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });
});

// Toggle account dropdown
function toggleAccountDropdown() {
  const dropdown = document.getElementById('account-dropdown');
  dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
  const accountMenu = document.querySelector('.account-menu');
  const dropdown = document.getElementById('account-dropdown');

  if (accountMenu && dropdown && !accountMenu.contains(event.target)) {
    dropdown.style.display = 'none';
  }
});
