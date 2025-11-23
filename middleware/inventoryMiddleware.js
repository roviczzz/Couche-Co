const InventoryManager = require('../utils/inventoryManager');
const { createLowStockNotification, getStockData } = require('../admin-helpers');

const checkInventoryAvailability = async (req, res, next) => {
  try {
    const orderItems = req.body.Cart || [];
    
    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ 
        error: 'No items in cart' 
      });
    }
    
    console.log('Checking inventory for items:', orderItems.length);
    
    const availabilityCheck = await InventoryManager.checkIngredientAvailability(orderItems);
    
    // If there's a database error, allow the order to proceed but log the issue
    if (availabilityCheck.error) {
      console.error('Inventory check failed, allowing order to proceed:', availabilityCheck.error);
      req.inventoryCheckFailed = true;
      req.inventoryError = availabilityCheck.error;
      return next();
    }
    
    if (!availabilityCheck.available) {
      // Log detailed unavailable items for debugging
      console.log('=== INVENTORY CHECK FAILED ===');
      console.log('Order items checked:', orderItems.length);
      console.log('Unavailable items details:', JSON.stringify(availabilityCheck.unavailableItems, null, 2));
      
      // Enhanced error response with customer-friendly messages
      const enhancedUnavailableItems = availabilityCheck.unavailableItems.map(item => {
        // Count missing ingredients and add-ons
        const missingIngredients = item.missingIngredients || [];
        const ingredientCount = missingIngredients.filter(ing => ing.type !== 'addon').length;
        const addonCount = missingIngredients.filter(ing => ing.type === 'addon').length;
        
        let customerReason = 'Currently unavailable';
        if (ingredientCount > 0 && addonCount > 0) {
          customerReason = 'Some ingredients and add-ons are out of stock';
        } else if (ingredientCount > 0) {
          customerReason = 'Some ingredients are out of stock';
        } else if (addonCount > 0) {
          customerReason = 'Some add-ons are out of stock';
        }
        
        return {
          item: item.item,
          reason: customerReason,
          missingIngredients: item.missingIngredients // Keep for detailed frontend logging
        };
      });
      
      return res.status(409).json({
        error: 'Some items are currently unavailable',
        unavailableItems: enhancedUnavailableItems
      });
    }
    
    console.log('All items available for order');
    req.inventoryChecked = true;
    next();
    
  } catch (error) {
    console.error('Inventory check middleware error:', error);
    // In case of system errors, allow order to proceed but log the issue
    req.inventoryCheckFailed = true;
    req.inventoryError = error.message;
    console.warn('Inventory check failed, allowing order to proceed due to system error');
    next();
  }
};

const deductInventoryAfterPayment = async (orderData) => {
  try {
    const orderItems = orderData.Cart || [];

    if (!orderItems || orderItems.length === 0) {
      console.warn('[INVENTORY] No items to deduct from inventory');
      return { success: true, message: 'No items to process' };
    }

    console.log(`[INVENTORY] Starting deduction for order ${orderData.OrderID} with ${orderItems.length} items`);
    console.log('[INVENTORY] Order items:', JSON.stringify(orderItems, null, 2));

    const deductionResult = await InventoryManager.deductIngredients(orderItems);

    if (!deductionResult.success) {
      console.error('[INVENTORY] Failed to deduct inventory:', deductionResult.error);
      return deductionResult;
    }

    console.log('[INVENTORY] Successfully deducted inventory for order:', orderData.OrderID);
    console.log('[INVENTORY] Deduction details:', deductionResult.deductions);

    // After successful inventory deduction, check for low stock and trigger notification
    try {
      console.log('[INVENTORY] Checking for low stock after inventory deduction...');
      const stockData = await getStockData(orderData.db);
      const notification = await createLowStockNotification(orderData.db, stockData);

      if (notification) {
        console.log('[INVENTORY] Low stock notification created after inventory deduction');
      } else {
        console.log('[INVENTORY] No low stock notification needed');
      }
    } catch (notificationError) {
      console.error('[INVENTORY] Error checking low stock after deduction:', notificationError);
      // Don't fail the order if notification fails
    }

    return deductionResult;

  } catch (error) {
    console.error('[INVENTORY] Error in inventory deduction:', error);
    return { success: false, error: error.message };
  }
};

const validateInventoryData = (req, res, next) => {
  const { Cart } = req.body;
  
  if (!Cart || !Array.isArray(Cart)) {
    return res.status(400).json({
      error: 'Invalid cart data format'
    });
  }
  
  // Validate each cart item has required fields
  for (let i = 0; i < Cart.length; i++) {
    const item = Cart[i];
    
    if (!item.ProductName && !item.Name) {
      return res.status(400).json({
        error: `Item at index ${i} missing product name`
      });
    }
    
    if (!item.Quantity || item.Quantity <= 0) {
      return res.status(400).json({
        error: `Item at index ${i} has invalid quantity`
      });
    }
  }
  
  next();
};

const logInventoryTransaction = async (orderId, transactionType, details) => {
  try {
    const logEntry = {
      orderId,
      transactionType, // 'check', 'deduct', 'restock'
      details,
      timestamp: new Date(),
      success: details.success || false
    };
    
    console.log(`Inventory ${transactionType} for order ${orderId}:`, logEntry);
    
    // Could save to a separate inventory_logs collection if needed
    return logEntry;
    
  } catch (error) {
    console.error('Error logging inventory transaction:', error);
  }
};

module.exports = {
  checkInventoryAvailability,
  deductInventoryAfterPayment,
  validateInventoryData,
  logInventoryTransaction
};
