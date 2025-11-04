const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

class InventoryManager {
  
  static async deductIngredients(orderItems) {
    let client;
    const deductionLog = [];
    
    try {
      client = new MongoClient(uri);
      await client.connect();
      const db = client.db('blessingscafe');
      
      const menuCollection = db.collection('Menu');
      const ingredientsCollection = db.collection('Ingredients');
      const addonsCollection = db.collection('Add-ons');
      
      for (const item of orderItems) {
        if (item.isFree) continue;
        
        // Find menu item by ProductID or Name
        const menuItem = await menuCollection.findOne({ 
          $or: [
            { ProductID: item.ProductID },
            { Name: item.ProductName }
          ]
        });
        
        if (!menuItem) {
          console.warn(`[INVENTORY DEBUG] Menu item not found in database: ${item.ProductName} (ProductID: ${item.ProductID})`);
          continue;
        }
        
        console.log(`[INVENTORY DEBUG] Processing item: ${item.ProductName}, Quantity: ${item.Quantity}, Size: ${item.Size}`);
        
        // Process ingredients for this menu item
        await this.processMenuItemIngredients(
          menuItem, 
          item, 
          ingredientsCollection, 
          deductionLog
        );
        
        // Process add-ons for this item
        await this.processAddons(
          item.Addons || [], 
          addonsCollection, 
          deductionLog
        );
      }
      
      console.log(`[INVENTORY SUCCESS] Completed deduction for ${orderItems.length} items. Total deductions: ${deductionLog.length}`);
      console.log('[INVENTORY DEBUG] Detailed deduction log:', JSON.stringify(deductionLog, null, 2));
      return { success: true, deductions: deductionLog };
      
    } catch (error) {
      console.error('[INVENTORY ERROR] Failed to deduct ingredients:', error);
      return { success: false, error: error.message };
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
  
  static async processMenuItemIngredients(menuItem, orderItem, ingredientsCollection, deductionLog) {
    if (!menuItem.Ingredients || !Array.isArray(menuItem.Ingredients)) return;
    
    for (const ingredient of menuItem.Ingredients) {
      const { ingredientID, usedGrams, name } = ingredient;
      let gramsToDeduct = 0;
      
      try {
        // Handle size-based ingredient usage
        if (typeof usedGrams === 'object' && usedGrams !== null && orderItem.Size) {
          gramsToDeduct = usedGrams[orderItem.Size] || usedGrams['16oz'] || 0;
        } else if (typeof usedGrams === 'number') {
          gramsToDeduct = usedGrams;
        } else {
          console.warn(`[INVENTORY DEBUG] Invalid usedGrams format for ingredient ${ingredientID}:`, usedGrams);
          continue;
        }
        
        if (gramsToDeduct > 0) {
          const totalGrams = gramsToDeduct * (orderItem.Quantity || 1);
          
          console.log(`[INVENTORY DEBUG] Deducting ${totalGrams}g of ${name || ingredientID} (${gramsToDeduct}g × ${orderItem.Quantity})`);
          
          const result = await ingredientsCollection.updateOne(
            { IngredientID: ingredientID },
            { 
              $inc: { Amount: -totalGrams },
              $set: { lastModified: new Date() }
            }
          );
          
          if (result.modifiedCount > 0) {
            console.log(`[INVENTORY DEBUG] Successfully deducted ${totalGrams}g of ${name || ingredientID}`);
            deductionLog.push({
              type: 'ingredient',
              id: ingredientID,
              name: name || 'Unknown Ingredient',
              gramsDeducted: totalGrams,
              gramsPerUnit: gramsToDeduct,
              orderItem: orderItem.ProductName,
              size: orderItem.Size,
              quantity: orderItem.Quantity
            });
          } else {
            console.warn(`[INVENTORY DEBUG] Failed to update ingredient ${ingredientID} - ingredient not found or already at minimum`);
          }
        }
      } catch (error) {
        console.error(`[INVENTORY DEBUG] Error processing ingredient ${ingredientID}:`, error);
      }
    }
  }
  
  static async processAddons(addons, addonsCollection, deductionLog) {
    if (!addons || !Array.isArray(addons)) return;
    
    for (const addon of addons) {
      try {
        const addonId = addon.AddOnID || addon.addOnID || addon.id;
        const addonName = addon.Name || addon.name || 'Unknown Add-on';
        
        if (!addonId) {
          console.warn('[INVENTORY DEBUG] Add-on missing ID:', addon);
          continue;
        }
        
        console.log(`[INVENTORY DEBUG] Deducting 1 unit of add-on: ${addonName} (${addonId})`);
        
        const result = await addonsCollection.updateOne(
          { AddOnID: addonId },
          { 
            $inc: { Quantity: -1 }
          }
        );
        
        if (result.modifiedCount > 0) {
          console.log(`[INVENTORY DEBUG] Successfully deducted 1 unit of ${addonName}`);
          deductionLog.push({
            type: 'addon',
            id: addonId,
            name: addonName,
            quantityDeducted: 1
          });
        } else {
          console.warn(`[INVENTORY DEBUG] Failed to update add-on ${addonId} - add-on not found or out of stock`);
        }
      } catch (error) {
        console.error('[INVENTORY DEBUG] Error processing add-on:', addon, error);
      }
    }
  }
  
  static async checkIngredientAvailability(orderItems) {
    let client;
    
    try {
      client = new MongoClient(uri);
      await client.connect();
      const db = client.db('blessingscafe');
      
      const menuCollection = db.collection('Menu');
      const ingredientsCollection = db.collection('Ingredients');
      const addonsCollection = db.collection('Add-ons');
      
      const unavailableItems = [];
      
      for (const item of orderItems) {
        if (item.isFree) continue;
        
        const menuItem = await menuCollection.findOne({ 
          $or: [
            { ProductID: item.ProductID },
            { Name: item.ProductName }
          ]
        });
        
        if (!menuItem) continue;
        
        const itemCheck = await this.checkSingleItemAvailability(
          menuItem, 
          item, 
          ingredientsCollection, 
          addonsCollection
        );
        
        if (!itemCheck.available) {
          unavailableItems.push({
            item: item.ProductName,
            reason: itemCheck.reason,
            missingIngredients: itemCheck.missingIngredients
          });
        }
      }
      
      return {
        available: unavailableItems.length === 0,
        unavailableItems
      };
      
    } catch (error) {
      console.error('Error checking availability:', error);
      return { available: false, error: error.message };
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
  
  static async checkSingleItemAvailability(menuItem, orderItem, ingredientsCollection, addonsCollection) {
    const missingIngredients = [];
    
    try {
      // Check ingredients
      if (menuItem.Ingredients && Array.isArray(menuItem.Ingredients)) {
        for (const ingredient of menuItem.Ingredients) {
          const { ingredientID, usedGrams, name } = ingredient;
          let gramsNeeded = 0;
          
          // Handle size-based ingredient usage
          if (typeof usedGrams === 'object' && usedGrams !== null && orderItem.Size) {
            gramsNeeded = usedGrams[orderItem.Size] || usedGrams['16oz'] || 0;
          } else if (typeof usedGrams === 'number') {
            gramsNeeded = usedGrams;
          }
          
          if (gramsNeeded > 0) {
            const totalNeeded = gramsNeeded * (orderItem.Quantity || 1);
            
            const ingredientDoc = await ingredientsCollection.findOne({ IngredientID: ingredientID });
            
            if (!ingredientDoc || (ingredientDoc.Amount || 0) < totalNeeded) {
              missingIngredients.push({
                id: ingredientID,
                name: name || 'Unknown Ingredient',
                needed: totalNeeded,
                available: ingredientDoc ? (ingredientDoc.Amount || 0) : 0,
                type: 'ingredient'
              });
            }
          }
        }
      }
      
      // Check add-ons
      if (orderItem.Addons && Array.isArray(orderItem.Addons)) {
        for (const addon of orderItem.Addons) {
          const addonId = addon.AddOnID || addon.addOnID || addon.id;
          const addonName = addon.Name || addon.name || 'Unknown Add-on';
          
          if (!addonId) continue;
          
          const addonDoc = await addonsCollection.findOne({ AddOnID: addonId });
          
          if (!addonDoc || (addonDoc.Quantity || 0) < 1) {
            missingIngredients.push({
              id: addonId,
              name: addonName,
              type: 'addon',
              needed: 1,
              available: addonDoc ? (addonDoc.Quantity || 0) : 0
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking item availability:', error);
      missingIngredients.push({
        id: 'ERROR',
        name: 'System Error',
        type: 'error',
        needed: 0,
        available: 0
      });
    }
    
    return {
      available: missingIngredients.length === 0,
      missingIngredients,
      reason: missingIngredients.length > 0 ? 'Insufficient ingredients or add-ons' : null
    };
  }
  
  static async restockIngredient(ingredientId, amount) {
    let client;
    
    try {
      client = new MongoClient(uri);
      await client.connect();
      const db = client.db('blessingscafe');
      
      const result = await db.collection('Ingredients').updateOne(
        { IngredientID: ingredientId },
        { 
          $inc: { Amount: amount },
          $set: { lastModified: new Date() }
        }
      );
      
      return { success: result.modifiedCount > 0 };
      
    } catch (error) {
      console.error('Error restocking ingredient:', error);
      return { success: false, error: error.message };
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
}

module.exports = InventoryManager;