(function() {
    try {
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (isCollapsed) {
            document.documentElement.className += ' sidebar-collapsed';
        }
    } catch (e) {
        console.warn('Unable to read sidebar state from localStorage');
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const isMobile = () => window.innerWidth <= 768;

    function getSidebarState() {
        try {
            return localStorage.getItem('sidebarCollapsed') === 'true';
        } catch (e) {
            return false;
        }
    }

    function setSidebarState(isCollapsed) {
        try {
            localStorage.setItem('sidebarCollapsed', isCollapsed.toString());
        } catch (e) {
            console.warn('Unable to save sidebar state to localStorage');
        }
    }

    function applySidebarState(isCollapsed) {
        if (isMobile()) return; // Skip desktop state on mobile
        
        const body = document.body;
        const html = document.documentElement;

        if (isCollapsed) {
            body.classList.add('sidebar-collapsed');
            html.classList.add('sidebar-collapsed');
            if (sidebar) sidebar.classList.add('sidebar-collapsed');
        } else {
            body.classList.remove('sidebar-collapsed');
            html.classList.remove('sidebar-collapsed');
            if (sidebar) sidebar.classList.remove('sidebar-collapsed');
        }
    }

    function toggleSidebar() {
        if (isMobile()) return; // Mobile uses overlay toggle instead
        
        const isCurrentlyCollapsed = document.body.classList.contains('sidebar-collapsed');
        const newState = !isCurrentlyCollapsed;
        applySidebarState(newState);
        setSidebarState(newState);
    }

    // Mobile overlay functions
    function openMobileSidebar() {
        if (!isMobile()) return;
        
        if (sidebar) {
            sidebar.classList.add('mobile-active');
            sidebar.setAttribute('aria-hidden', 'false');
        }
        
        let backdrop = document.querySelector('.sidebar-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'sidebar-backdrop';
            backdrop.setAttribute('aria-label', 'Close menu');
            backdrop.addEventListener('click', closeMobileSidebar);
            document.body.appendChild(backdrop);
        }
        backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileSidebar() {
        if (!isMobile()) return;
        
        if (sidebar) {
            sidebar.classList.remove('mobile-active');
            sidebar.setAttribute('aria-hidden', 'true');
        }
        
        const backdrop = document.querySelector('.sidebar-backdrop');
        if (backdrop) {
            backdrop.classList.remove('active');
        }
        document.body.style.overflow = '';
    }

    function toggleMobileSidebar() {
        if (!isMobile()) return;
        
        if (sidebar && sidebar.classList.contains('mobile-active')) {
            closeMobileSidebar();
        } else {
            openMobileSidebar();
        }
    }

    // Apply saved state on desktop
    const savedState = getSidebarState();
    applySidebarState(savedState);

    setTimeout(() => {
        document.body.classList.remove('sidebar-no-transition');
        document.querySelectorAll('.sidebar-no-transition').forEach(el => {
            el.classList.remove('sidebar-no-transition');
        });
    }, 100);

    // Mobile menu toggle button
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleMobileSidebar();
        });
        
        mobileMenuToggle.setAttribute('aria-label', 'Toggle menu');
        mobileMenuToggle.setAttribute('aria-expanded', 'false');
    }

    // Desktop sidebar toggle
    const sidebarToggleRow = document.querySelector('.sidebar-toggle-btn-row');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');

    if (sidebarToggleRow) {
        sidebarToggleRow.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleSidebar();
        });

        sidebarToggleRow.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSidebar();
            }
        });

        sidebarToggleRow.setAttribute('tabindex', '0');
        sidebarToggleRow.setAttribute('role', 'button');
        sidebarToggleRow.setAttribute('aria-label', 'Toggle sidebar');
    }

    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleSidebar();
        });
    }

    // Close mobile sidebar when clicking links
    if (sidebar) {
        sidebar.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (isMobile()) {
                    closeMobileSidebar();
                }
            });
        });
    }

    const notificationBtn = document.querySelector('.notification');
    const notificationRow = document.querySelector('.sidebar-notification-row');
    const notificationPopup = document.getElementById('notification-popup');
    const notificationPopupClose = document.getElementById('notification-popup-close');

    function closeNotificationPopup() {
        if (notificationPopup) {
            notificationPopup.classList.remove('show');
            notificationPopup.setAttribute('aria-hidden', 'true'); // Ensure accessibility state
        }
        if (notificationBtn) {
            notificationBtn.setAttribute('aria-expanded', 'false');
        }
    }

    function toggleNotificationPopup() {
        if (notificationPopup) {
            const isVisible = notificationPopup.classList.toggle('show');
            notificationPopup.setAttribute('aria-hidden', !isVisible);
            notificationBtn.setAttribute('aria-expanded', isVisible);
        }
    }

    if (notificationBtn && notificationRow && notificationPopup) {
        notificationRow.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleNotificationPopup();
        });

        notificationBtn.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleNotificationPopup();
            }
            if (e.key === 'Escape') {
                closeNotificationPopup();
                notificationBtn.blur();
            }
        });
    }

    if (notificationPopupClose) {
        notificationPopupClose.addEventListener('click', function(e) {
            e.preventDefault();
            closeNotificationPopup();
        });
    }

    document.addEventListener('click', function(e) {
        if (notificationPopup && notificationPopup.classList.contains('show')) {
            if (!notificationPopup.contains(e.target) && !notificationRow.contains(e.target)) {
                closeNotificationPopup();
            }
        }
    });

    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (isMobile()) {
                // On mobile, close overlay if open
                closeMobileSidebar();
                // Remove desktop collapsed state
                document.body.classList.remove('sidebar-collapsed');
                document.documentElement.classList.remove('sidebar-collapsed');
                if (sidebar) sidebar.classList.remove('sidebar-collapsed');
            } else {
                // On desktop, remove mobile classes and restore saved state
                if (sidebar) sidebar.classList.remove('mobile-active');
                const backdrop = document.querySelector('.sidebar-backdrop');
                if (backdrop) backdrop.classList.remove('active');
                document.body.style.overflow = '';
                
                const savedState = getSidebarState();
                applySidebarState(savedState);
            }
        }, 250);
    });

    function createSidebarTooltip() {
        let tooltip = document.createElement('div');
        tooltip.className = 'sidebar-tooltip';
        document.body.appendChild(tooltip);
        return tooltip;
    }
    let sidebarTooltip = createSidebarTooltip();
    function showSidebarTooltip(text, target) {
        sidebarTooltip.textContent = text;
        let rect = target.getBoundingClientRect();
        let sidebarRect = document.querySelector('.sidebar').getBoundingClientRect();
        let top = rect.top + rect.height / 2;
        sidebarTooltip.style.top = `${top}px`;
        sidebarTooltip.style.left = `${sidebarRect.right + 8}px`;
        sidebarTooltip.classList.add('show');
    }
    function hideSidebarTooltip() {
        sidebarTooltip.classList.remove('show');
    }
    function setupSidebarTooltips() {
        let sidebar = document.querySelector('.sidebar');
        let isCollapsed = () => document.body.classList.contains('sidebar-collapsed') || document.documentElement.classList.contains('sidebar-collapsed');
        document.querySelectorAll('.sidebar-menu ul li a').forEach(link => {
            link.addEventListener('mouseenter', function(e) {
                if (isCollapsed()) {
                    let label = this.querySelector('.label-text');
                    if (label) {
                        showSidebarTooltip(label.textContent, this);
                    }
                }
            });
            link.addEventListener('mouseleave', function(e) {
                hideSidebarTooltip();
            });
            link.addEventListener('focus', function(e) {
                if (isCollapsed()) {
                    let label = this.querySelector('.label-text');
                    if (label) {
                        showSidebarTooltip(label.textContent, this);
                    }
                }
            });
            link.addEventListener('blur', function(e) {
                hideSidebarTooltip();
            });
        });
        sidebar.addEventListener('mouseleave', hideSidebarTooltip);
    }
    setupSidebarTooltips();

    // Initialize message badge
    updateMessageBadge();

    // Update message badge every 30 seconds
    setInterval(updateMessageBadge, 30000);

    async function updateMessageBadge() {
        try {
            const response = await fetch('/admin/messages/api/unread-count');
            if (response.ok) {
                const data = await response.json();
                const badge = document.getElementById('messages-badge');
                if (badge) {
                    if (data.unreadCount > 0) {
                        badge.textContent = data.unreadCount > 99 ? '99+' : data.unreadCount;
                        badge.style.display = 'flex';
                    } else {
                        badge.style.display = 'none';
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching unread message count:', error);
        }
    }
});
