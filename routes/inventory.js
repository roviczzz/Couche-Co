const express = require('express');
const router = express.Router();
const { checkInventoryAvailability, validateInventoryData, logInventoryTransaction } = require('../middleware/inventoryMiddleware');
const InventoryManager = require('../utils/inventoryManager');

// Check inventory availability for cart items
router.post('/check', validateInventoryData, checkInventoryAvailability, async (req, res) => {
  try {
    await logInventoryTransaction(
      req.body.orderId || 'pre-order-check',
      'check',
      { success: true, itemCount: req.body.Cart.length }
    );
    
    res.json({ 
      success: true, 
      message: 'All items are available',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error in inventory check endpoint:', error);
    res.status(500).json({
      error: 'Internal server error during inventory check'
    });
  }
});

// Get current inventory levels (for admin dashboard)
router.get('/levels', async (req, res) => {
  try {
    const { MongoClient } = require('mongodb');
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    let client;

    client = new MongoClient(uri);
    await client.connect();
    const db = client.db('blessingscafe');

    const ingredients = await db.collection('Ingredients').find({}).toArray();
    const addons = await db.collection('Add-ons').find({}).toArray();

    await client.close();

    res.json({
      success: true,
      data: {
        ingredients: ingredients.map(ing => ({
          id: ing.IngredientID,
          name: ing.Name,
          amount: ing.Amount,
          unit: 'grams',
          category: ing.Category,
          isAvailable: ing.isAvailable
        })),
        addons: addons.map(addon => ({
          id: addon.AddOnID,
          name: addon.Name,
          quantity: addon.Quantity,
          unit: 'pieces',
          category: addon.Category,
          isEnabled: addon.isEnabled
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching inventory levels:', error);
    res.status(500).json({
      error: 'Failed to fetch inventory levels'
    });
  }
});

// Restock ingredient (admin only)
router.post('/restock', async (req, res) => {
  try {
    const { ingredientId, amount, adminId } = req.body;

    if (!ingredientId || !amount || amount <= 0) {
      return res.status(400).json({
        error: 'Invalid restock parameters'
      });
    }

    const result = await InventoryManager.restockIngredient(ingredientId, amount);

    if (result.success) {
      await logInventoryTransaction(
        `restock-${Date.now()}`,
        'restock',
        { 
          success: true, 
          ingredientId, 
          amount, 
          adminId: adminId || 'unknown'
        }
      );

      res.json({
        success: true,
        message: `Successfully restocked ${amount}g of ${ingredientId}`
      });
    } else {
      res.status(500).json({
        error: 'Failed to restock ingredient',
        details: result.error
      });
    }

  } catch (error) {
    console.error('Error in restock endpoint:', error);
    res.status(500).json({
      error: 'Internal server error during restock'
    });
  }
});

// Get low stock alerts (items below threshold)
router.get('/alerts', async (req, res) => {
  try {
    const { MongoClient } = require('mongodb');
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    let client;

    client = new MongoClient(uri);
    await client.connect();
    const db = client.db('blessingscafe');

    // Define thresholds
    const INGREDIENT_THRESHOLD = 100; // grams
    const ADDON_THRESHOLD = 5; // pieces

    const lowIngredients = await db.collection('Ingredients')
      .find({ 
        Amount: { $lt: INGREDIENT_THRESHOLD },
        isEnabled: true 
      })
      .toArray();

    const lowAddons = await db.collection('Add-ons')
      .find({ 
        Quantity: { $lt: ADDON_THRESHOLD },
        isEnabled: true 
      })
      .toArray();

    await client.close();

    const alerts = [
      ...lowIngredients.map(ing => ({
        type: 'ingredient',
        id: ing.IngredientID,
        name: ing.Name,
        current: ing.Amount,
        threshold: INGREDIENT_THRESHOLD,
        unit: 'grams',
        severity: ing.Amount <= 50 ? 'critical' : 'warning'
      })),
      ...lowAddons.map(addon => ({
        type: 'addon',
        id: addon.AddOnID,
        name: addon.Name,
        current: addon.Quantity,
        threshold: ADDON_THRESHOLD,
        unit: 'pieces',
        severity: addon.Quantity <= 2 ? 'critical' : 'warning'
      }))
    ];

    res.json({
      success: true,
      alerts,
      count: alerts.length
    });

  } catch (error) {
    console.error('Error fetching inventory alerts:', error);
    res.status(500).json({
      error: 'Failed to fetch inventory alerts'
    });
  }
});

module.exports = router;