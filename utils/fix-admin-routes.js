const fs = require('fs');
const path = require('path');

const adminRoutesPath = path.join(__dirname, '..', 'routes', 'admin.js');
let content = fs.readFileSync(adminRoutesPath, 'utf8');

// List of all helper functions that now require db parameter
const helperFunctions = [
  'getDashboardStats',
  'getAnalyticsData',
  'getProducts',
  'getProductById',
  'getOrders',
  'getOrderById',
  'getStockData',
  'getDiscounts',
  'getMenu',
  'getPopularProducts',
  'getDashboardAnalyticsStats',
  'getTopCategories',
  'getPaymentTypes',
  'getOrdersBySource',
  'getSalesPerformance',
  'getActiveDiscounts',
  'getDiscountById',
  'getDiscountStats'
];

// Replace function calls to include req.db parameter
helperFunctions.forEach(funcName => {
  // Match: functionName() or await functionName()
  const regex1 = new RegExp(`(await\\s+)?${funcName}\\(\\)`, 'g');
  content = content.replace(regex1, `$1${funcName}(req.db)`);
  
  // Match: functionName(param) -> functionName(req.db, param)
  // This handles cases like getSalesPerformance(14)
  const regex2 = new RegExp(`(await\\s+)?${funcName}\\(([^)]*)\\)`, 'g');
  content = content.replace(regex2, (match, awaitPart, params) => {
    awaitPart = awaitPart || '';
    // Skip if already has req.db as first param
    if (params.trim().startsWith('req.db')) {
      return match;
    }
    // If no params, just add req.db
    if (!params.trim()) {
      return `${awaitPart}${funcName}(req.db)`;
    }
    // If has params, add req.db as first param
    return `${awaitPart}${funcName}(req.db, ${params})`;
  });
});

// Special case: functions that need id parameter
// getProductById(id) -> getProductById(req.db, id)
// getOrderById(id) -> getOrderById(req.db, id)
content = content.replace(/getProductById\(req\.params\.id\)/g, 'getProductById(req.db, req.params.id)');
content = content.replace(/getOrderById\(req\.params\.id\)/g, 'getOrderById(req.db, req.params.id)');

fs.writeFileSync(adminRoutesPath, content, 'utf8');
console.log('✅ Fixed all helper function calls in admin.js to include req.db parameter');
