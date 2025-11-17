const express = require('express');
const router = express.Router();
const InventoryManager = require('../utils/inventoryManager');
const { logInventoryTransaction } = require('../middleware/inventoryMiddleware');

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const { MongoClient } = require('mongodb');
    
    
    const client = new MongoClient(uri);
    await client.connect();
    await client.db('blessingscafe').collection('Ingredients').findOne({});
    
    res.json({
      status: 'healthy',
      timestamp: new Date(),
      message: 'Inventory system operational'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date(),
      error: error.message
    });
  }
});

// Manual inventory deduction (for testing or manual corrections)
router.post('/manual-deduct', async (req, res) => {
  try {
    const { orderId, cartItems, adminId } = req.body;
    
    if (!orderId || !cartItems || !Array.isArray(cartItems)) {
      return res.status(400).json({
        error: 'Missing required fields: orderId, cartItems'
      });
    }
    
    const result = await InventoryManager.deductIngredients(cartItems);
    
    await logInventoryTransaction(
      orderId,
      'manual-deduct',
      { 
        success: result.success, 
        adminId: adminId || 'unknown',
        itemCount: cartItems.length,
        deductions: result.deductions
      }
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Inventory manually deducted',
        deductions: result.deductions
      });
    } else {
      res.status(500).json({
        error: 'Failed to deduct inventory',
        details: result.error
      });
    }
    
  } catch (error) {
    console.error('Error in manual deduction:', error);
    res.status(500).json({
      error: 'Internal server error during manual deduction'
    });
  }
});

// Get ingredient usage analytics
router.get('/analytics', async (req, res) => {
  try {
    const { MongoClient } = require('mongodb');
    
    
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('blessingscafe');
    
    // Get all ingredients with low stock
    const ingredients = await req.db.collection('Ingredients')
      .find({ isEnabled: true })
      .sort({ Amount: 1 })
      .toArray();
    
    // Get all add-ons with low stock  
    const addons = await req.db.collection('Add-ons')
      .find({ isEnabled: true })
      .sort({ Quantity: 1 })
      .toArray();
    
    const analytics = {
      totalIngredients: ingredients.length,
      totalAddons: addons.length,
      lowStockIngredients: ingredients.filter(ing => ing.Amount < 100).length,
      lowStockAddons: addons.filter(addon => addon.Quantity < 5).length,
      criticalIngredients: ingredients.filter(ing => ing.Amount < 50),
      criticalAddons: addons.filter(addon => addon.Quantity < 2),
      timestamp: new Date()
    };
    
    res.json({
      success: true,
      analytics
    });
    
  } catch (error) {
    console.error('Error fetching inventory analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch inventory analytics'
    });
  }
});

module.exports = router;