const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

// Import multer for file uploads (messages)
const multer = require('multer');
const path = require('path');

// Import analytics helper functions
const {
  getDashboardStats,
  getDashboardAnalyticsStats,
  getTopCategories,
  getPaymentTypes,
  getOrdersBySource,
  getSalesPerformance,
  getActiveDiscounts,
  createNewOrderNotification,
  createMessageNotification
} = require('../admin-helpers');

// Authentication middleware for staff routes
function isStaffLoggedIn(req, res, next) {
  if (req.session.user && req.session.user.role === 'staff') {
    return next();
  }
  res.redirect('/admin/login');
}

// Authentication middleware for order completion (staff, admin, owner)
function isAuthorizedForOrderCompletion(req, res, next) {
  if (req.session.user && ['staff', 'admin', 'owner'].includes(req.session.user.role)) {
    return next();
  }
  res.redirect('/admin/login');
}

// POS Order Submission Route (for staff POS)
router.post('/orders/submit', isStaffLoggedIn, async (req, res) => {
  try {
    const orderData = req.body;

    // Basic validation
    if (!orderData.OrderID || !orderData.Cart || !Array.isArray(orderData.Cart) || orderData.Cart.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order data: missing OrderID or empty cart'
      });
    }

    if (!orderData.Customer || !orderData.Customer.fullname) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order data: missing customer name'
      });
    }

    if (!orderData.Total || orderData.Total <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order data: invalid total amount'
      });
    }

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    // Ensure order is from POS with proper Source
    const orderToInsert = {
      ...orderData,
      Source: 'POS', // Ensure Source is always 'POS' for POS submissions
      cashierName: req.session.user?.fullname || 'Unknown',
      insertedAt: new Date()
    };

    const result = await ordersCollection.insertOne(orderToInsert);

    if (result.acknowledged && result.insertedId) {
      // Log successful order submission
      console.log(`✅ Staff POS Order submitted successfully: ${orderData.OrderID} by ${req.session.user?.fullname}`);

      // Deduct ingredients and add-ons from inventory
      try {
        const InventoryManager = require('../utils/inventoryManager');
        const deductionResult = await InventoryManager.deductIngredients(orderData.Cart);
        if (deductionResult.success) {
          console.log(`✅ Stock deduction completed for order ${orderData.OrderID}:`, deductionResult.deductions);
        } else {
          console.error('❌ Stock deduction failed:', deductionResult.error);
          // Don't fail the order if stock deduction fails, but log it
        }
      } catch (deductionError) {
        console.error('❌ Error during stock deduction:', deductionError);
        // Don't fail the order if stock deduction fails
      }

      // Create notification for new order
      try {
        await createNewOrderNotification(orderToInsert);
      } catch (notifError) {
        console.error('Failed to create order notification:', notifError);
        // Don't fail the order creation if notification fails
      }

      res.json({
        success: true,
        message: 'Order submitted successfully',
        orderId: orderData.OrderID,
        insertedId: result.insertedId
      });
    } else {
      throw new Error('Order insertion failed');
    }

    await client.close();
  } catch (error) {
    console.error('Staff POS Order submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit order. Please try again.',
      error: error.message
    });
  }
});

// Order completion route (needs to be before general staff middleware)
router.get('/complete-order/:orderId', isAuthorizedForOrderCompletion, async (req, res) => {
  try {
    const { orderId } = req.params;

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    // Get current order status
    const order = await ordersCollection.findOne({ OrderID: orderId });
    if (!order) {
      await client.close();
      return res.status(404).render('error', {
        title: 'Order Not Found',
        message: 'The order you\'re trying to complete was not found.',
        status: 404
      });
    }

    // Only allow completion if not already completed
    if (order.FulfillmentStatus === 'Completed') {
      await client.close();
      return res.render('staff/order-complete', {
        title: 'Order Already Completed',
        layout: false,
        orderId: orderId,
        order: order,
        message: 'This order has already been completed.',
        currentUser: req.session.user
      });
    }

    // Update order status to Completed
    await ordersCollection.updateOne(
      { OrderID: orderId },
      { $set: { FulfillmentStatus: 'Completed', fulfillmentStatus: 'Completed' } }
    );

    await client.close();

    // Render success page
    res.render('staff/order-complete', {
      title: 'Order Completed Successfully',
      layout: false,
      orderId: orderId,
      order: { ...order, FulfillmentStatus: 'Completed' },
      message: `Order ${orderId} has been marked as completed.`,
      currentUser: req.session.user
    });

  } catch (error) {
    console.error('Error completing order:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to complete the order.',
      status: 500
    });
  }
});

// Apply authentication middleware to all protected routes
router.use(isStaffLoggedIn);

router.use((req, res, next) => {
  res.locals.sidebarItems = [
    { path: '/staff/dashboard', label: 'Dashboard', icon: 'house' },
    { path: '/staff/menu', label: 'POS Menu', icon: 'list' },
    { path: '/staff/order', label: 'Orders', icon: 'box' },
    { path: '/staff/messages', label: 'Messages', icon: 'envelope' },
    { path: '/staff/calculator', label: 'Calculator', icon: 'calculator' },
    { path: '/staff/settings', label: 'Settings', icon: 'gear' },
    { path: '/logout', label: 'Logout', icon: 'door-open' }
  ];
  res.locals.currentPage = req.path;
  next();
});

async function getMenu() {
  const client = await MongoClient.connect(uri);
  const db = client.db('blessingscafe');
  const menu = await db.collection('Menu').find().toArray();
  await client.close();
  return menu;
}



router.get('/dashboard', async (req, res) => {
  try {
    // Fetch current user data from database to ensure fullname is up to date
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const currentUser = await db.collection('users').findOne({ _id: new ObjectId(req.session.user._id) });
    await client.close();

    // Merge session data with fresh database data
    const userData = {
      ...req.session.user,
      fullname: currentUser?.fullname
    };

    // Fetch all dashboard data server-side for better loading performance
    const [basicStats, analyticsStats, topCategories, paymentTypes, ordersBySource, salesPerformance] = await Promise.all([
      getDashboardStats(),
      getDashboardAnalyticsStats(),
      getTopCategories(),
      getPaymentTypes(),
      getOrdersBySource(),
      getSalesPerformance(14)
    ]);

    // Fetch low stock data for dashboard
    let lowStockData = { quantity: 0, name: 'All stocked', type: 'none', hasMore: false };
    try {
      // Get user's low stock threshold from settings
      const client = await MongoClient.connect(uri);
      const db = client.db('blessingscafe');
      const userSettings = await db.collection('UserSettings').findOne({ userId: req.session.user._id });
      const threshold = userSettings?.lowStockAlertRange || 5;

    const ingredients = await db.collection('Ingredients').find({ Amount: { $lte: threshold }, isEnabled: true }).sort({ Amount: 1 }).toArray();
    const addons = await db.collection('Add-ons').find({ Amount: { $lte: threshold }, isEnabled: true }).sort({ Amount: 1 }).toArray();

      const getItemName = (item, type) => {
        if (type === 'ingredient') {
          return item.itemName || item.ItemName || item.name || item.Name || 'Unnamed Ingredient';
        } else {
          return item.itemName || item.ItemName || item.name || item.Name || 'Unnamed Add-on';
        }
      };

      const allLowStockItems = [
        ...ingredients.map(item => ({
          quantity: item.Amount,
          name: getItemName(item, 'ingredient'),
          type: 'ingredient'
        })),
        ...addons.map(item => ({
          quantity: item.Amount,
          name: getItemName(item, 'addon'),
          type: 'addon'
        }))
      ].sort((a, b) => a.quantity - b.quantity);

      if (allLowStockItems.length > 0) {
        const primary = allLowStockItems[0];
        lowStockData = {
          quantity: primary.quantity,
          name: primary.name,
          type: primary.type,
          hasMore: allLowStockItems.length > 1,
          totalLowStock: allLowStockItems.length,
          allItems: allLowStockItems.length > 1 ? allLowStockItems.slice(1).map(item => `${item.name} (${item.quantity})`) : []
        };
      }

      await client.close();
    } catch (error) {
      console.error('Low stock data fetch error:', error);
    }

    // Combine all stats into a single object for template consistency
    const combinedStats = {
      ...basicStats,
      ...analyticsStats
    };

    // Get user settings for threshold
    const clientThreshold = await MongoClient.connect(uri);
    const dbThreshold = clientThreshold.db('blessingscafe');
    const userSettingsThreshold = await dbThreshold.collection('UserSettings').findOne({ userId: req.session.user._id });
    const userLowStockThreshold = userSettingsThreshold?.lowStockAlertRange || 5;
    await clientThreshold.close();

    res.render('staff/dashboard', {
      title: 'Staff Dashboard',
      layout: 'staff/layout',
      user: userData,
      stats: combinedStats,  // Template expects 'stats' object
      analyticsStats,
      topCategories,
      paymentTypes,
      ordersBySource,
      salesPerformance,
      lowStockData,
      userLowStockThreshold
    });
  } catch (error) {
    console.error('Staff Dashboard error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load dashboard',
      status: 500
    });
  }
});

router.get('/pos', async (req, res) => {
  res.redirect('/staff/menu');
});

router.get('/menu', async (req, res) => {
  try {
    // Fetch current user data from database to ensure fullname is up to date
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const currentUser = await db.collection('users').findOne({ _id: new ObjectId(req.session.user._id) });
    
    // Fetch menu items, addons, ingredients, and active promos
    const [menu, addons, ingredients, activePromos] = await Promise.all([
      getMenu(),
      db.collection('Add-ons').find({ isEnabled: true }).toArray(),
      db.collection('Ingredients').find({ isEnabled: true }).toArray(),
      getActiveDiscounts()
    ]);
    
    await client.close();

    // Merge session data with fresh database data
    const userData = {
      ...req.session.user,
      fullname: currentUser?.fullname
    };

    res.render('staff/menu', {
      title: 'POS Menu',
      layout: 'staff/layout',
      user: userData,
      menuItems: menu,
      addons,
      ingredients,
      activePromos
    });
  } catch (error) {
    console.error('Staff Menu error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load menu',
      status: 500
    });
  }
});

router.get('/order', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');
    const menuCollection = db.collection('Menu');
    const orders = await ordersCollection.find().toArray();
    const menu = await menuCollection.find().toArray();
    await client.close();
    res.render('staff/order', {
      title: 'Orders',
      layout: 'staff/layout',
      orders,
      menu
    });
  } catch (error) {
    console.error('Staff Orders error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load orders',
      status: 500
    });
  }
});

router.get('/calculator', (req, res) => {
  res.render('staff/calculator', {
    title: 'Calculator',
    layout: 'staff/layout'
  });
});

router.get('/settings', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.session.user._id) });

    // Load user settings from UserSettings collection
    let userSettings = await db.collection('UserSettings').findOne({ userId: req.session.user._id });
    if (!userSettings) {
      userSettings = {
        soundEnabled: true,
        printReceipts: false,
        darkMode: false,
        orderConfirmations: true
      };
    }

    await client.close();

    res.render('staff/settings', {
      title: 'Settings',
      layout: 'staff/layout',
      user: user,
      settings: userSettings
    });
  } catch (error) {
    console.error('Staff Settings error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load settings',
      status: 500
    });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const { displayName, email, phone } = req.body;

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    await db.collection('users').updateOne(
      { _id: new ObjectId(req.session.user._id) },
      { $set: { displayName, email, phone } }
    );

    await client.close();

    res.redirect('/staff/settings');
  } catch (error) {
    console.error('Staff Settings update error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to update settings',
      status: 500
    });
  }
});

// API route to save staff preferences
router.post('/settings/preferences', async (req, res) => {
  try {
    console.log('Received staff preferences update:', req.body);

    const { soundEnabled, printReceipts, darkMode, orderConfirmations, lowStockAlertRange } = req.body;

    // If only lowStockAlertRange is provided (from modal), we need to fetch existing settings and merge
    let updateFields = {
      updatedAt: new Date()
    };

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Fetch existing settings to preserve other values
    const existingSettings = await db.collection('UserSettings').findOne({ userId: req.session.user._id });

    // Process boolean values or use existing values
    if (typeof soundEnabled !== 'undefined') {
      updateFields.soundEnabled = soundEnabled === 'true' || soundEnabled === true;
    } else if (existingSettings) {
      updateFields.soundEnabled = existingSettings.soundEnabled;
    } else {
      updateFields.soundEnabled = true;
    }

    if (typeof printReceipts !== 'undefined') {
      updateFields.printReceipts = printReceipts === 'true' || printReceipts === true;
    } else if (existingSettings) {
      updateFields.printReceipts = existingSettings.printReceipts;
    } else {
      updateFields.printReceipts = false;
    }

    if (typeof darkMode !== 'undefined') {
      updateFields.darkMode = darkMode === 'true' || darkMode === true;
    } else if (existingSettings) {
      updateFields.darkMode = existingSettings.darkMode;
    } else {
      updateFields.darkMode = false;
    }

    if (typeof orderConfirmations !== 'undefined') {
      updateFields.orderConfirmations = orderConfirmations === 'true' || orderConfirmations === true;
    } else if (existingSettings) {
      updateFields.orderConfirmations = existingSettings.orderConfirmations;
    } else {
      updateFields.orderConfirmations = true;
    }

    if (typeof lowStockAlertRange !== 'undefined') {
      updateFields.lowStockAlertRange = parseInt(lowStockAlertRange) || 5;
    } else if (existingSettings) {
      updateFields.lowStockAlertRange = existingSettings.lowStockAlertRange || 5;
    } else {
      updateFields.lowStockAlertRange = 5;
    }

    // Upsert user settings
    await db.collection('UserSettings').updateOne(
      { userId: req.session.user._id },
      {
        $set: updateFields,
        $setOnInsert: {
          userId: req.session.user._id,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    await client.close();
    console.log('Updated staff lowStockAlertRange to:', updateFields.lowStockAlertRange);
    res.json({ success: true, message: 'Preferences updated successfully', lowStockAlertRange: updateFields.lowStockAlertRange });
  } catch (error) {
    console.error('Staff preferences update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update preferences' });
  }
});

// Order management endpoints
router.patch('/orders/:orderId/fulfillment', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { FulfillmentStatus } = req.body;

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    // Get current order before update
    const currentOrder = await ordersCollection.findOne({ OrderID: orderId });

    const result = await ordersCollection.updateOne(
      { OrderID: orderId },
      { $set: { FulfillmentStatus, fulfillmentStatus: FulfillmentStatus } }
    );

    // If status is being set to 'Cancelled', rollback inventory
    if (FulfillmentStatus === 'Cancelled' && currentOrder && currentOrder.Cart && Array.isArray(currentOrder.Cart) && currentOrder.Cart.length > 0) {
      try {
        const InventoryManager = require('../utils/inventoryManager');
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

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ success: true, message: 'Fulfillment status updated successfully' });
  } catch (error) {
    console.error('Error updating fulfillment status:', error);
    res.status(500).json({ error: 'Failed to update fulfillment status' });
  }
});

router.patch('/orders/:orderId/payment-status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { PaymentStatus } = req.body;
    
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');
    
    const result = await ordersCollection.updateOne(
      { OrderID: orderId },
      { $set: { PaymentStatus, paymentStatus: PaymentStatus } }
    );
    
    await client.close();
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({ success: true, message: 'Payment status updated successfully' });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

router.patch('/orders/:orderId/cancel', async (req, res) => {
  try {
    const { orderId } = req.params;

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    // First, get the order data before updating (needed for stock rollback)
    const order = await ordersCollection.findOne({ OrderID: orderId });
    if (!order) {
      await client.close();
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if order was already cancelled to prevent double rollback
    if (order.PaymentStatus === 'Cancelled' || order.FulfillmentStatus === 'Cancelled') {
      console.warn(`Order ${orderId} already cancelled, skipping stock rollback`);
      const result = await ordersCollection.updateOne(
        { OrderID: orderId },
        {
          $set: {
            PaymentStatus: 'Cancelled',
            paymentStatus: 'Cancelled',
            FulfillmentStatus: 'Cancelled',
            fulfillmentStatus: 'Cancelled'
          }
        }
      );
      await client.close();
      return res.json({ success: true, message: 'Order cancelled successfully' });
    }

    // Rollback inventory stock before updating order status
    if (order.Cart && Array.isArray(order.Cart) && order.Cart.length > 0) {
      try {
        const InventoryManager = require('../utils/inventoryManager');
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

    // Now update the order status
    const result = await ordersCollection.updateOne(
      { OrderID: orderId },
      {
        $set: {
          PaymentStatus: 'Cancelled',
          paymentStatus: 'Cancelled',
          FulfillmentStatus: 'Cancelled',
          fulfillmentStatus: 'Cancelled'
        }
      }
    );

    await client.close();

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

router.patch('/orders/:orderId/restore', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { PaymentStatus, FulfillmentStatus } = req.body;
    
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');
    
    const result = await ordersCollection.updateOne(
      { OrderID: orderId },
      { 
        $set: { 
          PaymentStatus,
          paymentStatus: PaymentStatus,
          FulfillmentStatus,
          fulfillmentStatus: FulfillmentStatus
        } 
      }
    );
    
    await client.close();
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({ success: true, message: 'Order restored successfully' });
  } catch (error) {
    console.error('Error restoring order:', error);
    res.status(500).json({ error: 'Failed to restore order' });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/messages/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Messages page
router.get('/messages', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const currentUserId = req.session.user._id;

    // Get all users for messaging (admins, owners and staff only) - include current user for sender display
    const users = await db.collection('users').find({
      role: { $in: ['admin', 'owner', 'staff'] }
    }).project({
      _id: 1,
      fullname: 1,
      staffId: 1,
      role: 1
    }).toArray();

    // Get conversations for current user (server-side)
    const messages = await db.collection('messages')
      .find({
        $or: [
          { senderId: currentUserId },
          { recipientId: currentUserId }
        ]
      })
      .sort({ timestamp: -1 })
      .toArray();

    // Group messages by conversation partner
    const conversationMap = new Map();

    for (const message of messages) {
      const partnerId = message.senderId === currentUserId ? message.recipientId : message.senderId;
      const conversationKey = [currentUserId, partnerId].sort().join('_');

      if (!conversationMap.has(conversationKey)) {
        // Show subject if available, otherwise content
        const lastMessageText = message.subject ? `${message.subject}: ${message.content || 'Sent an attachment'}` : (message.content || 'Sent an attachment');
        conversationMap.set(conversationKey, {
          conversationId: conversationKey,
          participantId: partnerId,
          lastMessage: lastMessageText,
          lastMessageTime: message.timestamp,
          messageCount: 0,
          unreadCount: 0
        });
      }

      const conv = conversationMap.get(conversationKey);
      conv.messageCount++;

      // Count unread messages from this partner
      if (message.recipientId === currentUserId && !message.read) {
        conv.unreadCount++;
      }
    }

    const conversations = Array.from(conversationMap.values());

    // Get participant details
    if (conversations.length > 0) {
      const participantIds = conversations.map(c => c.participantId);
      const participants = await db.collection('users')
        .find({ _id: { $in: participantIds.map(id => new ObjectId(id)) } })
        .toArray();

      const participantMap = new Map(participants.map(p => [p._id.toString(), p]));

      conversations.forEach(conv => {
        const participant = participantMap.get(conv.participantId);
        if (participant) {
          conv.participantName = participant.fullname;
        }
      });
    }

    await client.close();

    res.render('staff/messages', {
      title: 'Messages | Blessings Cafe',
      user: req.session.user,
      currentPage: '/staff/messages',
      layout: 'staff/layout',
      users,
      conversations
    });
  } catch (error) {
    console.error('Staff Messages error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load messages',
      status: 500
    });
  }
});



// API Routes for messaging
// Get conversations for current user
router.get('/messages/api/conversations', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const currentUserId = req.session.user._id;

    // Find all unique conversation partners
    const messages = await db.collection('messages')
      .find({
        $or: [
          { senderId: currentUserId },
          { recipientId: currentUserId }
        ]
      })
      .sort({ timestamp: -1 })
      .toArray();

    // Group messages by conversation partner
    const conversationMap = new Map();

    for (const message of messages) {
      const partnerId = message.senderId === currentUserId ? message.recipientId : message.senderId;
      const conversationKey = [currentUserId, partnerId].sort().join('_');

      if (!conversationMap.has(conversationKey)) {
        // Show subject if available, otherwise content
        const lastMessageText = message.subject ? `${message.subject}: ${message.content || 'Sent an attachment'}` : (message.content || 'Sent an attachment');
        conversationMap.set(conversationKey, {
          conversationId: conversationKey,
          participantId: partnerId,
          lastMessage: lastMessageText,
          lastMessageTime: message.timestamp,
          messageCount: 0,
          unreadCount: 0
        });
      }

      const conv = conversationMap.get(conversationKey);
      conv.messageCount++;

      // Count unread messages from this partner
      if (message.recipientId === currentUserId && !message.read) {
        conv.unreadCount++;
      }
    }

    const conversations = Array.from(conversationMap.values());

    // Get participant details
    if (conversations.length > 0) {
      const participantIds = conversations.map(c => c.participantId);
      const participants = await db.collection('users')
        .find({ _id: { $in: participantIds.map(id => new ObjectId(id)) } })
        .toArray();

      const participantMap = new Map(participants.map(p => [p._id.toString(), p]));

      conversations.forEach(conv => {
        const participant = participantMap.get(conv.participantId);
        if (participant) {
          conv.participantName = participant.fullname;
        }
      });
    }

    await client.close();

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages for a conversation
router.get('/messages/api/messages/:conversationId', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const currentUserId = req.session.user._id;
    const conversationId = req.params.conversationId;

    // Parse conversation ID to get participant IDs
    const [user1, user2] = conversationId.split('_');
    const participantId = user1 === currentUserId ? user2 : user1;

    // Get messages between current user and participant
    const messages = await db.collection('messages')
      .find({
        $or: [
          { senderId: currentUserId, recipientId: participantId },
          { senderId: participantId, recipientId: currentUserId }
        ]
      })
      .sort({ timestamp: 1 })
      .toArray();

    // Mark messages as read
    await db.collection('messages').updateMany(
      {
        senderId: participantId,
        recipientId: currentUserId,
        read: false
      },
      { $set: { read: true, readAt: new Date() } }
    );

    await client.close();
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a message
router.post('/messages/api/send', async (req, res) => {
  try {
    const { recipientId, content, attachments, subject } = req.body;
    const senderId = req.session.user._id;

    if (!recipientId || (!content && (!attachments || attachments.length === 0))) {
      return res.status(400).json({ error: 'Recipient and content or attachments required' });
    }

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Verify recipient exists and is admin/staff/owner
    const recipient = await db.collection('users').findOne({
      _id: new ObjectId(recipientId),
      role: { $in: ['admin', 'owner', 'staff'] }
    });

    if (!recipient) {
      await client.close();
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const message = {
      senderId,
      recipientId,
      subject: subject || '',
      content: content || '',
      attachments: attachments || [],
      timestamp: new Date(),
      read: false
    };

    const result = await db.collection('messages').insertOne(message);

    // Create notification for new message
    try {
      await createMessageNotification({
        _id: result.insertedId,
        senderName: req.session.user?.fullname || 'Unknown',
        subject: subject || 'New Message'
      }, 'staff');
    } catch (notifError) {
      console.error('Failed to create message notification:', notifError);
      // Don't fail the message sending if notification fails
    }

    await client.close();

    res.json({
      success: true,
      message: { ...message, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get users for messaging
router.get('/messages/api/users', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const users = await db.collection('users').find({
      role: { $in: ['admin', 'owner', 'staff'] },
      _id: { $ne: new ObjectId(req.session.user._id) } // Exclude current user
    }).toArray();

    await client.close();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get unread message count for current user
router.get('/messages/api/unread-count', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const currentUserId = req.session.user._id;

    const unreadCount = await db.collection('messages').countDocuments({
      recipientId: currentUserId,
      read: false
    });

    await client.close();
    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Analytics page route
router.get('/analytics', async (req, res) => {
  try {
    // Fetch current user data from database to ensure fullname is up to date
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const currentUser = await db.collection('users').findOne({ _id: new ObjectId(req.session.user._id) });
    await client.close();

    // Merge session data with fresh database data
    const userData = {
      ...req.session.user,
      fullname: currentUser?.fullname
    };

    res.render('staff/analytics', {
      title: 'Analytics',
      layout: 'staff/layout',
      user: userData,
      currentPage: '/staff/analytics'
    });
  } catch (error) {
    console.error('Staff Analytics error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load analytics',
      status: 500
    });
  }
});

// Analytics Endpoints
router.get('/analytics/dashboard-stats', async (req, res) => {
  try {
    const stats = await getDashboardAnalyticsStats();
    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

router.get('/analytics/popular-products', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Get popular products from orders
    const popularProducts = await db.collection('Orders').aggregate([
      { $unwind: '$Cart' },
      {
        $group: {
          _id: '$Cart.ProductName',
          totalQuantity: { $sum: '$Cart.Quantity' }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 20 }
    ]).toArray();

    await client.close();
    res.json(popularProducts);
  } catch (error) {
    console.error('Popular products error:', error);
    res.status(500).json({ error: 'Failed to load popular products' });
  }
});

router.get('/analytics/sales-per-day', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Get sales per day for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const salesPerDay = await db.collection('Orders').aggregate([
      {
        $match: {
          Date: { $gte: thirtyDaysAgo.toISOString() },
          PaymentStatus: { $in: ['Paid', 'Payment pending'] }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: { $dateFromString: { dateString: '$Date' } }
            }
          },
          totalSales: { $sum: '$Total' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]).toArray();

    await client.close();
    res.json(salesPerDay);
  } catch (error) {
    console.error('Sales per day error:', error);
    res.status(500).json({ error: 'Failed to load sales per day' });
  }
});

router.get('/analytics/payment-methods', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const paymentMethods = await db.collection('Orders').aggregate([
      {
        $match: {
          PaymentStatus: { $in: ['Paid', 'Payment pending'] }
        }
      },
      {
        $group: {
          _id: '$PaymentMethod',
          revenue: { $sum: '$Total' },
          count: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } }
    ]).toArray();

    await client.close();
    res.json(paymentMethods);
  } catch (error) {
    console.error('Payment methods error:', error);
    res.status(500).json({ error: 'Failed to load payment methods' });
  }
});

router.get('/analytics/order-sources', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const orderSources = await db.collection('Orders').aggregate([
      {
        $group: {
          _id: '$Source',
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: '$Total' }
        }
      },
      { $sort: { orderCount: -1 } }
    ]).toArray();

    await client.close();
    res.json(orderSources);
  } catch (error) {
    console.error('Order sources error:', error);
    res.status(500).json({ error: 'Failed to load order sources' });
  }
});

router.get('/analytics/order-history', async (req, res) => {
  try {
    const days = req.query.days === 'all' ? null : parseInt(req.query.days) || 7;
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    let matchCondition = {};
    if (days) {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - days);
      matchCondition.Date = { $gte: dateLimit.toISOString() };
    }

    const orders = await db.collection('Orders').aggregate([
      { $match: matchCondition },
      {
        $project: {
          OrderID: 1,
          Customer: '$Customer.fullname',
          Date: {
            $dateToString: {
              format: '%Y-%m-%d %H:%M',
              date: { $dateFromString: { dateString: '$Date' } }
            }
          },
          Total: 1,
          PaymentMode: '$PaymentMode',
          PaymentStatus: '$PaymentStatus'
        }
      },
      { $sort: { Date: -1 } },
      { $limit: 100 }
    ]).toArray();

    await client.close();
    res.json(orders);
  } catch (error) {
    console.error('Order history error:', error);
    res.status(500).json({ error: 'Failed to load order history' });
  }
});

router.get('/analytics/sales-report-pdf', async (req, res) => {
  try {
    // Get user fullname for PDF header (same as analytics page route)
    const userData = req.session.user;

    const { start_date, end_date, days } = req.query;

    // Validate date range
    let startDate, endDate;
    let reportTitle = "Sales Report";

    try {
      if (days && days !== "custom") {
        const numDays = parseInt(days);
        if (!isNaN(numDays) && numDays > 0) {
          endDate = new Date();
          startDate = new Date();
          startDate.setDate(startDate.getDate() - numDays);
          reportTitle = `Sales Report - Last ${numDays} Days`;
        } else {
          throw new Error('Invalid days parameter');
        }
      } else if (start_date && end_date) {
        startDate = new Date(start_date);
        endDate = new Date(end_date);

        // Validate dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Invalid date format');
        }

        if (startDate > endDate) {
          throw new Error('Start date cannot be after end date');
        }

        reportTitle = `Sales Report - ${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} to ${endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      } else {
        // Default to last 30 days
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        reportTitle = "Sales Report - Last 30 Days";
      }

      // Ensure dates are valid
      if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date range');
      }

    } catch (error) {
      console.error('Date validation error:', error);
      return res.status(400).json({ error: 'Invalid date parameters', details: error.message });
    }

    // Get sales data from database (simplified like the working order-history route)
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Create date strings for comparison (same format as order-history route)
    const cutoffStart = startDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    const cutoffEnd = endDate.toISOString().split('T')[0];

    // Query orders within date range (like the working order-history route)
    const orders = await db.collection('Orders').find({
      Date: { $gte: cutoffStart, $lte: cutoffEnd },
      PaymentStatus: { $ne: "Cancelled" }
    })
    .sort({ Date: -1 })
    .toArray();

    // Calculate summary statistics with proper null handling
    const totalRevenue = orders.reduce((sum, order) => {
      const orderTotal = typeof order.Total === 'number' && !isNaN(order.Total) ? order.Total : 0;
      return sum + orderTotal;
    }, 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Get payment method breakdown (normalize E-Payment variations)
    const paymentBreakdown = orders.reduce((acc, order) => {
      let method = order.PaymentMode || 'Unknown';
      // Normalize different variations of E-Payment to a single category
      if (method === 'E_Payment' || method === 'E-PAYMENT' || method === 'E-Payment') {
        method = 'E-Payment';
      }
      acc[method] = (acc[method] || 0) + order.Total;
      return acc;
    }, {});

    // Get daily sales data (using raw Date field like working order-history)
    const dailySales = orders.reduce((acc, order) => {
      if (order.Date) {
        const date = order.Date.substring(0, 10); // Extract YYYY-MM-DD part only
        acc[date] = (acc[date] || 0) + (typeof order.Total === 'number' ? order.Total : 0);
      }
      return acc;
    }, {});

    // Count orders per date accurately
    const ordersPerDate = orders.reduce((acc, order) => {
      if (order.Date) {
        const date = order.Date.substring(0, 10); // Extract YYYY-MM-DD part only
        acc[date] = (acc[date] || 0) + 1;
      }
      return acc;
    }, {});

    const dailySalesData = Object.entries(dailySales)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({
        date,
        total,
        count: ordersPerDate[date] || 0
      }));

    // Fetch current menu items for price lookups (keep connection open)
    const currentMenu = await db.collection('Menu').find({ isEnabled: true }).toArray();
    const menuLookup = {};
    currentMenu.forEach(menuItem => {
      menuLookup[menuItem.Name] = menuItem;
      if (menuItem.ProductName) menuLookup[menuItem.ProductName] = menuItem;
    });

    // Get top selling products (by revenue, like the "Top Product" insight) with actual quantities - keeping minimal report sections
    const productStats = orders.reduce((acc, order) => {
      // Use Cart array with correct field names
      const cartItems = order.Cart || [];
      cartItems.forEach(item => {
        const productName = item.ProductName || item.Name || 'Unknown Product';
        // Check multiple possible price fields in order of preference
        let price = item.Price || item.BasePrice || 0;

        // If price is still 0, try to look up from current menu
        if (price === 0) {
          const menuItem = menuLookup[productName];
          if (menuItem) {
            // If it has sizes and item specifies size, use that price
            if (menuItem.Sizes && item.Size) {
              const sizeInfo = menuItem.Sizes.find(size => size.Size === item.Size);
              if (sizeInfo) {
                price = sizeInfo.BasePrice || 0;
              }
            } else if (menuItem.BasePrice) {
              // Use base price for items like pastries
              price = menuItem.BasePrice;
            } else if (menuItem.Sizes && menuItem.Sizes.length > 0) {
              // Default to first size if available
              price = menuItem.Sizes[0].BasePrice || 0;
            }
          }
        }

        const quantity = item.Quantity || 1;
        const itemSubtotal = price * quantity;

        if (!acc[productName]) {
          acc[productName] = { revenue: 0, quantity: 0 };
        }
        acc[productName].revenue += itemSubtotal;
        acc[productName].quantity += quantity;
      });
      return acc;
    }, {});

    const topProducts = Object.entries(productStats)
      .sort(([,a], [,b]) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(([name, stats]) => ({
        name,
        revenue: Math.round(stats.revenue),
        quantity: stats.quantity
      }));

    await client.close();

    // Generate HTML for PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${reportTitle}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 30px;
            background: white;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #8b5a2b;
            margin-bottom: 30px;
            padding-bottom: 20px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #8b5a2b;
            margin-bottom: 10px;
        }
        .report-title {
            font-size: 18px;
            color: #666;
            margin-bottom: 5px;
        }
        .report-meta {
            text-align: center;
            margin-top: 10px;
        }
        .report-date {
            font-size: 12px;
            color: #999;
            margin-bottom: 2px;
            display: block;
        }
        .report-user {
            font-size: 12px;
            color: #666;
            font-weight: 500;
            display: block;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            background: #f9f9f9;
        }
        .summary-value {
            font-size: 24px;
            font-weight: bold;
            color: #8b5a2b;
            margin-bottom: 5px;
        }
        .summary-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .section {
            margin-bottom: 30px;
        }
        .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #333;
            border-bottom: 2px solid #8b5a2b;
            padding-bottom: 5px;
            margin-bottom: 15px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 11px;
        }
        th, td {
            border: 1px solid #e0e0e0;
            padding: 8px 12px;
            text-align: left;
        }
        th {
            background: #f5f5f5;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 1px;
        }
        .payment-methods {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .payment-method {
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 10px;
            background: white;
        }
        .payment-name {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .payment-amount {
            font-size: 18px;
            color: #8b5a2b;
        }
        .page-break {
            page-break-before: always;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">Blessings Cafe</div>
        <div class="report-title">${reportTitle}</div>
        <div class="report-meta">
            <div class="report-date">Generated on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div class="report-user">Generated by: ${userData.fullname || userData.displayName || 'Unknown User'}</div>
        </div>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <div class="summary-value">${totalOrders.toLocaleString()}</div>
            <div class="summary-label">Total Orders</div>
        </div>
        <div class="summary-card">
            <div class="summary-value">₱${totalRevenue.toLocaleString()}</div>
            <div class="summary-label">Total Revenue</div>
        </div>
    <div class="summary-card">
            <div class="summary-value">₱${(!isNaN(averageOrderValue) ? averageOrderValue.toFixed(2) : '0.00')}</div>
            <div class="summary-label">Avg Order Value</div>
        </div>
        <div class="summary-card">
            <div class="summary-value">₱${(() => {
                const daysDiff = Math.max(Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)), 1);
                return (totalRevenue / daysDiff).toFixed(2);
            })()}</div>
            <div class="summary-label">Daily Revenue</div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Payment Methods</div>
        <div class="payment-methods">
            ${Object.entries(paymentBreakdown).map(([method, amount]) => `
                <div class="payment-method">
                    <div class="payment-name">${method}</div>
                    <div class="payment-amount">₱${amount.toLocaleString()}</div>
                    <div style="font-size: 12px; color: #666;">${((amount / totalRevenue) * 100).toFixed(1)}% of total</div>
                </div>
            `).join('')}
        </div>
    </div>

    <div class="section">
        <div class="section-title">Top Selling Products (by Revenue)</div>
        <table>
            <thead>
                <tr>
                    <th style="width: 55%">Product Name</th>
                    <th style="width: 22%">Total Revenue</th>
                    <th style="width: 23%">Units Sold</th>
                </tr>
            </thead>
            <tbody>
                ${topProducts.map(product => `
                    <tr>
                        <td>${product.name}</td>
                        <td>₱${product.revenue.toLocaleString()}</td>
                        <td>${product.quantity}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section page-break">
        <div class="section-title">Daily Sales Breakdown</div>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Orders</th>
                    <th>Revenue</th>
                    <th>Average Order Value</th>
                </tr>
            </thead>
            <tbody>
                ${dailySalesData.map(day => `
                    <tr>
                        <td>${day.date ? new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</td>
                        <td>${day.count}</td>
                        <td>₱${(day.total || 0).toLocaleString()}</td>
                        <td>₱${day.count > 0 ? ((day.total || 0) / day.count).toFixed(2) : '0.00'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section" style="border-top: 3px solid #8b5a2b; margin-top: 40px; padding-top: 20px;">
        <div style="background: #8b5a2b; color: white; padding: 20px; border-radius: 8px; text-align: center;">
            <h3 style="margin: 0 0 10px 0; font-size: 18px;">Total Sales Summary</h3>
            <div style="font-size: 32px; font-weight: bold; margin-bottom: 15px;">₱${totalRevenue.toLocaleString()}</div>
            <div style="font-size: 14px; opacity: 0.9;">
                Based on ${totalOrders.toLocaleString()} orders processed between<br>
                ${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} and
                ${endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
        </div>
    </div>
</body>
</html>`;

    const puppeteer = require('puppeteer');

    // Launch browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set content and wait for it to load
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });

    await browser.close();

    // Set headers and send PDF
    const filename = `${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF report', details: error.message });
  }
});

router.get('/analytics/low-stock', async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 5; // Default to 5, can be 5-100

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const ingredients = await db.collection('Ingredients').find({ Amount: { $lte: threshold }, isEnabled: true }).sort({ Amount: 1 }).toArray();
    const addons = await db.collection('Add-ons').find({ Amount: { $lte: threshold }, isEnabled: true }).sort({ Amount: 1 }).toArray();

    await client.close();

    // Helper function to get item name
    const getItemName = (item, type) => {
      if (type === 'ingredient') {
        return item.itemName || item.ItemName || item.name || item.Name || 'Unnamed Ingredient';
      } else {
        return item.itemName || item.ItemName || item.name || item.Name || 'Unnamed Add-on';
      }
    };

    // Combine and sort all low stock items
    const allLowStockItems = [
      ...ingredients.map(item => ({
        quantity: item.Amount,
        name: getItemName(item, 'ingredient'),
        type: 'ingredient'
      })),
      ...addons.map(item => ({
        quantity: item.Amount,
        name: getItemName(item, 'addon'),
        type: 'addon'
      }))
    ].sort((a, b) => a.quantity - b.quantity);

    if (allLowStockItems.length > 0) {
      const primary = allLowStockItems[0];
      const hasMore = allLowStockItems.length > 1;

      res.json({
        quantity: primary.quantity,
        name: primary.name,
        type: primary.type,
        hasMore: hasMore,
        totalLowStock: allLowStockItems.length,
        allItems: hasMore ? allLowStockItems.slice(1).map(item => `${item.name} (${item.quantity})`) : []
      });
    } else {
      res.json({
        quantity: 0,
        name: 'All stocked',
        type: 'none',
        hasMore: false,
        totalLowStock: 0,
        allItems: []
      });
    }
  } catch (error) {
    console.error('Low stock error:', error);
    res.status(500).json({ error: 'Failed to load low stock data' });
  }
});

router.get('/analytics/top-categories', async (req, res) => {
  try {
    const categories = await getTopCategories();
    res.json(categories);
  } catch (error) {
    console.error('Top categories error:', error);
    res.status(500).json({ error: 'Failed to load top categories' });
  }
});

router.get('/analytics/payment-types', async (req, res) => {
  try {
    const paymentTypes = await getPaymentTypes();
    res.json(paymentTypes);
  } catch (error) {
    console.error('Payment types error:', error);
    res.status(500).json({ error: 'Failed to load payment types' });
  }
});

router.get('/analytics/orders-by-source', async (req, res) => {
  try {
    const ordersBySource = await getOrdersBySource();
    res.json(ordersBySource);
  } catch (error) {
    console.error('Orders by source error:', error);
    res.status(500).json({ error: 'Failed to load orders by source' });
  }
});

router.get('/analytics/sales-performance', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 14;
    const results = await getSalesPerformance(days);
    res.json(results);
  } catch (error) {
    console.error('Sales performance error:', error);
    res.status(500).json({ error: 'Failed to load sales performance data' });
  }
});

router.get('/analytics/export-performance', async (req, res) => {
  try {
    const userData = req.session.user;
    const days = parseInt(req.query.days) || 14;

    // Get performance data
    const performanceData = await getSalesPerformance(days);

    // Calculate summary statistics
    const totalEarnings = performanceData.reduce((sum, day) => sum + (day.earnings || 0), 0);
    const totalCosts = performanceData.reduce((sum, day) => sum + (day.costs || 0), 0);
    const totalOrders = performanceData.reduce((sum, day) => sum + (day.orders || 0), 0);
    const averageEarnings = performanceData.length > 0 ? totalEarnings / performanceData.length : 0;
    const averageOrders = performanceData.length > 0 ? totalOrders / performanceData.length : 0;
    const profitMargin = totalEarnings > 0 ? ((totalEarnings - totalCosts) / totalEarnings) * 100 : 0;

    // Generate HTML for PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Sales Performance Report - Last ${days} Days</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 30px;
            background: white;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #8b5a2b;
            margin-bottom: 30px;
            padding-bottom: 20px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #8b5a2b;
            margin-bottom: 10px;
        }
        .report-title {
            font-size: 18px;
            color: #666;
            margin-bottom: 5px;
        }
        .report-meta {
            text-align: center;
            margin-top: 10px;
        }
        .report-date {
            font-size: 12px;
            color: #999;
            margin-bottom: 2px;
            display: block;
        }
        .report-user {
            font-size: 12px;
            color: #666;
            font-weight: 500;
            display: block;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            background: #f9f9f9;
        }
        .summary-value {
            font-size: 24px;
            font-weight: bold;
            color: #8b5a2b;
            margin-bottom: 5px;
        }
        .summary-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .section {
            margin-bottom: 30px;
        }
        .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #333;
            border-bottom: 2px solid #8b5a2b;
            padding-bottom: 5px;
            margin-bottom: 15px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 11px;
        }
        th, td {
            border: 1px solid #e0e0e0;
            padding: 8px 12px;
            text-align: left;
        }
        th {
            background: #f5f5f5;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 1px;
        }
        .page-break {
            page-break-before: always;
        }
        .performance-chart {
            margin: 20px 0;
            padding: 20px;
            background: #f9f9f9;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">Blessings Cafe</div>
        <div class="report-title">Sales Performance Report - Last ${days} Days</div>
        <div class="report-meta">
            <div class="report-date">Generated on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div class="report-user">Generated by: ${userData.fullname || userData.displayName || 'Unknown User'}</div>
        </div>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <div class="summary-value">₱${totalEarnings.toLocaleString()}</div>
            <div class="summary-label">Total Earnings</div>
        </div>
        <div class="summary-card">
            <div class="summary-value">₱${totalCosts.toLocaleString()}</div>
            <div class="summary-label">Total Costs</div>
        </div>
        <div class="summary-card">
            <div class="summary-value">₱${(totalEarnings - totalCosts).toLocaleString()}</div>
            <div class="summary-label">Net Profit</div>
        </div>
        <div class="summary-card">
            <div class="summary-value">${profitMargin.toFixed(1)}%</div>
            <div class="summary-label">Profit Margin</div>
        </div>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <div class="summary-value">${totalOrders}</div>
            <div class="summary-label">Total Orders</div>
        </div>
        <div class="summary-card">
            <div class="summary-value">${averageOrders.toFixed(1)}</div>
            <div class="summary-label">Avg Orders/Day</div>
        </div>
        <div class="summary-card">
            <div class="summary-value">₱${averageEarnings.toFixed(2)}</div>
            <div class="summary-label">Avg Earnings/Day</div>
        </div>
        <div class="summary-card">
            <div class="summary-value">${days}</div>
            <div class="summary-label">Days Analyzed</div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Daily Performance Breakdown</div>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Earnings</th>
                    <th>Costs</th>
                    <th>Profit</th>
                    <th>Orders</th>
                    <th>Avg Order Value</th>
                </tr>
            </thead>
            <tbody>
                ${performanceData.map(day => {
                    const profit = day.earnings - day.costs;
                    const avgOrderValue = day.orders > 0 ? day.earnings / day.orders : 0;
                    return `
                    <tr>
                        <td>${new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td>₱${day.earnings.toLocaleString()}</td>
                        <td>₱${day.costs.toLocaleString()}</td>
                        <td>₱${profit.toLocaleString()}</td>
                        <td>${day.orders}</td>
                        <td>₱${avgOrderValue.toFixed(2)}</td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    </div>

    <div class="section" style="border-top: 3px solid #8b5a2b; margin-top: 40px; padding-top: 20px;">
        <div style="background: #8b5a2b; color: white; padding: 20px; border-radius: 8px; text-align: center;">
            <h3 style="margin: 0 0 10px 0; font-size: 18px;">Performance Summary</h3>
            <div style="font-size: 32px; font-weight: bold; margin-bottom: 15px;">₱${(totalEarnings - totalCosts).toLocaleString()}</div>
            <div style="font-size: 14px; opacity: 0.9;">
                Net profit over the last ${days} days<br>
                Based on ${totalOrders} orders with ${profitMargin.toFixed(1)}% profit margin
            </div>
        </div>
    </div>
</body>
</html>`;

    const puppeteer = require('puppeteer');

    // Launch browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set content and wait for it to load
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });

    await browser.close();

    // Set headers and send PDF
    const filename = `Sales_Performance_Last_${days}_Days.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate performance PDF', details: error.message });
  }
});

// Upload files
router.post('/messages/api/upload', upload.array('files', 5), (req, res) => {
  try {
    const files = req.files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/messages/${file.filename}`
    }));

    res.json({ success: true, files });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

module.exports = router;
