// Real-time dashboard updates configuration
const DASHBOARD_CONFIG = {
    refreshInterval: 5000, // 5 seconds for more responsive updates
    maxRetries: 3,
    retryDelay: 2000, // 2 seconds
    enableRealTimeUpdates: true
};

// Real-time data cache and state management
let dashboardState = {
    lastUpdate: null,
    isUpdating: false,
    autoUpdateEnabled: true,
    retryCount: 0,
    connectionStatus: 'online' // online, offline, reconnecting
};

// Real-time update intervals
let refreshInterval;
let reconnectionTimer;

// Dashboard tooltip functions (similar to sidebar tooltip)
let dashboardTooltip = document.querySelector('.dashboard-tooltip');
function showDashboardTooltip(text, target) {
    dashboardTooltip.textContent = text;
    let rect = target.getBoundingClientRect();
    let top = rect.bottom + 12; // Position more below the "more" text
    let left = rect.left; // Align with the left edge of the "more" text

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipRect = dashboardTooltip.getBoundingClientRect();

    // Ensure tooltip stays within viewport horizontally
    if (left + 300 > viewportWidth - 20) {
        left = viewportWidth - 320;
    }

    // If not enough space below, position above
    if (top + tooltipRect.height > viewportHeight - 10) {
        top = rect.top - tooltipRect.height - 8;
    }

    // Ensure it doesn't go off-screen above
    if (top < 10) {
        top = 10;
    }

    dashboardTooltip.style.top = `${top}px`;
    dashboardTooltip.style.left = `${left}px`;
    dashboardTooltip.classList.add('show');
}
function hideDashboardTooltip() {
    dashboardTooltip.classList.remove('show');
}

/**
 * Real-time Dashboard Update System
 * Handles automatic refreshing of all analytics data
 */
function updateDashboardStats() {
    const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
    return fetch(`${basePath}/analytics/dashboard-stats`)
        .then(res => res.ok ? res.json() : null)
        .catch(err => { console.warn('Dashboard stats update failed:', err); return null; });
}

function updateLowStockData() {
    const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
    // Use server-provided threshold instead of localStorage to stay in sync
    const dataEl = document.getElementById('dashboard-data');
    const threshold = dataEl?.dataset?.userLowStockThreshold || '5';
    return fetch(`${basePath}/analytics/low-stock?threshold=${threshold}`)
        .then(res => res.ok ? res.json() : null)
        .catch(err => { console.warn('Low stock data update failed:', err); return null; });
}

function updateTopCategoriesData() {
    const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
    return fetch(`${basePath}/analytics/top-categories`)
        .then(res => res.ok ? res.json() : null)
        .catch(err => { console.warn('Top categories update failed:', err); return null; });
}

function updatePaymentTypesData() {
    const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
    return fetch(`${basePath}/analytics/payment-types`)
        .then(res => res.ok ? res.json() : null)
        .catch(err => { console.warn('Payment types update failed:', err); return null; });
}

function updateOrdersBySourceData() {
    const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
    return fetch(`${basePath}/analytics/orders-by-source`)
        .then(res => res.ok ? res.json() : null)
        .catch(err => { console.warn('Orders by source update failed:', err); return null; });
}

function updatePerformanceChart(forceRefresh = false) {
    const periodSelect = document.getElementById('performance-period');
    const days = periodSelect ? periodSelect.value || '14' : '14';

    if (forceRefresh || event.target.value !== dashboardState.lastPerformancePeriod) {
        dashboardState.lastPerformancePeriod = days;
        drawSalesPerformanceChart(days);
    }
}

function initializeRealTimeUpdates() {
    if (!DASHBOARD_CONFIG.enableRealTimeUpdates) return;

    console.log('🔄 Initializing real-time dashboard updates...');

    // Update all dashboard data
    async function refreshAllDashboardData() {
        if (dashboardState.isUpdating) return;
        dashboardState.isUpdating = true;

        try {
            dashboardState.retryCount = 0;
            dashboardState.connectionStatus = 'online';
            const results = await Promise.allSettled([
                updateDashboardStats(),
                updateLowStockData(),
                updateTopCategoriesData(),
                updatePaymentTypesData(),
                updateOrdersBySourceData()
            ]);

            // Apply updates
            const [statsResult, lowStockResult, categoriesResult, paymentResult, sourceResult] = results;

            // Dashboard stats
            if (statsResult.status === 'fulfilled' && statsResult.value) {
                applyDashboardStatsUpdate(statsResult.value);
            }

            // Low stock data
            if (lowStockResult.status === 'fulfilled' && lowStockResult.value) {
                applyLowStockUpdate(lowStockResult.value);
            }

            // Categories data
            if (categoriesResult.status === 'fulfilled' && categoriesResult.value) {
                applyTopCategoriesUpdate(categoriesResult.value);
            }

            // Payment types data
            if (paymentResult.status === 'fulfilled' && paymentResult.value) {
                applyPaymentTypesUpdate(paymentResult.value);
            }

            // Orders by source
            if (sourceResult.status === 'fulfilled' && sourceResult.value) {
                applyOrdersBySourceUpdate(sourceResult.value);
            }

            dashboardState.lastUpdate = new Date();
            console.log('✅ Dashboard data updated successfully at', dashboardState.lastUpdate.toLocaleTimeString());

        } catch (error) {
            handleUpdateError(error);
        } finally {
            dashboardState.isUpdating = false;
        }
    }

    async function applyDashboardStatsUpdate(stats) {
        if (!stats) return;

        // Update summary cards with animations
        animateValueUpdate('total-sales-value', '₱' + (stats.totalSales || 0).toLocaleString('en-PH', {minimumFractionDigits:2}));
        animateValueUpdate('total-sales-trend', (stats.totalSalesPercent > 0 ? '+' : '') + (stats.totalSalesPercent || 0) + '%');
        animateValueUpdate('total-sales-week', (stats.totalSalesWeek || 0) + ' this week');

        document.getElementById('total-sales-trend').className = `trend-${stats.totalSalesPercent >= 0 ? 'up' : 'down'}`;

        animateValueUpdate('incoming-orders-value', stats.incomingOrders || 0);
        animateValueUpdate('incoming-orders-trend', (stats.incomingOrdersPercent > 0 ? '+' : '') + (stats.incomingOrdersPercent || 0) + '%');
        document.getElementById('incoming-orders-trend').className = `trend-${stats.incomingOrdersPercent >= 0 ? 'up' : 'down'}`;

        animateValueUpdate('orders-today-value', stats.ordersToday || 0);
        animateValueUpdate('orders-today-trend', (stats.ordersTodayPercent > 0 ? '+' : '') + (stats.ordersTodayPercent || 0) + '%');
        document.getElementById('orders-today-trend').className = `trend-${stats.ordersTodayPercent >= 0 ? 'up' : 'down'}`;
    }

    async function applyLowStockUpdate(lowStockData) {
        if (!lowStockData) return;

        const quantity = lowStockData.quantity || 0;
        const quantityDisplay = quantity > 0 ? quantity + 'g' : quantity;
        animateValueUpdate('low-stock-value', quantityDisplay);
        const nameElement = document.getElementById('low-stock-name');
        nameElement.textContent = lowStockData.name || 'All stocked';

        const moreElement = document.getElementById('low-stock-more');
        if (lowStockData.hasMore && moreElement) {
            moreElement.style.display = 'inline';
            // Update tooltip if it exists
            moreElement.addEventListener('mouseenter', () => {
                showDashboardTooltip('Other low stock items:\n' + (lowStockData.allItems || []).join('\n'), moreElement);
            });
        } else if (moreElement) {
            moreElement.style.display = 'none';
        }
    }

    async function applyTopCategoriesUpdate(categories) {
        if (!categories || !Array.isArray(categories) || !categories.length) return;

        categories.sort((a, b) => (b.value || 0) - (a.value || 0));
        window.topCategories = categories;
        drawTopCategoriesChart();
    }

    async function applyPaymentTypesUpdate(paymentTypes) {
        if (!paymentTypes || !Array.isArray(paymentTypes) || !paymentTypes.length) return;

        window.paymentTypes = paymentTypes;
        drawPaymentTypesChart();
    }

    async function applyOrdersBySourceUpdate(ordersBySource) {
        if (!ordersBySource || !Array.isArray(ordersBySource) || !ordersBySource.length) return;

        window.ordersBySource = ordersBySource;
        drawOrdersBySourceChart();
    }

    function animateValueUpdate(elementId, newValue) {
        const element = document.getElementById(elementId);
        if (!element) return;

        // Add subtle animation
        element.style.transition = 'all 0.5s ease-out';
        element.style.opacity = '0.7';
        element.style.transform = 'scale(0.95)';

        setTimeout(() => {
            element.textContent = newValue;
            element.style.opacity = '1';
            element.style.transform = 'scale(1)';
        }, 150);
    }

    function handleUpdateError(error) {
        console.error('Dashboard update error:', error);
        dashboardState.retryCount++;

        if (dashboardState.retryCount <= DASHBOARD_CONFIG.maxRetries) {
            dashboardState.connectionStatus = 'reconnecting';
            console.log(`🔄 Retrying dashboard update (${dashboardState.retryCount}/${DASHBOARD_CONFIG.maxRetries})...`);
            setTimeout(refreshAllDashboardData, DASHBOARD_CONFIG.retryDelay);
        } else {
            dashboardState.connectionStatus = 'offline';
            console.error('❌ Dashboard update failed after max retries');
        }
    }

    // Start the update cycle
    refreshAllDashboardData();
    refreshInterval = setInterval(refreshAllDashboardData, DASHBOARD_CONFIG.refreshInterval);

    // Add performance chart updates
    const periodSelect = document.getElementById('performance-period');
    if (periodSelect) {
        periodSelect.addEventListener('change', updatePerformanceChart);
    }

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Page hidden - pause updates
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
                console.log('⏸️ Paused real-time updates (page hidden)');
            }
        } else {
            // Page visible - resume updates
            if (!refreshInterval && dashboardState.autoUpdateEnabled) {
                refreshAllDashboardData();
                refreshInterval = setInterval(refreshAllDashboardData, DASHBOARD_CONFIG.refreshInterval);
                console.log('▶️ Resumed real-time updates');
            }
        }
    });

    // Handle network status
    window.addEventListener('online', () => {
        console.log('🌐 Network connection restored - resuming real-time updates');
        dashboardState.connectionStatus = 'online';
        dashboardState.retryCount = 0;
        if (!refreshInterval && dashboardState.autoUpdateEnabled) {
            refreshAllDashboardData();
            refreshInterval = setInterval(refreshAllDashboardData, DASHBOARD_CONFIG.refreshInterval);
        }
    });

    window.addEventListener('offline', () => {
        console.log('🌐 Network connection lost - pausing real-time updates');
        dashboardState.connectionStatus = 'offline';
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    });

    console.log(`🚀 Real-time dashboard updates initialized (every ${DASHBOARD_CONFIG.refreshInterval/1000}s)`);
}

/**
 * Manual refresh function (for emergency manual updates)
 */
function manualDashboardRefresh() {
    if (dashboardState.isUpdating) return;

    console.log('🔄 Manual dashboard refresh initiated...');
    // Stop current interval, refresh once, then restart
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }

    updateDashboardStats().then(stats => {
        if (stats) applyDashboardStatsUpdate(stats);
    });
    updateLowStockData().then(data => {
        if (data) applyLowStockUpdate(data);
    });

    if (dashboardState.autoUpdateEnabled) {
        refreshInterval = setInterval(() => {
            updateDashboardStats().then(stats => {
                if (stats) applyDashboardStatsUpdate(stats);
            });
            updateLowStockData().then(data => {
                if (data) applyLowStockUpdate(data);
            });
        }, DASHBOARD_CONFIG.refreshInterval);
    }
}

/**
 * Immediate refresh function (called from other pages like stocks management)
 * This provides instant updates when stock changes occur
 */
window.forceDashboardRefresh = function() {
    console.log('⚡ Force dashboard refresh triggered from external source');

    // Clear any existing update in progress
    dashboardState.isUpdating = false;

    // Immediately update low stock data (most relevant for stock changes)
    updateLowStockData().then(data => {
        if (data) {
            applyLowStockUpdate(data);
            console.log('✅ Low stock data updated immediately');
        }
    }).catch(err => {
        console.error('❌ Failed to update low stock data:', err);
    });

    // Also update dashboard stats for completeness
    updateDashboardStats().then(stats => {
        if (stats) {
            applyDashboardStatsUpdate(stats);
            console.log('✅ Dashboard stats updated immediately');
        }
    }).catch(err => {
        console.error('❌ Failed to update dashboard stats:', err);
    });
};

/**
 * Listen for custom events from other pages (like stock updates)
 */
document.addEventListener('DOMContentLoaded', function() {
    // Listen for custom stock update events
    window.addEventListener('stockUpdated', function(event) {
        console.log('📡 Received stock update event:', event.detail);
        window.forceDashboardRefresh();
    });

    // Listen for storage changes (in case multiple tabs are open)
    window.addEventListener('storage', function(event) {
        if (event.key === 'stockDataChanged') {
            console.log('💾 Stock data changed in another tab, refreshing dashboard');
            window.forceDashboardRefresh();
        }
    });
});

/**
 * Toggle auto-update functionality
 */
function toggleRealTimeUpdates() {
    dashboardState.autoUpdateEnabled = !dashboardState.autoUpdateEnabled;

    if (dashboardState.autoUpdateEnabled) {
        console.log('▶️ Real-time updates enabled');
        initializeRealTimeUpdates();
    } else {
        console.log('⏸️ Real-time updates disabled');
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    }

    return dashboardState.autoUpdateEnabled;
}

// Parse server-rendered data from data attributes
const dataEl = document.getElementById('dashboard-data');
window.analyticsStats = (dataEl.dataset.analyticsStats && dataEl.dataset.analyticsStats !== 'null') ? JSON.parse(dataEl.dataset.analyticsStats) : undefined;
window.topCategories = (dataEl.dataset.topCategories && dataEl.dataset.topCategories !== 'null') ? JSON.parse(dataEl.dataset.topCategories) : undefined;
window.paymentTypes = (dataEl.dataset.paymentTypes && dataEl.dataset.paymentTypes !== 'null') ? JSON.parse(dataEl.dataset.paymentTypes) : undefined;
window.ordersBySource = (dataEl.dataset.ordersBySource && dataEl.dataset.ordersBySource !== 'null') ? JSON.parse(dataEl.dataset.ordersBySource) : undefined;
    async function fetchDashboardStats() {
        // Use server-rendered data if available
        let stats = null;
        if (typeof window.analyticsStats !== 'undefined') {
            stats = window.analyticsStats;
        } else {
            // Fallback to AJAX if server data not available
            try {
                const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
                const res = await fetch(`${basePath}/analytics/dashboard-stats`);
                stats = await res.json();
            } catch (err) {}
        }
        if (stats) {
            document.getElementById('total-sales-value').innerText = '₱' + (stats.totalSales || 0).toLocaleString('en-PH', {minimumFractionDigits:2});
            document.getElementById('total-sales-trend').innerText = (stats.totalSalesPercent > 0 ? '+' : '') + (stats.totalSalesPercent || 0) + '%';
            document.getElementById('total-sales-trend').className = stats.totalSalesPercent >= 0 ? 'trend-up' : 'trend-down';
            document.getElementById('total-sales-week').innerText = (stats.totalSalesWeek || 0) + ' this week';

            document.getElementById('incoming-orders-value').innerText = stats.incomingOrders || 0;
            document.getElementById('incoming-orders-trend').innerText = (stats.incomingOrdersPercent > 0 ? '+' : '') + (stats.incomingOrdersPercent || 0) + '%';
            document.getElementById('incoming-orders-trend').className = stats.incomingOrdersPercent >= 0 ? 'trend-up' : 'trend-down';

            document.getElementById('orders-today-value').innerText = stats.ordersToday || 0;
            document.getElementById('orders-today-trend').innerText = (stats.ordersTodayPercent > 0 ? '+' : '') + (stats.ordersTodayPercent || 0) + '%';
            document.getElementById('orders-today-trend').className = stats.ordersTodayPercent >= 0 ? 'trend-up' : 'trend-down';
        }
    }
    document.addEventListener('DOMContentLoaded', function() {
        const periodSelect = document.getElementById('performance-period');
        if (periodSelect) {
            periodSelect.addEventListener('change', function() {
                drawSalesPerformanceChart(this.value);
            });
        }
        const exportBtn = document.getElementById('export-performance');
        if (exportBtn) {
            exportBtn.addEventListener('click', function() {
                const periodSelect = document.getElementById('performance-period');
                const period = periodSelect ? periodSelect.value : '14';
                const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
                const exportUrl = `${basePath}/analytics/export-performance?days=${period}`;
                console.log('Exporting performance data for', period, 'days from:', exportUrl);

                // Show loading modal
                const loadingModal = document.getElementById('export-loading-modal');
                if (loadingModal) {
                    loadingModal.style.display = 'block';
                }

                // Create a temporary link to trigger download
                const link = document.createElement('a');
                link.href = exportUrl;
                link.download = `Sales_Performance_Last_${period}_Days.pdf`;

                // Start download and hide modal after PDF generation/download begins
                // Using a longer timeout to account for PDF generation time
                setTimeout(() => {
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    // Hide loading modal after download starts
                    setTimeout(() => {
                        if (loadingModal) {
                            loadingModal.style.display = 'none';
                        }
                    }, 2000); // Keep showing for 2 more seconds after download starts
                }, 500); // Small delay to ensure modal is visible
            });
        }

    // Low stock settings modal handling
        const cardSettings = document.querySelector('.card-settings');
        const modal = document.getElementById('low-stock-settings-modal');
        const cancelBtn = document.getElementById('cancel-stock-settings');
        const saveBtn = document.getElementById('save-stock-settings');
        const thresholdSlider = document.getElementById('low-stock-threshold');
        const thresholdValue = document.getElementById('threshold-value');

        // Get user's threshold from server data
        const userThreshold = dataEl.dataset.userLowStockThreshold || '5';

        if (cardSettings && modal) {
            cardSettings.addEventListener('click', function() {
                // Load current threshold from user settings
                if (thresholdSlider && thresholdValue) {
                    thresholdSlider.value = userThreshold;
                    thresholdValue.textContent = userThreshold + ' grams';
                }
                modal.style.display = 'flex';
            });

            // Update display value as user drags the slider
            if (thresholdSlider && thresholdValue) {
                thresholdSlider.addEventListener('input', function() {
                    thresholdValue.textContent = this.value + ' grams';
                });
            }

            // Close modal on cancel
            if (cancelBtn) {
                cancelBtn.addEventListener('click', function() {
                    modal.style.display = 'none';
                });
            }

            // Save threshold via API and refresh dashboard
            if (saveBtn) {
                saveBtn.addEventListener('click', async function() {
                    if (thresholdSlider) {
                        const newThreshold = thresholdSlider.value;

                        try {
                            // Save to settings via API
                            const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
                            const response = await fetch(`${basePath}/settings/preferences`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    lowStockAlertRange: parseInt(newThreshold)
                                })
                            });

                            const result = await response.json();
                            if (result.success) {
                                modal.style.display = 'none';
                                // Force a dashboard refresh to show new data
                                location.reload();
                            } else {
                                alert('Failed to save settings: ' + result.message);
                            }
                        } catch (error) {
                            console.error('Error saving threshold:', error);
                            alert('Failed to save settings');
                        }
                    }
                });
            }

            // Close modal when clicking outside
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }

        // Initialize all dashboard components
        fetchDashboardStats();
        fetchLowStockData();
        
        // Initialize charts with slight delay to ensure DOM is ready
        setTimeout(() => {
            if (typeof Chart !== 'undefined') {
                drawSalesPerformanceChart();
                drawTopCategoriesChart();
                drawPaymentTypesChart();
                drawOrdersBySourceChart();
                console.log('✅ All dashboard charts initialized');
            } else {
                console.error('❌ Chart.js not loaded - charts will not display');
            }
        }, 100);

        // Initialize real-time updates
        initializeRealTimeUpdates();
    });
    async function drawSalesPerformanceChart(days=14) {
        const chartElement = document.getElementById('salesPerformanceChart');
        const loadingIndicator = document.getElementById('sales-performance-loading');
        
        if (!chartElement) return;
        
        // Show loading indicator
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
        
        // Hide chart temporarily during loading
        chartElement.style.opacity = '0.3';
        
        let results = [];
        try {
            const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
            const res = await fetch(`${basePath}/analytics/sales-performance?days=` + days);
            if (res.ok) {
                results = await res.json();
            }
        } catch (err) {
            console.error('Failed to fetch sales performance data:', err);
        }
        
        if (!Array.isArray(results) || !results.length) {
            results = [];
            console.log('📊 No sales performance data available for', days, 'days');
        } else {
            console.log('📊 Loaded', results.length, 'days of sales performance data');
        }
        
        // Destroy existing chart instance
        if (window.salesPerformanceChart && typeof window.salesPerformanceChart.destroy === 'function') {
            window.salesPerformanceChart.destroy();
        }
        
        const labels = results.map(r => r.date);
        const earnings = results.map(r => r.earnings);
        const costs = results.map(r => r.costs);
        
        // Hide loading indicator before creating chart
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // Restore chart visibility
        chartElement.style.opacity = '1';
        
        window.salesPerformanceChart = new Chart(chartElement, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Earnings',
                        data: earnings,
                        backgroundColor: 'rgba(108,52,31,0.1)',
                        borderColor: 'rgba(108,52,31,1)',
                        tension: 0.4,
                        borderWidth: 3,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: 'rgba(108,52,31,1)',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        fill: true
                    },
                    {
                        label: 'Costs',
                        data: costs,
                        backgroundColor: 'rgba(180,180,180,0.08)',
                        borderColor: '#999',
                        tension: 0.4,
                        borderWidth: 3,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#999',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 2.2,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: { 
                        display: true, 
                        labels: { 
                            font: { size: 14 },
                            usePointStyle: true,
                            padding: 20
                        } 
                    },
                    tooltip: {
                        backgroundColor: 'rgba(107, 62, 38, 0.95)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#6b3e26',
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                if (context.dataset.label === 'Earnings') {
                                    return `Earnings: ₱${context.parsed.y.toLocaleString('en-PH', {minimumFractionDigits:2})}`;
                                } else if (context.dataset.label === 'Costs') {
                                    return `Costs: ₱${context.parsed.y.toLocaleString('en-PH', {minimumFractionDigits:2})}`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        ticks: { 
                            font: { size: 11 } 
                        },
                        grid: {
                            color: 'rgba(160, 92, 47, 0.1)'
                        }
                    },
                    y: { 
                        beginAtZero: true, 
                        ticks: { 
                            font: { size: 11 },
                            callback: function(value) {
                                return '₱' + value.toLocaleString('en-PH');
                            }
                        },
                        grid: {
                            color: 'rgba(160, 92, 47, 0.1)'
                        }
                    }
                },
                animation: {
                    duration: 2000,
                    easing: 'easeInOutQuart',
                    onComplete: function() {
                        console.log('Sales performance chart animation complete');
                    }
                },
                elements: {
                    line: {
                        tension: 0.4
                    },
                    point: {
                        hoverRadius: 8
                    }
                }
            }
        });
        let totalEarnings = earnings.reduce((a, b) => a + b, 0);
        let totalOrders = results.reduce((a, b) => a + (b.orders || 0), 0);
        let avgEarnings = earnings.length ? (totalEarnings / earnings.length) : 0;
        let infoHtml = `<div style="font-size:13px;color:#6b3e26;margin-top:10px;">
            <b>Total Earnings:</b> ₱${totalEarnings.toLocaleString('en-PH', {minimumFractionDigits:2})}<br>
            <b>Total Orders:</b> ${totalOrders}<br>
            <b>Avg Earnings/Day:</b> ₱${avgEarnings.toLocaleString('en-PH', {minimumFractionDigits:2})}
        </div>`;
        document.getElementById('sales-performance-info').innerHTML = infoHtml;
    }
    async function drawTopCategoriesChart() {
        let categories = [];
        // Use server-rendered data if available
        if (typeof window.topCategories !== 'undefined') {
            categories = window.topCategories;
        } else {
            try {
                const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
                const response = await fetch(`${basePath}/analytics/top-categories`);
                if (response.ok) {
                    categories = await response.json();
                    if (!Array.isArray(categories) || !categories.length || !categories[0].name) {
                        categories = [];
                    }
                }
            } catch (error) {}
            // No fallback data - chart will handle empty state
        }
        // Sort by value descending
        categories.sort((a, b) => (b.value || 0) - (a.value || 0));
        let leftHtml = '';
        let rightHtml = '';
        if (categories.length > 0) {
            const top = categories[0];
            leftHtml = `<div style="text-align:left;font-size:56px;font-weight:700;color:#6b3e26;">₱${(top.value || 0).toLocaleString('en-PH')}</div>
                        <div style="font-size:14px;color:#999;margin-top:8px;">${top.name || 'Unnamed'}</div>`;
            rightHtml = `<div style="font-size:14px;color:#666;line-height:2;">`;
            for (let i = 1; i < categories.length; i++) {
                const cat = categories[i];
                rightHtml += `${cat.name || 'Unnamed'}: ₱${(cat.value || 0).toLocaleString('en-PH')}<br/>`;
            }
            rightHtml += `</div>`;
        }
        const html = `<div style="display:flex;gap:20px;">
                        <div style="flex:1;">${leftHtml}</div>
                        <div style="flex:2;">${rightHtml}</div>
                      </div>`;
        const container = document.getElementById('top-categories-container');
        if (container) {
            container.innerHTML = html;
        }
    }
    async function drawPaymentTypesChart() {
        const loadingIndicator = document.getElementById('payment-types-loading-indicator');
        if (loadingIndicator) loadingIndicator.style.display = 'flex';
        let paymentTypes = [];
        // Use server-rendered data if available
        if (typeof window.paymentTypes !== 'undefined') {
            paymentTypes = window.paymentTypes;
        } else {
            try {
                const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
                const response = await fetch(`${basePath}/analytics/payment-types`);
                if (response.ok) {
                    paymentTypes = await response.json();
                    if (!Array.isArray(paymentTypes) || !paymentTypes.length || !paymentTypes[0].name) {
                        paymentTypes = [];
                    }
                }
            } catch (error) {}
            // No fallback data - chart will handle empty state
        }
        const chartElement = document.getElementById('paymentTypesChart');
        if (!chartElement) return;
        if (window.paymentTypesChart && typeof window.paymentTypesChart.destroy === 'function') window.paymentTypesChart.destroy();
        const labels = paymentTypes.map(p => p.name || 'Unnamed');
        const orderCounts = paymentTypes.map(p => p.orderCount || 0);
        const colors = ['#6d4f2c','#a05c2f','#c1a97b','#e3dac9','#d2a679','#9d7a56','#b7966c','#8b7355'];
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        window.paymentTypesChart = new Chart(chartElement, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Orders',
                    data: orderCounts,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: colors.slice(0, labels.length),
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(107, 62, 38, 0.95)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#6b3e26',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                const total = orderCounts.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((context.parsed.y / total) * 100).toFixed(1) : '0.0';
                                return [
                                    `Orders: ${context.parsed.y}`,
                                    `Share: ${percentage}%`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            font: { size: 11 },
                            precision: 0
                        },
                        grid: {
                            color: 'rgba(160, 92, 47, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            font: { size: 11 },
                            maxRotation: 0,
                            minRotation: 0
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                barThickness: 16,
                maxBarThickness: 20,
                animation: {
                    duration: 1500,
                    easing: 'easeInOutCubic'
                }
            }
        });
        const totalOrders = orderCounts.reduce((sum, val) => sum + val, 0) || 1;
        let listHtml = '';
        for(let i = 0; i < labels.length; i++) {
            const percentage = ((orderCounts[i] / totalOrders) * 100).toFixed(1);
            listHtml += `
            <div class="cat-row" data-payment="${labels[i]}">
                <div class="cat-info">
                    <span class="cat-dot" style="background:${colors[i % colors.length]}"></span>
                    <span class="cat-name">${labels[i]}</span>
                </div>
                <div class="cat-details">
                    <span class="cat-val">${orderCounts[i]} orders</span>
                    <span class="cat-percent">${percentage}%</span>
                </div>
            </div>
        `;
        }
        const listElement = document.getElementById('payment-types-list');
        if (listElement) {
            listElement.innerHTML = listHtml;
            setTimeout(() => {
                document.querySelectorAll('#payment-types-list .cat-row').forEach((row, index) => {
                    row.addEventListener('mouseenter', () => {
                        if (window.paymentTypesChart) {
                            try {
                                window.paymentTypesChart.setActiveElements([{
                                    datasetIndex: 0,
                                    index: index
                                }]);
                                window.paymentTypesChart.update('none');
                            } catch (e) {}
                        }
                        row.style.backgroundColor = 'rgba(107, 62, 38, 0.05)';
                    });
                    row.addEventListener('mouseleave', () => {
                        if (window.paymentTypesChart) {
                            try {
                                window.paymentTypesChart.setActiveElements([]);
                                window.paymentTypesChart.update('none');
                            } catch (e) {}
                        }
                        row.style.backgroundColor = 'transparent';
                    });
                });
            }, 100);
        }
    }
    async function drawOrdersBySourceChart() {
        let ordersBySource = [];
        // Use server-rendered data if available
        if (typeof window.ordersBySource !== 'undefined') {
            ordersBySource = window.ordersBySource;
        } else {
            // Fallback to AJAX if server data not available
            try {
                const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
                const response = await fetch(`${basePath}/analytics/orders-by-source`);
                if (response.ok) {
                    ordersBySource = await response.json();
                    if (!Array.isArray(ordersBySource) || !ordersBySource.length || !ordersBySource[0].name) {
                        ordersBySource = [];
                    }
                }
            } catch (error) {}
            // No fallback data - chart will handle empty state
        }
        // Sort by orderCount descending
        ordersBySource.sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0));
        let leftHtml = '';
        let rightHtml = '';
        if (ordersBySource.length > 0) {
            const top = ordersBySource[0];
            leftHtml = `<div style="text-align:left;font-size:56px;font-weight:700;color:#6b3e26;">${(top.orderCount || 0)}</div>
                        <div style="font-size:14px;color:#999;margin-top:8px;">${top.name || 'Unnamed'}</div>`;
            rightHtml = `<div style="font-size:14px;color:#666;line-height:2;">`;
            for (let i = 1; i < ordersBySource.length; i++) {
                const src = ordersBySource[i];
                rightHtml += `${src.name || 'Unnamed'}: ${(src.orderCount || 0)} orders<br/>`;
            }
            rightHtml += `</div>`;
        }
        const html = `<div style="display:flex;gap:20px;">
                        <div style="flex:1;">${leftHtml}</div>
                        <div style="flex:2;">${rightHtml}</div>
                      </div>`;
        const container = document.getElementById('orders-by-source-container');
        if (container) {
            container.innerHTML = html;
        }
    }
    async function fetchLowStockData() {
        try {
            // Use server-provided threshold instead of localStorage to stay in sync
            const dataEl = document.getElementById('dashboard-data');
            const threshold = dataEl?.dataset?.userLowStockThreshold || '5';
            const basePath = window.location.pathname.startsWith('/staff/') ? '/staff' : '/admin';
            const response = await fetch(`${basePath}/analytics/low-stock?threshold=` + threshold);
            if (response.ok) {
                const lowStockData = await response.json();
                const quantity = lowStockData.quantity || 0;
                const quantityDisplay = quantity > 0 ? quantity + 'g' : quantity;
                document.getElementById('low-stock-value').innerText = quantityDisplay;
                document.getElementById('low-stock-name').innerText = lowStockData.name || 'All stocked';

                // Handle the "more" link
                const moreElement = document.getElementById('low-stock-more');
                if (lowStockData.hasMore && moreElement) {
                    moreElement.style.display = 'inline';
                    // Add tooltip event listeners (similar to sidebar tooltips)
                    moreElement.addEventListener('mouseenter', () => {
                        showDashboardTooltip('Other low stock items:\n' + lowStockData.allItems.join('\n'), moreElement);
                    });
                    moreElement.addEventListener('mouseleave', hideDashboardTooltip);
                    moreElement.addEventListener('focus', () => {
                        showDashboardTooltip('Other low stock items:\n' + lowStockData.allItems.join('\n'), moreElement);
                    });
                    moreElement.addEventListener('blur', hideDashboardTooltip);
                } else if (moreElement) {
                    moreElement.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Failed to fetch low stock data:', error);
        }
    }
