const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const uri = process.env.MONGODB_URI;

async function getDashboardStats() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const totalOrders = await db.collection('Orders').countDocuments();
    const totalProducts = await db.collection('Menu').countDocuments();
    const totalIngredients = await db.collection('Ingredients').countDocuments();
    const totalAddons = await db.collection('Add-ons').countDocuments();

    await client.close();

    return { totalOrders, totalProducts, totalIngredients, totalAddons };
  } catch (err) {
    console.error('Error getting dashboard stats:', err);
    return { totalOrders: 0, totalProducts: 0, totalIngredients: 0, totalAddons: 0 };
  }
}

async function getDashboardAnalyticsStats() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const totalSalesResult = await ordersCollection.aggregate([
      {
        $match: {
          PaymentStatus: { $ne: "Cancelled" }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$Total" },
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].total : 0;
    const totalOrders = totalSalesResult.length > 0 ? totalSalesResult[0].count : 0;

    const weekSalesResult = await ordersCollection.aggregate([
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{ $type: "$Date" }, "string"] },
              then: { $dateFromString: { dateString: "$Date" } },
              else: "$Date"
            }
          }
        }
      },
      { $match: { orderDate: { $gte: weekAgo }, PaymentStatus: { $ne: "Cancelled" } } },
      { $group: { _id: null, total: { $sum: "$Total" } } }
    ]).toArray();

    const totalSalesWeek = weekSalesResult.length > 0 ? weekSalesResult[0].total : 0;

    const prevWeekAgo = new Date(weekAgo);
    prevWeekAgo.setDate(prevWeekAgo.getDate() - 7);

    const prevWeekSalesResult = await ordersCollection.aggregate([
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{ $type: "$Date" }, "string"] },
              then: { $dateFromString: { dateString: "$Date" } },
              else: "$Date"
            }
          }
        }
      },
      { $match: { orderDate: { $gte: prevWeekAgo, $lt: weekAgo }, PaymentStatus: { $ne: "Cancelled" } } },
      { $group: { _id: null, total: { $sum: "$Total" } } }
    ]).toArray();

    const prevWeekSales = prevWeekSalesResult.length > 0 ? prevWeekSalesResult[0].total : 0;
    const totalSalesPercent = prevWeekSales === 0 ? 100 : Math.round(((totalSalesWeek - prevWeekSales) / prevWeekSales) * 100);

    const incomingOrdersCount = await ordersCollection.countDocuments({
      FulfillmentStatus: { $nin: ["Completed", "Cancelled"] }
    });

    const yesterdayIncomingResult = await ordersCollection.aggregate([
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{ $type: "$Date" }, "string"] },
              then: { $dateFromString: { dateString: "$Date" } },
              else: "$Date"
            }
          }
        }
      },
      { $match: { FulfillmentStatus: { $nin: ["Completed", "Cancelled"] }, orderDate: { $gte: yesterday, $lt: today } } },
      { $count: "count" }
    ]).toArray();

    const yesterdayIncomingOrdersCount = yesterdayIncomingResult.length > 0 ? yesterdayIncomingResult[0].count : 0;
    const incomingOrdersPercent = yesterdayIncomingOrdersCount === 0 ? 0 : Math.round(((incomingOrdersCount - yesterdayIncomingOrdersCount) / yesterdayIncomingOrdersCount) * 100);

    const ordersTodayResult = await ordersCollection.aggregate([
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{ $type: "$Date" }, "string"] },
              then: { $dateFromString: { dateString: "$Date" } },
              else: "$Date"
            }
          }
        }
      },
      { $match: { orderDate: { $gte: today } } },
      { $count: "count" }
    ]).toArray();

    const ordersTodayCount = ordersTodayResult.length > 0 ? ordersTodayResult[0].count : 0;

    const yesterdayOrdersResult = await ordersCollection.aggregate([
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{ $type: "$Date" }, "string"] },
              then: { $dateFromString: { dateString: "$Date" } },
              else: "$Date"
            }
          }
        }
      },
      { $match: { orderDate: { $gte: yesterday, $lt: today } } },
      { $count: "count" }
    ]).toArray();

    const yesterdayOrdersCount = yesterdayOrdersResult.length > 0 ? yesterdayOrdersResult[0].count : 0;
    const ordersTodayPercent = yesterdayOrdersCount === 0 ? 0 : Math.round(((ordersTodayCount - yesterdayOrdersCount) / yesterdayOrdersCount) * 100);

    await client.close();

    return {
      totalSales,
      totalOrders,
      totalSalesWeek,
      totalSalesPercent,
      incomingOrders: incomingOrdersCount,
      incomingOrdersPercent,
      ordersToday: ordersTodayCount,
      ordersTodayPercent
    };
  } catch (err) {
    console.error('Error getting dashboard analytics stats:', err);
    return {
      totalSales: 0,
      totalOrders: 0,
      totalSalesWeek: 0,
      totalSalesPercent: 0,
      incomingOrders: 0,
      incomingOrdersPercent: 0,
      ordersToday: 0,
      ordersTodayPercent: 0
    };
  }
}

async function getAnalyticsData() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const recentOrders = await db.collection('Orders').find().limit(10).toArray();
    await client.close();
    return { recentOrders };
  } catch (err) {
    console.error('Error getting analytics data:', err);
    return { recentOrders: [] };
  }
}

async function getProducts() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const products = await db.collection('Menu').find().toArray();
    await client.close();
    return products;
  } catch (err) {
    console.error('Error getting products:', err);
    return [];
  }
}

async function getProductById(id) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const product = await db.collection('Menu').findOne({ _id: new ObjectId(id) });
    await client.close();
    return product;
  } catch (err) {
    console.error('Error getting product by id:', err);
    return null;
  }
}

async function getOrders() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const orders = await db.collection('Orders').find().toArray();
    await client.close();
    return orders;
  } catch (err) {
    console.error('Error getting orders:', err);
    return [];
  }
}

async function getOrderById(id) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const order = await db.collection('Orders').findOne({ _id: new ObjectId(id) });
    await client.close();
    return order;
  } catch (err) {
    console.error('Error getting order by id:', err);
    return null;
  }
}

async function updateOrderFulfillment(orderId, fulfillmentStatus) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    const filter = { OrderID: orderId };
    const updateDoc = { $set: { FulfillmentStatus: fulfillmentStatus } };

    // Get the current order before updating
    const currentOrder = await ordersCollection.findOne(filter);

    await ordersCollection.updateOne(filter, updateDoc);
    const updatedOrder = await ordersCollection.findOne(filter);

    // If status is being set to 'Cancelled', rollback inventory
    if (fulfillmentStatus === 'Cancelled' && currentOrder && currentOrder.Cart && Array.isArray(currentOrder.Cart) && currentOrder.Cart.length > 0) {
      try {
        const InventoryManager = require('./utils/inventoryManager');
        const rollbackResult = await InventoryManager.rollbackIngredients(currentOrder.Cart);
        if (rollbackResult.success) {
          console.log(`✅ Stock rollback completed for cancelled order ${orderId}:`, rollbackResult.rollbacks);
        } else {
          console.error('❌ Stock rollback failed:', rollbackResult.error);
        }
      } catch (rollbackError) {
        console.error('❌ Error during stock rollback:', rollbackError);
      }
    }

    await client.close();
    return updatedOrder;
  } catch (err) {
    console.error('Error updating order fulfillment:', err);
    return null;
  }
}

async function updateOrderPaymentStatus(orderId, paymentStatus) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    const filter = { OrderID: orderId };
    const updateDoc = { $set: { PaymentStatus: paymentStatus } };

    await ordersCollection.updateOne(filter, updateDoc);
    const updatedOrder = await ordersCollection.findOne(filter);

    await client.close();
    return updatedOrder;
  } catch (err) {
    console.error('Error updating payment status:', err);
    return null;
  }
}

async function cancelOrder(orderId) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    const filter = { OrderID: orderId };

    // First, get the order data before deleting it (needed for stock rollback)
    const order = await ordersCollection.findOne(filter);
    if (!order) {
      await client.close();
      console.warn(`Order ${orderId} not found for cancellation`);
      return false;
    }

    // Check if order was already cancelled to prevent double rollback
    if (order.PaymentStatus === 'Cancelled' || order.FulfillmentStatus === 'Cancelled') {
      console.warn(`Order ${orderId} already cancelled, skipping stock rollback`);
      const result = await ordersCollection.deleteOne(filter);
      await client.close();
      return result.deletedCount === 1;
    }

    // Rollback inventory stock before deleting the order
    if (order.Cart && Array.isArray(order.Cart) && order.Cart.length > 0) {
      try {
        const InventoryManager = require('./utils/inventoryManager');
        const rollbackResult = await InventoryManager.rollbackIngredients(order.Cart);
        if (rollbackResult.success) {
          console.log(`✅ Stock rollback completed for cancelled order ${orderId}:`, rollbackResult.rollbacks);
        } else {
          console.error('❌ Stock rollback failed:', rollbackResult.error);
          // Continue with order cancellation even if rollback fails
        }
      } catch (rollbackError) {
        console.error('❌ Error during stock rollback:', rollbackError);
        // Continue with order cancellation even if rollback fails
      }
    }

    // Now delete the order
    const result = await ordersCollection.deleteOne(filter);

    await client.close();
    return result.deletedCount === 1;
  } catch (err) {
    console.error('Error cancelling order:', err);
    return false;
  }
}

async function restoreOrder(orderId) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    const filter = { OrderID: orderId };

    // Get the current order before updating
    const currentOrder = await ordersCollection.findOne(filter);

    const updateDoc = {
      $set: {
        PaymentStatus: 'Pending',
        FulfillmentStatus: 'Preparing'
      }
    };

    await ordersCollection.updateOne(filter, updateDoc);
    const updatedOrder = await ordersCollection.findOne(filter);

    // If restoring from cancelled, deduct inventory again
    if (currentOrder && currentOrder.FulfillmentStatus === 'Cancelled' && updatedOrder && updatedOrder.Cart && Array.isArray(updatedOrder.Cart) && updatedOrder.Cart.length > 0) {
      try {
        const InventoryManager = require('./utils/inventoryManager');
        const deductResult = await InventoryManager.deductIngredients(updatedOrder.Cart);
        if (deductResult.success) {
          console.log(`✅ Stock deduction completed for restored order ${orderId}:`, deductResult.deductions);
        } else {
          console.error('❌ Stock deduction failed:', deductResult.error);
        }
      } catch (deductError) {
        console.error('❌ Error during stock deduction:', deductError);
      }
    }

    await client.close();
    return updatedOrder;
  } catch (err) {
    console.error('Error restoring order:', err);
    return null;
  }
}

async function getStockData() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ingredients = await db.collection('Ingredients').find().toArray();
    const addons = await db.collection('Add-ons').find().toArray();
    await client.close();
    return { ingredients, addons };
  } catch (err) {
    console.error('Error getting stock data:', err);
    return { ingredients: [], addons: [] };
  }
}

async function addIngredient(ingredientData) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Check for existing ingredient with same ID and Name combination
    if (ingredientData.IngredientID && ingredientData.Name) {
      const existingIngredient = await db.collection('Ingredients').findOne({
        IngredientID: ingredientData.IngredientID,
        Name: ingredientData.Name.trim()
      });

      if (existingIngredient) {
        await client.close();
        throw new Error('DUPLICATE_ID_NAME');
      }
    }

    const result = await db.collection('Ingredients').insertOne({
      ...ingredientData,
      createdAt: new Date(),
      lastModified: new Date()
    });

    await client.close();
    return result;
  } catch (err) {
    console.error('Error adding ingredient:', err);
    throw err;
  }
}

async function updateIngredient(id, ingredientData) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Determine collection and ID field based on data type
    let collection, idField;
    if (ingredientData.IngredientID) {
      collection = 'Ingredients';
      idField = 'IngredientID';
    } else if (ingredientData.AddOnID) {
      collection = 'Add-ons';
      idField = 'AddOnID';
    } else {
      await client.close();
      throw new Error('Invalid data: missing IngredientID or AddOnID');
    }

    // Check for existing item with same ID (except current one)
    const existingItem = await db.collection(collection).findOne({
      [idField]: ingredientData[idField],
      _id: { $ne: new ObjectId(id) }
    });

    if (existingItem) {
      await client.close();
      throw new Error(`Another ${collection.toLowerCase().replace(/s$/, '')} with this ID already exists`);
    }

    // Create a clean update object with proper type conversion
    const updateData = {
      ...ingredientData,
      lastModified: new Date()
    };

    // Ensure isEnabled is a boolean
    if (updateData.isEnabled !== undefined) {
      updateData.isEnabled = updateData.isEnabled === 'true' || updateData.isEnabled === true;
    }

    // Ensure Amount is converted to integer if present
    if (updateData.Amount !== undefined) {
      const amountValue = parseInt(updateData.Amount, 10);
      if (!isNaN(amountValue)) {
        updateData.Amount = amountValue;
      } else {
        // Remove invalid Amount values
        delete updateData.Amount;
      }
    }

    // Ensure DeductionQuantityGrams is converted to integer if present
    if (updateData.DeductionQuantityGrams !== undefined) {
      const dqValue = parseInt(updateData.DeductionQuantityGrams, 10);
      if (!isNaN(dqValue)) {
        updateData.DeductionQuantityGrams = dqValue;
      } else {
        // Remove invalid DeductionQuantityGrams values
        delete updateData.DeductionQuantityGrams;
      }
    }

    const result = await db.collection(collection).updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    await client.close();
    return result;
  } catch (err) {
    console.error('Error updating item:', err);
    throw err;
  }
}

async function deleteIngredient(id) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // First, check if the item is an ingredient or add-on
    let item = await db.collection('Ingredients').findOne({ _id: new ObjectId(id) });
    let collection = 'Ingredients';

    if (!item) {
      item = await db.collection('Add-ons').findOne({ _id: new ObjectId(id) });
      collection = 'Add-ons';
    }

    if (!item) {
      await client.close();
      throw new Error('Item not found');
    }

    const result = await db.collection(collection).deleteOne({ _id: new ObjectId(id) });

    await client.close();
    return result;
  } catch (err) {
    console.error('Error deleting item:', err);
    throw err;
  }
}

async function bulkUpdateIngredients(updates) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const bulkOps = updates.map(update => {
      const updateData = { ...update.data, lastModified: new Date() };

      // Ensure Amount is converted to integer if present
      if (updateData.Amount !== undefined) {
        const amountValue = parseInt(updateData.Amount, 10);
        if (!isNaN(amountValue)) {
          updateData.Amount = amountValue;
        } else {
          // Remove invalid Amount values
          delete updateData.Amount;
        }
      }

      // Ensure DeductionQuantityGrams is converted to integer if present
      if (updateData.DeductionQuantityGrams !== undefined) {
        const dqValue = parseInt(updateData.DeductionQuantityGrams, 10);
        if (!isNaN(dqValue)) {
          updateData.DeductionQuantityGrams = dqValue;
        } else {
          // Remove invalid DeductionQuantityGrams values
          delete updateData.DeductionQuantityGrams;
        }
      }

      return {
        updateOne: {
          filter: { _id: new ObjectId(update.id) },
          update: {
            $set: updateData
          }
        }
      }
    });

    const result = await db.collection('Ingredients').bulkWrite(bulkOps);

    await client.close();
    return result.modifiedCount;
  } catch (err) {
    console.error('Error performing bulk update:', err);
    throw err;
  }
}

async function exportIngredientsAndAddons() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const ingredients = await db.collection('Ingredients').find().toArray();
    const addons = await db.collection('Add-ons').find().toArray();

    await client.close();

    return {
      ingredients,
      addons,
      exportedAt: new Date(),
      stats: {
        totalIngredients: ingredients.length,
        totalAddons: addons.length,
        enabledIngredients: ingredients.filter(i => i.isEnabled).length,
        enabledAddons: addons.filter(a => a.isEnabled).length
      }
    };
  } catch (err) {
    console.error('Error exporting inventory data:', err);
    throw err;
  }
}

async function searchIngredientsAddons(query, category, enabled) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const searchRegex = new RegExp(query || '', 'i');
    let searchFilter = {
      $or: [
        { Name: searchRegex },
        { Category: searchRegex },
        { Allergen: searchRegex },
        { IngredientID: searchRegex },
        { AddOnID: searchRegex }
      ]
    };

    if (category) {
      searchFilter.Category = new RegExp(category, 'i');
    }

    if (enabled !== undefined) {
      searchFilter.isEnabled = enabled === 'true';
    }

    const ingredients = await db.collection('Ingredients').find(searchFilter).toArray();
    const addons = await db.collection('Add-ons').find(searchFilter).toArray();

    await client.close();

    return {
      ingredients,
      addons,
      resultCount: ingredients.length + addons.length
    };
  } catch (err) {
    console.error('Error searching inventory:', err);
    throw err;
  }
}

async function getIngredientStats() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const ingredientStats = await db.collection('Ingredients').aggregate([
      {
        $group: {
          _id: null,
          totalIngredients: { $sum: 1 },
          enabledIngredients: { $sum: { $cond: ['$isEnabled', 1, 0] } },
          availableIngredients: { $sum: { $cond: ['$isAvailable', 1, 0] } },
          totalQuantity: { $sum: '$Quantity' },
          averageQuantity: { $avg: '$Quantity' },
          categories: { $addToSet: '$Category' },
          lowStockItems: { $sum: { $cond: [{ $lte: ['$Quantity', 10] }, 1, 0] } }
        }
      }
    ]).toArray();

    const addonStats = await db.collection('Add-ons').aggregate([
      {
        $group: {
          _id: null,
          totalAddons: { $sum: 1 },
          enabledAddons: { $sum: { $cond: ['$isEnabled', 1, 0] } },
          totalQuantity: { $sum: '$Quantity' },
          averageQuantity: { $avg: '$Quantity' },
          categories: { $addToSet: '$Category' },
          lowStockItems: { $sum: { $cond: [{ $lte: ['$Quantity', 10] }, 1, 0] } }
        }
      }
    ]).toArray();

    await client.close();

    return {
      ingredients: ingredientStats[0] || {
        totalIngredients: 0,
        enabledIngredients: 0,
        availableIngredients: 0,
        totalQuantity: 0,
        averageQuantity: 0,
        categories: [],
        lowStockItems: 0
      },
      addons: addonStats[0] || {
        totalAddons: 0,
        enabledAddons: 0,
        totalQuantity: 0,
        averageQuantity: 0,
        categories: [],
        lowStockItems: 0
      }
    };
  } catch (err) {
    console.error('Error generating inventory statistics:', err);
    throw err;
  }
}

async function getLowStockAlerts(threshold = 10, urgentThreshold = 5) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const lowStockIngredients = await db.collection('Ingredients').find({
      Amount: { $lte: threshold },
      isEnabled: true
    }).toArray();

    const lowStockAddons = await db.collection('Add-ons').find({
      Amount: { $lte: threshold },
      isEnabled: true
    }).toArray();

    const urgentIngredients = lowStockIngredients.filter(item => item.Quantity <= urgentThreshold);
    const urgentAddons = lowStockAddons.filter(item => item.Quantity <= urgentThreshold);

    await client.close();

    return {
      lowStockIngredients,
      lowStockAddons,
      urgentIngredients,
      urgentAddons,
      thresholds: {
        lowStock: threshold,
        urgent: urgentThreshold
      },
      counts: {
        totalAlerts: lowStockIngredients.length + lowStockAddons.length,
        urgentAlerts: urgentIngredients.length + urgentAddons.length,
        lowStockIngredients: lowStockIngredients.length,
        lowStockAddons: lowStockAddons.length
      }
    };
  } catch (err) {
    console.error('Error generating low stock alerts:', err);
    throw err;
  }
}

async function getIngredientCategories() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const ingredientCategories = await db.collection('Ingredients').aggregate([
      { $group: { _id: '$Category', count: { $sum: 1 }, enabled: { $sum: { $cond: ['$isEnabled', 1, 0] } } } },
      { $sort: { _id: 1 } }
    ]).toArray();

    const addonCategories = await db.collection('Add-ons').aggregate([
      { $group: { _id: '$Category', count: { $sum: 1 }, enabled: { $sum: { $cond: ['$isEnabled', 1, 0] } } } },
      { $sort: { _id: 1 } }
    ]).toArray();

    await client.close();

    return {
      ingredients: ingredientCategories.filter(cat => cat._id && cat._id.trim()),
      addons: addonCategories.filter(cat => cat._id && cat._id.trim()),
      all: [...ingredientCategories, ...addonCategories].filter(cat => cat._id && cat._id.trim())
    };
  } catch (err) {
    console.error('Error retrieving categories:', err);
    throw err;
  }
}

async function getStockHealth() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const ingredientCount = await db.collection('Ingredients').countDocuments();
    const addonCount = await db.collection('Add-ons').countDocuments();
    const enabledIngredients = await db.collection('Ingredients').countDocuments({ isEnabled: true });
    const enabledAddons = await db.collection('Add-ons').countDocuments({ isEnabled: true });

    await client.close();

    return {
      status: 'healthy',
      inventory: {
        ingredients: ingredientCount,
        addons: addonCount,
        enabledIngredients: enabledIngredients,
        enabledAddons: enabledAddons,
        totalItems: ingredientCount + addonCount
      }
    };
  } catch (err) {
    console.error('Error checking stock health:', err);
    return {
      status: 'unhealthy',
      error: err.message
    };
  }
}

async function getDiscounts() {
  let client;
  try {
    client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Check if Promos collection exists, if not, create it
    const collections = await db.listCollections({ name: 'Promos' }).toArray();
    if (collections.length === 0) {
      console.log('Creating Promos collection as it does not exist');
      await db.createCollection('Promos');
      return [];
    }

    const discounts = await db.collection('Promos').find().toArray();
    return discounts || [];
  } catch (err) {
    console.error('Error getting discounts:', err);
    return [];
  } finally {
    if (client) {
      await client.close().catch(console.error);
    }
  }
}

async function getDiscountById(id) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const discount = await db.collection('Promos').findOne({ _id: new ObjectId(id) });

    await client.close();
    return discount;
  } catch (err) {
    console.error('Error getting discount by id:', err);
    return null;
  }
}

async function addDiscount(discountData) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Parse dates if they're strings
    if (discountData.startDate && typeof discountData.startDate === 'string') {
      discountData.startDate = new Date(discountData.startDate);
    }

    if (discountData.endDate && typeof discountData.endDate === 'string') {
      discountData.endDate = new Date(discountData.endDate);
    }

    // Add metadata
    const newDiscount = {
      ...discountData,
      createdAt: new Date(),
      lastModified: new Date(),
      isActive: discountData.isActive !== false
    };

    const result = await db.collection('Promos').insertOne(newDiscount);

    await client.close();
    return result;
  } catch (err) {
    console.error('Error adding discount:', err);
    throw err;
  }
}

async function updateDiscount(id, discountData) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Parse dates if they're strings
    if (discountData.startDate && typeof discountData.startDate === 'string') {
      discountData.startDate = new Date(discountData.startDate);
    }

    if (discountData.endDate && typeof discountData.endDate === 'string') {
      discountData.endDate = new Date(discountData.endDate);
    }

    const result = await db.collection('Promos').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...discountData,
          lastModified: new Date()
        }
      }
    );

    await client.close();
    return result;
  } catch (err) {
    console.error('Error updating discount:', err);
    throw err;
  }
}

async function deleteDiscount(id) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const result = await db.collection('Promos').deleteOne({ _id: new ObjectId(id) });

    await client.close();
    return result;
  } catch (err) {
    console.error('Error deleting discount:', err);
    throw err;
  }
}

async function bulkUpdateDiscounts(updates) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: { _id: new ObjectId(update.id) },
        update: {
          $set: {
            ...update.data,
            lastModified: new Date()
          }
        }
      }
    }));

    const result = await db.collection('Promos').bulkWrite(bulkOps);

    await client.close();
    return result.modifiedCount;
  } catch (err) {
    console.error('Error performing bulk discount update:', err);
    throw err;
  }
}

async function getDiscountStats() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const now = new Date();

    const totalCount = await db.collection('Promos').countDocuments();

    const activeCount = await db.collection('Promos').countDocuments({
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true
    });

    const expiringSoonCount = await db.collection('Promos').countDocuments({
      startDate: { $lte: now },
      endDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
      isActive: true
    });

    const upcomingCount = await db.collection('Promos').countDocuments({
      startDate: { $gt: now },
      isActive: true
    });

    const expiredCount = await db.collection('Promos').countDocuments({
      endDate: { $lt: now }
    });

    const highDiscountCount = await db.collection('Promos').countDocuments({
      discountPercentage: { $gte: 20 },
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true
    });

    await client.close();

    return {
      total: totalCount,
      active: activeCount,
      expiringSoon: expiringSoonCount,
      upcoming: upcomingCount,
      expired: expiredCount,
      highDiscount: highDiscountCount
    };
  } catch (err) {
    console.error('Error getting discount stats:', err);
    throw err;
  }
}

async function getActiveDiscounts() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Check if Promos collection exists
    const collections = await db.listCollections({ name: 'Promos' }).toArray();
    if (collections.length === 0) {
      console.log('Promos collection does not exist, returning empty array');
      await client.close();
      return [];
    }

    const now = new Date();

    const activeDiscounts = await db.collection('Promos').find({
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true
    }).toArray();

    await client.close();
    return activeDiscounts;
  } catch (err) {
    console.error('Error getting active discounts:', err);
    return [];
  }
}

async function getMenu() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const menu = await db.collection('Menu').find().toArray();
    await client.close();
    return menu;
  } catch (err) {
    console.error('Error getting menu:', err);
    return [];
  }
}

async function getPopularProducts() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    // Aggregate product sales from Orders using Cart array
    const results = await db.collection('Orders').aggregate([
      { $unwind: "$Cart" },
      { $group: {
        _id: "$Cart.ProductName",
        totalQuantity: { $sum: "$Cart.Quantity" }
      }},
      { $sort: { totalQuantity: -1 } }
    ]).toArray();
    await client.close();
    return results;
  } catch (err) {
    console.error('Error in getPopularProducts:', err);
    return [];
  }
}

async function getAverageSalesPerDay() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const salesPerDay = await db.collection('Orders').aggregate([
      {
        $addFields: {
          parsedDate: {
            $cond: {
              if: { $eq: [{ $type: "$Date" }, "string"] },
              then: { $dateFromString: { dateString: "$Date" } },
              else: "$Date"
            }
          }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$parsedDate" } },
          avgSales: { $avg: "$Total" }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();

    await client.close();
    return salesPerDay;
  } catch (err) {
    console.error('Error getting average sales per day:', err);
    return [];
  }
}

async function getTopCategories() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const pipeline = [
      { $unwind: '$Cart' },
      {
        $match: {
          PaymentStatus: { $ne: 'Cancelled' }
        }
      },
      {
        $lookup: {
          from: 'Menu',
          let: { productId: '$Cart.ProductID' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$ProductID', '$$productId'] }
              }
            },
            {
              $project: { Category: 1, _id: 0 }
            }
          ],
          as: 'menuItem'
        }
      },
      {
        $unwind: {
          path: '$menuItem',
          preserveNullAndEmptyArrays: false
        }
      },
      {
        $match: {
          'menuItem.Category': { $exists: true, $ne: null, $ne: '' }
        }
      },
      {
        $group: {
          _id: '$menuItem.Category',
          total: { $sum: { $multiply: ['$Cart.BasePrice', '$Cart.Quantity'] } },
          quantity: { $sum: '$Cart.Quantity' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 8 }
    ];

    const categories = await db.collection('Orders').aggregate(pipeline).toArray();
    await client.close();

    return categories.map(cat => ({
      name: cat._id,
      value: cat.total,
      quantity: cat.quantity,
      orderCount: cat.orderCount
    }));
  } catch (err) {
    console.error('Error getting top categories:', err);
    return [];
  }
}

async function getPaymentTypes() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const pipeline = [
      {
        $match: {
          PaymentStatus: { $ne: 'Cancelled' },
          PaymentMode: { $exists: true, $ne: null }
        }
      },
      {
        $project: {
          PaymentMode: {
            $cond: {
              if: { $in: ['$PaymentMode', ['E-PAYMENT', 'E-Payment']] },
              then: 'E-Payment',
              else: '$PaymentMode'
            }
          },
          PaymentStatus: 1
        }
      },
      {
        $group: {
          _id: '$PaymentMode',
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { orderCount: -1 } }
    ];

    const paymentTypes = await db.collection('Orders').aggregate(pipeline).toArray();
    await client.close();

    return paymentTypes.map(pt => ({
      name: pt._id,
      orderCount: pt.orderCount
    }));
  } catch (err) {
    console.error('Error getting payment types:', err);
    return [];
  }
}

async function getOrdersBySource() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const pipeline = [
      {
        $match: {
          PaymentStatus: { $ne: 'Cancelled' },
          Source: { $exists: true, $ne: null, $ne: '' }
        }
      },
      {
        $group: {
          _id: '$Source',
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: '$Total' }
        }
      },
      { $sort: { orderCount: -1 } }
    ];

    const ordersBySource = await db.collection('Orders').aggregate(pipeline).toArray();
    await client.close();

    return ordersBySource.map(source => ({
      name: source._id,
      orderCount: source.orderCount,
      totalRevenue: source.totalRevenue
    }));
  } catch (err) {
    console.error('Error getting orders by source:', err);
    return [];
  }
}

async function getSalesPerformance(days = 14) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const pipeline = [
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{ $type: "$Date" }, "string"] },
              then: { $dateFromString: { dateString: "$Date" } },
              else: "$Date"
            }
          }
        }
      },
      {
        $match: {
          orderDate: { $gte: startDate, $lte: endDate },
          PaymentStatus: { $ne: "Cancelled" }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
          earnings: { $sum: "$Total" },
          costs: { $sum: { $multiply: ["$Total", 0.6] } },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];

    let results = await db.collection('Orders').aggregate(pipeline).toArray();

    // Fill in missing dates
    const dateMap = {};
    results.forEach(item => { dateMap[item._id] = item });

    const allDates = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      allDates.unshift(dateStr);
    }

    const formattedResults = allDates.map(dateStr => {
      if (dateMap[dateStr]) {
        return {
          date: dateStr,
          earnings: dateMap[dateStr].earnings || 0,
          costs: dateMap[dateStr].costs || 0,
          orders: dateMap[dateStr].orders || 0
        };
      } else {
        return {
          date: dateStr,
          earnings: 0,
          costs: 0,
          orders: 0
        };
      }
    });

    await client.close();
    return formattedResults;
  } catch (err) {
    console.error('Error getting sales performance:', err);
    return [];
  }
}

// ===== NOTIFICATION FUNCTIONS =====

async function createNotification(notificationData) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    
    const notification = {
      ...notificationData,
      createdAt: new Date(),
      isRead: false,
      type: notificationData.type || 'info', // 'order', 'message', 'stock', 'report', 'promo'
      priority: notificationData.priority || 'normal', // 'urgent', 'high', 'normal', 'low'
      targetRoles: notificationData.targetRoles || ['admin', 'staff'] // who can see this notification
    };
    
    const result = await db.collection('Notifications').insertOne(notification);
    await client.close();
    
    return result;
  } catch (err) {
    console.error('Error creating notification:', err);
    throw err;
  }
}

async function getNotifications(userRole, limit = 50) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    
    const notifications = await db.collection('Notifications').find({
      targetRoles: { $in: [userRole] }
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
    
    await client.close();
    return notifications;
  } catch (err) {
    console.error('Error getting notifications:', err);
    return [];
  }
}

async function getUnreadNotificationCount(userRole) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    
    const count = await db.collection('Notifications').countDocuments({
      targetRoles: { $in: [userRole] },
      isRead: false
    });
    
    await client.close();
    return count;
  } catch (err) {
    console.error('Error getting unread notification count:', err);
    return 0;
  }
}

async function markNotificationAsRead(notificationId) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    
    const result = await db.collection('Notifications').updateOne(
      { _id: new ObjectId(notificationId) },
      { $set: { isRead: true, readAt: new Date() } }
    );
    
    await client.close();
    return result;
  } catch (err) {
    console.error('Error marking notification as read:', err);
    throw err;
  }
}

async function markAllNotificationsAsRead(userRole) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    
    const result = await db.collection('Notifications').updateMany(
      { 
        targetRoles: { $in: [userRole] },
        isRead: false 
      },
      { $set: { isRead: true, readAt: new Date() } }
    );
    
    await client.close();
    return result;
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    throw err;
  }
}

async function deleteNotification(notificationId) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    
    const result = await db.collection('Notifications').deleteOne({
      _id: new ObjectId(notificationId)
    });
    
    await client.close();
    return result;
  } catch (err) {
    console.error('Error deleting notification:', err);
    throw err;
  }
}

// Generate specific types of notifications

async function createNewOrderNotification(orderData) {
  try {
    console.log('🔔 Creating new order notification for order:', orderData.OrderID);
    
    const notification = await createNotification({
      type: 'order',
      title: 'New Order Received',
      message: `Order #${orderData.OrderID} received from ${orderData.Customer?.fullname || 'Customer'}`,
      data: {
        orderId: orderData.OrderID,
        customerName: orderData.Customer?.fullname || 'Unknown',
        total: orderData.Total,
        items: orderData.Cart?.length || 0
      },
      actionUrl: '/admin/orders',
      priority: 'high',
      targetRoles: ['admin', 'staff']
    });
    
    console.log('✅ New order notification created:', notification._id);
    return notification;
  } catch (error) {
    console.error('❌ Error creating new order notification:', error);
    throw error;
  }
}

async function createMessageNotification(messageData, targetRole = 'admin') {
  return await createNotification({
    type: 'message',
    title: 'New Message Received',
    message: `New message from ${messageData.senderName || 'Unknown'}`,
    data: {
      messageId: messageData._id || messageData.id,
      senderName: messageData.senderName || 'Unknown',
      subject: messageData.subject
    },
    actionUrl: targetRole === 'admin' ? '/admin/messages' : '/staff/messages',
    priority: 'normal',
    targetRoles: [targetRole]
  });
}

async function createLowStockNotification(stockData, userSettings = {}) {
  const client = await MongoClient.connect(uri);
  const db = client.db('blessingscafe');
  
  try {
    // Get user settings from UserSettings collection if not provided
    let effectiveThreshold = userSettings.lowStockAlertRange || userSettings.lowStockThreshold;
    
    if (!effectiveThreshold) {
      // Get admin user settings from UserSettings collection
      const adminUser = await db.collection('users').findOne({ role: 'admin' });
      if (adminUser) {
        const adminSettings = await db.collection('UserSettings').findOne({ userId: adminUser._id });
        effectiveThreshold = adminSettings?.lowStockAlertRange || 10;
      } else {
        effectiveThreshold = 10; // Default fallback
      }
    }
    
    const urgentThreshold = Math.floor(effectiveThreshold / 2); // Half of normal threshold for urgent
    const items = [];
    
    // Check ingredients against threshold
    if (stockData.ingredients) {
      stockData.ingredients.forEach(item => {
        const amount = item.Amount || 0;
        if (amount <= effectiveThreshold && item.isEnabled !== false) {
          items.push({
            name: `${item.Name} (${amount}g remaining)`,
            amount: amount,
            type: 'ingredient',
            id: item.IngredientID
          });
        }
      });
    }
    
    // Check add-ons against threshold (both ingredients and add-ons use "Amount" field)
    if (stockData.addons) {
      console.log('🔍 Checking add-ons for low stock, threshold:', effectiveThreshold);
      stockData.addons.forEach(item => {
        const amount = item.Amount || 0; // Use "Amount" field same as ingredients
        console.log(`  - ${item.Name}: ${amount} (enabled: ${item.isEnabled !== false})`);
        
        if (amount <= effectiveThreshold && item.isEnabled !== false) {
          console.log(`    ⚠️ Low stock: ${item.Name} (${amount} <= ${effectiveThreshold})`);
          items.push({
            name: `${item.Name} (${amount} pieces remaining)`,
            amount: amount,
            type: 'addon',
            id: item.AddOnID
          });
        }
      });
    }
    
    if (items.length === 0) return null;
    
    // Determine priority based on severity
    const criticalItems = items.filter(item => {
      if (item.type === 'ingredient') {
        return item.amount <= urgentThreshold;
      } else {
        return item.amount <= 1;
      }
    });
    
    const priority = criticalItems.length > 0 ? 'urgent' : 'high';
    const itemsText = items.slice(0, 3).map(item => item.name).join(', ');
    const additionalText = items.length > 3 ? ` and ${items.length - 3} more` : '';
    
    // Check if we already sent a low stock notification in the last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const existingNotification = await db.collection('Notifications').findOne({
      type: 'stock',
      createdAt: { $gte: twoHoursAgo },
      isRead: false
    });
    
    if (existingNotification) {
      console.log('🔔 Low stock notification already exists within 2 hours, skipping duplicate');
      return null;
    }
    
    const notification = await createNotification({
      type: 'stock',
      title: `${priority === 'urgent' ? '🚨 Critical' : '⚠️'} Low Stock Alert`,
      message: `${items.length} item(s) running low: ${itemsText}${additionalText}`,
      data: {
        lowStockItems: items,
        threshold: effectiveThreshold,
        totalItems: items.length,
        criticalCount: criticalItems.length,
        ingredients: items.filter(i => i.type === 'ingredient').length,
        addons: items.filter(i => i.type === 'addon').length
      },
      actionUrl: '/admin/stocks',
      priority: priority,
      targetRoles: ['admin', 'staff']
    });
    
    console.log(`🔔 Created low stock notification: ${items.length} items below threshold (${effectiveThreshold})`);
    return notification;
    
  } catch (error) {
    console.error('Error creating low stock notification:', error);
    return null;
  } finally {
    await client.close();
  }
}

async function createMonthlyReportNotification() {
  const now = new Date();
  const month = now.toLocaleString('default', { month: 'long' });
  const year = now.getFullYear();
  
  return await createNotification({
    type: 'report',
    title: 'Monthly Report Available',
    message: `Analytics report for ${month} ${year} is now available for download`,
    data: {
      reportMonth: month,
      reportYear: year,
      generatedAt: now
    },
    actionUrl: '/admin/analytics',
    priority: 'normal',
    targetRoles: ['admin']
  });
}

async function createPromoExpiryNotification(promoData) {
  const daysUntilExpiry = Math.ceil((new Date(promoData.endDate) - new Date()) / (1000 * 60 * 60 * 24));
  
  return await createNotification({
    type: 'promo',
    title: 'Promotion Expiring Soon',
    message: `"${promoData.event}" expires in ${daysUntilExpiry} day(s)`,
    data: {
      promoId: promoData._id,
      promoName: promoData.event,
      expiryDate: promoData.endDate,
      daysLeft: daysUntilExpiry
    },
    actionUrl: '/admin/discounts',
    priority: daysUntilExpiry <= 1 ? 'urgent' : daysUntilExpiry <= 3 ? 'high' : 'normal',
    targetRoles: ['admin']
  });
}

// Check for notifications that need to be generated
async function generatePeriodicNotifications(userSettings = {}) {
  try {
    const notifications = [];
    const now = new Date();
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    
    console.log('🔔 Starting periodic notification generation...');
    
    // Get user settings for all admin users if not provided
    let allUserSettings = [];
    if (!userSettings.lowStockAlertRange) {
      const adminUsers = await db.collection('users').find({ role: 'admin' }).toArray();
      for (const user of adminUsers) {
        const settings = await db.collection('UserSettings').findOne({ userId: user._id });
        allUserSettings.push({
          userId: user._id,
          fullname: user.fullname,
          settings: settings || { lowStockAlertRange: 10 }
        });
      }
    } else {
      allUserSettings = [{ settings: userSettings }];
    }
    
    // Check for low stock using the most restrictive threshold
    const lowestThreshold = allUserSettings.reduce((min, userSet) => {
      const threshold = userSet.settings.lowStockAlertRange || 10;
      return Math.min(min, threshold);
    }, 10);
    
    console.log(`🔍 Checking low stock with threshold: ${lowestThreshold}`);
    const stockData = await getStockData();
    const lowStockNotif = await createLowStockNotification(stockData, { lowStockAlertRange: lowestThreshold });
    if (lowStockNotif) {
      notifications.push(lowStockNotif);
      console.log('✅ Low stock notification created');
    }
    
    // Check for monthly report availability (check if it's the 1st day of the month)
    if (now.getDate() === 1) {
      console.log('📅 Checking for monthly report notification (1st of month)...');
      
      // Check if we haven't already sent monthly report notification today
      const existingMonthlyNotif = await db.collection('Notifications').findOne({
        type: 'report',
        createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
      });
      
      if (!existingMonthlyNotif) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'];
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const lastMonthName = monthNames[lastMonth];
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        
        const monthlyNotif = await createMonthlyReportNotification({
          month: lastMonthName,
          year: year
        });
        notifications.push(monthlyNotif);
        console.log('✅ Monthly report notification created');
      } else {
        console.log('ℹ️ Monthly report notification already exists for today');
      }
    }
    
    // Check for expiring promos
    console.log('🎯 Checking for expiring promos...');
    const promos = await getActiveDiscounts();
    for (const promo of promos) {
      const daysUntilExpiry = Math.ceil((new Date(promo.endDate) - now) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry <= 7 && daysUntilExpiry >= 0) {
        // Check if we haven't already notified about this promo today
        const existingNotif = await db.collection('Notifications').findOne({
          type: 'promo',
          'data.promoId': promo._id.toString(),
          createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
        });
        
        if (!existingNotif) {
          const promoNotif = await createPromoExpiryNotification(promo);
          notifications.push(promoNotif);
          console.log(`✅ Promo expiry notification created for: ${promo.event}`);
        }
      }
    }
    
    await client.close();
    
    console.log(`🔔 Periodic notification generation complete: ${notifications.length} notifications created`);
    return notifications;
    
  } catch (err) {
    console.error('❌ Error generating periodic notifications:', err);
    return [];
  }
}

// Utility function to trigger notifications based on business events
async function triggerBusinessEventNotification(eventType, eventData = {}) {
  try {
    console.log(`🔔 Triggering ${eventType} notification...`);
    
    switch (eventType) {
      case 'low-stock-check':
        const stockData = await getStockData();
        const lowStockNotif = await createLowStockNotification(stockData, eventData.userSettings);
        return lowStockNotif;
        
      case 'new-order':
        return await createNewOrderNotification(eventData);
        
      case 'new-message':
        return await createMessageNotification(eventData.messageData, eventData.targetRole);
        
      case 'promo-expiry':
        return await createPromoExpiryNotification(eventData);
        
      case 'monthly-report':
        return await createMonthlyReportNotification(eventData);
        
      default:
        console.log(`ℹ️ Unknown event type: ${eventType}`);
        return null;
    }
  } catch (error) {
    console.error(`❌ Error triggering ${eventType} notification:`, error);
    return null;
  }
}

module.exports = {
  getDashboardStats,
  getDashboardAnalyticsStats,
  getAnalyticsData,
  getProducts,
  getProductById,
  getOrders,
  getOrderById,
  getStockData,
  getDiscounts,
  getMenu,
  getPopularProducts,
  addIngredient,
  updateIngredient,
  deleteIngredient,
  bulkUpdateIngredients,
  exportIngredientsAndAddons,
  searchIngredientsAddons,
  getIngredientStats,
  getLowStockAlerts,
  getIngredientCategories,
  getStockHealth,
  updateOrderFulfillment,
  updateOrderPaymentStatus,
  cancelOrder,
  restoreOrder,
  getAverageSalesPerDay,
  getSalesPerformance,
  getTopCategories,
  getPaymentTypes,
  getOrdersBySource,
  addDiscount,
  updateDiscount,
  deleteDiscount,
  bulkUpdateDiscounts,
  getDiscountStats,
  getActiveDiscounts,
  getDiscountById,
  // Notification functions
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  createNewOrderNotification,
  createMessageNotification,
  createLowStockNotification,
  createMonthlyReportNotification,
  createPromoExpiryNotification,
  generatePeriodicNotifications,
  triggerBusinessEventNotification
};
