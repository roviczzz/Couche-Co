// Custom Notification System
class NotificationSystem {
    constructor() {
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            console.error('Notification container not found');
            return;
        }
        this.notifications = [];
    }

    // Show a notification
    show(message, type = 'info', title = '', duration = 5000) {
        if (!this.container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        // Create icon based on type
        let icon = '';
        switch (type) {
            case 'success':
                icon = '<i class="fas fa-check-circle"></i>';
                if (!title) title = 'Success';
                break;
            case 'error':
                icon = '<i class="fas fa-exclamation-circle"></i>';
                if (!title) title = 'Error';
                break;
            case 'warning':
                icon = '<i class="fas fa-exclamation-triangle"></i>';
                if (!title) title = 'Warning';
                break;
            case 'info':
            default:
                icon = '<i class="fas fa-info-circle"></i>';
                if (!title) title = 'Information';
                break;
        }

        notification.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="notificationSystem.close(this.parentElement)">&times;</button>
        `;

        this.container.appendChild(notification);

        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Auto-hide after duration
        if (duration > 0) {
            setTimeout(() => {
                this.close(notification);
            }, duration);
        }

        this.notifications.push(notification);
        return notification;
    }

    // Close a notification
    close(notification) {
        if (!notification) return;

        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentElement) {
                notification.parentElement.removeChild(notification);
            }
            this.notifications = this.notifications.filter(n => n !== notification);
        }, 300);
    }

    // Close all notifications
    closeAll() {
        this.notifications.forEach(notification => {
            this.close(notification);
        });
    }

    // Convenience methods
    success(message, title = 'Success', duration = 5000) {
        return this.show(message, 'success', title, duration);
    }

    error(message, title = 'Error', duration = 7000) {
        return this.show(message, 'error', title, duration);
    }

    warning(message, title = 'Warning', duration = 6000) {
        return this.show(message, 'warning', title, duration);
    }

    info(message, title = 'Information', duration = 5000) {
        return this.show(message, 'info', title, duration);
    }
}

// Create global instance
const notificationSystem = new NotificationSystem();

// Make it globally available
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
