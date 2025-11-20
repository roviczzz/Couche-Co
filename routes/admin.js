const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const { check, validationResult } = require('express-validator');

const SALT_ROUNDS = 12;

// Generate staff ID based on role and user ID
function generateStaffId(role, userId) {
  const rolePrefix = {
    'admin': 'ADM',
    'owner': 'OWN',
    'staff': 'BC',
    'user': 'USR'
  };

  const prefix = rolePrefix[role] || 'USR';

  // Generate a 5-digit number based on ObjectId hash for all roles
  const hash = userId.toString().split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  const idNumber = Math.abs(hash % 100000).toString().padStart(5, '0');
  return `${prefix}${idNumber}`;
}

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { createNewOrderNotification, createMessageNotification, createLowStockNotification } = require('../admin-helpers');


router.post("/toggle-availability/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { isEnabled } = req.body;

    console.log("Toggle request:", id, req.body);

    const enabledValue = isEnabled === true || isEnabled === "true";

    const result = await req.db.collection('Menu').updateOne(
      { _id: new ObjectId(id) },
      { $set: { isEnabled: enabledValue } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, isEnabled: enabledValue });
  } catch (err) {
    console.error("Toggle route error:", err);
    res.status(500).json({ success: false, message: "Server error" });
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
  res.redirect('/admin');
}

function ensureAdmin(req, res, next) {
  if (req.session.user?.role === 'admin' || req.session.user?.role === 'owner') {
    return next();
  }
  res.status(403).send('Access denied. Admins only.');
}

// Authentication middleware for order completion (staff, admin, owner)
function isAuthorizedForOrderCompletion(req, res, next) {
  if (req.session.user && ['staff', 'admin', 'owner'].includes(req.session.user.role)) {
    return next();
  }
  res.redirect('/admin/login');
}

function ensureOwner(req, res, next) {
  if (req.session.user?.role === 'owner') {
    return next();
  }
  res.status(403).send('Access denied. Owner only.');
}

// Generate staff ID based on role and user ID (copied from auth.js)
function generateStaffId(role, userId) {
  const rolePrefix = {
    'admin': 'ADM',
    'owner': 'OWN',
    'staff': 'BC',
    'user': 'USR'
  };

  const prefix = rolePrefix[role] || 'USR';

  // Generate a 5-digit number based on ObjectId hash for all roles
  const hash = userId.toString().split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  const idNumber = Math.abs(hash % 100000).toString().padStart(5, '0');
  return `${prefix}${idNumber}`;
}

// POST route for account creation (owner only)
router.post('/settings/create-account', ensureOwner, async (req, res) => {
  try {
    const { username, password, fullname, role, email, phone } = req.body;

    // Basic validation
    if (!username || !password || !role) {
      return res.status(400).json({ success: false, message: 'Username, password, and role are required.' });
    }

    if (!['admin', 'staff'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Must be admin or staff.' });
    }

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Check if username already exists
    const existingUser = await db.collection('users').findOne({ username: username.trim() });
    if (existingUser) {
      await client.close();
      return res.status(400).json({ success: false, message: 'Username already exists.' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user (simplified with only required fields)
    const newUser = {
      username: username.trim(),
      password: hashedPassword,
      fullname: username.trim(), // Use username as default fullname initially
      role: role,
      passwordUpgraded: new Date(),
      lastModified: new Date(),
      passwordChangedAt: new Date(),
      passwordChangedBy: username.trim(),
      upgradedBy: req.session.user.username,
      createdAt: new Date()
    };

    // Insert user
    const result = await db.collection('users').insertOne(newUser);

    // Generate staff ID and update the user
    const staffId = generateStaffId(role, result.insertedId);
    await db.collection('users').updateOne(
      { _id: result.insertedId },
      { $set: { staffId } }
    );

    await client.close();

    console.log(`✅ Created new ${role} account: ${username} (${staffId}) by owner: ${req.session.user.username}`);

    res.json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully.`,
      user: {
        username: newUser.username,
        fullname: newUser.fullname,
        role: newUser.role,
        staffId,
        email: newUser.email,
        phone: newUser.phone
      }
    });

  } catch (error) {
    console.error('Account creation error:', error);
    res.status(500).json({ success: false, message: 'Failed to create account. Please try again.' });
  }
});

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
    const stats = await getDashboardAnalyticsStats(req.db);
    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

router.get('/analytics/low-stock', nocache, async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 5; // Default to 5, can be 5-100

    // Using shared DB connection from req.db

    const ingredients = await req.db.collection('Ingredients').find({ Amount: { $lte: threshold }, isEnabled: true }).sort({ Amount: 1 }).toArray();
    const addons = await req.db.collection('Add-ons').find({ Amount: { $lte: threshold }, isEnabled: true }).sort({ Amount: 1 }).toArray();

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

router.get('/analytics/top-categories', nocache, async (req, res) => {
  try {
    // Using shared DB connection from req.db

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

    const categories = await req.db.collection('Orders').aggregate(pipeline).toArray();

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
    // Using shared DB connection from req.db

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
              if: { $in: ['$PaymentMode', ['E-PAYMENT', 'E-Payment', 'E_Payment']] },
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

    const paymentTypes = await req.db.collection('Orders').aggregate(pipeline).toArray();

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
    // Using shared DB connection from req.db

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

    const ordersBySource = await req.db.collection('Orders').aggregate(pipeline).toArray();

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
  if (req.session.user) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', {
    title: 'Staff & Admin Login',
    layout: false,
    errors: {},
    error: null,
    formData: {}
  });
});

// Admin login route
router.get('/login', (req, res) => {
  if (req.session.user) {
    let redirectPath;
    if (req.session.user.role === 'staff') {
      redirectPath = '/staff/dashboard';
    } else if (req.session.user.role === 'admin' || req.session.user.role === 'owner') {
      redirectPath = '/admin/dashboard';
    } else {
      redirectPath = '/admin/dashboard'; // Default
    }
    return res.redirect(redirectPath);
  }
  res.render('admin/login', {
    title: 'Staff & Admin Login',
    layout: false,
    errors: {},
    error: null,
    formData: {}
  });
});

// Unified login route for both admin and staff
router.post('/login',
  [
    check('Username').notEmpty().withMessage('Username is required'),
    check('Password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorsObj = {};
      errors.array().forEach(err => {
        errorsObj[err.param] = err;
      });
      return res.render('admin/login', {
        title: 'Staff & Admin Login',
        layout: false,
        errors: errorsObj,
        error: 'Please fix the errors below',
        formData: req.body
      });
    }

    const { Username, Password } = req.body;
    console.log(`📅 Login attempt at ${new Date().toISOString()} for user: ${Username}`);

    try {
      const users = req.db.collection('users');

      const user = await users.findOne({
        username: Username
      });

      if (!user) {
        console.log(`❌ Login failed for user: ${Username} - User not found`);
        return res.render('admin/login', {
          title: 'Staff & Admin Login',
          layout: false,
          errors: {},
          error: 'Invalid username or password',
          formData: { Username }
        });
      }

      let passwordMatch = false;

      if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
        passwordMatch = await bcrypt.compare(Password, user.password);
        console.log('🔐 Using bcrypt verification for hashed password');
      } else {
        if (Password === user.password) {
          passwordMatch = true;
          console.log('⚠️ Plain text password detected - upgrading to bcrypt');

          const hashedPassword = await bcrypt.hash(Password, SALT_ROUNDS);
          await users.updateOne(
            { _id: user._id },
            {
              $set: {
                password: hashedPassword,
                passwordUpgraded: new Date(),
                upgradedBy: 'auto-login'
              }
            }
          );
          console.log('✅ Password upgraded to bcrypt hash');
        }
      }

      if (!passwordMatch) {
        console.log(`❌ Login failed for user: ${Username} - Invalid password`);
        return res.render('admin/login', {
          title: 'Staff & Admin Login',
          layout: false,
          errors: {},
          error: 'Invalid username or password',
          formData: { Username }
        });
      }

      // Update last login time in database
      await users.updateOne(
        { _id: user._id },
        { $set: { lastLogin: new Date() } }
      );

      req.session.user = {
        _id: user._id,
        username: user.username,
        email: user.email,
        name: user.fullname || user.name,
        fullname: user.fullname,
        role: user.role || 'admin',
        staffId: user.staffId || generateStaffId(user.role, user._id),
        loginTime: new Date().toISOString()
      };

      console.log(`✅ Login successful for user: ${user.username} (ID: ${user._id}) at ${new Date().toISOString()}`);

      // Redirect based on role - staff goes to staff dashboard, admin and owner go to admin dashboard
      let redirectPath;
      if (user.role === 'staff') {
        redirectPath = '/staff/dashboard';
      } else if (user.role === 'admin' || user.role === 'owner') {
        redirectPath = '/admin/dashboard';
      } else {
        redirectPath = '/admin/dashboard'; // Default
      }

      res.redirect(redirectPath);

    } catch (err) {
      console.error('❌ Login error:', err);
      res.status(500).render('admin/login', {
        title: 'Staff & Admin Login',
        layout: false,
        errors: {},
        error: 'An error occurred during login',
        formData: { Username }
      });
    }
  }
);

// Admin Dashboard
router.get('/dashboard', nocache, async (req, res) => {
  try {
    // Fetch current user data from database to ensure fullname is up to date
    // Using shared DB connection from req.db
    const currentUser = await req.db.collection('users').findOne({ _id: new ObjectId(req.session.user._id) });

    // Merge session data with fresh database data
    const userData = {
      ...req.session.user,
      fullname: currentUser?.fullname
    };

    // Fetch all dashboard data server-side for better loading performance
    const [basicStats, analyticsStats, topCategories, paymentTypes, ordersBySource, salesPerformance] = await Promise.all([
      getDashboardStats(req.db),
      getDashboardAnalyticsStats(req.db),
      getTopCategories(req.db),
      getPaymentTypes(req.db),
      getOrdersBySource(req.db),
      getSalesPerformance(req.db, 14)
    ]);

    // Fetch low stock data for dashboard
    let lowStockData = { quantity: 0, name: 'All stocked', type: 'none', hasMore: false };
    try {
      // Get user's low stock threshold from settings
      // Using shared DB connection from req.db
      const userSettings = await req.db.collection('UserSettings').findOne({ userId: req.session.user._id });
      const threshold = userSettings?.lowStockAlertRange || 5;

      const ingredients = await req.db.collection('Ingredients').find({ Amount: { $lte: threshold }, isEnabled: true }).sort({ Amount: 1 }).toArray();
      const addons = await req.db.collection('Add-ons').find({ Amount: { $lte: threshold }, isEnabled: true }).sort({ Amount: 1 }).toArray();

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
    } catch (error) {
      console.error('Low stock data fetch error:', error);
    }

    // Combine all stats into a single object for template consistency
    const combinedStats = {
      ...basicStats,
      ...analyticsStats
    };

    const userSettingsThreshold = await req.db.collection('UserSettings').findOne({ userId: req.session.user._id });
    const userLowStockThreshold = userSettingsThreshold?.lowStockAlertRange || 5;

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: userData,
      currentPage: '/admin/dashboard',
      layout: 'admin/layout',
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
    const stats = await getDashboardAnalyticsStats(req.db);
    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

router.get('/analytics/top-categories', nocache, async (req, res) => {
  try {
    // Using shared DB connection from req.db

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

    const categories = await req.db.collection('Orders').aggregate(pipeline).toArray();

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
    const analyticsData = await getAnalyticsData(req.db);
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
    const products = await getProducts(req.db);
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

// --- Multer setup (disk storage for local image uploads) ---

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'products');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Add Product route
router.post('/products/add', upload.single('imagelink'), async (req, res) => {
  const {
    categoryShortcut,
    productCode,
    Name,
    size16,
    size22,
    Ingredients,
    AddOns,
    Quantity,
    Allergen,
    isEnabled,
    BasePrice,
    description   // ✅ must match the textarea name in the Add Product modal
  } = req.body;

  // Map shortcuts to full category names
  const categoryMap = { CF: "Coffee", MT: "Milktea", FT: "Fruit Tea", BK: "Pastries" };
  const Category = categoryMap[categoryShortcut] || categoryShortcut || null;

  // Validation
  if (!Category || !productCode || !Name) {
    req.flash('error_msg', 'Please select a category, enter a product code, and product name.');
    return res.redirect('/admin/products');
  }

  // Automatically append category name for Coffee, Milktea, and Fruit Tea
  let finalName = Name;
  if (Category === "Coffee" || Category === "Milktea" || Category === "Fruit Tea") {
    finalName = `${Name} ${Category}`;
  }

  const ProductID = `${categoryShortcut.toUpperCase()}-${productCode.toUpperCase()}`;

  // Sizes
  const Sizes = [];
  if (size16) Sizes.push({ Size: '16oz', BasePrice: parseFloat(size16) });
  if (size22) Sizes.push({ Size: '22oz', BasePrice: parseFloat(size22) });

  // Ingredients array - now expecting JSON string of objects with ingredientID and usedGrams
  let ingredientsArray = [];
  if (Ingredients) {
    try {
      ingredientsArray = JSON.parse(Ingredients);
      // Validate the structure
      if (!Array.isArray(ingredientsArray)) {
        ingredientsArray = [];
      } else {
      // Ensure each item has the required properties
      ingredientsArray = ingredientsArray.filter(item => {
        if (!item || typeof item !== 'object' || !item.ingredientID) return false;
        // usedGrams can be a number (for non-Milktea) or an object (for Milktea)
        const usedGrams = item.usedGrams;
        if (typeof usedGrams === 'number') return true; // non-Milktea
        if (typeof usedGrams === 'object' && usedGrams !== null &&
            typeof usedGrams['16oz'] === 'number' && typeof usedGrams['22oz'] === 'number') return true; // Milktea
        return false;
      });
      }
    } catch (err) {
      console.error('Error parsing ingredients JSON:', err);
      ingredientsArray = [];
    }
  }

  // AddOns array - expecting JSON string of objects with addOnID, name, usedGrams16oz, usedGrams22oz
  let addOnsArray = [];
  if (AddOns) {
    try {
      addOnsArray = JSON.parse(AddOns);
      // Validate the structure
      if (!Array.isArray(addOnsArray)) {
        addOnsArray = [];
      } else {
      // Ensure each item has the required properties
      addOnsArray = addOnsArray.filter(item => {
        if (!item || typeof item !== 'object' || !item.addOnID || !item.name) return false;
        // usedGrams16oz and usedGrams22oz must be numbers
        if (typeof item.usedGrams16oz !== 'number' || typeof item.usedGrams22oz !== 'number') return false;
        return true;
      });
      }
    } catch (err) {
      console.error('Error parsing addOns JSON:', err);
      addOnsArray = [];
    }
  }

  // Image handling - save locally
  let imagelink = 'placeholder';

  if (req.file) {
    const tempPath = req.file.path;
    const sanitizedName = finalName.replace(/[^a-zA-Z0-9]/g, '-');
    const newFilename = `${sanitizedName}-${Date.now()}${path.extname(req.file.originalname)}`;
    const newPath = path.join(uploadsDir, newFilename);
    fs.renameSync(tempPath, newPath);
    imagelink = `https://blessingsateverysip.me/uploads/products/${newFilename}`;
  }

  // ✅ Build the product document to insert
  const productData = {
    ProductID,
    Name: finalName,
    description: description || "",        // <-- lowercase key so it matches your textarea name
    Sizes: Sizes.length > 0 ? Sizes : null,
    Category,
    Allergen: Allergen || null,
    imagelink,
    isEnabled: isEnabled === 'true'
  };

  // Add AddOns if provided
  if (addOnsArray.length > 0) {
    productData.AddOns = addOnsArray;
  }

  // Handle ingredients vs quantity based on category
  if (Category.toLowerCase() === 'pastries') {
    // For pastries, save Quantity instead of Ingredients
    if (Quantity && !isNaN(parseInt(Quantity))) {
      productData.Quantity = parseInt(Quantity);
    }
    // Base price for pastries
    if (!isNaN(parseFloat(BasePrice))) {
      productData.BasePrice = parseFloat(BasePrice);
    }
  } else {
    // For other categories, save Ingredients
    productData.Ingredients = ingredientsArray;
  }

  try {
    // Using shared DB connection from req.db
    await req.db.collection('Menu').insertOne(productData);

    req.flash('success_msg', `${Name} has been added to the menu`);
    res.redirect('/admin/products');
  } catch (err) {
    console.error('Error adding product:', err);
    req.flash('error_msg', 'Failed to add product. Please try again.');
    res.redirect('/admin/products');
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

// Lightning-fast API endpoint with maximum optimizations
router.get('/api/products/:id', async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID' });
  }

  // Set optimal caching and compression headers for maximum performance
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate', // Prevent caching for dynamic data
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });

  try {
    // Use shared DB connection for maximum speed
    const product = await req.db.collection('Menu').findOne(
      { _id: new ObjectId(id) },
      {
        // Projection: only fetch fields needed for edit modal
        projection: {
          Name: 1,
          Category: 1,
          description: 1,
          Allergen: 1,
          isEnabled: 1,
          imagelink: 1,
          Sizes: 1,
          BasePrice: 1,
          Quantity: 1,
          Ingredients: 1,
          AddOns: 1
        }
      }
    );

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Strip domain from imagelink for local display
    if (product.imagelink && product.imagelink.startsWith('https://blessingsateverysip.me')) {
      product.imagelink = product.imagelink.replace('https://blessingsateverysip.me', '');
    }

    // Ultra-fast response with minimal processing
    res.json({
      success: true,
      product: {
        ...product,
        imagelink: product.imagelink || null
      }
    });

  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});




// ✅ Edit Product route (with local image upload)
router.post('/products/edit/:id', upload.single('imagelink'), async (req, res) => {
  const { id } = req.params;
  const { description, Allergen, size16, size22, BasePrice, Quantity } = req.body;



  try {
    // Using shared DB connection from req.db
    const collection = req.db.collection('Menu');

    // Fetch current product
    const existingProduct = await collection.findOne({ _id: new ObjectId(id) });
    if (!existingProduct) {
      req.flash('error_msg', 'Product not found');
      return res.redirect('/admin/products');
    }

    const updateFields = {};

    // Only update description if it was provided and is different
    if (description !== undefined && description !== existingProduct.description) {
      updateFields.description = description || "";
    }

    // Only update allergen if it was provided and is different
    if (Allergen !== undefined && Allergen !== existingProduct.Allergen) {
      updateFields.Allergen = Allergen || "";
    }

    // Update sizes/prices only if they were provided
    if (size16 !== undefined || size22 !== undefined) {
      const sizes = [];
      if (size16 !== undefined && size16 !== "") {
        const size16Price = parseFloat(size16);
        if (!isNaN(size16Price)) {
          sizes.push({ Size: '16oz', BasePrice: size16Price });
        }
      }
      if (size22 !== undefined && size22 !== "") {
        const size22Price = parseFloat(size22);
        if (!isNaN(size22Price)) {
          sizes.push({ Size: '22oz', BasePrice: size22Price });
        }
      }

      // Only update sizes if they actually changed
      const currentSizes = existingProduct.Sizes || [];
      const sizesChanged = JSON.stringify(sizes.sort((a, b) => a.Size.localeCompare(b.Size))) !==
                          JSON.stringify(currentSizes.sort((a, b) => a.Size.localeCompare(b.Size)));

      if (sizesChanged) {
        updateFields.Sizes = sizes.length > 0 ? sizes : null;
      }
    }

    // Update BasePrice only if it was provided and is different
    if (BasePrice !== undefined && BasePrice !== "") {
      const basePriceValue = parseFloat(BasePrice);
      const existingBasePrice = parseFloat(existingProduct.BasePrice) || 0;
      if (!isNaN(basePriceValue) && basePriceValue !== existingBasePrice) {
        updateFields.BasePrice = basePriceValue;
      }
    }

    // Update Quantity only if it was provided and is different
    if (Quantity !== undefined && Quantity !== "") {
      const quantityValue = parseInt(Quantity);
      const existingQuantity = parseInt(existingProduct.Quantity) || 0;
      if (!isNaN(quantityValue) && quantityValue !== existingQuantity) {
        updateFields.Quantity = quantityValue;
      }
    }

    // ✅ If new image uploaded
    if (req.file) {
      console.log("🖼 New image uploaded to disk");

      // Delete old local image if exists
      if (existingProduct.imagelink && existingProduct.imagelink !== 'placeholder' && existingProduct.imagelink.startsWith('/uploads/products/')) {
        try {
          const oldImagePath = path.join(__dirname, '..', 'public', existingProduct.imagelink);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
            console.log("🗑 Old local image deleted");
          }
        } catch (err) {
          console.error("Local image delete error:", err.message);
        }
      }

      // Rename new image with product name
      const tempPath = req.file.path;
      const sanitizedName = existingProduct.Name.replace(/[^a-zA-Z0-9]/g, '-');
      const newFilename = `${sanitizedName}-${Date.now()}${path.extname(req.file.originalname)}`;
      const newPath = path.join(uploadsDir, newFilename);
      fs.renameSync(tempPath, newPath);
      updateFields.imagelink = `https://blessingsateverysip.me/uploads/products/${newFilename}`;
    }

    // Only update if there are actual changes
    if (Object.keys(updateFields).length > 0) {
      await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields }
      );
      req.flash('success_msg', 'Product updated successfully');
    } else {
      req.flash('info_msg', 'No changes were made to the product');
    }
    res.redirect('/admin/products');
  } catch (err) {
    console.error('Error editing product:', err);
    req.flash('error_msg', 'Internal Server Error');
    res.redirect('/admin/products');
  }
});




// ✅ Edit Product – fetch and render edit page
router.get('/products/edit/:id', nocache, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId before querying
    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).render('error', {
        title: 'Invalid Request',
        message: 'Invalid product ID.',
        status: 400
      });
    }

    const product = await getProductById(req.db, id);
    if (!product) {
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'Product not found.',
        status: 404
      });
    }

    // Render edit page with fetched product data
    res.render('admin/edit-product', {
      title: 'Edit Product | Blessings Cafe',
      user: req.session.user,
      currentPage: '/admin/products',
      layout: 'admin/layout',
      product,
      // ✅ Match your add-product categories
      categories: ['Coffee', 'Milktea', 'Fruit Tea', 'Pastries']
    });

  } catch (error) {
    console.error('Edit product error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load product.',
      status: 500
    });
  }
});

// DELETE Product Route (AJAX-friendly)
// Delete Product route (JSON response)
router.post('/delete-product/:id', async (req, res) => {
  const productId = req.params.id;

  try {
    // Using shared DB connection from req.db
    const productCollection = req.db.collection('Menu');

    const product = await productCollection.findOne({ _id: new ObjectId(productId) });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Delete local image if exists
    if (product.imagelink && product.imagelink !== 'placeholder' && product.imagelink.startsWith('/uploads/products/')) {
      try {
        const imagePath = path.join(__dirname, '..', 'public', product.imagelink);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log("🗑 Local image deleted for product:", productId);
        }
      } catch (err) {
        console.error("Local image delete error:", err.message);
      }
    }

    await productCollection.deleteOne({ _id: new ObjectId(productId) });

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


// Orders Management

// POS Order Submission Route (for both admin and staff POS)
router.post('/orders/submit', ensureAdmin, async (req, res) => {
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

    // Using shared DB connection from req.db
    const ordersCollection = req.db.collection('Orders');

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
      console.log(`✅ POS Order submitted successfully: ${orderData.OrderID} by ${req.session.user?.fullname}`);

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
        await createNewOrderNotification(req.db, orderToInsert);
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
  } catch (error) {
    console.error('POS Order submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit order. Please try again.',
      error: error.message
    });
  }
});

router.get('/orders', nocache, async (req, res) => {
  try {
    const [orders, menu] = await Promise.all([
      getOrders(req.db),
      getMenu(req.db)
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
    // Using shared DB connection from req.db
    const ordersCollection = req.db.collection('Orders');
    const menuCollection = req.db.collection('Menu');
    const orders = await ordersCollection.find().toArray();
    const menu = await menuCollection.find().toArray();

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
    const order = await getOrderById(req.db, req.params.id);
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
    // Fetch current user data from database to ensure fullname is up to date
    // Using shared DB connection from req.db
    const currentUser = await req.db.collection('users').findOne({ _id: new ObjectId(req.session.user._id) });
    
    // Fetch menu items, addons, ingredients, and active promos
    const [menuItems, addons, ingredients, activePromos] = await Promise.all([
      getMenu(req.db),
      req.db.collection('Add-ons').find({ isEnabled: true }).toArray(),
      req.db.collection('Ingredients').find({ isEnabled: true }).toArray(),
      getActiveDiscounts(req.db)
    ]);

    // Merge session data with fresh database data
    const userData = {
      ...req.session.user,
      fullname: currentUser?.fullname
    };

    res.render('admin/menu', {
      title: 'Menu Management | Blessings Cafe',
      user: userData,
      currentPage: '/admin/menu',
      layout: 'admin/layout',
      menuItems,
      addons,
      ingredients,
      activePromos
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
    // Using shared DB connection from req.db
    const ingredients = await req.db.collection('Ingredients').find().toArray();
    const addons = await req.db.collection('Add-ons').find().toArray();
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
    const discounts = await getDiscounts(req.db);
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

// Test endpoint for promo tracking (accessible via /admin/test-promo-tracking)
router.get('/test-promo-tracking', async (req, res) => {
  try {
    const { generatePeriodicNotifications } = require('../admin-helpers');
    console.log('🧪 Manual promo tracking test initiated...');
    
    const notifications = await generatePeriodicNotifications(req.db);
    
    res.json({
      success: true,
      message: 'Promo tracking test completed successfully',
      notificationsGenerated: notifications.length,
      notifications: notifications.map(notif => ({
        type: notif.type || 'unknown',
        title: notif.title || 'No title',
        message: notif.message || 'No message',
        priority: notif.priority || 'normal',
        createdAt: notif.createdAt || new Date()
      }))
    });
  } catch (error) {
    console.error('Error in promo tracking test:', error);
    res.status(500).json({
      success: false,
      error: 'Promo tracking test failed',
      details: error.message
    });
  }
});

// Messages page
router.get('/messages', nocache, async (req, res) => {
  try {
    // Using shared DB connection from req.db
    const currentUserId = req.session.user._id;

    // Get all users for messaging (admins and staff only) - include current user for sender display
    const users = await req.db.collection('users').find({
      role: { $in: ['admin', 'owner', 'staff'] }
    }).project({
      _id: 1,
      fullname: 1,
      staffId: 1,
      role: 1
    }).toArray();

    // Get conversations for current user (server-side)
    const messages = await req.db.collection('messages')
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
      const participants = await req.db.collection('users')
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


// Configure multer for file uploads
const messageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/messages/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const messageUpload = multer({
  storage: messageStorage,
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
    // Using shared DB connection from req.db
    const currentUserId = req.session.user._id;

    // Find all unique conversation partners
    const messages = await req.db.collection('messages')
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
      const participants = await req.db.collection('users')
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

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages for a conversation
router.get('/messages/api/messages/:conversationId', async (req, res) => {
  try {
    // Using shared DB connection from req.db
    const currentUserId = req.session.user._id;
    const conversationId = req.params.conversationId;

    // Parse conversation ID to get participant IDs
    const [user1, user2] = conversationId.split('_');
    const participantId = user1 === currentUserId ? user2 : user1;

    // Get messages between current user and participant
    const messages = await req.db.collection('messages')
      .find({
        $or: [
          { senderId: currentUserId, recipientId: participantId },
          { senderId: participantId, recipientId: currentUserId }
        ]
      })
      .sort({ timestamp: 1 })
      .toArray();

    // Mark messages as read
    await req.db.collection('messages').updateMany(
      {
        senderId: participantId,
        recipientId: currentUserId,
        read: false
      },
      { $set: { read: true, readAt: new Date() } }
    );
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

    // Using shared DB connection from req.db

    // Verify recipient exists and is admin/staff
    const recipient = await req.db.collection('users').findOne({
      _id: new ObjectId(recipientId),
      role: { $in: ['admin', 'owner', 'staff'] }
    });

    if (!recipient) {
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

    const result = await req.db.collection('messages').insertOne(message);

    // Create notification for new message
    try {
      await createMessageNotification(req.db, {
        _id: result.insertedId,
        senderName: req.session.user?.fullname || 'Unknown',
        subject: subject || 'New Message'
      }, 'admin');
    } catch (notifError) {
      console.error('Failed to create message notification:', notifError);
      // Don't fail the message sending if notification fails
    }

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
    // Using shared DB connection from req.db

    const users = await req.db.collection('users').find({
      role: { $in: ['admin', 'owner', 'staff'] },
      _id: { $ne: new ObjectId(req.session.user._id) } // Exclude current user
    }).toArray();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get unread message count for current user
router.get('/messages/api/unread-count', async (req, res) => {
  try {
    // Using shared DB connection from req.db
    const currentUserId = req.session.user._id;

    const unreadCount = await req.db.collection('messages').countDocuments({
      recipientId: currentUserId,
      read: false
    });
    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Upload files
router.post('/messages/api/upload', messageUpload.array('files', 5), (req, res) => {
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
    // Using shared DB connection from req.db
    const user = await req.db.collection('users').findOne({ _id: new ObjectId(req.session.user._id) });

    // Load user settings from UserSettings collection
    let userSettings = await req.db.collection('UserSettings').findOne({ userId: req.session.user._id });
    if (!userSettings) {
      userSettings = {
        soundEnabled: true,
        printReceipts: false,
        darkMode: false,
        orderConfirmations: true,
        lowStockAlertRange: 5
      };
    }

    res.render('admin/settings', {
      title: 'Settings | Blessings Cafe',
      user: user,
      settings: userSettings,
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

    // Using shared DB connection from req.db

    await req.db.collection('users').updateOne(
      { _id: new ObjectId(req.session.user._id) },
      { $set: { fullname: displayName, email, phone } }
    );

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

// API route to save user preferences
router.post('/settings/preferences', async (req, res) => {
  try {
    console.log('Received preferences update:', req.body);

    const { soundEnabled, printReceipts, darkMode, orderConfirmations, lowStockAlertRange } = req.body;

    // If only lowStockAlertRange is provided (from modal), we need to fetch existing settings and merge
    let updateFields = {
      updatedAt: new Date()
    };

    // Using shared DB connection from req.db

    // Fetch existing settings to preserve other values
    const existingSettings = await req.db.collection('UserSettings').findOne({ userId: req.session.user._id });

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
    await req.db.collection('UserSettings').updateOne(
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
    console.log('Updated lowStockAlertRange to:', updateFields.lowStockAlertRange);
    res.json({ success: true, message: 'Preferences updated successfully', lowStockAlertRange: updateFields.lowStockAlertRange });
  } catch (error) {
    console.error('Preferences update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update preferences' });
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

    const user = await req.db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await req.db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { password: hashedPassword } }
    );
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

    const users = await req.db.collection('users').find({}).toArray();
    let updatedCount = 0;

    for (const user of users) {
      if (user.password.startsWith('$2b$')) continue;

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(user.password, salt);

      await req.db.collection('users').updateOne(
          { _id: user._id },
          { $set: { password: hashedPassword } }
      );

      updatedCount++;
    }
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
    // Check if this is an add-on by looking for addon-specific fields
    const isAddon = req.body.AddOnID || req.body.AddOnPrefix || req.body.AddOnSuffix || req.body.BasePrice;

    // Using shared DB connection from req.db

    if (isAddon) {
      // Handle Add-On with correct field formatting

      // Check for existing add-on with same ID and Name combination
      const existingAddon = await req.db.collection('Add-ons').findOne({
        AddOnID: req.body.AddOnID,
        Name: req.body.Name.trim()
      });

      if (existingAddon) {
        return res.redirect('/admin/stocks?msg=duplicate_id_name');
      }

      const addOnData = {
        AddOnID: req.body.AddOnID,
        AddOnPrefix: req.body.AddOnPrefix || 'AD',
        AddOnSuffix: req.body.AddOnSuffix,
        Name: req.body.Name,
        AmountPerPack: req.body.AmountPerPack,
        Amount: parseInt(req.body.Amount),
        Unit: req.body.Unit,
        Category: req.body.Category || 'Add-Ons',
        Allergen: req.body.Allergen || 'None',
        BasePrice: parseFloat(req.body.BasePrice) || 10,
        isEnabled: req.body.isEnabled === 'true' || req.body.isEnabled === true || req.body.isEnabled === 'on',
        DeductionQuantityGrams: parseInt(req.body.DeductionQuantityGrams) || 10,
        lastModified: new Date()
      };

      await req.db.collection('Add-ons').insertOne(addOnData);
      console.log('✅ Added new add-on:', addOnData.AddOnID, 'with AmountPerPack:', addOnData.AmountPerPack, 'BasePrice:', addOnData.BasePrice);
    } else {
      // Handle Ingredient with correct field formatting
      const ingredientData = {
        IngredientID: req.body.IngredientID,
        IngredientPrefix: req.body.IngredientPrefix || 'ING',
        IngredientSuffix: req.body.IngredientSuffix,
        Name: req.body.Name,
        AmountPerPack: req.body.AmountPerPack,
        Amount: parseInt(req.body.Amount),
        Unit: req.body.Unit,
        Category: req.body.Category || 'Ingredients',
        Allergen: req.body.Allergen || 'None',
        isEnabled: req.body.isEnabled === 'true' || req.body.isEnabled === true || req.body.isEnabled === 'on',
        isAvailable: req.body.isAvailable === 'true' || req.body.isAvailable === true,
        DeductionQuantityGrams: parseInt(req.body.DeductionQuantityGrams) || 10,
        createdAt: new Date(),
        lastModified: new Date()
      };

      // Check for existing ingredient with same ID and Name combination
      if (ingredientData.IngredientID && ingredientData.Name) {
        const existingIngredient = await req.db.collection('Ingredients').findOne({
          IngredientID: ingredientData.IngredientID,
          Name: ingredientData.Name.trim()
        });

        if (existingIngredient) {
          throw new Error('DUPLICATE_ID_NAME');
        }
      }

      await req.db.collection('Ingredients').insertOne(ingredientData);
      console.log('✅ Added new ingredient:', ingredientData.IngredientID, 'with AmountPerPack:', ingredientData.AmountPerPack);
    }

    res.redirect('/admin/stocks?msg=add_success');
  } catch (err) {
    console.error('Add item error:', err);

    // Handle specific duplicate data error
    if (err.message === 'DUPLICATE_DATA') {
      return res.redirect('/admin/stocks?msg=duplicate_data');
    }

    if (err.message === 'DUPLICATE_ID_NAME') {
      return res.redirect('/admin/stocks?msg=duplicate_id_name');
    }

    res.status(500).send('Failed to add item');
  }
});

router.post('/stocks/edit/:id', async (req, res) => {
  try {
    await updateIngredient(req.db, req.params.id, req.body);
    
    // Check for low stock after update and trigger notification if needed
    try {
      const stockData = await getStockData(req.db);
      await createLowStockNotification(req.db, stockData, req.session.user || {});
    } catch (notifError) {
      console.error('Failed to create stock notification after update:', notifError);
    }
    
    // Check if request is AJAX
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      res.json({ success: true, message: 'Item updated successfully' });
    } else {
      res.redirect('/admin/stocks?msg=update_success');
    }
  } catch (err) {
    console.error('Update item error:', err);
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      res.status(500).json({ success: false, error: 'Failed to update item' });
    } else {
      res.status(500).send('Failed to update item');
    }
  }
});

router.post('/stocks/delete/:id', async (req, res) => {
  try {
    await deleteIngredient(req.db, req.params.id);
    
    // Check if request is AJAX
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      res.json({ success: true, message: 'Item deleted successfully' });
    } else {
      res.redirect('/admin/stocks?msg=delete_success');
    }
  } catch (err) {
    console.error('Delete item error:', err);
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      res.status(500).json({ success: false, error: 'Failed to delete item' });
    } else {
      res.status(500).send('Failed to delete item');
    }
  }
});
router.post('/stocks/bulk-update', async (req, res) => {
  try {
    const modified = await bulkUpdateIngredients(req.db, req.body.updates);
    
    // Check for low stock after bulk update and trigger notification if needed
    try {
      const stockData = await getStockData(req.db);
      await createLowStockNotification(req.db, stockData, req.session.user || {});
    } catch (notifError) {
      console.error('Failed to create stock notification after bulk update:', notifError);
    }
    
    res.json({ success: true, modified });
  } catch (err) {
    res.status(500).json({ error: 'Failed to perform bulk update' });
  }
});
router.get('/stocks/export', async (req, res) => {
  try {
    const data = await exportIngredientsAndAddons(req.db);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export inventory data' });
  }
});
router.get('/stocks/search', async (req, res) => {
  try {
    const { query, category, enabled } = req.query;
    const data = await searchIngredientsAddons(req.db, query, category, enabled);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to search inventory' });
  }
});
router.get('/stocks/stats', async (req, res) => {
  try {
    const stats = await getIngredientStats(req.db);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate inventory statistics' });
  }
});
router.get('/stocks/alerts', async (req, res) => {
  try {
    const { threshold, urgent } = req.query;
    const alerts = await getLowStockAlerts(req.db, Number(threshold) || 10, Number(urgent) || 5);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate low stock alerts' });
  }
});
router.get('/stocks/categories', async (req, res) => {
  try {
    const categories = await getIngredientCategories(req.db);
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve categories' });
  }
});
router.get('/stocks/health', async (req, res) => {
  try {
    const health = await getStockHealth(req.db);
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: 'Failed to check stock health' });
  }
});
// ORDERS ROUTES
router.patch('/orders/:OrderID/fulfillment', async (req, res) => {
  try {
    const updatedOrder = await updateOrderFulfillment(req.db, req.params.OrderID, req.body.FulfillmentStatus);
    
    // Notify chatbot if this is a chatbot order
    if (updatedOrder && updatedOrder.Source === 'Chatbot') {
      try {
        const { notifyOrderStatusChange } = require('../utils/chatbotNotifier');
        const notificationResult = await notifyOrderStatusChange(updatedOrder, req.body.FulfillmentStatus);
        
        if (notificationResult.success) {
          console.log(`🔔 Chatbot notification sent for order ${req.params.OrderID} - Status: ${req.body.FulfillmentStatus}`);
        } else if (!notificationResult.skipped) {
          console.warn(`⚠️ Chatbot notification failed for order ${req.params.OrderID}:`, notificationResult.message);
        }
      } catch (notifyError) {
        console.error('❌ Error sending chatbot notification:', notifyError);
        // Don't fail the request if notification fails
      }
    }
    
    res.json({ success: true, order: updatedOrder });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update fulfillment status' });
  }
});
router.patch('/orders/:OrderID/payment-status', async (req, res) => {
  try {
    const updatedOrder = await updateOrderPaymentStatus(req.db, req.params.OrderID, req.body.PaymentStatus);
    res.json({ success: true, order: updatedOrder });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

// Update FulfillmentMethod (Delivery/Pick-Up)
router.patch('/orders/:OrderID/fulfillment-method', async (req, res) => {
  try {
    const { OrderID } = req.params;
    const { FulfillmentMethod } = req.body;
    
    // Validate FulfillmentMethod
    if (!['Delivery', 'Pick-Up'].includes(FulfillmentMethod)) {
      return res.status(400).json({ error: 'Invalid FulfillmentMethod. Must be "Delivery" or "Pick-Up"' });
    }
    
    // Using shared DB connection from req.db
    const ordersCollection = req.db.collection('Orders');
    
    const result = await ordersCollection.updateOne(
      { OrderID },
      { $set: { 
        FulfillmentMethod,
        DeliveryStatus: FulfillmentMethod,
        deliveryStatus: FulfillmentMethod
      } }
    );
    
    // Get updated order for notification
    const updatedOrder = await ordersCollection.findOne({ OrderID });
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Notify chatbot if this is a chatbot order
    if (updatedOrder && updatedOrder.Source === 'Chatbot') {
      try {
        const { notifyOrderStatusChange } = require('../utils/chatbotNotifier');
        const notificationResult = await notifyOrderStatusChange(updatedOrder, 'Method Changed');
        
        if (notificationResult.success) {
          console.log(`🔔 Chatbot notification sent for order ${OrderID} - FulfillmentMethod changed to ${FulfillmentMethod}`);
        } else if (!notificationResult.skipped) {
          console.warn(`⚠️ Chatbot notification failed for order ${OrderID}:`, notificationResult.message);
        }
      } catch (notifyError) {
        console.error('❌ Error sending chatbot notification:', notifyError);
        // Don't fail the request if notification fails
      }
    }
    
    res.json({ success: true, order: updatedOrder });
  } catch (err) {
    console.error('Error updating fulfillment method:', err);
    res.status(500).json({ error: 'Failed to update fulfillment method' });
  }
});

router.patch('/orders/:OrderID/cancel', async (req, res) => {
  try {
    const success = await cancelOrder(req.db, req.params.OrderID);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});
router.patch('/orders/:OrderID/restore', async (req, res) => {
  try {
    const updatedOrder = await restoreOrder(req.db, req.params.OrderID);
    res.json({ success: true, order: updatedOrder });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore order' });
  }
});
// ANALYTICS ROUTES
router.get('/analytics/popular-products', async (req, res) => {
  try {
    const results = await getPopularProducts(req.db);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch popular products' });
  }
});
router.get('/analytics/average-sales-per-day', async (req, res) => {
  try {
    const results = await getAverageSalesPerDay(req.db);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch average sales per day' });
  }
});
router.get('/analytics/sales-performance', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 14;
    const results = await getSalesPerformance(req.db, days);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales performance data' });
  }
});

router.get('/analytics/export-performance', async (req, res) => {
  try {
    const userData = req.session.user;
    const days = parseInt(req.query.days) || 14;

    // Get performance data
    const performanceData = await getSalesPerformance(req.db, days);

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
            grid-template-columns: repeat(6, 1fr);
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
// DISCOUNTS ROUTES
router.post('/discounts/add', async (req, res) => {
  try {
    await addDiscount(req.db, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add discount' });
  }
});
router.post('/discounts/edit/:id', async (req, res) => {
  try {
    await updateDiscount(req.db, req.params.id, req.body);
    
    // Trigger immediate promo tracking check for this specific promo
    try {
      const { triggerBusinessEventNotification } = require('../admin-helpers');
      await triggerBusinessEventNotification(req.db, 'promo-update-check', {
        promoId: req.params.id,
        updatedData: req.body
      });
      console.log(`🔔 Triggered promo update check for discount ID: ${req.params.id}`);
    } catch (notifError) {
      console.error('Error triggering promo update notification:', notifError);
      // Don't fail the main update if notification fails
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update discount' });
  }
});
router.post('/discounts/delete/:id', async (req, res) => {
  try {
    await deleteDiscount(req.db, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete discount' });
  }
});
router.post('/discounts/bulk-update', async (req, res) => {
  try {
    const modified = await bulkUpdateDiscounts(req.db, req.body.updates);
    res.json({ success: true, modified });
  } catch (err) {
    res.status(500).json({ error: 'Failed to perform bulk update' });
  }
});
router.get('/discounts/stats', async (req, res) => {
  try {
    const stats = await getDiscountStats(req.db);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get discount stats' });
  }
});
router.get('/discounts/active', async (req, res) => {
  try {
    const discounts = await getActiveDiscounts(req.db);
    res.json(discounts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get active discounts' });
  }
});
router.get('/discounts/:id', async (req, res) => {
  try {
    const discount = await getDiscountById(req.db, req.params.id);
    res.json(discount);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get discount' });
  }
});

// Route: Order History (last 30 days)
let db;

async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db("blessingscafe");
  }
  return db;
}

router.get('/analytics/order-history', async (req, res) => {
  try {
    const days = req.query.days;

    let orders = [];

    if (days && days !== "all" && !isNaN(parseInt(days))) {
      const numDays = parseInt(days);
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - numDays);

      // Format as "YYYY-MM-DD" string to match DB format
      const cutoff = fromDate.toISOString().split('T')[0];

      orders = await req.db.collection("Orders").aggregate([
        {
          $match: {
            Date: { $gte: cutoff }
          }
        },
        {
          $project: {
            OrderID: 1,
            Customer: '$Customer.fullname',
            Date: {
              $dateToString: {
                format: '%Y-%m-%d %H:%M',
                date: {
                  $switch: {
                    branches: [
                      { case: { $regexMatch: { input: '$Date', regex: '\\d{4}-\\d{2}-\\d{2}T' } }, then: { $dateFromString: { dateString: '$Date' } } },
                      { case: { $regexMatch: { input: '$Date', regex: '\\d{4}-\\d{2}-\\d{2} \\d{2}' } }, then: { $dateFromString: { dateString: '$Date', format: '%Y-%m-%d %H:%M:%S' } } }
                    ],
                    default: '$Date'
                  }
                }
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

      console.log(`Orders fetched: ${orders.length} (filtered by ${days} days), cutoff=${cutoff}`);
    } else {
      orders = await req.db.collection("Orders").aggregate([
        {
          $match: {}
        },
        {
          $project: {
            OrderID: 1,
            Customer: '$Customer.fullname',
            Date: {
              $dateToString: {
                format: '%Y-%m-%d %H:%M',
                date: {
                  $switch: {
                    branches: [
                      { case: { $regexMatch: { input: '$Date', regex: '\\d{4}-\\d{2}-\\d{2}T' } }, then: { $dateFromString: { dateString: '$Date' } } },
                      { case: { $regexMatch: { input: '$Date', regex: '\\d{4}-\\d{2}-\\d{2} \\d{2}' } }, then: { $dateFromString: { dateString: '$Date', format: '%Y-%m-%d %H:%M:%S' } } }
                    ],
                    default: '$Date'
                  }
                }
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

      console.log(`Orders fetched: ${orders.length} (no filter)`);
    }

    res.setHeader("Cache-Control", "no-store");
    res.json(orders);

  } catch (err) {
    console.error("Order history fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch order history" });
  }
});



router.get("/products", async (req, res) => {
  const products = await Product.find(); // returns 18
  res.render("products", { products });  // ✅ pass to EJS
});

router.get("/analytics/sales-report-pdf", async (req, res) => {
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
    // Using shared DB connection from req.db

    // Create date strings for comparison (same format as order-history route)
    const cutoffStart = startDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    const cutoffEnd = endDate.toISOString().split('T')[0];

    // Query orders within date range (like the working order-history route)
    const orders = await req.db.collection('Orders').find({
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

    // Calculate delivery statistics (case-insensitive and robust)
    const totalDeliveryOrders = orders.filter(order => {
      const method = order.FulfillmentMethod;
      return method && (method.toLowerCase() === 'delivery' || method === 'Delivery');
    }).length;
    const totalDeliveryRevenue = totalDeliveryOrders * 20;

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
    const currentMenu = await req.db.collection('Menu').find({ isEnabled: true }).toArray();
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
        <div class="summary-card">
            <div class="summary-value">${totalDeliveryOrders.toLocaleString()}</div>
            <div class="summary-label">Delivery Orders</div>
        </div>
        <div class="summary-card">
            <div class="summary-value">₱${totalDeliveryRevenue.toLocaleString()}</div>
            <div class="summary-label">Delivery Revenue</div>
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

// Admin endpoint to complete order (for QR code)
router.get('/complete-order', isAuthorizedForOrderCompletion, async (req, res) => {
  try {
    const { orderId, secret } = req.query;
    if (!orderId || !secret) {
      return res.status(400).render('error', {
        title: 'Invalid Request',
        message: 'Missing order ID or secret.',
        status: 400
      });
    }

    // Verify secret
    const expectedSecret = process.env.ORDER_COMPLETION_SECRET;
    if (secret !== expectedSecret) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        message: 'Invalid secret.',
        status: 403
      });
    }

    // Fetch order details
    const order = await req.db.collection('Orders').findOne({ OrderID: orderId });
    if (!order) {
      return res.status(404).render('error', {
        title: 'Order Not Found',
        message: 'Order not found.',
        status: 404
      });
    }

    res.render('admin/complete-order', {
      title: 'Complete Order | Blessings Cafe',
      user: req.session.user,
      order: order,
      orderId: orderId,
      secret: secret
    });
  } catch (error) {
    console.error('Complete order page error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load order completion page',
      status: 500
    });
  }
});

router.post('/complete-order', isAuthorizedForOrderCompletion, async (req, res) => {
  try {
    const { orderId, secret } = req.body; // From QR URL params
    if (!orderId || !secret) {
      return res.status(400).json({ success: false, error: 'Missing orderId or secret' });
    }

    // Verify secret (e.g., compare to a hash or stored value)
    const expectedSecret = process.env.ORDER_COMPLETION_SECRET; // Set in .env
    if (secret !== expectedSecret) {
      return res.status(403).json({ success: false, error: 'Invalid secret' });
    }

    // Update to Completed
    const order = await req.db.collection('Orders').findOneAndUpdate(
      { OrderID: orderId },
      { $set: { FulfillmentStatus: 'Completed' } },
      { returnDocument: 'after' }
    );
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Optional: Send webhook to N8N for notification (if needed)
    // await axios.post('https://your-n8n-instance.com/webhook/order-completed', { orderId });

    res.json({ success: true, message: 'Order marked as completed', data: { orderId } });
  } catch (error) {
    console.error('Complete order error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
