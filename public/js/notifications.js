// Notification system client-side JavaScript
class NotificationManager {
    constructor() {
        this.isPopupOpen = false;
        this.pollInterval = null;
        this.lastNotificationCount = 0;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.startPolling();
        this.loadInitialNotifications();
    }
    
    bindEvents() {
        // Notification bell click
        const notificationBell = document.getElementById('notification-bell');
        if (notificationBell) {
            notificationBell.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleNotificationPopup();
            });
        }
        
        // Close popup
        const closeBtn = document.getElementById('notification-popup-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeNotificationPopup();
            });
        }
        
        // Mark all as read
        const markAllReadBtn = document.getElementById('mark-all-read');
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', () => {
                this.markAllAsRead();
            });
        }
        
        // Close popup when clicking outside
        document.addEventListener('click', (e) => {
            const popup = document.getElementById('notification-popup');
            const bell = document.getElementById('notification-bell');
            
            if (this.isPopupOpen && popup && !popup.contains(e.target) && !bell.contains(e.target)) {
                this.closeNotificationPopup();
            }
        });
        
        // Escape key to close popup
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isPopupOpen) {
                this.closeNotificationPopup();
            }
        });
    }
    
    async loadInitialNotifications() {
        await this.updateUnreadCount();
        if (this.isPopupOpen) {
            await this.loadNotifications();
        }
    }
    
    startPolling() {
        // Poll for new notifications every 30 seconds
        this.pollInterval = setInterval(() => {
            this.updateUnreadCount();
        }, 30000);
        
        // Initial load
        this.updateUnreadCount();
    }
    
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
    
    async updateUnreadCount() {
        try {
            const response = await fetch('/api/notifications/unread-count');
            const data = await response.json();
            
            if (data.success) {
                this.updateNotificationBadge(data.unreadCount);
                
                // Show notification sound/animation for new notifications
                if (data.unreadCount > this.lastNotificationCount) {
                    this.showNewNotificationIndicator();
                }
                
                this.lastNotificationCount = data.unreadCount;
            }
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    }
    
    updateNotificationBadge(count) {
        const badge = document.getElementById('notification-count');
        const bell = document.getElementById('notification-bell');
        
        if (badge && bell) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count.toString();
                badge.style.display = 'block';
                bell.classList.add('has-notifications');
            } else {
                badge.style.display = 'none';
                bell.classList.remove('has-notifications');
            }
        }
    }
    
    showNewNotificationIndicator() {
        const bell = document.getElementById('notification-bell');
        if (bell) {
            bell.classList.add('notification-pulse');
            setTimeout(() => {
                bell.classList.remove('notification-pulse');
            }, 1000);
        }
    }
    
    toggleNotificationPopup() {
        console.log('Toggle notification popup, current state:', this.isPopupOpen);
        if (this.isPopupOpen) {
            this.closeNotificationPopup();
        } else {
            this.openNotificationPopup();
        }
    }
    
    async openNotificationPopup() {
        const popup = document.getElementById('notification-popup');
        const bell = document.getElementById('notification-bell');
        
        console.log('Opening notification popup');
        
        if (popup && !this.isPopupOpen) {
            // Force display first
            popup.style.display = 'block';
            
            // Small delay to ensure display is applied
            setTimeout(() => {
                popup.classList.add('show');
            }, 10);
            
            if (bell) {
                bell.setAttribute('aria-expanded', 'true');
            }
            
            this.isPopupOpen = true;
            
            // Load notifications
            await this.loadNotifications();
        }
    }
    
    closeNotificationPopup() {
        const popup = document.getElementById('notification-popup');
        const bell = document.getElementById('notification-bell');
        
        console.log('Closing notification popup');
        
        if (popup && this.isPopupOpen) {
            popup.classList.remove('show');
            
            if (bell) {
                bell.setAttribute('aria-expanded', 'false');
            }
            
            // Wait for animation to complete
            setTimeout(() => {
                popup.style.display = 'none';
                this.isPopupOpen = false;
                console.log('Popup closed, state reset');
            }, 200);
        }
    }
    
    async loadNotifications() {
        const notificationList = document.getElementById('notification-list');
        
        if (!notificationList) return;
        
        // Show loading
        notificationList.innerHTML = `
            <div class="notification-loading">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Loading notifications...</span>
            </div>
        `;
        
        try {
            const response = await fetch('/api/notifications?limit=20');
            const data = await response.json();
            
            if (data.success) {
                this.renderNotifications(data.notifications);
            } else {
                this.showNotificationError('Failed to load notifications');
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
            this.showNotificationError('Error loading notifications');
        }
    }
    
    renderNotifications(notifications) {
        const notificationList = document.getElementById('notification-list');
        
        if (!notificationList) return;
        
        if (notifications.length === 0) {
            notificationList.innerHTML = `
                <div class="notification-empty">
                    <i class="fa-regular fa-bell"></i>
                    <span>No notifications yet</span>
                </div>
            `;
            return;
        }
        
        const notificationsHtml = notifications.map(notification => {
            const timeAgo = this.getTimeAgo(new Date(notification.createdAt));
            const priorityClass = this.getPriorityClass(notification.priority);
            const typeIcon = this.getTypeIcon(notification.type);
            
            return `
                <div class="notification-popup-item ${notification.isRead ? 'read' : 'unread'} ${priorityClass}" 
                     data-id="${notification._id}" 
                     data-action-url="${notification.actionUrl || ''}"
                     onclick="notificationManager.handleNotificationClick('${notification._id}', '${notification.actionUrl || ''}')">
                    <div class="notification-icon">
                        <i class="${typeIcon}"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-title">${this.escapeHtml(notification.title)}</div>
                        <div class="notification-message">${this.escapeHtml(notification.message)}</div>
                        <div class="notification-time">${timeAgo}</div>
                    </div>
                    ${!notification.isRead ? '<div class="notification-unread-dot"></div>' : ''}
                </div>
            `;
        }).join('');
        
        notificationList.innerHTML = notificationsHtml;
    }
    
    showNotificationError(message) {
        const notificationList = document.getElementById('notification-list');
        
        if (notificationList) {
            notificationList.innerHTML = `
                <div class="notification-error">
                    <i class="fa-solid fa-exclamation-triangle"></i>
                    <span>${message}</span>
                </div>
            `;
        }
    }
    
    async handleNotificationClick(notificationId, actionUrl) {
        try {
            // Mark as read
            await this.markAsRead(notificationId);
            
            // Navigate to action URL if provided
            if (actionUrl) {
                window.location.href = actionUrl;
            }
            
            // Close popup
            this.closeNotificationPopup();
        } catch (error) {
            console.error('Error handling notification click:', error);
        }
    }
    
    async markAsRead(notificationId) {
        try {
            const response = await fetch(`/api/notifications/${notificationId}/read`, {
                method: 'POST'
            });
            
            if (response.ok) {
                // Update UI
                const notificationElement = document.querySelector(`[data-id="${notificationId}"]`);
                if (notificationElement) {
                    notificationElement.classList.remove('unread');
                    notificationElement.classList.add('read');
                    const unreadDot = notificationElement.querySelector('.notification-unread-dot');
                    if (unreadDot) {
                        unreadDot.remove();
                    }
                }
                
                // Update badge count
                await this.updateUnreadCount();
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }
    
    async markAllAsRead() {
        try {
            const response = await fetch('/api/notifications/mark-all-read', {
                method: 'POST'
            });
            
            if (response.ok) {
                // Update UI
                const unreadItems = document.querySelectorAll('.notification-popup-item.unread');
                unreadItems.forEach(item => {
                    item.classList.remove('unread');
                    item.classList.add('read');
                    const unreadDot = item.querySelector('.notification-unread-dot');
                    if (unreadDot) {
                        unreadDot.remove();
                    }
                });
                
                // Update badge
                this.updateNotificationBadge(0);
            }
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }
    
    getPriorityClass(priority) {
        switch (priority) {
            case 'urgent': return 'priority-urgent';
            case 'high': return 'priority-high';
            case 'normal': return 'priority-normal';
            case 'low': return 'priority-low';
            default: return 'priority-normal';
        }
    }
    
    getTypeIcon(type) {
        switch (type) {
            case 'order': return 'fa-solid fa-cart-shopping';
            case 'message': return 'fa-solid fa-envelope';
            case 'stock': return 'fa-solid fa-box-open';
            case 'report': return 'fa-solid fa-chart-line';
            case 'promo': return 'fa-solid fa-percent';
            default: return 'fa-solid fa-bell';
        }
    }
    
    getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize notification manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.notificationManager = new NotificationManager();
});

// Clean up when page is unloaded
window.addEventListener('beforeunload', () => {
    if (window.notificationManager) {
        window.notificationManager.stopPolling();
    }
});