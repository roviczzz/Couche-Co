/**
 * Real-time Order Status Poller
 * Handles periodic checking of order status and UI updates
 */

class OrderStatusPoller {
  constructor(orderId) {
    this.orderId = orderId;
    this.lastStatus = null;
    this.lastProgress = null;
    this.pollInterval = null;
    this.pollCount = 0;
    this.MAX_POLLS = 100; // Stop after ~25 minutes
    this.POLL_INTERVAL = 12000; // 12 seconds
    this.isActive = true;

    this.init();
  }

  init() {
    this.progressFill = document.querySelector('.progress-fill');
    this.progressPercentage = document.querySelector('.progress-percentage');
    this.statusMessage = document.querySelector('.status-message');
    this.currentStatusElement = document.querySelector('.current-status p');

    this.lastStatus = this.currentStatusElement ? this.currentStatusElement.textContent.replace('Current Status: ', '').trim() : 'Preparing';

    if (this.lastStatus !== 'Completed') {
      setTimeout(() => this.pollStatus(), 3000);
      this.pollInterval = setInterval(() => this.pollStatus(), this.POLL_INTERVAL);
    }
  }

  updateProgress(status, progress, message) {
    if (this.progressFill) {
      this.progressFill.style.transition = 'width 0.8s ease-in-out';
      this.progressFill.style.width = progress + '%';
    }

    if (this.progressPercentage) {
      this.progressPercentage.textContent = progress + '%';
    }

    if (this.statusMessage) {
      this.statusMessage.textContent = message;
    }

    if (this.currentStatusElement) {
      // Update the entire <p> with innerHTML to include the <strong> wrapper
      this.currentStatusElement.innerHTML = `<strong>Current Status: ${status}</strong>`;
    }

    // Status update notification removed
  }

  showStatusUpdate(message) {
    const notification = document.createElement('div');
    notification.className = 'status-update-notification';
    notification.textContent = '🔄 ' + message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 1000;
      font-weight: bold;
      animation: slideIn 0.3s ease-out;
      opacity: 0;
      transform: translateX(100%);
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 100);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentElement) {
          notification.parentElement.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  pollStatus() {
    if (!this.isActive || this.pollCount >= this.MAX_POLLS) {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
      return;
    }

    this.pollCount++;

    fetch(`/api/orders/${this.orderId}/status`)
      .then(response => {
        if (!response.ok) {
          if (response.status === 404) {
            console.warn(`Order ${this.orderId} not found yet`);
            return null;
          }
          throw new Error(`HTTP ${response.status}: Failed to fetch status`);
        }
        return response.json();
      })
      .then(data => {
        if (!data || !data.success) {
          if (data) {
            console.warn('Status API returned error:', data.error);
          }
          return;
        }

        const fulfillmentStatus = data.data.fulfillmentStatus;
        const fulfillmentMethod = (data.data.fulfillmentMethod || 'Pickup').toLowerCase();
        const isDelivery = fulfillmentMethod === 'delivery';

        let progressPercentage = 25;
        let statusText = 'Preparing your order';

        if (isDelivery) {
          if (fulfillmentStatus === 'Preparing') {
            progressPercentage = 20;
            statusText = 'Preparing your order';
          } else if (fulfillmentStatus === 'In Progress') {
            progressPercentage = 40;
            statusText = 'Your order is being prepared';
          } else if (fulfillmentStatus === 'Ready') {
            progressPercentage = 70;
            statusText = 'Your order is ready for delivery';
          } else if (fulfillmentStatus === 'In Delivery') {
            progressPercentage = 90;
            statusText = 'Your order is out for delivery';
          } else if (fulfillmentStatus === 'Completed') {
            progressPercentage = 100;
            statusText = 'Order delivered successfully';
          } else {
            progressPercentage = 20;
            statusText = 'Preparing your order';
          }
        } else {
          if (fulfillmentStatus === 'Preparing') {
            progressPercentage = 25;
            statusText = 'Preparing your order';
          } else if (fulfillmentStatus === 'In Progress') {
            progressPercentage = 50;
            statusText = 'Your order is being prepared';
          } else if (fulfillmentStatus === 'Ready') {
            progressPercentage = 90;
            statusText = 'Your order is ready for pickup';
          } else if (fulfillmentStatus === 'Completed') {
            progressPercentage = 100;
            statusText = 'Order completed successfully';
          } else {
            progressPercentage = 25;
            statusText = 'Preparing your order';
          }
        }

        if (fulfillmentStatus !== this.lastStatus || progressPercentage !== this.lastProgress) {
          this.lastStatus = fulfillmentStatus;
          this.lastProgress = progressPercentage;

          this.updateProgress(fulfillmentStatus, progressPercentage, statusText);

          if (fulfillmentStatus === 'Completed') {
            this.isActive = false;
            if (this.pollInterval) {
              clearInterval(this.pollInterval);
              this.pollInterval = null;
            }
          }
        }
      })
      .catch(error => {
        console.debug(`Order status polling attempt ${this.pollCount}: ${error.message}`);
      });
  }

  destroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.isActive = false;
  }
}

// Auto-initialize when script loads
document.addEventListener('DOMContentLoaded', function() {
  // Look for order data in hidden div
  const orderDataDiv = document.getElementById('order-data');
  if (orderDataDiv) {
    const orderId = orderDataDiv.getAttribute('data-order-id');
    if (orderId) {
      // Auto-initialize the poller
      const poller = new OrderStatusPoller(orderId);
      console.log('Order status poller initialized for order:', orderId);
    }
  }
});

// Initialize when loaded
let statusPoller = null;

// Global function to initialize (for backward compatibility)
function initOrderStatusPoller(orderId) {
  if (statusPoller) {
    statusPoller.destroy();
  }
  statusPoller = new OrderStatusPoller(orderId);
}

// Make it global
window.OrderStatusPoller = {
  init: initOrderStatusPoller,
  destroy: () => {
    if (statusPoller) {
      statusPoller.destroy();
    }
  }
};
