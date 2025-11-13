const dbConnection = require('./db');
const InventoryManager = require('./inventoryManager');



class InventoryMonitor {
  
  static async generateDailyReport() {
        try {
      const db = dbConnection.getDb();
      
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));
      
      // Get orders from today with inventory deductions
      const todaysOrders = await db.collection('Orders').find({
        Date: { $gte: startOfDay, $lte: endOfDay },
        InventoryDeducted: true
      }).toArray();
      
      // Get current inventory levels
      const ingredients = await db.collection('Ingredients').find({}).toArray();
      const addons = await db.collection('Add-ons').find({}).toArray();
      
      const report = {
        date: today.toISOString().split('T')[0],
        ordersProcessed: todaysOrders.length,
        totalDeductions: todaysOrders.reduce((acc, order) => {
          return acc + (order.InventoryDeductions ? order.InventoryDeductions.length : 0);
        }, 0),
        currentStock: {
          ingredients: ingredients.map(ing => ({
            id: ing.IngredientID,
            name: ing.Name,
            amount: ing.Amount,
            status: ing.Amount < 50 ? 'critical' : ing.Amount < 100 ? 'low' : 'good'
          })),
          addons: addons.map(addon => ({
            id: addon.AddOnID,
            name: addon.Name,
            quantity: addon.Quantity,
            status: addon.Quantity < 2 ? 'critical' : addon.Quantity < 5 ? 'low' : 'good'
          }))
        },
        alerts: {
          criticalIngredients: ingredients.filter(ing => ing.Amount < 50).length,
          lowIngredients: ingredients.filter(ing => ing.Amount < 100 && ing.Amount >= 50).length,
          criticalAddons: addons.filter(addon => addon.Quantity < 2).length,
          lowAddons: addons.filter(addon => addon.Quantity < 5 && addon.Quantity >= 2).length
        }
      };
      
      console.log('=== DAILY INVENTORY REPORT ===');
      console.log(`Date: ${report.date}`);
      console.log(`Orders Processed: ${report.ordersProcessed}`);
      console.log(`Total Inventory Deductions: ${report.totalDeductions}`);
      console.log(`Critical Ingredients: ${report.alerts.criticalIngredients}`);
      console.log(`Low Stock Ingredients: ${report.alerts.lowIngredients}`);
      console.log(`Critical Add-ons: ${report.alerts.criticalAddons}`);
      console.log(`Low Stock Add-ons: ${report.alerts.lowAddons}`);
      console.log('==============================');
      
      return report;
      
    } catch (error) {
      console.error('Error generating daily report:', error);
      return null;
    }
  }
  
  static async checkForCriticalStock() {
        try {
      const db = dbConnection.getDb();
      
      const criticalIngredients = await db.collection('Ingredients').find({
        Amount: { $lt: 50 },
        isEnabled: true
      }).toArray();
      
      const criticalAddons = await db.collection('Add-ons').find({
        Quantity: { $lt: 2 },
        isEnabled: true
      }).toArray();
      
      const alerts = [];
      
      criticalIngredients.forEach(ing => {
        alerts.push({
          type: 'ingredient',
          severity: 'critical',
          item: ing.Name,
          id: ing.IngredientID,
          current: ing.Amount,
          unit: 'grams',
          message: `Critical: ${ing.Name} only has ${ing.Amount}g remaining`
        });
      });
      
      criticalAddons.forEach(addon => {
        alerts.push({
          type: 'addon',
          severity: 'critical',
          item: addon.Name,
          id: addon.AddOnID,
          current: addon.Quantity,
          unit: 'pieces',
          message: `Critical: ${addon.Name} only has ${addon.Quantity} pieces remaining`
        });
      });
      
      if (alerts.length > 0) {
        console.log('🚨 CRITICAL STOCK ALERTS 🚨');
        alerts.forEach(alert => {
          console.log(`- ${alert.message}`);
        });
      }
      
      return alerts;
      
    } catch (error) {
      console.error('Error checking critical stock:', error);
      return [];
    }
  }
  
  static async simulateRestockRecommendations() {
        try {
      const db = dbConnection.getDb();
      
      // Get usage patterns from recent orders
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      
      const recentOrders = await db.collection('Orders').find({
        Date: { $gte: lastWeek },
        InventoryDeducted: true
      }).toArray();
      
      // Analyze usage patterns
      const ingredientUsage = {};
      const addonUsage = {};
      
      recentOrders.forEach(order => {
        if (order.InventoryDeductions) {
          order.InventoryDeductions.forEach(deduction => {
            if (deduction.type === 'ingredient') {
              if (!ingredientUsage[deduction.id]) {
                ingredientUsage[deduction.id] = {
                  name: deduction.name,
                  totalUsed: 0,
                  count: 0
                };
              }
              ingredientUsage[deduction.id].totalUsed += deduction.gramsDeducted;
              ingredientUsage[deduction.id].count++;
            } else if (deduction.type === 'addon') {
              if (!addonUsage[deduction.id]) {
                addonUsage[deduction.id] = {
                  name: deduction.name,
                  totalUsed: 0,
                  count: 0
                };
              }
              addonUsage[deduction.id].totalUsed += deduction.quantityDeducted;
              addonUsage[deduction.id].count++;
            }
          });
        }
      });
      
      console.log('📊 USAGE ANALYSIS (Last 7 Days)');
      console.log('Ingredients:');
      Object.entries(ingredientUsage).forEach(([id, usage]) => {
        const avgDaily = usage.totalUsed / 7;
        console.log(`- ${usage.name}: ${usage.totalUsed}g total, ${Math.round(avgDaily)}g/day average`);
      });
      
      console.log('Add-ons:');
      Object.entries(addonUsage).forEach(([id, usage]) => {
        const avgDaily = usage.totalUsed / 7;
        console.log(`- ${usage.name}: ${usage.totalUsed} pieces total, ${Math.round(avgDaily)} pieces/day average`);
      });
      
      return { ingredientUsage, addonUsage };
      
    } catch (error) {
      console.error('Error analyzing usage patterns:', error);
      return null;
    }
  }
}

module.exports = InventoryMonitor;

// If run directly, execute daily report
if (require.main === module) {
  console.log('Running inventory monitoring...');
  
  Promise.all([
    InventoryMonitor.generateDailyReport(),
    InventoryMonitor.checkForCriticalStock(),
    InventoryMonitor.simulateRestockRecommendations()
  ]).then(() => {
    console.log('Inventory monitoring complete.');
    process.exit(0);
  }).catch(error => {
    console.error('Error running inventory monitoring:', error);
    process.exit(1);
  });
}