const fs = require('fs');
const path = require('path');

console.log('🔧 Starting comprehensive route file fixes...\n');

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
  'getDiscountStats',
  'getUnreadNotificationCount',
  'addIngredient',
  'updateIngredient',
  'deleteIngredient',
  'bulkUpdateIngredients',
  'exportIngredientsAndAddons',
  'searchIngredientsAddons',
  'getIngredientStats',
  'getLowStockAlerts',
  'getIngredientCategories',
  'getStockHealth',
  'updateOrderFulfillment',
  'updateOrderPaymentStatus',
  'cancelOrder',
  'restoreOrder',
  'getAverageSalesPerDay',
  'addDiscount',
  'updateDiscount',
  'deleteDiscount',
  'bulkUpdateDiscounts'
];

// Files to process
const routeFiles = [
  'routes/staff.js',
  'routes/inventory.js',
  'routes/inventory-admin.js',
  'routes/user.js'
];

let totalFixes = 0;

routeFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ Skipping ${file} - file not found`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let fileFixed = false;
  let fileFixes = 0;
  
  helperFunctions.forEach(funcName => {
    // Pattern 1: functionName() -> functionName(req.db)
    const regex1 = new RegExp(`(await\\s+)?${funcName}\\(\\)`, 'g');
    const matches1 = content.match(regex1);
    if (matches1) {
      content = content.replace(regex1, `$1${funcName}(req.db)`);
      fileFixes += matches1.length;
      fileFixed = true;
    }
    
    // Pattern 2: functionName(params) -> functionName(req.db, params)
    const regex2 = new RegExp(`(await\\s+)?${funcName}\\(([^)]*)\\)`, 'g');
    content = content.replace(regex2, (match, awaitPart, params) => {
      awaitPart = awaitPart || '';
      params = params.trim();
      
      // Skip if already has req.db
      if (params.startsWith('req.db')) {
        return match;
      }
      
      // If no params, add req.db
      if (!params) {
        fileFixes++;
        fileFixed = true;
        return `${awaitPart}${funcName}(req.db)`;
      }
      
      // If has params, add req.db as first param
      fileFixes++;
      fileFixed = true;
      return `${awaitPart}${funcName}(req.db, ${params})`;
    });
  });
  
  if (fileFixed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed ${file} - ${fileFixes} function calls updated`);
    totalFixes += fileFixes;
  } else {
    console.log(`✓ ${file} - no fixes needed`);
  }
});

console.log(`\n🎉 Total fixes applied: ${totalFixes} function calls updated`);
