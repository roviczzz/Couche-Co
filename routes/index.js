const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');

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


// Helper functions
function isLoggedIn(req, res, next) {
  if (req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
}

function nocache(req, res, next) {
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  next();
}

// Home page
router.get('/', async (req, res) => {
  try {
    // Using shared DB connection from req.db
    const menuCollection = req.db.collection('Menu');

    // Always fetch fresh menu items for real-time availability checking
    const allItems = await menuCollection.find().toArray();

    // Check availability for all items
    const InventoryManager = require('../utils/inventoryManager');
    const itemsWithAvailability = [];

    for (const item of allItems) {
      try {
        const availabilityCheck = await InventoryManager.checkProductAvailability(item.ProductID);
        item.isAvailable = availabilityCheck.available;
        itemsWithAvailability.push(item);
      } catch (error) {
        console.error(`Error checking availability for ${item.ProductID}:`, error);
        // Mark as available if check fails (fail-safe)
        item.isAvailable = true;
        itemsWithAvailability.push(item);
      }
    }

    // Strip domain from imagelinks for local display
    itemsWithAvailability.forEach(item => {
      if (item.imagelink && item.imagelink.startsWith('https://blessingsateverysip.me')) {
        item.imagelink = item.imagelink.replace('https://blessingsateverysip.me', '');
      }
    });

    // Categorize all items (both available and unavailable)
    const categorizedItems = {};
    itemsWithAvailability.forEach(item => {
      const category = item.Category || 'Others';
      if (!categorizedItems[category]) {
        categorizedItems[category] = [];
      }
      categorizedItems[category].push(item);
    });

    // Define category order
    const categoryOrder = ['Coffee', 'Milktea', 'Fruit Tea', 'Pastries'];

    if (req.session.user) {
      if (req.session.user.role === 'admin') {
        return res.redirect('/admin/dashboard');
      }
      return res.render('home', {
        title: 'Home | Blessings Cafe',
        user: req.session.user,
        categorizedItems: categorizedItems,
        categoryOrder: categoryOrder
      });
    }
    return res.render('home', {
      title: 'Home | Blessings Cafe',
      user: null,
      categorizedItems: categorizedItems,
      categoryOrder: categoryOrder
    });
  } catch (err) {
    console.error('Home page error:', err);
    res.render('home', {
      title: 'Home | Blessings Cafe',
      user: null,
      featuredItems: [],
      layout: 'layout'
    });
  }
});

// About page
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'About Us | Blessings Cafe',
    user: req.session?.user || null
  });
});

// Contact page
router.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Contact Us | Blessings Cafe',
    user: req.session?.user || null
  });
});

// Privacy Policy page
router.get('/privacy-policy', (req, res) => {
  res.render('privacy', {
    title: 'Privacy Policy | Blessings Cafe',
    user: req.session?.user || null
  });
});

// Legacy login route redirect
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'admin' ? '/admin/dashboard' : '/');
  }

  try {
    res.render('login', {
      title: 'Login | Blessings Cafe',
      layout: false,
      errors: {},
      error: null,
      formData: {}
    });
  } catch (error) {
    console.error('Error rendering login page:', error);
    res.status(500).send('Error loading login page');
  }
});

// Login form submission
router.post('/login',
  [
    check('email').isEmail().withMessage('Please enter a valid email address'),
    check('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('login', {
        title: 'Login | Blessings Cafe',
        layout: false,
        errors: errors.mapped(),
        error: 'Please fix the errors below',
        formData: req.body
      });
    }

    try {
      const user = await req.db.collection('users').findOne({ email: req.body.email });

      if (!user) {
        return res.render('login', {
          title: 'Login | Blessings Cafe',
          layout: false,
          errors: {},
          error: 'Invalid email or password',
          formData: req.body
        });
      }

      const validPassword = await bcrypt.compare(req.body.password, user.password);
      if (!validPassword) {
        return res.render('login', {
          title: 'Login | Blessings Cafe',
          layout: false,
          errors: {},
          error: 'Invalid email or password',
          formData: req.body
        });
      }

      // Update last login time in database
      await req.db.collection('users').updateOne(
        { _id: user._id },
        { $set: { lastLogin: new Date() } }
      );

      // Set user session
      req.session.user = {
        _id: user._id,
        email: user.email,
        name: user.fullname || user.name,
        fullname: user.fullname,
        role: user.role || 'user',
        staffId: user.staffId || generateStaffId(user.role, user._id),
        username: user.username
      };

      // Redirect based on role
      const redirectPath = user.role === 'admin' ? '/admin/dashboard' : '/';
      res.redirect(redirectPath);

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).render('login', {
        title: 'Login | Blessings Cafe',
        layout: false,
        errors: {},
        error: 'An error occurred during login',
        formData: req.body
      });
    }
  }
);

// Register route redirect
router.get('/register', (req, res) => {
  res.redirect('/auth/register');
});

// Forgot password route redirect
router.get('/forgot-password', (req, res) => {
  res.redirect('/auth/forgot-password');
});

// Dashboard route
router.get('/dashboard', isLoggedIn, nocache, (req, res) => {
  if (req.session.user && req.session.user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  }
  res.render('home', { title: 'Dashboard | Blessings Cafe', user: req.session.user, layout: false });
});

// Menu route (public for guests)
router.get('/menu', async (req, res) => {
  try {
    // Using shared DB connection from req.db
    const menuCollection = req.db.collection('Menu');
    let menuItems = await menuCollection.find().toArray();

    // Filter by search query if provided
    const searchQuery = req.query.search;
    if (searchQuery) {
      menuItems = menuItems.filter(item =>
        item.Name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    res.render('menu', {
      menuItems,
      title: 'Menu | Blessings Cafe',
      user: req.session?.user || null
    });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});

// Simple cache for add-ons and ingredients
let cachedAddons = null;
let cachedIngredients = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for menu items
let cachedMenuItems = null;
let menuCacheTimestamp = 0;

// Product page
router.get('/product/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ObjectId } = require('mongodb');
    // Using shared DB connection from req.db
    const menuCollection = req.db.collection('Menu');

    const product = await menuCollection.findOne({
      $or: [
        { ProductID: id },
        { _id: ObjectId.isValid(id) ? new ObjectId(id) : null }
      ]
    });

    if (!product) {
      return res.status(404).send('Product not found');
    }

    // Check product availability
    const InventoryManager = require('../utils/inventoryManager');
    let isAvailable = true;
    try {
      const availabilityCheck = await InventoryManager.checkProductAvailability(product.ProductID);
      isAvailable = availabilityCheck.available;
    } catch (error) {
      console.error(`Error checking availability for ${product.ProductID}:`, error);
    }

    // Check cache for add-ons and ingredients
    const now = Date.now();
    if (!cachedAddons || !cachedIngredients || (now - cacheTimestamp) > CACHE_DURATION) {
      [cachedAddons, cachedIngredients] = await Promise.all([
        req.db.collection('Add-ons').find({ isEnabled: true }).toArray(),
        req.db.collection('Ingredients').find({ isEnabled: true }).toArray()
      ]);
      cacheTimestamp = now;
    }

    // Fetch recommended add-ons/ingredients for this category
    const categoryRec = await req.db.collection('CategoryRecommendations').findOne({ 
      category: product.Category 
    });
    
    let displayAddons = cachedAddons;
    let recommendedItems = [];
    let remainingAddons = [];
    let remainingIngredients = [];
    
    if (categoryRec && categoryRec.recommendations && categoryRec.recommendations.length > 0) {
      const recommendedIds = new Set();
      
      // Map recommendations to actual items with prices
      recommendedItems = categoryRec.recommendations.map(rec => {
        if (rec.type === 'addon') {
          const addon = cachedAddons.find(a => a.AddOnID === rec.id);
          if (addon) {
            recommendedIds.add(rec.id);
            return addon;
          }
        } else if (rec.type === 'ingredient') {
          const ingredient = cachedIngredients.find(i => i.IngredientID === rec.id);
          if (ingredient) {
            recommendedIds.add(rec.id);
            return { ...ingredient, AddOnID: ingredient.IngredientID, Name: ingredient.Name, BasePrice: ingredient.BasePrice || 15 };
          }
        }
        return null;
      }).filter(item => item !== null);
      
      // Calculate remaining add-ons (not in recommendations)
      remainingAddons = cachedAddons
        .filter(addon => !recommendedIds.has(addon.AddOnID))
        .sort((a, b) => a.Name.localeCompare(b.Name));
      
      // Calculate remaining ingredients (not in recommendations)
      remainingIngredients = cachedIngredients
        .filter(ing => !recommendedIds.has(ing.IngredientID))
        .sort((a, b) => a.Name.localeCompare(b.Name));
      
      // Main section shows recommended items only
      if (recommendedItems.length > 0) {
        displayAddons = recommendedItems;
      }
    } else {
      // If no recommendations, all add-ons and ingredients go to modal
      remainingAddons = cachedAddons.sort((a, b) => a.Name.localeCompare(b.Name));
      remainingIngredients = cachedIngredients.sort((a, b) => a.Name.localeCompare(b.Name));
    }

    res.render('product', {
      isAvailable,
      product,
      addons: displayAddons,
      ingredients: cachedIngredients,
      recommendedItems,
      remainingAddons,
      remainingIngredients,
      title: `${product.Name} | Blessings Cafe`,
      user: req.session?.user || null,
      extraCSS: '/css/product.css'
    });
  } catch (err) {
    console.error('Product page error:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Cart page
router.get('/cart', (req, res) => {
  res.render('cart', {
    title: 'Cart | Blessings Cafe',
    user: req.session?.user || null,
    orderItems: req.session.cart || []
  });
});

// Order success page
router.get('/order/success', async (req, res) => {
  const { orderId } = req.query;
  // Using shared DB connection from req.db
  const ordersCollection = req.db.collection('Orders');

  try {
    const order = await ordersCollection.findOne({ OrderID: orderId });

    if (!order) {
      return res.status(404).render('error', {
        title: 'Order Not Found',
        message: 'Could not find order details.',
        status: 404
      });
    }

    // Generate QR code for order completion
    const QRCode = require('qrcode');
    const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
    const secret = process.env.ORDER_COMPLETION_SECRET || 'default-secret-change-in-env';
    const qrUrl = `${baseUrl}/admin/complete-order?orderId=${orderId}&secret=${secret}`;
    let qrCodeDataUrl = '';

    try {
      qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 150,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (qrError) {
      console.error('QR Code generation error:', qrError);
      qrCodeDataUrl = '';
    }

    res.render('order-success', {
      title: 'Order Success | Blessings Cafe',
      user: req.session?.user || null,
      order: order,
      orderId: orderId || 'Unknown',
      qrCodeDataUrl: qrCodeDataUrl,
      qrUrl: qrUrl
    });
  } catch (err) {
    console.error('Order success page error:', err);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load order details',
      status: 500
    });
  }
});

// Order failure page
router.get('/order/failure', (req, res) => {
  const { orderId } = req.query;
  res.render('order-failure', {
    title: 'Order Failed | Blessings Cafe',
    user: req.session?.user || null,
    orderId: orderId || 'Unknown'
  });
});

// Checkout routes
// POST /checkout - for guests to submit cart data
router.post('/checkout', (req, res) => {
  req.session.guestOrderItems = req.body.orderItems;
  res.redirect('/checkout');
});

// GET /checkout - unprotected, renders checkout page
router.get('/checkout', nocache, async (req, res) => {
  let orderItems = [];
  if (req.session.user) {
    // Load from database for logged-in users
    try {
      // Using shared DB connection from req.db
      const cartDoc = await req.db.collection('UserCart').findOne({ userId: new ObjectId(req.session.user._id) });
      orderItems = (cartDoc && cartDoc.cart) ? cartDoc.cart : [];
    } catch (err) {
      console.error('Error loading user cart:', err);
    }
  } else {
    // For guests, use session data
    orderItems = req.session.guestOrderItems || [];
  }
  res.render('checkout', {
    title: 'Checkout | Blessings Cafe',
    user: req.session.user || null,
    orderItems: orderItems
  });
});

// Products route
router.get('/products', isLoggedIn, nocache, async (req, res) => {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('blessingscafe');
    const products = await req.db.collection('Menu').find().toArray();

    res.render('products', {
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

module.exports = router;
