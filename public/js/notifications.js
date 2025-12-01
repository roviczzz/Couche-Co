// Notification system client-side JavaScript
class NotificationManager {
    constructor() {
        this.isPopupOpen = false;
        this.pollInterval = null;
        this.lastNotificationCount = 0;
        this.isInitialLoad = true;
        
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
            markAllReadBtn.style.setProperty('margin-top', '0px', 'important');
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
            
            // Check if response is successful and contains JSON
            if (response.status !== 200 || !response.headers.get('content-type')?.includes('application/json')) {
                console.warn('Failed to fetch unread count, status:', response.status, 'content-type:', response.headers.get('content-type'));
                return;
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.updateNotificationBadge(data.unreadCount);
                
                // Show notification sound/animation for new notifications (skip on initial load)
                if (data.unreadCount > this.lastNotificationCount && !this.isInitialLoad) {
                    this.showNewNotificationIndicator();
                }
                
                this.lastNotificationCount = data.unreadCount;
                this.isInitialLoad = false;
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
        if (this.isPopupOpen) {
            this.closeNotificationPopup();
        } else {
            this.openNotificationPopup();
        }
    }
    
    async openNotificationPopup() {
        const popup = document.getElementById('notification-popup');
        const bell = document.getElementById('notification-bell');
        
        if (popup) {
            popup.style.display = 'block';
            popup.classList.add('show');
            bell.setAttribute('aria-expanded', 'true');
            this.isPopupOpen = true;
            
            // Load notifications
            await this.loadNotifications();
        }
    }
    
    closeNotificationPopup() {
        const popup = document.getElementById('notification-popup');
        const bell = document.getElementById('notification-bell');
        
        if (popup) {
            popup.classList.remove('show');
            setTimeout(() => {
                popup.style.display = 'none';
            }, 200);
            bell.setAttribute('aria-expanded', 'false');
            this.isPopupOpen = false;
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
            
            // Check if response is successful and contains JSON
            if (response.status !== 200 || !response.headers.get('content-type')?.includes('application/json')) {
                console.warn('Failed to load notifications, status:', response.status, 'content-type:', response.headers.get('content-type'));
                this.showNotificationError('Failed to load notifications');
                return;
            }
            
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
            const orderId = notification.data?.orderId || notification.data?.OrderID || '';
            
            return `
                <div class="notification-popup-item ${notification.isRead ? 'read' : 'unread'} ${priorityClass}" 
                     data-id="${notification._id}" 
                     data-action-url="${notification.actionUrl || ''}"
                     data-type="${notification.type || ''}"
                     data-order-id="${orderId}"
                     onclick="notificationManager.handleNotificationClick('${notification._id}', '${notification.actionUrl || ''}', '${notification.type || ''}', '${orderId}')">
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
    
    async handleNotificationClick(notificationId, actionUrl, notificationType, orderId) {
        try {
            console.log('🔔 Notification clicked:', { notificationId, actionUrl, notificationType, orderId });
            
            await this.markAsRead(notificationId);
            
            if (actionUrl) {
                const currentPath = window.location.pathname;
                let adjustedUrl = actionUrl;
                
                if (currentPath.startsWith('/staff/')) {
                    adjustedUrl = actionUrl.replace('/admin/', '/staff/');
                }
                
                if (notificationType === 'order' && orderId) {
                    adjustedUrl += (adjustedUrl.includes('?') ? '&' : '?') + 'orderId=' + orderId;
                }
                
                console.log('🔗 Redirecting to:', adjustedUrl);
                window.location.href = adjustedUrl;
            }
            
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

class NotificationSystem {
    constructor(options = {}) {
        this.maxNotifications = options.maxNotifications || 5;
        this.defaultDuration = options.defaultDuration || 5000;
        this.notifications = [];
        this.notificationId = 0;
        
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        }
    }

    show(message, type = 'info', title = '', duration = null) {
        if (!this.container) return null;
        
        duration = duration !== null ? duration : this.defaultDuration;

        while (this.notifications.length >= this.maxNotifications) {
            const oldest = this.notifications[0];
            if (oldest) this.close(oldest.element, true);
        }

        const id = ++this.notificationId;
        const notification = document.createElement('div');
        notification.className = `toast-notification toast-${type}`;
        notification.dataset.id = id;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Info'
        };

        const displayTitle = title || titles[type] || 'Notification';
        const iconClass = icons[type] || icons.info;

        notification.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="toast-body">
                <div class="toast-title">${displayTitle}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" aria-label="Close">
                <i class="fas fa-times"></i>
            </button>
            ${duration > 0 ? '<div class="toast-progress"><div class="toast-progress-bar"></div></div>' : ''}
        `;

        const closeBtn = notification.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.close(notification));

        notification.addEventListener('mouseenter', () => this.pauseTimer(id));
        notification.addEventListener('mouseleave', () => this.resumeTimer(id));

        this.container.appendChild(notification);

        requestAnimationFrame(() => {
            notification.classList.add('toast-visible');
        });

        const notificationData = {
            id,
            element: notification,
            duration,
            remainingTime: duration,
            timer: null,
            startTime: null,
            paused: false
        };

        this.notifications.push(notificationData);

        if (duration > 0) {
            this.startTimer(notificationData);
        }

        return notification;
    }

    startTimer(notificationData) {
        const progressBar = notificationData.element.querySelector('.toast-progress-bar');
        
        notificationData.startTime = Date.now();
        notificationData.paused = false;

        if (progressBar) {
            progressBar.style.transition = `width ${notificationData.remainingTime}ms linear`;
            requestAnimationFrame(() => {
                progressBar.style.width = '0%';
            });
        }

        notificationData.timer = setTimeout(() => {
            this.close(notificationData.element);
        }, notificationData.remainingTime);
    }

    pauseTimer(id) {
        const notificationData = this.notifications.find(n => n.id === id);
        if (!notificationData || notificationData.paused || notificationData.duration <= 0) return;

        clearTimeout(notificationData.timer);
        notificationData.paused = true;

        const elapsed = Date.now() - notificationData.startTime;
        notificationData.remainingTime = Math.max(0, notificationData.remainingTime - elapsed);

        const progressBar = notificationData.element.querySelector('.toast-progress-bar');
        if (progressBar) {
            const computedWidth = window.getComputedStyle(progressBar).width;
            progressBar.style.transition = 'none';
            progressBar.style.width = computedWidth;
        }
    }

    resumeTimer(id) {
        const notificationData = this.notifications.find(n => n.id === id);
        if (!notificationData || !notificationData.paused || notificationData.duration <= 0) return;

        this.startTimer(notificationData);
    }

    close(notification, immediate = false) {
        if (!notification) return;

        const id = parseInt(notification.dataset.id);
        const notificationData = this.notifications.find(n => n.id === id);
        
        if (notificationData) {
            clearTimeout(notificationData.timer);
            this.notifications = this.notifications.filter(n => n.id !== id);
        }

        notification.classList.remove('toast-visible');
        notification.classList.add('toast-hidden');

        const removeDelay = immediate ? 0 : 300;
        setTimeout(() => {
            if (notification.parentElement) {
                notification.parentElement.removeChild(notification);
            }
        }, removeDelay);
    }

    closeAll() {
        [...this.notifications].forEach(n => this.close(n.element, true));
    }

    success(message, title = '', duration = 4000) {
        return this.show(message, 'success', title, duration);
    }

    error(message, title = '', duration = 6000) {
        return this.show(message, 'error', title, duration);
    }

    warning(message, title = '', duration = 5000) {
        return this.show(message, 'warning', title, duration);
    }

    info(message, title = '', duration = 4000) {
        return this.show(message, 'info', title, duration);
    }
}

const notificationSystem = new NotificationSystem({ maxNotifications: 5 });

window.notificationSystem = notificationSystem;

// Override alert function to use notifications
window.originalAlert = window.alert;
window.alert = function(message) {
    // Try to determine message type from content
    let type = 'info';
    let title = 'Notification';

    if (message.toLowerCase().includes('error') ||
        message.toLowerCase().includes('failed') ||
        message.toLowerCase().includes('sorry')) {
        type = 'error';
        title = 'Error';
    } else if (message.toLowerCase().includes('success') ||
               message.toLowerCase().includes('successful')) {
        type = 'success';
        title = 'Success';
    } else if (message.toLowerCase().includes('warning') ||
               message.toLowerCase().includes('caution')) {
        type = 'warning';
        title = 'Warning';
    }

    notificationSystem.show(message, type, title);
};

// Custom confirm replacement
window.showConfirm = function(message, title = 'Confirm', onConfirm = null, onCancel = null) {
    const notification = notificationSystem.show(message, 'warning', title, 0); // Don't auto-hide

    if (notification) {
        // Replace close button with confirm/cancel buttons
        const content = notification.querySelector('.notification-content');
        const closeBtn = notification.querySelector('.notification-close');

        if (closeBtn) closeBtn.style.display = 'none';

        const buttonContainer = document.createElement('div');
        buttonContainer.style.marginTop = '12px';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '8px';
        buttonContainer.style.justifyContent = 'flex-end';

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Confirm';
        confirmBtn.style.padding = '6px 12px';
        confirmBtn.style.background = '#dc3545';
        confirmBtn.style.color = 'white';
        confirmBtn.style.border = 'none';
        confirmBtn.style.borderRadius = '4px';
        confirmBtn.style.cursor = 'pointer';
        confirmBtn.onclick = () => {
            notificationSystem.close(notification);
            if (onConfirm) onConfirm();
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.padding = '6px 12px';
        cancelBtn.style.background = '#6c757d';
        cancelBtn.style.color = 'white';
        cancelBtn.style.border = 'none';
        cancelBtn.style.borderRadius = '4px';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.onclick = () => {
            notificationSystem.close(notification);
            if (onCancel) onCancel();
        };

        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(confirmBtn);
        content.appendChild(buttonContainer);
    }
};
