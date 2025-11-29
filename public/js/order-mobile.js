    // Enhance mobile product item expansion for touch targets and accessibility
// Mobile product item expansion handler (outside class for compatibility)
function initMobileProductItemExpansion() {
    document.querySelectorAll('.product-item-card').forEach(item => {
        item.addEventListener('touchstart', function(e) {
            if (e.target.closest('button')) return;
            this.classList.toggle('collapsed');
            const icon = this.querySelector('.expand-icon-small');
            if (icon) {
                icon.style.transform = this.classList.contains('collapsed') ? 'rotate(0deg)' : 'rotate(90deg)';
            }
            this.setAttribute('aria-expanded', !this.classList.contains('collapsed'));
        });
        item.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.classList.toggle('collapsed');
                const icon = this.querySelector('.expand-icon-small');
                if (icon) {
                    icon.style.transform = this.classList.contains('collapsed') ? 'rotate(0deg)' : 'rotate(90deg)';
                }
                this.setAttribute('aria-expanded', !this.classList.contains('collapsed'));
            }
        });
    });
}
class OrderMobileHandler {
    constructor() {
        this.isMobile = window.innerWidth <= 768;
        this.ordersMobileCardsContainer = document.getElementById('ordersMobileCards');
        this.mobileBackdrop = document.getElementById('mobileBackdrop');
        this.orderDetailPanel = document.getElementById('orderDetailPanel');
        this.closePanelBtn = document.getElementById('closePanelBtn');
        this.completedOrdersMobileCards = document.getElementById('completedOrdersMobileCards');

        this.selectedCardIndex = null;
        this.expandedCardIndex = null;

        this.init();
    }

    init() {
        window.addEventListener('resize', () => this.handleResize());
        if (this.isMobile) {
            this.setupMobileHandlers();
        }
    }

    handleResize() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 768;

        if (wasMobile !== this.isMobile) {
            if (this.isMobile) {
                this.setupMobileHandlers();
            } else {
                this.removeMobileHandlers();
            }
        }
    }

    setupMobileHandlers() {
        if (this.closePanelBtn) {
            this.closePanelBtn.addEventListener('click', () => this.closeMobilePanel());
        }

        if (this.mobileBackdrop) {
            this.mobileBackdrop.addEventListener('click', () => this.closeMobilePanel());
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.orderDetailPanel.classList.contains('show')) {
                this.closeMobilePanel();
            }
        });
    }

    removeMobileHandlers() {
        if (this.closePanelBtn) {
            this.closePanelBtn.removeEventListener('click', () => this.closeMobilePanel());
        }

        if (this.mobileBackdrop) {
            this.mobileBackdrop.removeEventListener('click', () => this.closeMobilePanel());
        }
    }

    createOrderCard(order, index) {
        const cardId = `order-card-${index}`;
        const paymentStatus = order.PaymentStatus || order.paymentStatus || 'Unpaid';
        const fulfillmentStatus = order.FulfillmentStatus || order.fulfillmentStatus || 'N/A';

        const totalAmount = order.Total !== undefined && order.Total !== null 
            ? '₱ ' + Number(order.Total).toFixed(2)
            : (order.total !== undefined && order.total !== null 
                ? '₱ ' + Number(order.total).toFixed(2)
                : '₱ 0.00');

        const customerName = this.getCustomerName(order);
        const createdDate = this.formatDate(order.Date || order.date);
        const timeAgo = this.getTimeAgo(order.Date || order.date);

        const paymentBadgeClass = paymentStatus.toLowerCase() === 'paid' ? 'paid' : '';
        const fulfillmentClass = fulfillmentStatus.toLowerCase().replace(/\s+/g, '-');

        const card = document.createElement('div');
        card.className = 'order-card';
        card.id = cardId;
        card.setAttribute('data-idx', index);

        card.innerHTML = `
            <div class="order-card-header">
                <div class="order-card-id">#${order.OrderID || 'N/A'}</div>
                <div class="order-card-customer">${customerName}</div>
                <div class="order-card-badges">
                    <span class="order-card-badge payment ${paymentBadgeClass}">${paymentStatus}</span>
                    <span class="order-card-badge fulfillment ${fulfillmentClass}">${fulfillmentStatus}</span>
                </div>
            </div>
            <div class="order-card-amount">${totalAmount}</div>
            <div class="order-card-time">${timeAgo}</div>
            <div class="order-card-expand">
                <span>Tap for details</span>
                <i class="fa-solid fa-chevron-down"></i>
            </div>
            <div class="order-card-details">
                <div class="order-card-detail-item">
                    <strong>Order Date:</strong>
                    <span>${createdDate}</span>
                </div>
                <div class="order-card-detail-item">
                    <strong>Fulfillment:</strong>
                    <span>${order.FulfillmentMethod || order.fulfillmentMethod || 'N/A'}</span>
                </div>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.order-card-expand')) {
                this.toggleCardExpanded(card, index);
            } else {
                this.openOrderDetails(index);
            }
        });

        return card;
    }

    createCompletedOrderCard(order) {
        const totalAmount = order.Total !== undefined && order.Total !== null 
            ? '₱ ' + Number(order.Total).toFixed(2)
            : (order.total !== undefined && order.total !== null 
                ? '₱ ' + Number(order.total).toFixed(2)
                : '₱ 0.00');

        const customerName = this.getCustomerName(order);
        const createdDate = this.formatDate(order.Date || order.date);

        const card = document.createElement('div');
        card.className = 'completed-order-mobile-card';

        card.innerHTML = `
            <div class="completed-order-card-info">
                <div class="completed-order-card-id">#${order.OrderID || 'N/A'}</div>
                <div class="completed-order-card-customer">${customerName}</div>
                <div class="completed-order-card-date">${createdDate}</div>
            </div>
            <div class="completed-order-card-total">${totalAmount}</div>
        `;

        return card;
    }

    toggleCardExpanded(card, index) {
        const isExpanded = card.classList.contains('expanded');
        
        if (isExpanded) {
            card.classList.remove('expanded');
        } else {
            if (this.expandedCardIndex !== null && this.expandedCardIndex !== index) {
                const prevCard = this.ordersMobileCardsContainer.querySelector(`[data-idx="${this.expandedCardIndex}"]`);
                if (prevCard) {
                    prevCard.classList.remove('expanded');
                }
            }
            card.classList.add('expanded');
            this.expandedCardIndex = index;
        }
    }

    openOrderDetails(index) {
        if (typeof window.displayOrderSummary === 'function') {
            window.displayOrderSummary(index);
            setTimeout(() => {
                initMobileProductItemExpansion();
            }, 100);
        }
        this.showMobilePanel();
    }

    showMobilePanel() {
        if (this.orderDetailPanel) {
            this.orderDetailPanel.classList.add('show');
            if (this.mobileBackdrop) {
                this.mobileBackdrop.style.display = 'block';
            }
            document.body.style.overflow = 'hidden';
        }
    }

    closeMobilePanel() {
        if (this.orderDetailPanel) {
            this.orderDetailPanel.classList.remove('show');
            // Hide backdrop
            if (this.mobileBackdrop) {
                this.mobileBackdrop.style.display = 'none';
            }
            document.body.style.overflow = '';
            // The buttons stay in the DOM at their original location
        }
    }

    renderOrderCards(orders) {
        if (!this.isMobile || !this.ordersMobileCardsContainer) return;

        this.ordersMobileCardsContainer.innerHTML = '';

        if (!orders || orders.length === 0) {
            this.ordersMobileCardsContainer.innerHTML = `
                <div style="padding: 40px 16px; text-align: center; color: #999;">
                    <p>No orders found.</p>
                </div>
            `;
            return;
        }

        orders.forEach((order, index) => {
            const card = this.createOrderCard(order, index);
            this.ordersMobileCardsContainer.appendChild(card);
        });
    }

    renderCompletedOrderCards(completedOrders) {
        if (!this.completedOrdersMobileCards) return;

        this.completedOrdersMobileCards.innerHTML = '';

        if (!completedOrders || completedOrders.length === 0) {
            this.completedOrdersMobileCards.innerHTML = '';
            return;
        }

        completedOrders.forEach((order) => {
            const card = this.createCompletedOrderCard(order);
            this.completedOrdersMobileCards.appendChild(card);
        });
    }

    getCustomerName(order) {
        if (order.Customer) {
            if (typeof order.Customer === 'string') return order.Customer;
            if (typeof order.Customer === 'object' && order.Customer.fullname) return order.Customer.fullname;
            if (typeof order.Customer === 'object' && order.Customer.firstName) {
                return (order.Customer.firstName + ' ' + (order.Customer.lastName || '')).trim();
            }
            if (typeof order.Customer === 'object') {
                return order.Customer.name || order.Customer.Name || 'Unknown Customer';
            }
        } else if (order.customer) {
            if (typeof order.customer === 'string') return order.customer;
            if (typeof order.customer === 'object' && order.customer.fullname) return order.customer.fullname;
            if (typeof order.customer === 'object' && order.customer.firstName) {
                return (order.customer.firstName + ' ' + (order.customer.lastName || '')).trim();
            }
            if (typeof order.customer === 'object') {
                return order.customer.name || order.customer.Name || 'Unknown Customer';
            }
        }
        return 'Unknown Customer';
    }

    formatDate(date) {
        if (!date) return 'N/A';
        try {
            if (typeof date === 'string' && date.includes('-') && !date.includes('T')) {
                return new Date(date.replace(' ', 'T')).toLocaleString();
            }
            return new Date(date).toLocaleString();
        } catch {
            return 'N/A';
        }
    }

    getTimeAgo(date) {
        if (!date) return '';
        try {
            const now = new Date();
            const orderDate = typeof date === 'string' && date.includes('-') && !date.includes('T')
                ? new Date(date.replace(' ', 'T'))
                : new Date(date);
            
            const diffMs = now - orderDate;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMins < 1) return 'just now';
            if (diffMins < 60) return `${diffMins} min ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            
            return this.formatDate(date);
        } catch {
            return '';
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.orderMobileHandler = new OrderMobileHandler();
    });
} else {
    window.orderMobileHandler = new OrderMobileHandler();
}