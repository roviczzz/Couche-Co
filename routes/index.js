const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

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
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const menuCollection = db.collection('Menu');

    // Always fetch fresh menu items for real-time availability checking
    const allItems = await menuCollection.find().toArray();
    await client.close();

    // Filter available items in real-time
    const InventoryManager = require('../utils/inventoryManager');
    const availableItems = [];

    for (const item of allItems) {
      try {
        const availabilityCheck = await InventoryManager.checkProductAvailability(item.ProductID);
        if (availabilityCheck.available) {
          availableItems.push(item);
        }
      } catch (error) {
        console.error(`Error checking availability for ${item.ProductID}:`, error);
        // Include item if availability check fails (fail-safe)
        availableItems.push(item);
      }
    }

    // Categorize available items
    const categorizedItems = {};
    availableItems.forEach(item => {
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
  res.redirect('/auth/login');
});

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
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const menuCollection = db.collection('Menu');
    let menuItems = await menuCollection.find().toArray();
    await client.close();

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
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const menuCollection = db.collection('Menu');

    const product = await menuCollection.findOne({
      $or: [
        { ProductID: id },
        { _id: ObjectId.isValid(id) ? new ObjectId(id) : null }
      ]
    });

    if (!product) {
      await client.close();
      return res.status(404).send('Product not found');
    }

    // Check cache for add-ons and ingredients
    const now = Date.now();
    if (!cachedAddons || !cachedIngredients || (now - cacheTimestamp) > CACHE_DURATION) {
      [cachedAddons, cachedIngredients] = await Promise.all([
        db.collection('Add-ons').find({ isEnabled: true }).toArray(),
        db.collection('Ingredients').find({ isEnabled: true }).toArray()
      ]);
      cacheTimestamp = now;
    } else {
    }

    await client.close();

    res.render('product', {
      product,
      addons: cachedAddons,
      ingredients: cachedIngredients,
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
  const client = await MongoClient.connect(uri);
  const db = client.db('blessingscafe');
  const ordersCollection = db.collection('Orders');

  try {
    const order = await ordersCollection.findOne({ OrderID: orderId });
    await client.close();

    if (!order) {
      return res.status(404).render('error', {
        title: 'Order Not Found',
        message: 'Could not find order details.',
        status: 404
      });
    }

    // Generate QR code for order completion
    const QRCode = require('qrcode');
    const qrUrl = `${process.env.BASE_URL || 'http://localhost:8080'}/staff/complete-order/${orderId}`;
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
    await client.close();
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
      const client = await MongoClient.connect(uri);
      const db = client.db('blessingscafe');
      const cartDoc = await db.collection('UserCart').findOne({ userId: new ObjectId(req.session.user._id) });
      orderItems = (cartDoc && cartDoc.cart) ? cartDoc.cart : [];
      await client.close();
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
    const products = await db.collection('Menu').find().toArray();

    res.render('products', {
      title: 'Products | Blessings Cafe',
      user: req.session.user,
      products
    });

    await client.close();
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
