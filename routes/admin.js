const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

// Direct toggle availability endpoint
router.post('/toggle-availability/:id', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Get product ID and new availability status
    const productId = req.params.id;
    const { isEnabled } = req.body;

    // Update the product
    const result = await db.collection('Menu').updateOne(
      { _id: new ObjectId(productId) },
      { $set: { isEnabled: isEnabled } }
    );

    await client.close();

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product availability updated successfully' });
  } catch (error) {
    console.error('Toggle availability error:', error);
    res.status(500).json({ success: false, message: 'Failed to update product availability' });
  }
});

// Import helper functions
const {
  getDashboardStats,
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
  getDashboardAnalyticsStats,
  getTopCategories,
  getPaymentTypes,
  getOrdersBySource,
  addDiscount,
  updateDiscount,
  deleteDiscount,
  bulkUpdateDiscounts,
  getDiscountStats,
  getActiveDiscounts,
  getDiscountById
} = require('../admin-helpers');

// Helper middleware
function nocache(req, res, next) {
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.header('Pragma', 'no-cache');
  next();
}

function isLoggedIn(req, res, next) {
  if (req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
}

function ensureAdmin(req, res, next) {
  if (req.session.user?.role === 'admin' || req.session.user?.role === 'owner') {
    return next();
  }
  res.status(403).send('Access denied. Admins only.');
}

// Forgot Password (also before auth middleware)
router.get('/forgot-password', (req, res) => {
  if (req.session.user) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/forgot-password', {
    title: 'Forgot Password | Blessings Cafe',
    layout: false
  });
});

// Analytics Endpoints (before auth middleware)
router.get('/analytics/dashboard-stats', nocache, async (req, res) => {
  try {
    const stats = await getDashboardAnalyticsStats();
    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

router.get('/analytics/low-stock', nocache, async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 5; // Default to 5, can be 5-100

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const ingredients = await db.collection('Ingredients').find({ Quantity: { $lte: threshold }, isEnabled: true }).sort({ Quantity: 1 }).toArray();
    const addons = await db.collection('Add-ons').find({ Quantity: { $lte: threshold }, isEnabled: true }).sort({ Quantity: 1 }).toArray();

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
        quantity: item.Quantity,
        name: getItemName(item, 'ingredient'),
        type: 'ingredient'
      })),
      ...addons.map(item => ({
        quantity: item.Quantity,
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

router.get('/analytics/top-categories', nocache, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const pipeline = [
      { $unwind: '$Cart' },
      {
        $match: {
          PaymentStatus: { $ne: 'Cancelled' },
          'Cart.Category': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$Cart.Category',
          total: { $sum: { $multiply: ['$Cart.Price', '$Cart.Quantity'] } },
          quantity: { $sum: '$Cart.Quantity' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 8 }
    ];

    const categories = await db.collection('Orders').aggregate(pipeline).toArray();
    await client.close();

    res.json(categories.map(cat => ({
      name: cat._id,
      value: cat.total,
      quantity: cat.quantity,
      orderCount: cat.orderCount
    })));
  } catch (error) {
    console.error('Top categories error:', error);
    res.status(500).json({ error: 'Failed to load top categories' });
  }
});

router.get('/analytics/payment-types', nocache, async (req, res) => {
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

    res.json(paymentTypes.map(pt => ({
      name: pt._id,
      orderCount: pt.orderCount
    })));
  } catch (error) {
    console.error('Payment types error:', error);
    res.status(500).json({ error: 'Failed to load payment types' });
  }
});

router.get('/analytics/orders-by-source', nocache, async (req, res) => {
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

    res.json(ordersBySource.map(source => ({
      name: source._id,
      orderCount: source.orderCount,
      totalRevenue: source.totalRevenue
    })));
  } catch (error) {
    console.error('Orders by source error:', error);
    res.status(500).json({ error: 'Failed to load orders by source' });
  }
});



// Apply admin check to all OTHER routes (not login/forgot-password)
router.use(['/dashboard', '/products', '/orders', '/stocks', '/discounts', '/menu', '/settings', '/order', '/messages'], isLoggedIn);
router.use(['/dashboard', '/products', '/orders', '/stocks', '/discounts', '/menu', '/settings', '/order', '/messages'], ensureAdmin);

// Admin redirect route
router.get('/', (req, res) => {
  res.redirect('/admin/dashboard');
});

// Admin Dashboard
router.get('/dashboard', nocache, async (req, res) => {
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
    const [stats, analyticsStats, topCategories, paymentTypes, ordersBySource, salesPerformance] = await Promise.all([
      getDashboardStats(),
      getDashboardAnalyticsStats(),
      getTopCategories(),
      getPaymentTypes(),
      getOrdersBySource(),
      getSalesPerformance(14)
    ]);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: userData,
      currentPage: '/admin/dashboard',
      layout: 'admin/layout',
      ...stats,
      analyticsStats,
      topCategories,
      paymentTypes,
      ordersBySource,
      salesPerformance
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load dashboard',
      status: 500
    });
  }
});

// Analytics Endpoints
router.get('/analytics/dashboard-stats', nocache, async (req, res) => {
  try {
    const stats = await getDashboardAnalyticsStats();
    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

router.get('/analytics/top-categories', nocache, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    
    const pipeline = [
      { $unwind: '$Cart' },
      { 
        $match: { 
          PaymentStatus: { $ne: 'Cancelled' },
          'Cart.Category': { $exists: true, $ne: null }
        } 
      },
      {
        $group: {
          _id: '$Cart.Category',
          total: { $sum: { $multiply: ['$Cart.Price', '$Cart.Quantity'] } },
          quantity: { $sum: '$Cart.Quantity' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 8 }
    ];

    const categories = await db.collection('Orders').aggregate(pipeline).toArray();
    await client.close();
    
    res.json(categories.map(cat => ({
      name: cat._id,
      value: cat.total,
      quantity: cat.quantity,
      orderCount: cat.orderCount
    })));
  } catch (error) {
    console.error('Top categories error:', error);
    res.status(500).json({ error: 'Failed to load top categories' });
  }
});

// Analytics Page
router.get('/analytics', nocache, async (req, res) => {
  try {
    const analyticsData = await getAnalyticsData();
    res.render('admin/analytics', {
      title: 'Analytics | Blessings Cafe',
      user: req.session.user,
      currentPage: '/admin/analytics',
      layout: 'admin/layout',
      analytics: analyticsData
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load analytics',
      status: 500
    });
  }
});

// Products Management
router.get('/products', nocache, async (req, res) => {
  try {
    const products = await getProducts();
    res.render('admin/products', {
      title: 'Products | Blessings Cafe',
      user: req.session.user,
      currentPage: '/admin/products',
      layout: 'admin/layout',
      products
    });
  } catch (error) {
    console.error('Products error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load products',
      status: 500
    });
  }
});

// Add Product
router.get('/products/add', nocache, (req, res) => {
  res.render('admin/add-product', {
    title: 'Add Product | Blessings Cafe',
    user: req.session.user,
    currentPage: '/admin/products',
    layout: 'admin/layout',
    categories: ['Coffee', 'Tea', 'Pastry', 'Meal']
  });
});

// Edit Product
router.get('/products/edit/:id', nocache, async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    if (!product) {
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'Product not found',
        status: 404
      });
    }
    res.render('admin/edit-product', {
      title: 'Edit Product | Blessings Cafe',
      user: req.session.user,
      currentPage: '/admin/products',
      layout: 'admin/layout',
      product,
      categories: ['Coffee', 'Tea', 'Pastry', 'Meal']
    });
  } catch (error) {
    console.error('Edit product error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load product',
      status: 500
    });
  }
});

// Orders Management
router.get('/orders', nocache, async (req, res) => {
  try {
    const [orders, menu] = await Promise.all([
      getOrders(),
      getMenu()
    ]);
    res.render('admin/order', {
      title: 'Orders | Blessings Cafe',
      user: req.session.user,
      currentPage: '/admin/orders',
      layout: 'admin/layout',
      orders,
      menu
    });
  } catch (error) {
    console.error('Orders error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load orders',
      status: 500
    });
  }
});

// POS Orders Management
router.get('/order', nocache, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');
    const menuCollection = db.collection('Menu');
    const orders = await ordersCollection.find().toArray();
    const menu = await menuCollection.find().toArray();
    await client.close();

    res.render('admin/order', {
      orders,
      menu,
      title: 'POS Orders | Blessings Cafe',
      user: req.session.user,
      currentPage: '/admin/orders',
      layout: 'admin/layout'
    });
  } catch (err) {
    console.error('POS Orders error:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Edit Order
router.get('/orders/edit/:id', nocache, async (req, res) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order) {
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'Order not found',
        status: 404
      });
    }
    res.render('admin/edit-order', {
      title: 'Edit Order | Blessings Cafe',
      user: req.session.user,
      currentPage: '/admin/orders',
      layout: 'admin/layout',
      order
    });
  } catch (error) {
    console.error('Edit order error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load order',
      status: 500
    });
  }
});

// Menu Management
router.get('/menu', nocache, async (req, res) => {
  try {
    const menuItems = await getMenu();
    res.render('admin/menu', {
      title: 'Menu Management | Blessings Cafe',
      user: req.session.user,
      currentPage: '/admin/menu',
      layout: 'admin/layout',
      menuItems
    });
  } catch (error) {
    console.error('Menu error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load menu',
      status: 500
    });
  }
});

// Stocks Management
router.get('/stocks', nocache, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ingredients = await db.collection('Ingredients').find().toArray();
    const addons = await db.collection('Add-ons').find().toArray();
    const message = req.query.msg || null;

    res.render('admin/stocks', {
      ingredients,
      addons,
      title: 'Inventory Management | Blessings Cafe',
      user: req.session.user,
      currentPage: '/admin/stocks',
      message,
      uiConfig: {
        fixedNavbar: true,
        contentOnlyScroll: true,
        enhancedModals: true,
        version: 'V13-Enhanced'
      },
      stats: {
        totalIngredients: ingredients.length,
        totalAddons: addons.length,
        enabledIngredients: ingredients.filter(i => i.isEnabled).length,
        enabledAddons: addons.filter(a => a.isEnabled).length
      },
      layout: 'admin/layout'
    });

    await client.close();
  } catch (error) {
    console.error('Stocks error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load stock data',
      status: 500
    });
  }
});

// Discounts Management
router.get('/discounts', nocache, async (req, res) => {
  try {
    const discounts = await getDiscounts();
    const message = req.query.msg || null;
    const success_msg = req.query.success_msg || null;
    const error_msg = req.query.error_msg || null;

    const now = new Date();
    const activePromos = discounts.filter(promo => {
      if (!promo.startDate || !promo.endDate) return false;
      const startDate = new Date(promo.startDate);
      const endDate = new Date(promo.endDate);
      return now >= new Date(startDate.toISOString().split('T')[0] + 'T00:00:00') &&
          now <= new Date(endDate.toISOString().split('T')[0] + 'T23:59:59') &&
          promo.isActive !== false;
    });

    const upcomingPromos = discounts.filter(promo => {
      if (!promo.startDate) return false;
      const startDate = new Date(promo.startDate);
      return now < new Date(startDate.toISOString().split('T')[0] + 'T00:00:00') && promo.isActive !== false;
    });

    const expiredPromos = discounts.filter(promo => {
      if (!promo.endDate) return false;
      const endDate = new Date(promo.endDate);
      return now > new Date(endDate.toISOString().split('T')[0] + 'T23:59:59');
    });

    const expiringSoonPromos = activePromos.filter(promo => {
      if (!promo.endDate) return false;
      const endDate = new Date(promo.endDate);
      const daysRemaining = Math.ceil((new Date(endDate.toISOString().split('T')[0] + 'T23:59:59') - now) / (1000 * 60 * 60 * 24));
      return daysRemaining <= 7 && daysRemaining >= 0;
    });

    const todayActivePromos = activePromos.filter(promo => {
      if (!promo.startDate || !promo.endDate) return false;
      const today = new Date().toISOString().split('T')[0];
      const startDate = new Date(promo.startDate).toISOString().split('T')[0];
      const endDate = new Date(promo.endDate).toISOString().split('T')[0];
      return today >= startDate && today <= endDate;
    });

    const highDiscountPromos = activePromos.filter(promo => promo.discountPercentage && promo.discountPercentage >= 20);
    const newPromos = discounts.filter(promo => {
      if (!promo.createdAt) return false;
      const createdAt = new Date(promo.createdAt);
      const daysSinceCreated = (now - createdAt) / (1000 * 60 * 60 * 24);
      return daysSinceCreated <= 7;
    });

    res.render('admin/discounts', {
      discounts: discounts || [],
      activePromos: activePromos || [],
      upcomingPromos: upcomingPromos || [],
      expiredPromos: expiredPromos || [],
      expiringSoonPromos: expiringSoonPromos || [],
      todayActivePromos: todayActivePromos || [],
      highDiscountPromos: highDiscountPromos || [],
      newPromos: newPromos || [],
      promoStats: {
        total: discounts.length,
        active: activePromos.length,
        upcoming: upcomingPromos.length,
        expired: expiredPromos.length,
        expiringSoon: expiringSoonPromos.length,
        todayActive: todayActivePromos.length,
        highDiscount: highDiscountPromos.length,
        new: newPromos.length
      },
      title: 'Promo Management | Blessings Cafe',
      user: req.session.user,
      message,
      currentPage: '/admin/discounts',
      currentDate: now.toISOString(),
      layout: 'admin/layout'
    });
  } catch (error) {
    console.error('Discounts error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load discounts',
      status: 500
    });
  }
});

// Messages page
router.get('/messages', nocache, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const currentUserId = req.session.user._id;

    // Get all users for messaging (admins and staff only) - include current user for sender display
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

    res.render('admin/messages', {
      title: 'Messages | Blessings Cafe',
      user: req.session.user,
      currentPage: '/admin/messages',
      layout: 'admin/layout',
      users,
      conversations
    });
  } catch (error) {
    console.error('Messages error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load messages',
      status: 500
    });
  }
});

// API Routes for messaging
const multer = require('multer');
const path = require('path');

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

    // Verify recipient exists and is admin/staff
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

// Admin settings page
router.get('/settings', nocache, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.session.user._id) });
    await client.close();

    res.render('admin/settings', {
      title: 'Settings | Blessings Cafe',
      user: user,
      currentPage: '/admin/settings',
      layout: 'admin/layout'
    });
  } catch (error) {
    console.error('Admin Settings error:', error);
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
      { $set: { fullname: displayName, email, phone } }
    );

    await client.close();

    res.redirect('/admin/settings');
  } catch (error) {
    console.error('Admin Settings update error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to update settings',
      status: 500
    });
  }
});

// Password change route
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user._id;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New passwords do not match' });
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('blessingscafe');

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user) {
      await client.close();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      await client.close();
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { password: hashedPassword } }
    );

    await client.close();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Failed to update password' });
  }
});

// Migrate Passwords (One-time use)
router.post('/migrate-passwords', async (req, res) => {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('blessingscafe');

    const users = await db.collection('users').find({}).toArray();
    let updatedCount = 0;

    for (const user of users) {
      if (user.password.startsWith('$2b$')) continue;

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(user.password, salt);

      await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { password: hashedPassword } }
      );

      updatedCount++;
    }

    await client.close();
    res.json({
      success: true,
      message: `Successfully migrated ${updatedCount} user passwords`
    });
  } catch (error) {
    console.error('Password migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to migrate passwords'
    });
  }
});

// STOCKS ROUTES
router.post('/stocks', async (req, res) => {
  try {
    await addIngredient(req.body);
    res.redirect('/admin/stocks?msg=add_success');
  } catch (err) {
    res.status(500).send('Failed to add ingredient');
  }
});
router.post('/stocks/edit/:id', async (req, res) => {
  try {
    await updateIngredient(req.params.id, req.body);
    res.redirect('/admin/stocks?msg=update_success');
  } catch (err) {
    res.status(500).send('Failed to update ingredient');
  }
});
router.post('/stocks/delete/:id', async (req, res) => {
  try {
    await deleteIngredient(req.params.id);
    res.redirect('/admin/stocks?msg=delete_success');
  } catch (err) {
    res.status(500).send('Failed to delete ingredient');
  }
});
router.post('/stocks/bulk-update', async (req, res) => {
  try {
    const modified = await bulkUpdateIngredients(req.body.updates);
    res.json({ success: true, modified });
  } catch (err) {
    res.status(500).json({ error: 'Failed to perform bulk update' });
  }
});
router.get('/stocks/export', async (req, res) => {
  try {
    const data = await exportIngredientsAndAddons();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export inventory data' });
  }
});
router.get('/stocks/search', async (req, res) => {
  try {
    const { query, category, enabled } = req.query;
    const data = await searchIngredientsAddons(query, category, enabled);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to search inventory' });
  }
});
router.get('/stocks/stats', async (req, res) => {
  try {
    const stats = await getIngredientStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate inventory statistics' });
  }
});
router.get('/stocks/alerts', async (req, res) => {
  try {
    const { threshold, urgent } = req.query;
    const alerts = await getLowStockAlerts(Number(threshold) || 10, Number(urgent) || 5);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate low stock alerts' });
  }
});
router.get('/stocks/categories', async (req, res) => {
  try {
    const categories = await getIngredientCategories();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve categories' });
  }
});
router.get('/stocks/health', async (req, res) => {
  try {
    const health = await getStockHealth();
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: 'Failed to check stock health' });
  }
});
// ORDERS ROUTES
router.patch('/orders/:OrderID/fulfillment', async (req, res) => {
  try {
    const updatedOrder = await updateOrderFulfillment(req.params.OrderID, req.body.FulfillmentStatus);
    res.json({ success: true, order: updatedOrder });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update fulfillment status' });
  }
});
router.patch('/orders/:OrderID/payment-status', async (req, res) => {
  try {
    const updatedOrder = await updateOrderPaymentStatus(req.params.OrderID, req.body.PaymentStatus);
    res.json({ success: true, order: updatedOrder });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});
router.patch('/orders/:OrderID/cancel', async (req, res) => {
  try {
    const success = await cancelOrder(req.params.OrderID);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});
router.patch('/orders/:OrderID/restore', async (req, res) => {
  try {
    const updatedOrder = await restoreOrder(req.params.OrderID);
    res.json({ success: true, order: updatedOrder });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore order' });
  }
});
// ANALYTICS ROUTES
router.get('/analytics/popular-products', async (req, res) => {
  try {
    const results = await getPopularProducts();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch popular products' });
  }
});
router.get('/analytics/average-sales-per-day', async (req, res) => {
  try {
    const results = await getAverageSalesPerDay();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch average sales per day' });
  }
});
router.get('/analytics/sales-performance', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 14;
    const results = await getSalesPerformance(days);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales performance data' });
  }
});
// DISCOUNTS ROUTES
router.post('/discounts/add', async (req, res) => {
  try {
    await addDiscount(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add discount' });
  }
});
router.post('/discounts/edit/:id', async (req, res) => {
  try {
    await updateDiscount(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update discount' });
  }
});
router.post('/discounts/delete/:id', async (req, res) => {
  try {
    await deleteDiscount(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete discount' });
  }
});
router.post('/discounts/bulk-update', async (req, res) => {
  try {
    const modified = await bulkUpdateDiscounts(req.body.updates);
    res.json({ success: true, modified });
  } catch (err) {
    res.status(500).json({ error: 'Failed to perform bulk update' });
  }
});
router.get('/discounts/stats', async (req, res) => {
  try {
    const stats = await getDiscountStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get discount stats' });
  }
});
router.get('/discounts/active', async (req, res) => {
  try {
    const discounts = await getActiveDiscounts();
    res.json(discounts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get active discounts' });
  }
});
router.get('/discounts/:id', async (req, res) => {
  try {
    const discount = await getDiscountById(req.params.id);
    res.json(discount);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get discount' });
  }
});
// PRODUCTS ROUTES
router.post('/toggle-availability/:id', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Get product ID and new availability status
    const productId = req.params.id;
    const { isEnabled } = req.body;

    // Update the product
    const result = await db.collection('Menu').updateOne(
      { _id: new ObjectId(productId) },
      { $set: { isEnabled: isEnabled } }
    );

    await client.close();

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product availability updated successfully' });
  } catch (error) {
    console.error('Toggle availability error:', error);
    res.status(500).json({ success: false, message: 'Failed to update product availability' });
  }
});


module.exports = router;
