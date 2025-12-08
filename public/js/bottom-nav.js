class BottomNavigation {
    constructor() {
        this.moreBtn = document.getElementById('bottom-nav-more-btn');
        this.drawer = document.getElementById('bottom-nav-drawer');
        this.backdrop = document.getElementById('bottom-nav-drawer-backdrop');
        this.drawerClose = document.getElementById('bottom-nav-drawer-close');
        this.calculatorBtn = document.getElementById('bottom-nav-calculator-btn');
        this.notificationsBtn = document.getElementById('bottom-nav-notifications-btn');
        this.navItems = document.querySelectorAll('.bottom-nav-item, .bottom-nav-drawer-item');
        this.moreBadge = document.getElementById('more-badge');
        this.notificationBell = document.getElementById('notification-bell');
        
        this.isDrawerOpen = false;
        this.init();
    }

    init() {
        this.attachEventListeners();
        this.setActiveStates();
        this.updateBadges();
    }

    attachEventListeners() {
        if (this.moreBtn) {
            this.moreBtn.addEventListener('click', () => this.toggleDrawer());
        }

        if (this.drawerClose) {
            this.drawerClose.addEventListener('click', () => this.closeDrawer());
        }

        if (this.backdrop) {
            this.backdrop.addEventListener('click', () => this.closeDrawer());
        }

        if (this.calculatorBtn) {
            this.calculatorBtn.addEventListener('click', () => {
                this.closeDrawer();
                const calculatorModal = document.getElementById('calculator-modal');
                if (calculatorModal) {
                    calculatorModal.setAttribute('aria-hidden', 'false');
                    calculatorModal.style.display = 'block';
                }
            });
        }

        if (this.notificationsBtn) {
            this.notificationsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeDrawer();
                setTimeout(() => {
                    if (window.notificationManager) {
                        window.notificationManager.openNotificationPopup();
                    } else {
                        const notificationPopup = document.getElementById('notification-popup');
                        if (notificationPopup) {
                            notificationPopup.setAttribute('aria-hidden', 'false');
                            notificationPopup.style.display = 'block';
                        }
                    }
                }, 50);
            });
        }

        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                if (item.classList.contains('bottom-nav-drawer-item') && 
                    !item.classList.contains('bottom-nav-action')) {
                    this.closeDrawer();
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isDrawerOpen) {
                this.closeDrawer();
            }
        });
    }

    setActiveStates() {
        const currentPath = window.location.pathname;
        
        this.navItems.forEach(item => {
            const route = item.getAttribute('data-route');
            
            if (route && currentPath === route) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    toggleDrawer() {
        if (this.isDrawerOpen) {
            this.closeDrawer();
        } else {
            this.openDrawer();
        }
    }

    openDrawer() {
        if (this.isDrawerOpen) return;
        
        this.isDrawerOpen = true;
        
        if (this.drawer) {
            this.drawer.classList.add('active');
            this.drawer.setAttribute('aria-hidden', 'false');
        }
        
        if (this.backdrop) {
            this.backdrop.classList.add('active');
            this.backdrop.setAttribute('aria-hidden', 'false');
        }
        
        document.body.style.overflow = 'hidden';
        this.moreBtn.setAttribute('aria-expanded', 'true');
    }

    closeDrawer() {
        if (!this.isDrawerOpen) return;
        
        this.isDrawerOpen = false;
        
        if (this.drawer) {
            this.drawer.classList.remove('active');
            this.drawer.setAttribute('aria-hidden', 'true');
        }
        
        if (this.backdrop) {
            this.backdrop.classList.remove('active');
            this.backdrop.setAttribute('aria-hidden', 'true');
        }
        
        document.body.style.overflow = '';
        this.moreBtn.setAttribute('aria-expanded', 'false');
    }

    updateBadges() {
        const notificationCount = this.getNotificationCount();
        const messageCount = this.getMessageCount();
        
        if (notificationCount > 0) {
            const notifBadge = document.getElementById('notification-badge-drawer');
            if (notifBadge) {
                notifBadge.textContent = notificationCount;
                notifBadge.style.display = 'flex';
            }
            
            if (this.moreBadge) {
                const currentBadgeCount = parseInt(this.moreBadge.textContent) || 0;
                const newCount = currentBadgeCount + notificationCount;
                this.moreBadge.textContent = newCount;
                this.moreBadge.style.display = 'flex';
            }
        }
        
        if (messageCount > 0) {
            const msgBadge = document.getElementById('messages-badge-drawer');
            if (msgBadge) {
                msgBadge.textContent = messageCount;
                msgBadge.style.display = 'flex';
            }
        }
    }

    getNotificationCount() {
        const notificationCountElement = document.getElementById('notification-count');
        if (notificationCountElement && notificationCountElement.style.display !== 'none') {
            return parseInt(notificationCountElement.textContent) || 0;
        }
        return 0;
    }

    getMessageCount() {
        const messagesBadge = document.getElementById('messages-badge');
        if (messagesBadge && messagesBadge.style.display !== 'none') {
            return parseInt(messagesBadge.textContent) || 0;
        }
        return 0;
    }

    refresh() {
        this.setActiveStates();
        this.updateBadges();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.bottomNav = new BottomNavigation();
    });
} else {
    window.bottomNav = new BottomNavigation();
}

window.addEventListener('popstate', () => {
    if (window.bottomNav) {
        window.bottomNav.refresh();
    }
});
