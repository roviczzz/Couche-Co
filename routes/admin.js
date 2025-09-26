const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const multer = require('multer');
let productCollection;

// Connect once and reuse
(async () => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db("blessingscafe");
    productCollection = db.collection("Menu");
    console.log("✅ Connected to MongoDB (Menu collection ready)");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
})();


router.post("/toggle-availability/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { isEnabled } = req.body;

    console.log("Toggle request:", id, req.body);

    const enabledValue = isEnabled === true || isEnabled === "true";

    const result = await productCollection.updateOne(
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

// Apply admin check to all OTHER routes (not login/forgot-password)
router.use(['/dashboard', '/products', '/orders', '/stocks', '/discounts', '/menu', '/settings', '/order'], isLoggedIn);
router.use(['/dashboard', '/products', '/orders', '/stocks', '/discounts', '/menu', '/settings', '/order'], ensureAdmin);

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
      currentPage: '/admin/dashboard',
      layout: 'admin/layout',
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

// --- Multer setup ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
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

  const ProductID = `${categoryShortcut.toUpperCase()}-${productCode.toUpperCase()}`;

  // Sizes
  const Sizes = [];
  if (size16) Sizes.push({ Size: '16oz', BasePrice: parseFloat(size16) });
  if (size22) Sizes.push({ Size: '22oz', BasePrice: parseFloat(size22) });

  // Ingredients array
  const ingredientsArray = Ingredients ? Ingredients.split(',').map(i => i.trim()) : [];

  // Image handling
  let imagelink = req.file ? `/uploads/${req.file.filename}` : 'placeholder';
  let imgbbUrl = null;
  let deleteUrl = null;

  if (req.file) {
    try {
      const fileData = fs.readFileSync(req.file.path, { encoding: "base64" });
      const imgbbKey = process.env.IMGBB_API_KEY;

      if (imgbbKey) {
        const response = await axios.post(
          `https://api.imgbb.com/1/upload?key=${imgbbKey}`,
          new URLSearchParams({ image: fileData })
        );
        imgbbUrl = response.data.data.url;
        deleteUrl = response.data.data.delete_url;
      }
    } catch (err) {
      console.error("ImgBB upload failed:", err.message);
    }
  }

  // ✅ Build the product document to insert
  const productData = {
    ProductID,
    Name,
    description: description || "",        // <-- lowercase key so it matches your textarea name
    Sizes: Sizes.length > 0 ? Sizes : null,
    Ingredients: ingredientsArray,
    Category,
    Allergen: Allergen || null,
    imagelink,
    imgbbUrl,
    deleteUrl,
    isEnabled: isEnabled === 'true'
  };

  // Base price for pastries
  if (Category.toLowerCase() === 'pastries' && !isNaN(parseFloat(BasePrice))) {
    productData.BasePrice = parseFloat(BasePrice);
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    await db.collection('Menu').insertOne(productData);
    await client.close();

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

// API endpoint to fetch product details for the edit modal
router.get('/api/products/:id', async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID' });
  }

  let client;
  try {
    client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');
    const ingredientsCollection = db.collection('Ingredients');

    const product = await productCollection.findOne({ _id: new ObjectId(id) });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Fetch ingredient details if any
    let ingredientDetails = [];
    if (Array.isArray(product.Ingredients) && product.Ingredients.length > 0) {
      ingredientDetails = await ingredientsCollection
        .find({ IngredientID: { $in: product.Ingredients } })
        .toArray();
    }

    res.json({
      success: true,
      product: {
        ...product,
        IngredientsDetails: ingredientDetails,
        imagelink: product.imagelink || null
      }
    });

  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
});


const FormData = require('form-data'); // 🆕 add this at the top with other requires

// ✅ Edit Product route (with FormData upload to ImgBB)
router.post('/products/edit/:id', upload.single('imagelink'), async (req, res) => {
  const { id } = req.params;
  const { description, Allergen, size16, size22 } = req.body;

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const collection = db.collection('Menu');

    // Fetch current product
    const existingProduct = await collection.findOne({ _id: new ObjectId(id) });
    if (!existingProduct) {
      await client.close();
      req.flash('error_msg', 'Product not found');
      return res.redirect('/admin/products');
    }

    const updateFields = {
      description: description || "",
      Allergen: Allergen || ""
    };

    // Update sizes/prices
    const sizes = [];
    if (size16) sizes.push({ Size: '16oz', BasePrice: parseFloat(size16) });
    if (size22) sizes.push({ Size: '22oz', BasePrice: parseFloat(size22) });
    if (sizes.length) updateFields.Sizes = sizes;

    console.log("DEBUG: API Key value ->", process.env.IMGBB_API_KEY);

    // ✅ If new image uploaded
    if (req.file) {
      console.log("🖼 New image uploaded:", req.file.filename);

      // Delete old local file if exists
      if (
        existingProduct.imagelink &&
        existingProduct.imagelink !== 'placeholder' &&
        existingProduct.imagelink.startsWith('/uploads/')
      ) {
        const oldPath = path.join(__dirname, '..', existingProduct.imagelink);
        fs.unlink(oldPath, err => {
          if (err) console.error('Error deleting old image:', err.message);
        });
      }

      // Delete old ImgBB image if deleteUrl exists
      if (existingProduct.deleteUrl) {
        try {
          await axios.get(existingProduct.deleteUrl);
          console.log("🗑 Old ImgBB image deleted");
        } catch (err) {
          console.error("ImgBB delete error:", err.message);
        }
      }

      // 🆕 Upload new image to ImgBB using FormData
      try {
        const imageData = fs.readFileSync(req.file.path, { encoding: 'base64' });

        const formData = new FormData();
        formData.append("key", process.env.IMGBB_API_KEY);
        formData.append("image", imageData);

        const response = await axios.post(
          "https://api.imgbb.com/1/upload",
          formData,
          { headers: formData.getHeaders() }
        );

        console.log("✅ ImgBB Upload Success:", response.data);

        updateFields.imgbbUrl = response.data.data.url;
        updateFields.deleteUrl = response.data.data.delete_url;
        updateFields.imagelink = `/uploads/${req.file.filename}`;
      } catch (err) {
        console.error("❌ ImgBB upload failed:", err.response?.data || err.message);
      }
    }

    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    await client.close();
    req.flash('success_msg', 'Product updated successfully');
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

    const product = await getProductById(id);
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
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');

    const product = await productCollection.findOne({ _id: new ObjectId(productId) });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Delete local file if exists
    const fs = require('fs');
    if (product.imagelink && product.imagelink !== 'placeholder') {
      fs.unlink(product.imagelink.replace(/^\//, ''), err => {
        if (err) console.error("Local file deletion error:", err.message);
      });
    }

    // Delete ImgBB image if exists
    if (product.deleteUrl) {
      try { await axios.get(product.deleteUrl); } 
      catch (err) { console.error("ImgBB delete error:", err.message); }
    }

    await productCollection.deleteOne({ _id: new ObjectId(productId) });
    await client.close();

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
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

// Admin settings page
router.get('/settings', nocache, (req, res) => {
  res.render('admin/settings', {
    title: 'Settings | Blessings Cafe',
    user: req.session.user,
    currentPage: '/admin/settings',
    layout: 'admin/layout'
  });
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

module.exports = router;

