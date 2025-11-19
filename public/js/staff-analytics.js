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
    const res = await fetch('/staff/analytics/popular-products');
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
    const labels = top.map(r => {
      const fullName = r._id || 'Unknown Product';
      // Truncate long names for display while keeping them readable
      return fullName.length > 15 ? fullName.substring(0, 12) + '...' : fullName;
    });
    const data = top.map(r => r.totalQuantity);
    const fullProductNames = top.map(r => r._id || 'Unknown Product'); // Store full names for tooltips

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
          },
          tooltip: {
            callbacks: {
              title: function(context) {
                // Show full product name in tooltip
                const index = context[0].dataIndex;
                return fullProductNames[index];
              },
              label: function(context) {
                return `Units Sold: ${context.parsed.y}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              font: { size: 11, weight: '500' },
              maxRotation: 45,
              minRotation: 0,
              color: '#6d7175',
              autoSkip: false,
              maxTicksLimit: labels.length
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
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'x',
              threshold: 10
            },
            zoom: {
              wheel: {
                enabled: true
              },
              pinch: {
                enabled: true
              },
              mode: 'x'
            }
          }
        },
        scales: {
          x: {
            ticks: {
              font: { size: 11, weight: '500' },
              maxRotation: 0,
              color: '#6d7175',
              maxTicksLimit: Math.min(labels.length, 14), // Limit to 14 ticks max
              autoSkip: true // Allow auto-skipping for dense dates
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

async function loadOrderHistory(days = 7) {
  console.log('loadOrderHistory called with days:', days);
  try {
    let url = "/staff/analytics/order-history?days=" + days;
    console.log('Fetching URL:', url);
    const res = await fetch(url);
    const orders = await res.json();
    console.log('Received orders:', orders.length);

    const tbody = document.getElementById("orderHistoryBody");
    tbody.innerHTML = "";

    if (!orders || orders.length === 0) {
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:10px;">No orders found</td></tr>';
  return;
}


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

// Filter button handlers
function setupOrderHistoryFilters() {
  const buttons = document.querySelectorAll(".filter-btn");

  buttons.forEach(btn => {
    btn.addEventListener("click", function () {
      const days = this.getAttribute("data-days"); // get "7", "30", or "all"
      loadOrderHistory(days); // call backend with parameter

      // remove active from all, then add to clicked one
      buttons.forEach(b => b.classList.remove("active"));
      this.classList.add("active");
    });
  });
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

    // Generate distinct brown color variations for pie charts
    const generateColors = (count) => {
      const brownColors = [
        '#8b5a2b', // Saddle Brown - primary brown
        '#a0522d', // Sienna - reddish brown
        '#cd853f', // Peru - warm brown
        '#daa520', // Goldenrod - golden brown
        '#b8860b', // Dark Goldenrod - darker golden
        '#d2b48c', // Tan - light brown
        '#f4a460', // Sandy Brown - sandy brown
        '#deb887', // Burlywood - burlywood brown
        '#d2691e', // Chocolate - chocolate brown
        '#bc8f8f'  // Rosy Brown - rosy brown
      ];

      // Use distinct brown variations to ensure visibility
      const colors = [];
      for (let i = 0; i < Math.min(count, brownColors.length); i++) {
        colors.push(brownColors[i]);
      }

      // If more than available browns, cycle through with slight variations
      if (count > brownColors.length) {
        const additionalColors = [];
        for (let i = 0; i < count - brownColors.length; i++) {
          additionalColors.push(brownColors[i % brownColors.length]);
        }
        colors.push(...additionalColors);
      }

      return colors;
    };

    // Hide loading, show chart
    loadingEl.style.display = 'none';
    chartEl.style.display = 'block';

    new Chart(chartEl, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d._id),
        datasets: [{
          data: data.map(d => d.count), // Use count instead of revenue for better visibility
          backgroundColor: generateColors(data.length),
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
                const dataIndex = context.dataIndex;
                const count = data[dataIndex]?.count || 0;
                return `${label}: ${count} orders`;
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
            const res = await fetch('/staff/analytics/order-sources');
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

            const labels = data.map(d => {
              const name = d._id || 'Unknown';
              // Truncate long names for display while keeping them readable
              return name.length > 15 ? name.substring(0, 12) + '...' : name;
            });
            const fullSourceNames = data.map(d => d._id || 'Unknown'); // Store full names for tooltips

            new Chart(chartEl, {
              type: 'bar',
              data: {
                labels: labels,
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
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      title: function(context) {
                        // Show full order source name in tooltip
                        const index = context[0].dataIndex;
                        return fullSourceNames[index];
                      },
                      label: function(context) {
                        return `Orders: ${context.parsed.y}`;
                      }
                    }
                  }
                },
                scales: {
                  x: {
                    ticks: {
                      font: { size: 11, weight: '500' },
                      maxRotation: 45,
                      minRotation: 0,
                      color: '#6d7175',
                      autoSkip: false,
                      maxTicksLimit: labels.length
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

// Report Modal Functions
document.addEventListener('DOMContentLoaded', function() {
  // Setup Generate Report Button
  const generateReportBtn = document.getElementById('generateReportBtn');
  if (generateReportBtn) {
    generateReportBtn.addEventListener('click', openReportModal);
  }

  // Setup Report Form
  const reportForm = document.getElementById('reportForm');
  const reportDateRange = document.getElementById('reportDateRange');
  const customDateRange = document.getElementById('customDateRange');

  if (reportDateRange) {
    reportDateRange.addEventListener('change', function() {
      if (this.value === 'custom') {
        customDateRange.style.display = 'block';
      } else {
        customDateRange.style.display = 'none';
      }
    });
  }

  if (reportForm) {
    reportForm.addEventListener('submit', handleReportGeneration);
  }
});

function openReportModal() {
  const modal = document.getElementById('reportModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function closeReportModal() {
  const modal = document.getElementById('reportModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

async function handleReportGeneration(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  const dateRange = formData.get('dateRange');
  const fromDate = formData.get('fromDate');
  const toDate = formData.get('toDate');

  // Validate inputs
  if (dateRange === 'custom') {
    if (!fromDate || !toDate) {
      alert('Please select both from and to dates');
      return;
    }
    if (new Date(fromDate) > new Date(toDate)) {
      alert('From date must be earlier than to date');
      return;
    }
  }

  // Build URL with parameters
  let url = '/staff/analytics/sales-report-pdf?';
  if (dateRange === 'custom') {
    url += `start_date=${fromDate}&end_date=${toDate}`;
  } else {
    url += `days=${dateRange}`;
  }

  // Close modal and show loading
  closeReportModal();

  const originalButtonText = event.target.querySelector('#generatePdfBtn').textContent;
  event.target.querySelector('#generatePdfBtn').textContent = 'Generating...';
  event.target.querySelector('#generatePdfBtn').disabled = true;

  try {
    // Create hidden link to trigger download
    const link = document.createElement('a');
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Show success message
    setTimeout(() => {
      alert('Report downloaded successfully!');
      event.target.querySelector('#generatePdfBtn').textContent = originalButtonText;
      event.target.querySelector('#generatePdfBtn').disabled = false;
    }, 2000);

  } catch (error) {
    console.error('Report generation error:', error);
    alert('Failed to generate report. Please try again.');
    event.target.querySelector('#generatePdfBtn').textContent = originalButtonText;
    event.target.querySelector('#generatePdfBtn').disabled = false;
  }
}

// Initialize charts and load data on page load
document.addEventListener("DOMContentLoaded", function() {
  drawPopularProductsChart();
  drawAverageSalesChart();
  drawPaymentMethodsChart();
  drawOrderSourcesChart();
  setupOrderHistoryFilters();
  document.getElementById('filter7days').classList.add('active');
  loadOrderHistory(7);
});

// Close modal when clicking outside
document.addEventListener('click', function(event) {
  const modal = document.getElementById('reportModal');
  if (modal && event.target === modal) {
    closeReportModal();
  }
});
