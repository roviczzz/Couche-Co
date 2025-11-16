const { ObjectId } = require('mongodb');
const dbConnection = require('./db');



class InventoryManager {
  
  static async deductIngredients(orderItems) {
        const deductionLog = [];

    try {
      const db = dbConnection.getDb();

      const menuCollection = db.collection('Menu');
      const ingredientsCollection = db.collection('Ingredients');
      const addonsCollection = db.collection('Add-ons');

      console.log(`[INVENTORY DEBUG] Starting deduction for ${orderItems.length} order items`);

      for (const item of orderItems) {
        if (item.isFree) {
          console.log(`[INVENTORY DEBUG] Skipping free item: ${item.ProductName}`);
          continue;
        }

        console.log(`[INVENTORY DEBUG] Processing order item:`, JSON.stringify(item, null, 2));

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

        console.log(`[INVENTORY DEBUG] Found menu item:`, JSON.stringify(menuItem, null, 2));

        // Handle pastries (they use Quantity field instead of ingredients)
        if (menuItem.Category === 'Pastries' || menuItem.Quantity !== undefined) {
          await this.processPastryItem(menuItem, item, menuCollection, deductionLog);
        } else {
          // Process ingredients for drinks/food items
          await this.processMenuItemIngredients(
            menuItem,
            item,
            ingredientsCollection,
            deductionLog
          );
        }

        // Process add-ons for this item (for all items, including pastries)
        // First process user-selected add-ons from cart
        await this.processAddons(
          item.Addons || [],
          addonsCollection,
          ingredientsCollection,
          deductionLog
        );

        // Then process menu-defined add-ons (like boba for milktea)
        if (menuItem.AddOns && Array.isArray(menuItem.AddOns)) {
          await this.processMenuAddons(
            menuItem.AddOns,
            item,
            addonsCollection,
            deductionLog
          );
        }
      }

      console.log(`[INVENTORY SUCCESS] Completed deduction for ${orderItems.length} items. Total deductions: ${deductionLog.length}`);
      console.log('[INVENTORY DEBUG] Detailed deduction log:', JSON.stringify(deductionLog, null, 2));
      return { success: true, deductions: deductionLog };

    } catch (error) {
      console.error('[INVENTORY ERROR] Failed to deduct ingredients:', error);
      return { success: false, error: error.message };
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
  
  static async processPastryItem(menuItem, orderItem, menuCollection, deductionLog) {
    try {
      const quantityToDeduct = orderItem.Quantity || 1;
      const currentQuantity = menuItem.Quantity || 0;
      
      console.log(`[INVENTORY DEBUG] Processing pastry: ${menuItem.Name} (${menuItem.ProductID})`);
      console.log(`[INVENTORY DEBUG] Current quantity: ${currentQuantity}, Deducting: ${quantityToDeduct}`);
      
      if (currentQuantity < quantityToDeduct) {
        console.warn(`[INVENTORY DEBUG] Insufficient pastry quantity for ${menuItem.Name}: needed ${quantityToDeduct}, available ${currentQuantity}`);
        return;
      }
      
      const result = await menuCollection.updateOne(
        { ProductID: menuItem.ProductID },
        { 
          $inc: { Quantity: -quantityToDeduct },
          $set: { lastModified: new Date() }
        }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`[INVENTORY DEBUG] Successfully deducted ${quantityToDeduct} units of pastry: ${menuItem.Name}`);
        deductionLog.push({
          type: 'pastry',
          id: menuItem.ProductID,
          name: menuItem.Name,
          quantityDeducted: quantityToDeduct,
          orderItem: orderItem.ProductName,
          quantity: orderItem.Quantity
        });
      } else {
        console.warn(`[INVENTORY DEBUG] Failed to update pastry quantity for ${menuItem.ProductID}`);
      }
    } catch (error) {
      console.error(`[INVENTORY DEBUG] Error processing pastry ${menuItem.ProductID}:`, error);
    }
  }
  
  static async processAddons(addons, addonsCollection, ingredientsCollection, deductionLog) {
    if (!addons || !Array.isArray(addons)) return;

    for (const addon of addons) {
      try {
        const addonId = addon.AddOnID || addon.addOnID || addon.id;
        const addonName = addon.Name || addon.name || 'Unknown Add-on';

        if (!addonId) {
          console.warn('[INVENTORY DEBUG] Add-on missing ID:', addon);
          continue;
        }

        // First try to find in Add-ons collection
        let addonDoc = await addonsCollection.findOne({ AddOnID: addonId });
        let isIngredientAddon = false;

        // If not found in Add-ons, try Ingredients collection (for ingredient add-ons)
        if (!addonDoc) {
          addonDoc = await ingredientsCollection.findOne({ IngredientID: addonId });
          isIngredientAddon = true;
        }

        if (!addonDoc) {
          console.warn(`[INVENTORY DEBUG] Add-on ${addonId} not found in either Add-ons or Ingredients collection`);
          continue;
        }

        // Get deduction amount - different field names for add-ons vs ingredients
        const deductionAmount = isIngredientAddon 
          ? (addonDoc.DeductionQuantityGrams || 20) // Default 20g for ingredients
          : (addonDoc.DeductionQuantityGrams || 1); // Default 1g for add-ons

        console.log(`[INVENTORY DEBUG] Deducting ${deductionAmount}g of ${isIngredientAddon ? 'ingredient add-on' : 'add-on'}: ${addonName} (${addonId})`);

        // Update the appropriate collection
        const collection = isIngredientAddon ? ingredientsCollection : addonsCollection;
        const idField = isIngredientAddon ? 'IngredientID' : 'AddOnID';
        
        const result = await collection.updateOne(
          { [idField]: addonId },
          {
            $inc: { Amount: -deductionAmount },
            $set: { lastModified: new Date() }
          }
        );

        if (result.modifiedCount > 0) {
          console.log(`[INVENTORY DEBUG] Successfully deducted ${deductionAmount}g of ${addonName}`);
          deductionLog.push({
            type: isIngredientAddon ? 'ingredient-addon' : 'addon',
            id: addonId,
            name: addonName,
            amountDeducted: deductionAmount,
            deductionQuantityGrams: deductionAmount
          });
        } else {
          console.warn(`[INVENTORY DEBUG] Failed to update ${isIngredientAddon ? 'ingredient' : 'add-on'} ${addonId} - item not found or insufficient amount`);
        }
      } catch (error) {
        console.error('[INVENTORY DEBUG] Error processing add-on:', addon, error);
      }
    }
  }

  static async processMenuAddons(menuAddons, orderItem, addonsCollection, deductionLog) {
    if (!menuAddons || !Array.isArray(menuAddons)) return;

    for (const menuAddon of menuAddons) {
      try {
        const addonId = menuAddon.addOnID;
        const addonName = menuAddon.name || 'Unknown Add-on';
        const orderSize = orderItem.Size || '16oz'; // Default to 16oz if no size specified

        if (!addonId) {
          console.warn('[INVENTORY DEBUG] Menu add-on missing ID:', menuAddon);
          continue;
        }

        // Calculate usage based on size
        let usageAmount = 0;
        if (orderSize === '22oz' && menuAddon.usedGrams22oz !== undefined) {
          usageAmount = menuAddon.usedGrams22oz;
        } else if (orderSize === '16oz' && menuAddon.usedGrams16oz !== undefined) {
          usageAmount = menuAddon.usedGrams16oz;
        } else {
          // Fallback to 16oz amount or default
          usageAmount = menuAddon.usedGrams16oz || 0;
        }

        // Skip if no usage amount (like 0g for certain sizes)
        if (usageAmount <= 0) {
          console.log(`[INVENTORY DEBUG] Skipping menu add-on ${addonName} for ${orderSize} - no usage amount`);
          continue;
        }

        // Multiply by order quantity
        const totalUsage = usageAmount * (orderItem.Quantity || 1);

        console.log(`[INVENTORY DEBUG] Deducting ${totalUsage}g of menu add-on: ${addonName} (${addonId}) for ${orderSize} × ${orderItem.Quantity}`);

        // Get the add-on document and update
        const result = await addonsCollection.updateOne(
          { AddOnID: addonId },
          {
            $inc: { Amount: -totalUsage },
            $set: { lastModified: new Date() }
          }
        );

        if (result.modifiedCount > 0) {
          console.log(`[INVENTORY DEBUG] Successfully deducted ${totalUsage}g of menu add-on ${addonName}`);
          deductionLog.push({
            type: 'menu-addon',
            id: addonId,
            name: addonName,
            amountDeducted: totalUsage,
            size: orderSize,
            quantity: orderItem.Quantity
          });
        } else {
          console.warn(`[INVENTORY DEBUG] Failed to update menu add-on ${addonId} - add-on not found or insufficient amount`);
        }
      } catch (error) {
        console.error('[INVENTORY DEBUG] Error processing menu add-on:', menuAddon, error);
      }
    }
  }
  
  static async checkIngredientAvailability(orderItems) {
        try {
      const db = dbConnection.getDb();
      
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
    }
  }
  
  static async checkProductAvailability(productId) {
        try {
      const db = dbConnection.getDb();

      const menuCollection = db.collection('Menu');
      const ingredientsCollection = db.collection('Ingredients');

      // Find the menu item
      const query = { ProductID: productId };

      // If productId looks like a valid ObjectId (24 hex chars), also search by _id
      if (/^[0-9a-fA-F]{24}$/.test(productId)) {
        query.$or = [
          { ProductID: productId },
          { _id: new ObjectId(productId) }
        ];
      }

      const menuItem = await menuCollection.findOne(query);

      if (!menuItem) {
        return {
          available: false,
          reason: 'Product not found'
        };
      }

      // Check if menu item is enabled
      if (!menuItem.isEnabled) {
        return {
          available: false,
          reason: 'Product is currently disabled'
        };
      }

      // Handle pastries (check Quantity field)
      if (menuItem.Category === 'Pastries' || menuItem.Quantity !== undefined) {
        const currentQuantity = menuItem.Quantity || 0;

        if (currentQuantity < 1) {
          return {
            available: false,
            reason: 'This pastry is currently out of stock'
          };
        }

        return {
          available: true,
          reason: null
        };
      }

      // Check ingredients for non-pastry items (minimum serving)
      if (menuItem.Ingredients && Array.isArray(menuItem.Ingredients)) {
        for (const ingredient of menuItem.Ingredients) {
          const { ingredientID, usedGrams, name } = ingredient;
          let gramsNeeded = 0;

          // Handle size-based ingredient usage - use smallest size or default
          if (typeof usedGrams === 'object' && usedGrams !== null) {
            // Find the minimum grams needed across all sizes
            const sizes = Object.values(usedGrams);
            gramsNeeded = Math.min(...sizes.filter(g => g > 0));
          } else if (typeof usedGrams === 'number') {
            gramsNeeded = usedGrams;
          }

          if (gramsNeeded > 0) {
            const ingredientDoc = await ingredientsCollection.findOne({
              IngredientID: ingredientID
            });

            // Check if ingredient is enabled (if the field exists)
            if (ingredientDoc && ingredientDoc.isEnabled === false) {
              return {
                available: false,
                reason: 'Insufficient ingredients to prepare this item'
              };
            }

            if (!ingredientDoc || (ingredientDoc.Amount || 0) < gramsNeeded) {
              return {
                available: false,
                reason: 'Insufficient ingredients to prepare this item'
              };
            }
          }
        }
      }

      return {
        available: true,
        reason: null
      };

    } catch (error) {
      console.error('Error checking product availability:', error);
      return {
        available: false,
        reason: 'System error checking availability'
      };
    }
  }

  static async checkSingleItemAvailability(menuItem, orderItem, ingredientsCollection, addonsCollection) {
    const missingIngredients = [];

    try {
      // Handle pastries (check Quantity field)
      if (menuItem.Category === 'Pastries' || menuItem.Quantity !== undefined) {
        const quantityNeeded = orderItem.Quantity || 1;
        const currentQuantity = menuItem.Quantity || 0;

        if (currentQuantity < quantityNeeded) {
          missingIngredients.push({
            id: menuItem.ProductID,
            name: menuItem.Name,
            needed: quantityNeeded,
            available: currentQuantity,
            type: 'pastry'
          });
        }
        // Pastries can still have menu add-ons, so continue to check below
      }

      // Check ingredients for non-pastry items
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

          // First try to find in Add-ons collection
          let addonDoc = await addonsCollection.findOne({ AddOnID: addonId });
          let isIngredientAddon = false;

          // If not found in Add-ons, try Ingredients collection (for ingredient add-ons)
          if (!addonDoc) {
            addonDoc = await ingredientsCollection.findOne({ IngredientID: addonId });
            isIngredientAddon = true;
          }

          if (!addonDoc) {
            missingIngredients.push({
              id: addonId,
              name: addonName,
              type: isIngredientAddon ? 'ingredient-addon' : 'addon',
              needed: isIngredientAddon ? 20 : 1, // Default amounts
              available: 0
            });
            continue;
          }

          const neededAmount = isIngredientAddon 
            ? (addonDoc.DeductionQuantityGrams || 20) // Default 20g for ingredients
            : (addonDoc.DeductionQuantityGrams || 1); // Default 1g for add-ons
          const availableAmount = addonDoc.Amount || 0;

          if (availableAmount < neededAmount) {
            missingIngredients.push({
              id: addonId,
              name: addonName,
              type: isIngredientAddon ? 'ingredient-addon' : 'addon',
              needed: neededAmount,
              available: availableAmount
            });
          }
        }
      }

      // Check menu-defined add-ons (like boba for milktea)
      if (menuItem.AddOns && Array.isArray(menuItem.AddOns)) {
        for (const menuAddon of menuItem.AddOns) {
          const addonId = menuAddon.addOnID;
          const addonName = menuAddon.name || 'Unknown Add-on';
          const orderSize = orderItem.Size || '16oz';

          if (!addonId) continue;

          // Calculate usage based on size
          let usageAmount = 0;
          if (orderSize === '22oz' && menuAddon.usedGrams22oz !== undefined) {
            usageAmount = menuAddon.usedGrams22oz;
          } else if (orderSize === '16oz' && menuAddon.usedGrams16oz !== undefined) {
            usageAmount = menuAddon.usedGrams16oz;
          } else {
            usageAmount = menuAddon.usedGrams16oz || 0;
          }

          // Skip if no usage amount
          if (usageAmount <= 0) continue;

          const totalNeeded = usageAmount * (orderItem.Quantity || 1);

          const addonDoc = await addonsCollection.findOne({ AddOnID: addonId });

          if (!addonDoc || (addonDoc.Amount || 0) < totalNeeded) {
            missingIngredients.push({
              id: addonId,
              name: addonName,
              type: 'menu-addon',
              needed: totalNeeded,
              available: addonDoc ? (addonDoc.Amount || 0) : 0
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
  
  static async rollbackIngredients(orderItems) {
        const rollbackLog = [];

    try {
      const db = dbConnection.getDb();

      const menuCollection = db.collection('Menu');
      const ingredientsCollection = db.collection('Ingredients');
      const addonsCollection = db.collection('Add-ons');

      console.log(`[INVENTORY ROLLBACK] Starting rollback for ${orderItems.length} order items`);

      for (const item of orderItems) {
        console.log(`[INVENTORY ROLLBACK] Processing order item:`, JSON.stringify(item, null, 2));

        // Find menu item by ProductID or Name
        const menuItem = await menuCollection.findOne({
          $or: [
            { ProductID: item.ProductID },
            { Name: item.ProductName }
          ]
        });

        if (!menuItem) {
          console.warn(`[INVENTORY ROLLBACK] Menu item not found in database: ${item.ProductName} (ProductID: ${item.ProductID})`);
          continue;
        }

        console.log(`[INVENTORY ROLLBACK] Found menu item:`, JSON.stringify(menuItem, null, 2));

        // Handle pastries (they use Quantity field instead of ingredients)
        if (menuItem.Category === 'Pastries' || menuItem.Quantity !== undefined) {
          await this.rollbackPastryItem(menuItem, item, menuCollection, rollbackLog);
        } else {
          // Rollback ingredients for drinks/food items
          await this.rollbackMenuItemIngredients(
            menuItem,
            item,
            ingredientsCollection,
            rollbackLog
          );
        }

        // Rollback add-ons for this item (for all items, including pastries)
        // First rollback user-selected add-ons from cart
        await this.rollbackAddons(
          item.Addons || [],
          addonsCollection,
          ingredientsCollection,
          rollbackLog
        );

        // Then rollback menu-defined add-ons (like boba for milktea)
        if (menuItem.AddOns && Array.isArray(menuItem.AddOns)) {
          await this.rollbackMenuAddons(
            menuItem.AddOns,
            item,
            addonsCollection,
            rollbackLog
          );
        }
      }

      console.log(`[INVENTORY ROLLBACK] Completed rollback for ${orderItems.length} items. Total rollbacks: ${rollbackLog.length}`);
      console.log('[INVENTORY ROLLBACK] Detailed rollback log:', JSON.stringify(rollbackLog, null, 2));
      return { success: true, rollbacks: rollbackLog };

    } catch (error) {
      console.error('[INVENTORY ROLLBACK] Failed to rollback ingredients:', error);
      return { success: false, error: error.message };
    }
  }

  static async rollbackMenuItemIngredients(menuItem, orderItem, ingredientsCollection, rollbackLog) {
    if (!menuItem.Ingredients || !Array.isArray(menuItem.Ingredients)) return;

    for (const ingredient of menuItem.Ingredients) {
      const { ingredientID, usedGrams, name } = ingredient;
      let gramsToRollback = 0;

      try {
        // Handle size-based ingredient usage
        if (typeof usedGrams === 'object' && usedGrams !== null && orderItem.Size) {
          gramsToRollback = usedGrams[orderItem.Size] || usedGrams['16oz'] || 0;
        } else if (typeof usedGrams === 'number') {
          gramsToRollback = usedGrams;
        } else {
          console.warn(`[INVENTORY ROLLBACK] Invalid usedGrams format for ingredient ${ingredientID}:`, usedGrams);
          continue;
        }

        if (gramsToRollback > 0) {
          const totalGrams = gramsToRollback * (orderItem.Quantity || 1);

          console.log(`[INVENTORY ROLLBACK] Adding back ${totalGrams}g of ${name || ingredientID} (${gramsToRollback}g × ${orderItem.Quantity})`);

          const result = await ingredientsCollection.updateOne(
            { IngredientID: ingredientID },
            {
              $inc: { Amount: totalGrams },
              $set: { lastModified: new Date() }
            }
          );

          if (result.modifiedCount > 0) {
            console.log(`[INVENTORY ROLLBACK] Successfully added back ${totalGrams}g of ${name || ingredientID}`);
            rollbackLog.push({
              type: 'ingredient',
              id: ingredientID,
              name: name || 'Unknown Ingredient',
              gramsRolledBack: totalGrams,
              gramsPerUnit: gramsToRollback,
              orderItem: orderItem.ProductName,
              size: orderItem.Size,
              quantity: orderItem.Quantity
            });
          } else {
            console.warn(`[INVENTORY ROLLBACK] Failed to update ingredient ${ingredientID} - ingredient not found`);
          }
        }
      } catch (error) {
        console.error(`[INVENTORY ROLLBACK] Error processing ingredient ${ingredientID}:`, error);
      }
    }
  }

  static async rollbackPastryItem(menuItem, orderItem, menuCollection, rollbackLog) {
    try {
      const quantityToRollback = orderItem.Quantity || 1;
      const currentQuantity = menuItem.Quantity || 0;

      console.log(`[INVENTORY ROLLBACK] Processing pastry: ${menuItem.Name} (${menuItem.ProductID})`);
      console.log(`[INVENTORY ROLLBACK] Current quantity: ${currentQuantity}, Adding back: ${quantityToRollback}`);

      const result = await menuCollection.updateOne(
        { ProductID: menuItem.ProductID },
        {
          $inc: { Quantity: quantityToRollback },
          $set: { lastModified: new Date() }
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`[INVENTORY ROLLBACK] Successfully added back ${quantityToRollback} units of pastry: ${menuItem.Name}`);
        rollbackLog.push({
          type: 'pastry',
          id: menuItem.ProductID,
          name: menuItem.Name,
          quantityRolledBack: quantityToRollback,
          orderItem: orderItem.ProductName,
          quantity: orderItem.Quantity
        });
      } else {
        console.warn(`[INVENTORY ROLLBACK] Failed to update pastry quantity for ${menuItem.ProductID}`);
      }
    } catch (error) {
      console.error(`[INVENTORY ROLLBACK] Error processing pastry ${menuItem.ProductID}:`, error);
    }
  }

  static async rollbackAddons(addons, addonsCollection, ingredientsCollection, rollbackLog) {
    if (!addons || !Array.isArray(addons)) return;

    for (const addon of addons) {
      try {
        const addonId = addon.AddOnID || addon.addOnID || addon.id;
        const addonName = addon.Name || addon.name || 'Unknown Add-on';

        if (!addonId) {
          console.warn('[INVENTORY ROLLBACK] Add-on missing ID:', addon);
          continue;
        }

        // First try to find in Add-ons collection
        let addonDoc = await addonsCollection.findOne({ AddOnID: addonId });
        let isIngredientAddon = false;

        // If not found in Add-ons, try Ingredients collection (for ingredient add-ons)
        if (!addonDoc) {
          addonDoc = await ingredientsCollection.findOne({ IngredientID: addonId });
          isIngredientAddon = true;
        }

        if (!addonDoc) {
          console.warn(`[INVENTORY ROLLBACK] Add-on ${addonId} not found in either Add-ons or Ingredients collection`);
          continue;
        }

        // Get rollback amount - different field names for add-ons vs ingredients
        const rollbackAmount = isIngredientAddon 
          ? (addonDoc.DeductionQuantityGrams || 20) // Default 20g for ingredients
          : (addonDoc.DeductionQuantityGrams || 1); // Default 1g for add-ons

        console.log(`[INVENTORY ROLLBACK] Adding back ${rollbackAmount}g of ${isIngredientAddon ? 'ingredient add-on' : 'add-on'}: ${addonName} (${addonId})`);

        // Update the appropriate collection
        const collection = isIngredientAddon ? ingredientsCollection : addonsCollection;
        const idField = isIngredientAddon ? 'IngredientID' : 'AddOnID';

        const result = await collection.updateOne(
          { [idField]: addonId },
          {
            $inc: { Amount: rollbackAmount },
            $set: { lastModified: new Date() }
          }
        );

        if (result.modifiedCount > 0) {
          console.log(`[INVENTORY ROLLBACK] Successfully added back ${rollbackAmount}g of ${addonName}`);
          rollbackLog.push({
            type: isIngredientAddon ? 'ingredient-addon' : 'addon',
            id: addonId,
            name: addonName,
            amountRolledBack: rollbackAmount,
            deductionQuantityGrams: rollbackAmount
          });
        } else {
          console.warn(`[INVENTORY ROLLBACK] Failed to update ${isIngredientAddon ? 'ingredient' : 'add-on'} ${addonId} - item not found`);
        }
      } catch (error) {
        console.error('[INVENTORY ROLLBACK] Error processing add-on:', addon, error);
      }
    }
  }

  static async rollbackMenuAddons(menuAddons, orderItem, addonsCollection, rollbackLog) {
    if (!menuAddons || !Array.isArray(menuAddons)) return;

    for (const menuAddon of menuAddons) {
      try {
        const addonId = menuAddon.addOnID;
        const addonName = menuAddon.name || 'Unknown Add-on';
        const orderSize = orderItem.Size || '16oz'; // Default to 16oz if no size specified

        if (!addonId) {
          console.warn('[INVENTORY ROLLBACK] Menu add-on missing ID:', menuAddon);
          continue;
        }

        // Calculate usage based on size (same logic as deduction)
        let usageAmount = 0;
        if (orderSize === '22oz' && menuAddon.usedGrams22oz !== undefined) {
          usageAmount = menuAddon.usedGrams22oz;
        } else if (orderSize === '16oz' && menuAddon.usedGrams16oz !== undefined) {
          usageAmount = menuAddon.usedGrams16oz;
        } else {
          // Fallback to 16oz amount or default
          usageAmount = menuAddon.usedGrams16oz || 0;
        }

        // Skip if no usage amount (like 0g for certain sizes)
        if (usageAmount <= 0) {
          console.log(`[INVENTORY ROLLBACK] Skipping menu add-on ${addonName} for ${orderSize} - no usage amount`);
          continue;
        }

        // Multiply by order quantity
        const totalUsage = usageAmount * (orderItem.Quantity || 1);

        console.log(`[INVENTORY ROLLBACK] Adding back ${totalUsage}g of menu add-on: ${addonName} (${addonId}) for ${orderSize} × ${orderItem.Quantity}`);

        // Add back to the add-on collection
        const result = await addonsCollection.updateOne(
          { AddOnID: addonId },
          {
            $inc: { Amount: totalUsage },
            $set: { lastModified: new Date() }
          }
        );

        if (result.modifiedCount > 0) {
          console.log(`[INVENTORY ROLLBACK] Successfully added back ${totalUsage}g of menu add-on ${addonName}`);
          rollbackLog.push({
            type: 'menu-addon',
            id: addonId,
            name: addonName,
            amountRolledBack: totalUsage,
            size: orderSize,
            quantity: orderItem.Quantity
          });
        } else {
          console.warn(`[INVENTORY ROLLBACK] Failed to update menu add-on ${addonId} - add-on not found`);
        }
      } catch (error) {
        console.error('[INVENTORY ROLLBACK] Error processing menu add-on:', menuAddon, error);
      }
    }
  }

  static async restockIngredient(ingredientId, amount) {
        try {
      const db = dbConnection.getDb();

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
    }
  }
}

module.exports = InventoryManager;
