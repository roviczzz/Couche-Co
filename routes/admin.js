const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

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
  getMenu
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
  if (req.session.user?.role === 'admin') {
    return next();
  }
  res.status(403).send('Access denied. Admins only.');
}

// Admin login route (BEFORE middleware that requires authentication)
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', {
    title: 'Admin Login | Blessings Cafe',
    layout: false
  });
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

// Apply admin check to all OTHER routes (not login/forgot-password)
router.use(['/dashboard', '/analytics', '/products', '/orders', '/stocks', '/discounts', '/menu', '/settings'], isLoggedIn);
router.use(['/dashboard', '/analytics', '/products', '/orders', '/stocks', '/discounts', '/menu', '/settings'], ensureAdmin);

// Admin redirect route
router.get('/', (req, res) => {
  res.redirect('/admin/dashboard');
});

// Admin Dashboard
router.get('/dashboard', nocache, async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: req.session.user,
      ...stats
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

// Analytics
router.get('/analytics', nocache, async (req, res) => {
  try {
    const analyticsData = await getAnalyticsData();
    res.render('admin/analytics', {
      title: 'Analytics | Blessings Cafe',
      user: req.session.user,
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
    res.render('admin/orders', {
      title: 'Orders | Blessings Cafe',
      user: req.session.user,
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
    res.render('admin/discounts', {
      title: 'Discounts | Blessings Cafe',
      user: req.session.user,
      discounts
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

// Menu Management
router.get('/menu', nocache, async (req, res) => {
  try {
    const menuItems = await getMenu();
    res.render('admin/menu', {
      title: 'Menu Management | Blessings Cafe',
      user: req.session.user,
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

// Settings
router.get('/settings', nocache, (req, res) => {
  res.render('admin/settings', {
    title: 'Settings | Blessings Cafe',
    user: req.session.user
  });
});


// Change Password
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
    
    const user = await db.collection('Users').findOne({ _id: new ObjectId(userId) });
    
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

    await db.collection('Users').updateOne(
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
    
    const users = await db.collection('Users').find({}).toArray();
    let updatedCount = 0;

    for (const user of users) {
      if (user.password.startsWith('$2b$')) continue;
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(user.password, salt);
      
      await db.collection('Users').updateOne(
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

module.exports = router;
