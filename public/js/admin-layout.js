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
        const body = document.body;
        const html = document.documentElement;
        const sidebar = document.querySelector('.sidebar');

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
        const isCurrentlyCollapsed = document.body.classList.contains('sidebar-collapsed');
        const newState = !isCurrentlyCollapsed;
        applySidebarState(newState);
        setSidebarState(newState);
    }

    const savedState = getSidebarState();
    applySidebarState(savedState);

    setTimeout(() => {
        document.body.classList.remove('sidebar-no-transition');
        document.querySelectorAll('.sidebar-no-transition').forEach(el => {
            el.classList.remove('sidebar-no-transition');
        });
    }, 100);

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

    const notificationBtn = document.querySelector('.notification');
    const notificationRow = document.querySelector('.sidebar-notification-row');
    const notificationPopup = document.getElementById('notification-popup');
    const notificationPopupClose = document.getElementById('notification-popup-close');

    function closeNotificationPopup() {
        if (notificationPopup) {
            notificationPopup.classList.remove('show');
        }
        if (notificationBtn) {
            notificationBtn.setAttribute('aria-expanded', 'false');
        }
    }

    if (notificationBtn && notificationRow && notificationPopup) {
        notificationRow.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            notificationPopup.classList.toggle('show');
            if (notificationPopup.classList.contains('show')) {
                notificationBtn.setAttribute('aria-expanded', 'true');
            } else {
                notificationBtn.setAttribute('aria-expanded', 'false');
            }
        });

        notificationBtn.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                notificationPopup.classList.toggle('show');
                if (notificationPopup.classList.contains('show')) {
                    notificationBtn.setAttribute('aria-expanded', 'true');
                } else {
                    notificationBtn.setAttribute('aria-expanded', 'false');
                }
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

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (window.innerWidth <= 768) {
                document.body.classList.add('sidebar-collapsed');
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
