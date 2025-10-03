// Enhanced chart configuration with Shopify-inspired styling
Chart.defaults.font.family = 'Inter';
Chart.defaults.font.size = 12;
Chart.defaults.color = '#6d7175';

let popularProductsData = [];
let salesTrendData = [];

async function drawPopularProductsChart() {
  const loadingEl = document.getElementById('popularProductsLoading');
  const chartEl = document.getElementById('popularProductsChart');
  
  try {
    const res = await fetch('/api/analytics/popular-products');
    if (!res.ok) {
      throw new Error(`Server returned ${res.status}: ${res.statusText}`);
    }
    const text = await res.text();
    let results;
    try {
      results = JSON.parse(text);
    } catch (e) {
      console.error('JSON parse error:', e, 'Raw response:', text);
      throw new Error('Invalid JSON response from server');
    }

    popularProductsData = results;

    if (!Array.isArray(results) || results.length === 0) {
      loadingEl.innerHTML = '<div class="error-message">No product data available. Try again later.</div>';
      return;
    }

    const top = results.slice(0, 10);
    const labels = top.map(r => r._id);
    const data = top.map(r => r.totalQuantity);

    // Update stats
    document.getElementById('totalProducts').textContent = results.length;
    document.getElementById('topProduct').textContent = top[0]?._id || 'N/A';

    // Hide loading, show chart
    loadingEl.style.display = 'none';
    chartEl.style.display = 'block';

    new Chart(chartEl, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Units Sold',
          data: data,
          backgroundColor: '#8b5a2b',
          borderColor: '#8b5a2b',
          borderWidth: 0,
          borderRadius: 4,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            display: false
          },
          title: { 
            display: false
          }
        },
        scales: {
          x: {
            ticks: { 
              font: { size: 11, weight: '500' },
              maxRotation: 0,
              color: '#6d7175'
            },
            grid: {
              display: false
            },
            border: {
              display: false
            }
          },
          y: { 
            beginAtZero: true,
            ticks: { 
              font: { size: 11, weight: '500' },
              color: '#6d7175',
              stepSize: 1
            },
            grid: {
              color: '#f1f2f3',
              drawBorder: false
            },
            border: {
              display: false
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        },
        elements: {
          bar: {
            borderRadius: 4
          }
        }
      }
    });
  } catch (err) {
    console.error('Chart error:', err);
    loadingEl.innerHTML = `<div class="error-message">Failed to load popular products data: ${err.message}</div>`;
  }
}

async function drawAverageSalesChart() {
  const loadingEl = document.getElementById('averageSalesLoading');
  const chartEl = document.getElementById('averageSalesChart');
  
  try {
    const res = await fetch('/api/analytics/sales-per-day');
    if (!res.ok) {
      throw new Error(`Server returned ${res.status}: ${res.statusText}`);
    }
    const text = await res.text();
    let results;
    try {
      results = JSON.parse(text);
    } catch (e) {
      console.error('JSON parse error:', e, 'Raw response:', text);
      throw new Error('Invalid JSON response from server');
    }

    salesTrendData = results;

    if (!Array.isArray(results) || results.length === 0) {
      loadingEl.innerHTML = '<div class="error-message">No sales data available. Try again later.</div>';
      return;
    }

    const labels = results.map(r => {
      const dateObj = new Date(r._id);
      return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    });

    const data = results.map(r => r.totalSales);

    // Calculate insights
    const avgSales = data.reduce((a, b) => a + b, 0) / data.length;
    const maxSales = Math.max(...data);
    const maxIndex = data.indexOf(maxSales);
    const trend = data[data.length - 1] > data[0] ? '↗ Growing' : '↘ Declining';

    // Update stats
    document.getElementById('avgDailySales').textContent = `₱${avgSales.toFixed(0)}`;
    document.getElementById('salesTrend').textContent = trend;
    document.getElementById('peakDay').textContent = labels[maxIndex];

    // Hide loading, show chart
    loadingEl.style.display = 'none';
    chartEl.style.display = 'block';

    new Chart(chartEl, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Sales (₱)',
          data: data,
          backgroundColor: 'rgba(139, 90, 43, 0.08)',
          borderColor: '#8b5a2b',
          borderWidth: 2,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#8b5a2b',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHoverBorderWidth: 3,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            display: false
          },
          title: { 
            display: false
          }
        },
        scales: {
          x: {
            ticks: { 
              font: { size: 11, weight: '500' }, 
              maxRotation: 0, 
              color: '#6d7175'
            },
            grid: {
              display: false
            },
            border: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            ticks: { 
              font: { size: 11, weight: '500' },
              color: '#6d7175',
              callback: function(value) {
                return '₱' + value.toLocaleString();
              }
            },
            grid: {
              color: '#f1f2f3',
              drawBorder: false
            },
            border: {
              display: false
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });
  } catch (err) {
    console.error('Average sales chart error:', err);
    loadingEl.innerHTML = `<div class="error-message">Failed to load sales trend data: ${err.message}</div>`;
  }
}

async function loadOrderHistory() {
  try {
    const res = await fetch("/admin/analytics/order-history");
    const orders = await res.json();

    const tbody = document.getElementById("orderHistoryBody");
    tbody.innerHTML = "";

    orders.forEach(o => {
      const row = `
        <tr>
          <td>${o.OrderID}</td>
          <td>${o.Customer}</td>
          <td>${o.Date}</td>
          <td>${o.Total}</td>
          <td>${o.PaymentMode}</td>
          <td>${o.PaymentStatus}</td>
        </tr>
      `;
      tbody.insertAdjacentHTML("beforeend", row);
    });
  } catch (err) {
    console.error("Error loading orders:", err);
  }
}

// Payment Methods Doughnut Chart
async function drawPaymentMethodsChart() {
  const loadingEl = document.getElementById('paymentMethodsLoading');
  const chartEl = document.getElementById('paymentMethodsChart');

  try {
    const res = await fetch('/api/analytics/payment-methods');
    if (!res.ok) {
      throw new Error(`Server returned ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      loadingEl.innerHTML = '<div class="error-message">No payment data available. Try again later.</div>';
      return;
    }

    // Hide loading, show chart
    loadingEl.style.display = 'none';
    chartEl.style.display = 'block';

    new Chart(chartEl, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d._id),
        datasets: [{
          data: data.map(d => d.revenue),
          backgroundColor: ['#8b5a2b', '#d2691e', '#cd853f', '#a0522d', '#daa520'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              font: { size: 12, weight: '500' }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                return `${label}: ₱${value.toLocaleString()}`;
              }
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('Payment methods chart error:', err);
    loadingEl.innerHTML = `<div class="error-message">Failed to load payment methods data: ${err.message}</div>`;
  }
}

// Order Sources Bar Chart
async function drawOrderSourcesChart() {
  const loadingEl = document.getElementById('orderSourcesLoading');
  const chartEl = document.getElementById('orderSourcesChart');

  try {
    const res = await fetch('/api/analytics/order-sources');
    if (!res.ok) {
      throw new Error(`Server returned ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      loadingEl.innerHTML = '<div class="error-message">No order source data available. Try again later.</div>';
      return;
    }

    // Hide loading, show chart
    loadingEl.style.display = 'none';
    chartEl.style.display = 'block';

    new Chart(chartEl, {
      type: 'bar',
      data: {
        labels: data.map(d => d._id),
        datasets: [{
          label: 'Orders',
          data: data.map(d => d.orderCount),
          backgroundColor: '#8b5a2b',
          borderColor: '#8b5a2b',
          borderWidth: 0,
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: {
              font: { size: 11, weight: '500' },
              maxRotation: 0,
              color: '#6d7175'
            },
            grid: { display: false },
            border: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: {
              font: { size: 11, weight: '500' },
              color: '#6d7175',
              stepSize: 1
            },
            grid: {
              color: '#f1f2f3',
              drawBorder: false
            },
            border: { display: false }
          }
        },
        plugins: {
          legend: { display: false }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        },
        elements: {
          bar: { borderRadius: 4 }
        }
      }
    });
  } catch (err) {
    console.error('Order sources chart error:', err);
    loadingEl.innerHTML = `<div class="error-message">Failed to load order sources data: ${err.message}</div>`;
  }
}

// Initialize charts and load data on page load
document.addEventListener("DOMContentLoaded", function() {
  drawPopularProductsChart();
  drawAverageSalesChart();
  drawPaymentMethodsChart();
  drawOrderSourcesChart();
  loadOrderHistory();
});
