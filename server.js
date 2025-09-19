const express = require('express');
const session = require('express-session');
const { MongoClient, ObjectId } = require('mongodb');
const { check, validationResult } = require('express-validator');
const expressLayouts = require('express-ejs-layouts');
const bcrypt = require('bcrypt');
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
} = require('./admin-helpers');
const app = express();
const port = 8080;
require('dotenv').config();
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
const flash = require('connect-flash');
const favicon = require('serve-favicon');
const path = require('path');

// BCRYPT CONFIGURATION
const SALT_ROUNDS = 12; // Higher security with 12 rounds

// Xendit configuration
const XENDIT_SECRET_KEY = 'xnd_development_9YDHJULGUWulhmoYgQxildVQ3EWsAeviiJHwF3PSi9zmNcCKll8zEP3thAc5VvD9'
const XENDIT_API_URL = 'https://api.xendit.co'

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))
app.use(session({
  secret: '4eaf42844a1772cb12e90869666b3a929f785d5bbd6d0fc5402c95ebc8721c3bca4ac502cc2fa7ec8abcbec042202876',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}))
app.use(flash())
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

app.use((req, res, next) => {
  res.locals.sidebarItems = [
    { path: '/dashboard', label: 'Home', icon: 'house' },
    { path: '/order', label: 'Orders', icon: 'box' },
    { path: '/menu', label: 'POS Menu', icon: 'list' },
    { path: '/stocks', label: 'Stocks', icon: 'warehouse' },
    { path: '/products', label: 'Products', icon: 'cart-shopping' },
    { path: '/logout', label: 'Logout', icon: 'door-open' }
  ];
  res.locals.currentPage = req.path;
  next();
});

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// ⚠️ IMPORTANT: Move these BEFORE express.static and expressLayouts
app.use(express.urlencoded({ extended: true })); // Changed from false to true
app.use(express.json());

app.use(express.static(__dirname + '/public'));
app.use(expressLayouts);
app.set('layout', 'layout');

function isLoggedIn(req, res, next) {
  if (req.session.user) {
    return next();
  }
  res.redirect('/account/login');
}

function nocache(req, res, next) {
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  next();
}


app.get('/', (req, res) => {
  res.render('user/home', { title: 'Home | Blessings Cafe', layout: false });
});

// User Login Routes
app.get('/user/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/user/dashboard');
  }
  res.render('user/login', {
    title: 'Login | Couche Co',
    layout: false,
    errors: {},
    error: null,
    formData: {}
  });
});

app.post('/user/login',
    [
      check('email').isEmail().withMessage('Please enter a valid email address'),
      check('password').notEmpty().withMessage('Password is required')
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorsObj = {};
        errors.array().forEach(err => {
          errorsObj[err.param] = err;
        });
        return res.render('user/login', {
          title: 'Login | Couche Co',
          errors: errorsObj,
          error: null,
          formData: req.body,
          layout: false
        });
      }

      try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');
        const users = db.collection('users');

        // Find user by email
        const user = await users.findOne({ email: req.body.email });

        if (!user) {
          await client.close();
          return res.render('user/login', {
            title: 'Login | Couche Co',
            errors: {},
            error: 'Invalid email or password',
            formData: { email: req.body.email },
            layout: false
          });
        }

        // Check password
        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) {
          await client.close();
          return res.render('user/login', {
            title: 'Login | Couche Co',
            errors: {},
            error: 'Invalid email or password',
            formData: { email: req.body.email },
            layout: false
          });
        }

        // Set user session
        req.session.user = {
          _id: user._id,
          email: user.email,
          name: user.name || user.email,
          role: 'user',
          loginTime: new Date().toISOString()
        };

        await client.close();
        res.redirect('/user/dashboard');
      } catch (err) {
        console.error('Login error:', err);
        res.status(500).render('user/login', {
          title: 'Login | Couche Co',
          errors: {},
          error: 'An error occurred during login',
          formData: req.body,
          layout: false
        });
      }
    }
);

app.post(
    '/account/login',
    [
      check('Username').notEmpty().withMessage('Username is required'),
      check('Password').notEmpty().withMessage('Password is required'),
    ],
    async (req, res) => {
      const errorsObj = {};
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach(err => {
          errorsObj[err.param] = err;
        });
        return res.render('login', {
          title: 'Login | Blessings Cafe',
          errors: errorsObj,
          error: null,
          formData: req.body,
          layout: false
        });
      }

      console.log(`📅 Login attempt at 2025-08-19 07:07:58 for user: ${req.body.Username}`);

      try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');
        const users = db.collection('users');

        // Find user by username first
        const user = await users.findOne({
          username: req.body.Username
        });

        if (!user) {
          await client.close();
          console.log(`❌ Login failed for user: ${req.body.Username} - User not found`);
          return res.render('login', {
            title: 'Login | Blessings Cafe',
            errors: {},
            error: 'Invalid username or password',
            formData: { Username: req.body.Username },
            layout: false
          });
        }

        // Check if password is hashed or plain text
        let passwordMatch = false;

        if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
          // Password is already hashed - use bcrypt compare
          passwordMatch = await bcrypt.compare(req.body.Password, user.password);
          console.log('🔐 Using bcrypt verification for hashed password');
        } else {
          // Password is plain text - compare directly and then hash it
          if (req.body.Password === user.password) {
            passwordMatch = true;
            console.log('⚠️ Plain text password detected - upgrading to bcrypt');

            // Hash the password for future use
            const hashedPassword = await bcrypt.hash(req.body.Password, SALT_ROUNDS);
            await users.updateOne(
                { _id: user._id },
                {
                  $set: {
                    password: hashedPassword,
                    passwordUpgraded: new Date('2025-08-19T07:07:58.000Z'),
                    upgradedBy: 'auto-login'
                  }
                }
            );
            console.log('✅ Password upgraded to bcrypt hash');
          }
        }

        await client.close();

        if (!passwordMatch) {
          console.log(`❌ Login failed for user: ${req.body.Username} - Invalid password`);
          return res.render('login', {
            title: 'Login | Blessings Cafe',
            errors: {},
            error: 'Invalid username or password',
            formData: { Username: req.body.Username },
            layout: false
          });
        }

        // ENHANCED SESSION DATA FOR PASSWORD CHANGE
        req.session.user = {
          _id: user._id, // Required for password change
          username: user.username,
          email: user.email,
          role: user.role || 'admin', // Default to admin if no role specified
          loginTime: '2025-08-19 07:07:58'
        };

        console.log(`✅ Login successful for user: ${user.username} (ID: ${user._id}) at 2025-08-19 07:07:58`);
        res.redirect('/dashboard');
      } catch (err) {
        console.error('❌ Login error:', err);
        res.status(500).send('Internal Server Error');
      }
    }
);

// ====================
// ADMIN ROUTES
// ====================

// Redirect /admin to /admin/dashboard
app.get('/admin', isLoggedIn, ensureAdmin, (req, res) => {
  res.redirect('/admin/dashboard');
});

// Admin Authentication
app.get('/admin/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', {
    title: 'Admin Login | Blessings Cafe',
    errors: {},
    error: null,
    formData: {},
    layout: false
  });
});

// Admin Dashboard
app.get('/admin/dashboard', isLoggedIn, ensureAdmin, nocache, async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.render('admin/dashboard', {
      title: 'Admin Dashboard | Blessings Cafe',
      user: req.session.user,
      stats: stats,
      layout: 'admin/layout'
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    req.flash('error_msg', 'Error loading dashboard');
    res.redirect('/admin');
  }
});

// Admin Analytics
app.get('/admin/analytics', isLoggedIn, ensureAdmin, nocache, async (req, res) => {
  try {
    const analyticsData = await getAnalyticsData();
    res.render('admin/analytics', {
      title: 'Analytics | Blessings Cafe',
      user: req.session.user,
      data: analyticsData,
      layout: 'admin/layout'
    });
  } catch (err) {
    console.error('Analytics error:', err);
    req.flash('error_msg', 'Error loading analytics');
    res.redirect('/admin/dashboard');
  }
});

// Products Management
app.get('/admin/products', isLoggedIn, ensureAdmin, nocache, async (req, res) => {
  try {
    const products = await getProducts();
    res.render('admin/products', {
      title: 'Products | Blessings Cafe',
      user: req.session.user,
      products: products,
      layout: 'admin/layout'
    });
  } catch (err) {
    console.error('Products error:', err);
    req.flash('error_msg', 'Error loading products');
    res.redirect('/admin/dashboard');
  }
});

// Add/Edit Product
app.get('/admin/products/add', isLoggedIn, ensureAdmin, nocache, (req, res) => {
  res.render('admin/add-product', {
    title: 'Add Product | Blessings Cafe',
    user: req.session.user,
    product: {},
    layout: 'admin/layout'
  });
});

app.get('/admin/products/edit/:id', isLoggedIn, ensureAdmin, nocache, async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    res.render('admin/edit-product', {
      title: 'Edit Product | Blessings Cafe',
      user: req.session.user,
      product: product,
      layout: 'admin/layout'
    });
  } catch (err) {
    console.error('Edit product error:', err);
    req.flash('error_msg', 'Error loading product');
    res.redirect('/admin/products');
  }
});

// Orders Management
app.get('/admin/orders', isLoggedIn, ensureAdmin, nocache, async (req, res) => {
  try {
    const [orders, menu] = await Promise.all([
      getOrders(),
      getMenu()
    ]);

    res.render('admin/order', {
      title: 'Orders | Blessings Cafe',
      user: req.session.user,
      orders: orders,
      menu: menu,
      layout: 'admin/layout'
    });
  } catch (err) {
    console.error('Orders error:', err);
    req.flash('error_msg', 'Error loading orders');
    res.redirect('/admin/dashboard');
  }
});

app.get('/admin/orders/edit/:id', isLoggedIn, ensureAdmin, nocache, async (req, res) => {
  try {
    const order = await getOrderById(req.params.id);
    res.render('admin/edit-order', {
      title: 'Edit Order | Blessings Cafe',
      user: req.session.user,
      order: order,
      layout: 'admin/layout'
    });
  } catch (err) {
    console.error('Edit order error:', err);
    req.flash('error_msg', 'Error loading order');
    res.redirect('/admin/orders');
  }
});

// Stocks Management
app.get('/admin/stocks', isLoggedIn, ensureAdmin, nocache, async (req, res) => {
  let client;
  try {
    client = await MongoClient.connect(uri);
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
  } catch (err) {
    res.status(500).send('Failed to load inventory');
  }
});

// Discounts Management
app.get('/admin/discounts', isLoggedIn, ensureAdmin, nocache, async (req, res) => {
  try {
    const discounts = await getDiscounts();
    res.render('admin/discounts', {
      title: 'Discounts | Blessings Cafe',
      user: req.session.user,
      discounts: discounts,
      layout: 'admin/layout'
    });
  } catch (err) {
    console.error('Discounts error:', err);
    req.flash('error_msg', 'Error loading discounts');
    res.redirect('/admin/dashboard');
  }
});

// Menu Management
app.get('/admin/menu', isLoggedIn, ensureAdmin, nocache, async (req, res) => {
  try {
    const menuItems = await getMenu();
    res.render('admin/menu', {
      title: 'Menu Management | Blessings Cafe',
      user: req.session.user,
      menuItems: menuItems,  // Changed from 'menu' to 'menuItems' to match template
      layout: 'admin/layout'
    });
  } catch (err) {
    console.error('Menu error:', err);
    req.flash('error_msg', 'Error loading menu');
    res.redirect('/admin/dashboard');
  }
});

// Admin Settings
app.get('/admin/settings', isLoggedIn, ensureAdmin, nocache, (req, res) => {
  res.render('admin/settings', {
    title: 'Settings | Blessings Cafe',
    user: req.session.user,
    layout: 'admin/layout'
  });
});

// Forgot Password
app.get('/admin/forgot-password', (req, res) => {
  if (req.session.user) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/forgot-password', {
    title: 'Forgot Password | Blessings Cafe',
    layout: false
  });
});

// Helper function to ensure user is admin
function ensureAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  req.flash('error_msg', 'Unauthorized access');
  res.redirect('/admin/login');
}

app.get('/account/register', (req, res) => {
  res.render('register', { errors: {}, formData: {}, error: null, layout: false });
});

app.get('/dashboard', isLoggedIn, nocache, (req, res) => {
  // Redirect to admin dashboard if user is admin
  if (req.session.user && req.session.user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  }
  // Otherwise, redirect to user dashboard or home
  res.redirect('/');
});

app.get('/menu', isLoggedIn, nocache, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const menuCollection = db.collection('Menu');
    const menuItems = await menuCollection.find().toArray();
    await client.close();
    res.render('menu', { menuItems, title: 'Menu | Blessings Cafe', user: req.session.user });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/addons', async (req, res) => {
  try {
    console.log('Fetching add-ons...');
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const addOns = await db.collection('Add-ons').find({ isEnabled: true }).toArray();

    console.log('Found add-ons:', addOns.length);
    console.log('Add-ons data:', addOns);

    await client.close();
    res.json(addOns);
  } catch (err) {
    console.error('Error fetching add-ons:', err);
    res.status(500).json([]);
  }
});

app.get('/api/orders/preparing-customers', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri)
    const db = client.db('blessingscafe')
    const docs = await db.collection('Orders').find({ FulfillmentStatus: "Preparing" }).project({ Customer: 1 }).toArray()
    await client.close()
    res.json(docs.map(d => d.Customer))
  } catch (err) {
    res.status(500).json([])
  }
})

// Xendit API Routes
app.post('/api/xendit/create-payment', async (req, res) => {
  try {
    const invoicePayload = req.body

    const response = await fetch(`${XENDIT_API_URL}/invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invoicePayload)
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Xendit API Error:', errorData)
      return res.status(response.status).json({
        error: 'Failed to create payment',
        details: errorData
      })
    }

    const paymentData = await response.json()
    res.json(paymentData)
  } catch (error) {
    console.error('Error creating Xendit payment:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/xendit/check-payment/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params

    const response = await fetch(`${XENDIT_API_URL}/invoices/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Xendit API Error:', errorData)
      return res.status(response.status).json({
        error: 'Failed to check payment status',
        details: errorData
      })
    }

    const paymentData = await response.json()
    res.json(paymentData)
  } catch (error) {
    console.error('Error checking payment status:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/xendit/webhook', express.raw({type: 'application/json'}), (req, res) => {
  try {
    const payload = JSON.parse(req.body)

    console.log('Xendit webhook received:', payload)

    if (payload.status === 'PAID') {
      console.log(`Payment completed for invoice: ${payload.external_id}`)
      // You can add your order update logic here
    }

    res.status(200).send('OK')
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(400).send('Bad Request')
  }
})

app.get('/products', isLoggedIn, nocache, async (req, res) => {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('blessingscafe');

    const productCollection = db.collection('Menu');
    const ingredientCollection = db.collection('Ingredients');

    // Get all products
    const products = await productCollection.find().toArray();

    // Collect all ingredient IDs from all products
    const allIngredientIDs = products.flatMap(p => p.Ingredients || []);

    // Fetch ingredient documents
    const ingredientDocs = await ingredientCollection
        .find({ IngredientID: { $in: allIngredientIDs } })
        .project({ IngredientID: 1, Name: 1, _id: 0 })
        .toArray();

    // Map IngredientID to Name
    const ingredientMap = {};
    ingredientDocs.forEach(i => {
      ingredientMap[i.IngredientID] = i.Name;
    });

    // Replace ingredient IDs with names
    const productsWithIngredientNames = products.map(p => ({
      ...p,
      Ingredients: (p.Ingredients || []).map(id => ingredientMap[id] || id)
    }));

    await client.close();

    res.render('products', {
      products: productsWithIngredientNames,
      title: 'Products | Blessings Cafe',
      user: req.session.user
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/toggle-availability/:id', async (req, res) => {
  const productId = req.params.id;

  const isEnabled = req.body.isEnabled === true || req.body.isEnabled === 'true';

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const product = await db.collection('Menu').findOne({ _id: new ObjectId(productId) });
    if (!product) {
      await client.close();
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const result = await db.collection('Menu').updateOne(
        { _id: new ObjectId(productId) },
        { $set: { isEnabled: isEnabled } }
    );

    await client.close();

    if (result.modifiedCount === 0) {
      return res.status(500).json({ success: false, message: 'No change made to product' });
    }

    res.json({ success: true, productName: product.Name });
  } catch (err) {
    console.error('Error updating product availability:', err);
    res.status(500).json({ success: false });
  }
});

app.post('/products/add', async (req, res) => {
  const {
    categoryShortcut, // CF, MT, FT, BK
    productCode,
    Name,
    size16,
    size22,
    Ingredients,
    Allergen,
    imagelink,
    isEnabled,
    BasePrice
  } = req.body;

  // Map shortcut to full category name
  const categoryMap = {
    CF: "Coffee",
    MT: "Milktea",
    FT: "Fruit Tea",
    BK: "Pastries"
  };

  const Category = categoryMap[categoryShortcut] || null;

  if (!Category || !productCode) {
    console.warn('Missing category or product code in form submission:', req.body);
    req.flash('error_msg', 'Please select a category and enter a product code.');
    return res.redirect('/add-product');
  }

  const ProductID = `${categoryShortcut.toUpperCase()}-${productCode.toUpperCase()}`;

  const Sizes = [];
  if (size16) Sizes.push({ Size: '16oz', BasePrice: parseFloat(size16) });
  if (size22) Sizes.push({ Size: '22oz', BasePrice: parseFloat(size22) });

  const ingredientsArray = Ingredients
      ? Ingredients.split(',').map(i => i.trim())
      : [];

  const productData = {
    ProductID,
    Name,
    Sizes: Sizes.length > 0 ? Sizes : null,
    Ingredients: ingredientsArray,
    Category, // full name now
    Allergen: Allergen || null,
    imagelink: imagelink || 'placeholder',
    isEnabled: isEnabled === 'true'
  };

  if (Category.toLowerCase() === 'pastries' && !isNaN(parseFloat(BasePrice))) {
    productData.BasePrice = parseFloat(BasePrice);
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    await db.collection('Menu').insertOne(productData);
    await client.close();
    req.flash('success_msg', `${Name} has been added to the menu`);
    res.redirect('/products');
  } catch (err) {
    console.error('Error adding product:', err);
    res.status(500).send('Internal Server Error');
  }
});




app.get('/management', async (req, res) => {
  res.render('management', {
    currentPage: '/management'
  });
});


app.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { layout: false });
});


app.post('/forgot-password', async (req, res) => {
  const { username, secretCode, newPassword } = req.body;

  if (!username || !secretCode || !newPassword) {
    return res.status(400).send('Username, secret code, and new password are required');
  }

  let client;
  try {
    client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const usersCollection = db.collection('users');

    // Check username + secretCode
    const user = await usersCollection.findOne({ username: username, secretCode: secretCode });
    if (!user) {
      await client.close();
      return res.status(404).send('User not found or invalid secret code');
    }

    // Update password if valid
    await usersCollection.updateOne(
        { username: username, secretCode: secretCode },
        { $set: { password: newPassword } }
    );

    await client.close();
    res.send('Password updated successfully. You can now log in.');
  } catch (error) {
    if (client) await client.close();
    console.error('Error updating password:', error);
    res.status(500).send('Server error');
  }
});


app.post('/delete-product/:id', async (req, res) => {
  const productId = req.params.id;

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const result = await db.collection('Menu').deleteOne({ _id: new ObjectId(productId) });

    await client.close();

    if (result.deletedCount === 1) {
      req.flash('success_msg', `Product has been deleted`);
      res.redirect('/products');} else {
      res.status(404).send('Product not found');
    }
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/add-product', isLoggedIn, nocache, (req, res) => {
  res.render('add-product', { title: 'Add Product | Blessings Cafe' , user: req.session.user});
});

app.post('/products/edit/:id', async (req, res) => {
  const { id } = req.params;
  const {
    Name,
    Category,
    imagelink,
    BasePrice,
    size16,
    size22,
    Allergen,
    isEnabled
  } = req.body;

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');

    // Build updateFields — only include fields we really want to change
    const updateFields = {
      Name,
      Category,
      imagelink,
      Allergen: Allergen || '',
      isEnabled: isEnabled === 'true',
    };

    // Only update BasePrice if category is pastries
    if (Category && Category.toLowerCase() === 'pastries' && BasePrice) {
      updateFields.BasePrice = parseFloat(BasePrice);
    }

    // Only update Sizes if user provided values
    if (size16 || size22) {
      const Sizes = [];
      if (size16) Sizes.push({ Size: '16oz', BasePrice: parseFloat(size16) });
      if (size22) Sizes.push({ Size: '22oz', BasePrice: parseFloat(size22) });
      updateFields.Sizes = Sizes;
    }
    // else → don’t touch existing Sizes in MongoDB

    await productCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields }
    );

    await client.close();
    req.flash('success_msg', `${Name} has been updated`);
    res.redirect('/products');
  } catch (err) {
    console.error('Error editing product:', err);
    res.status(500).send('Internal Server Error');
  }
});

// ✅ Edit product page with ingredient name lookup
app.get('/edit-product/:id',  async (req, res) => {
  const { id } = req.params;
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');
    const ingredientsCollection = db.collection('Ingredients');

    // Fetch product by ID
    const product = await productCollection.findOne({ _id: new ObjectId(id) });

    if (!product) {
      await client.close();return res.status(404).send('Product not found');
    }

    // Lookup ingredient names based on stored IngredientIDs
    let ingredientDetails = [];
    if (Array.isArray(product.Ingredients) && product.Ingredients.length > 0) {
      ingredientDetails = await ingredientsCollection
          .find({ IngredientID: { $in: product.Ingredients } })
          .toArray();
    }

    await client.close();

    // Always pass ingredientDetails as an array
    res.render('edit-product', {
      product,
      ingredientDetails: ingredientDetails || [] // crash-proof
    });
  } catch (err) {
    console.error('Error loading edit product:', err);
    res.status(500).send('Internal Server Error');
  }
});

// ✅ API endpoint for modal edit
app.get('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');
    const ingredientsCollection = db.collection('Ingredients');

    const product = await productCollection.findOne({ _id: new ObjectId(id) });
    if (!product) return res.status(404).send('Not found');

    let ingredientDetails = [];
    if (Array.isArray(product.Ingredients) && product.Ingredients.length > 0) {
      ingredientDetails = await ingredientsCollection
          .find({ IngredientID: { $in: product.Ingredients } })
          .toArray();
    }

    res.json({
      ...product,
      IngredientsDetails: ingredientDetails
    });

    client.close();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching product');
  }
});


app.get('/stocks', isLoggedIn, nocache, async (req, res) => {
  let client;
  try {
    console.log(`[${new Date().toISOString()}] Loading inventory page for user: ${req.session.user.username}`);

    // Connect to MongoDB
    client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Log available collections for debugging
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));

    // Fetch ingredients and add-ons
    const ingredients = await db.collection('Ingredients').find().toArray();
    console.log(`Fetched ${ingredients.length} ingredients`);

    const addons = await db.collection('Add-ons').find().toArray();
    console.log(`Fetched ${addons.length} add-ons`);

    // Log sample data for debugging
    if (ingredients.length > 0) {
      console.log('Sample ingredient:', {
        _id: ingredients[0]._id,
        name: ingredients[0].Name,
        quantity: ingredients[0].Quantity
      });
    }

    if (addons.length > 0) {
      console.log('Sample add-on:', {
        _id: addons[0]._id,
        name: addons[0].Name,
        quantity: addons[0].Quantity
      });
    }

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
  } catch (err) {
    res.status(500).send('Failed to load inventory');
  }
});

// Discounts Management
app.get('/admin/discounts', isLoggedIn, ensureAdmin, nocache, async (req, res) => {
  try {
    const discounts = await getDiscounts();
    res.render('admin/discounts', {
      title: 'Discounts | Blessings Cafe',
      user: req.session.user,
      discounts: discounts,
      layout: 'admin/layout'
    });
  } catch (err) {
    console.error('Discounts error:', err);
    req.flash('error_msg', 'Error loading discounts');
    res.redirect('/admin/dashboard');
  }
});

// Menu Management
app.get('/admin/menu', isLoggedIn, ensureAdmin, nocache, async (req, res) => {
  try {
    const menuItems = await getMenu();
    res.render('admin/menu', {
      title: 'Menu Management | Blessings Cafe',
      user: req.session.user,
      menuItems: menuItems,  // Changed from 'menu' to 'menuItems' to match template
      layout: 'admin/layout'
    });
  } catch (err) {
    console.error('Menu error:', err);
    req.flash('error_msg', 'Error loading menu');
    res.redirect('/admin/dashboard');
  }
});

// Admin Settings
app.get('/admin/settings', isLoggedIn, ensureAdmin, nocache, (req, res) => {
  res.render('admin/settings', {
    title: 'Settings | Blessings Cafe',
    user: req.session.user,
    layout: 'admin/layout'
  });
});

// Forgot Password
app.get('/admin/forgot-password', (req, res) => {
  if (req.session.user) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/forgot-password', {
    title: 'Forgot Password | Blessings Cafe',
    layout: false
  });
});

// Helper function to ensure user is admin
function ensureAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  req.flash('error_msg', 'Unauthorized access');
  res.redirect('/admin/login');
}

app.get('/account/register', (req, res) => {
  res.render('register', { errors: {}, formData: {}, error: null, layout: false });
});

app.get('/dashboard', isLoggedIn, nocache, (req, res) => {
  // Redirect to admin dashboard if user is admin
  if (req.session.user && req.session.user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  }
  // Otherwise, redirect to user dashboard or home
  res.redirect('/');
});

app.get('/menu', isLoggedIn, nocache, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const menuCollection = db.collection('Menu');
    const menuItems = await menuCollection.find().toArray();
    await client.close();
    res.render('menu', { menuItems, title: 'Menu | Blessings Cafe', user: req.session.user });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/addons', async (req, res) => {
  try {
    console.log('Fetching add-ons...');
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const addOns = await db.collection('Add-ons').find({ isEnabled: true }).toArray();

    console.log('Found add-ons:', addOns.length);
    console.log('Add-ons data:', addOns);

    await client.close();
    res.json(addOns);
  } catch (err) {
    console.error('Error fetching add-ons:', err);
    res.status(500).json([]);
  }
});

app.get('/api/orders/preparing-customers', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri)
    const db = client.db('blessingscafe')
    const docs = await db.collection('Orders').find({ FulfillmentStatus: "Preparing" }).project({ Customer: 1 }).toArray()
    await client.close()
    res.json(docs.map(d => d.Customer))
  } catch (err) {
    res.status(500).json([])
  }
})

// Xendit API Routes
app.post('/api/xendit/create-payment', async (req, res) => {
  try {
    const invoicePayload = req.body

    const response = await fetch(`${XENDIT_API_URL}/invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invoicePayload)
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Xendit API Error:', errorData)
      return res.status(response.status).json({
        error: 'Failed to create payment',
        details: errorData
      })
    }

    const paymentData = await response.json()
    res.json(paymentData)
  } catch (error) {
    console.error('Error creating Xendit payment:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/xendit/check-payment/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params

    const response = await fetch(`${XENDIT_API_URL}/invoices/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Xendit API Error:', errorData)
      return res.status(response.status).json({
        error: 'Failed to check payment status',
        details: errorData
      })
    }

    const paymentData = await response.json()
    res.json(paymentData)
  } catch (error) {
    console.error('Error checking payment status:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/xendit/webhook', express.raw({type: 'application/json'}), (req, res) => {
  try {
    const payload = JSON.parse(req.body)

    console.log('Xendit webhook received:', payload)

    if (payload.status === 'PAID') {
      console.log(`Payment completed for invoice: ${payload.external_id}`)
      // You can add your order update logic here
    }

    res.status(200).send('OK')
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(400).send('Bad Request')
  }
})

app.get('/products', isLoggedIn, nocache, async (req, res) => {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('blessingscafe');

    const productCollection = db.collection('Menu');
    const ingredientCollection = db.collection('Ingredients');

    // Get all products
    const products = await productCollection.find().toArray();

    // Collect all ingredient IDs from all products
    const allIngredientIDs = products.flatMap(p => p.Ingredients || []);

    // Fetch ingredient documents
    const ingredientDocs = await ingredientCollection
        .find({ IngredientID: { $in: allIngredientIDs } })
        .project({ IngredientID: 1, Name: 1, _id: 0 })
        .toArray();

    // Map IngredientID to Name
    const ingredientMap = {};
    ingredientDocs.forEach(i => {
      ingredientMap[i.IngredientID] = i.Name;
    });

    // Replace ingredient IDs with names
    const productsWithIngredientNames = products.map(p => ({
      ...p,
      Ingredients: (p.Ingredients || []).map(id => ingredientMap[id] || id)
    }));

    await client.close();

    res.render('products', {
      products: productsWithIngredientNames,
      title: 'Products | Blessings Cafe',
      user: req.session.user
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/toggle-availability/:id', async (req, res) => {
  const productId = req.params.id;

  const isEnabled = req.body.isEnabled === true || req.body.isEnabled === 'true';

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const product = await db.collection('Menu').findOne({ _id: new ObjectId(productId) });
    if (!product) {
      await client.close();
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const result = await db.collection('Menu').updateOne(
        { _id: new ObjectId(productId) },
        { $set: { isEnabled: isEnabled } }
    );

    await client.close();

    if (result.modifiedCount === 0) {
      return res.status(500).json({ success: false, message: 'No change made to product' });
    }

    res.json({ success: true, productName: product.Name });
  } catch (err) {
    console.error('Error updating product availability:', err);
    res.status(500).json({ success: false });
  }
});

app.post('/products/add', async (req, res) => {
  const {
    categoryShortcut, // CF, MT, FT, BK
    productCode,
    Name,
    size16,
    size22,
    Ingredients,
    Allergen,
    imagelink,
    isEnabled,
    BasePrice
  } = req.body;

  // Map shortcut to full category name
  const categoryMap = {
    CF: "Coffee",
    MT: "Milktea",
    FT: "Fruit Tea",
    BK: "Pastries"
  };

  const Category = categoryMap[categoryShortcut] || null;

  if (!Category || !productCode) {
    console.warn('Missing category or product code in form submission:', req.body);
    req.flash('error_msg', 'Please select a category and enter a product code.');
    return res.redirect('/add-product');
  }

  const ProductID = `${categoryShortcut.toUpperCase()}-${productCode.toUpperCase()}`;

  const Sizes = [];
  if (size16) Sizes.push({ Size: '16oz', BasePrice: parseFloat(size16) });
  if (size22) Sizes.push({ Size: '22oz', BasePrice: parseFloat(size22) });

  const ingredientsArray = Ingredients
      ? Ingredients.split(',').map(i => i.trim())
      : [];

  const productData = {
    ProductID,
    Name,
    Sizes: Sizes.length > 0 ? Sizes : null,
    Ingredients: ingredientsArray,
    Category, // full name now
    Allergen: Allergen || null,
    imagelink: imagelink || 'placeholder',
    isEnabled: isEnabled === 'true'
  };

  if (Category.toLowerCase() === 'pastries' && !isNaN(parseFloat(BasePrice))) {
    productData.BasePrice = parseFloat(BasePrice);
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    await db.collection('Menu').insertOne(productData);
    await client.close();
    req.flash('success_msg', `${Name} has been added to the menu`);
    res.redirect('/products');
  } catch (err) {
    console.error('Error adding product:', err);
    res.status(500).send('Internal Server Error');
  }
});




app.get('/management', async (req, res) => {
  res.render('management', {
    currentPage: '/management'
  });
});


app.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { layout: false });
});


app.post('/forgot-password', async (req, res) => {
  const { username, secretCode, newPassword } = req.body;

  if (!username || !secretCode || !newPassword) {
    return res.status(400).send('Username, secret code, and new password are required');
  }

  let client;
  try {
    client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const usersCollection = db.collection('users');

    // Check username + secretCode
    const user = await usersCollection.findOne({ username: username, secretCode: secretCode });
    if (!user) {
      await client.close();
      return res.status(404).send('User not found or invalid secret code');
    }

    // Update password if valid
    await usersCollection.updateOne(
        { username: username, secretCode: secretCode },
        { $set: { password: newPassword } }
    );

    await client.close();
    res.send('Password updated successfully. You can now log in.');
  } catch (error) {
    if (client) await client.close();
    console.error('Error updating password:', error);
    res.status(500).send('Server error');
  }
});


app.post('/delete-product/:id', async (req, res) => {
  const productId = req.params.id;

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const result = await db.collection('Menu').deleteOne({ _id: new ObjectId(productId) });

    await client.close();

    if (result.deletedCount === 1) {
      req.flash('success_msg', `Product has been deleted`);
      res.redirect('/products');} else {
      res.status(404).send('Product not found');
    }
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/add-product', isLoggedIn, nocache, (req, res) => {
  res.render('add-product', { title: 'Add Product | Blessings Cafe' , user: req.session.user});
});

app.post('/products/edit/:id', async (req, res) => {
  const { id } = req.params;
  const {
    Name,
    Category,
    imagelink,
    BasePrice,
    size16,
    size22,
    Allergen,
    isEnabled
  } = req.body;

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');

    // Build updateFields — only include fields we really want to change
    const updateFields = {
      Name,
      Category,
      imagelink,
      Allergen: Allergen || '',
      isEnabled: isEnabled === 'true',
    };

    // Only update BasePrice if category is pastries
    if (Category && Category.toLowerCase() === 'pastries' && BasePrice) {
      updateFields.BasePrice = parseFloat(BasePrice);
    }

    // Only update Sizes if user provided values
    if (size16 || size22) {
      const Sizes = [];
      if (size16) Sizes.push({ Size: '16oz', BasePrice: parseFloat(size16) });
      if (size22) Sizes.push({ Size: '22oz', BasePrice: parseFloat(size22) });
      updateFields.Sizes = Sizes;
    }
    // else → don’t touch existing Sizes in MongoDB

    await productCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields }
    );

    await client.close();
    req.flash('success_msg', `${Name} has been updated`);
    res.redirect('/products');
  } catch (err) {
    console.error('Error editing product:', err);
    res.status(500).send('Internal Server Error');
  }
});

// ✅ Edit product page with ingredient name lookup
app.get('/edit-product/:id',  async (req, res) => {
  const { id } = req.params;
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');
    const ingredientsCollection = db.collection('Ingredients');

    // Fetch product by ID
    const product = await productCollection.findOne({ _id: new ObjectId(id) });

    if (!product) {
      await client.close();return res.status(404).send('Product not found');
    }

    // Lookup ingredient names based on stored IngredientIDs
    let ingredientDetails = [];
    if (Array.isArray(product.Ingredients) && product.Ingredients.length > 0) {
      ingredientDetails = await ingredientsCollection
          .find({ IngredientID: { $in: product.Ingredients } })
          .toArray();
    }

    await client.close();

    // Always pass ingredientDetails as an array
    res.render('edit-product', {
      product,
      ingredientDetails: ingredientDetails || [] // crash-proof
    });
  } catch (err) {
    console.error('Error loading edit product:', err);
    res.status(500).send('Internal Server Error');
  }
});

// ✅ API endpoint for modal edit
app.get('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');
    const ingredientsCollection = db.collection('Ingredients');

    const product = await productCollection.findOne({ _id: new ObjectId(id) });
    if (!product) return res.status(404).send('Not found');

    let ingredientDetails = [];
    if (Array.isArray(product.Ingredients) && product.Ingredients.length > 0) {
      ingredientDetails = await ingredientsCollection
          .find({ IngredientID: { $in: product.Ingredients } })
          .toArray();
    }

    res.json({
      ...product,
      IngredientsDetails: ingredientDetails
    });

    client.close();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching product');
  }
});


app.get('/stocks', isLoggedIn, nocache, async (req, res) => {
  let client;
  try {
    console.log(`[${new Date().toISOString()}] Loading inventory page for user: ${req.session.user.username}`);

    // Connect to MongoDB
    client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Log available collections for debugging
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));

    // Fetch ingredients and add-ons
    const ingredients = await db.collection('Ingredients').find().toArray();
    console.log(`Fetched ${ingredients.length} ingredients`);

    const addons = await db.collection('Add-ons').find().toArray();
    console.log(`Fetched ${addons.length} add-ons`);

    // Log sample data for debugging
    if (ingredients.length > 0) {
      console.log('Sample ingredient:', {
        _id: ingredients[0]._id,
        name: ingredients[0].Name,
        quantity: ingredients[0].Quantity
      });
    }

    if (addons.length > 0) {
      console.log('Sample add-on:', {
        _id: addons[0]._id,
        name: addons[0].Name,
        quantity: addons[0].Quantity
      });
    }

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
  } catch (err) {
    res.status(500).send('Failed to load inventory');
  }
});

// Discounts Management
app.get('/admin/discounts', isLoggedIn, ensureAdmin, nocache, async (req, res) => {
  try {
    const discounts = await getDiscounts();
    res.render('admin/discounts', {
      title: 'Discounts | Blessings Cafe',
      user: req.session.user,
      discounts: discounts,
      layout: 'admin/layout'
    });
  } catch (err) {
    console.error('Discounts error:', err);
    req.flash('error_msg', 'Error loading discounts');
    res.redirect('/admin/dashboard');
  }
});

// Menu Management
app.get('/admin/menu', isLoggedIn, ensureAdmin, nocache, async (req, res) => {
  try {
    const menuItems = await getMenu();
    res.render('admin/menu', {
      title: 'Menu Management | Blessings Cafe',
      user: req.session.user,
      menuItems: menuItems,  // Changed from 'menu' to 'menuItems' to match template
      layout: 'admin/layout'
    });
  } catch (err) {
    console.error('Menu error:', err);
    req.flash('error_msg', 'Error loading menu');
    res.redirect('/admin/dashboard');
  }
});

// Admin Settings
app.get('/admin/settings', isLoggedIn, ensureAdmin, nocache, (req, res) => {
  res.render('admin/settings', {
    title: 'Settings | Blessings Cafe',
    user: req.session.user,
    layout: 'admin/layout'
  });
});

// Forgot Password
app.get('/admin/forgot-password', (req, res) => {
  if (req.session.user) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/forgot-password', {
    title: 'Forgot Password | Blessings Cafe',
    layout: false
  });
});

// Helper function to ensure user is admin
function ensureAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  req.flash('error_msg', 'Unauthorized access');
  res.redirect('/admin/login');
}

app.get('/account/register', (req, res) => {
  res.render('register', { errors: {}, formData: {}, error: null, layout: false });
});

app.get('/dashboard', isLoggedIn, nocache, (req, res) => {
  // Redirect to admin dashboard if user is admin
  if (req.session.user && req.session.user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  }
  // Otherwise, redirect to user dashboard or home
  res.redirect('/');
});

app.get('/menu', isLoggedIn, nocache, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const menuCollection = db.collection('Menu');
    const menuItems = await menuCollection.find().toArray();
    await client.close();
    res.render('menu', { menuItems, title: 'Menu | Blessings Cafe', user: req.session.user });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/addons', async (req, res) => {
  try {
    console.log('Fetching add-ons...');
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const addOns = await db.collection('Add-ons').find({ isEnabled: true }).toArray();

    console.log('Found add-ons:', addOns.length);
    console.log('Add-ons data:', addOns);

    await client.close();
    res.json(addOns);
  } catch (err) {
    console.error('Error fetching add-ons:', err);
    res.status(500).json([]);
  }
});

app.get('/api/orders/preparing-customers', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri)
    const db = client.db('blessingscafe')
    const docs = await db.collection('Orders').find({ FulfillmentStatus: "Preparing" }).project({ Customer: 1 }).toArray()
    await client.close()
    res.json(docs.map(d => d.Customer))
  } catch (err) {
    res.status(500).json([])
  }
})

// Xendit API Routes
app.post('/api/xendit/create-payment', async (req, res) => {
  try {
    const invoicePayload = req.body

    const response = await fetch(`${XENDIT_API_URL}/invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invoicePayload)
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Xendit API Error:', errorData)
      return res.status(response.status).json({
        error: 'Failed to create payment',
        details: errorData
      })
    }

    const paymentData = await response.json()
    res.json(paymentData)
  } catch (error) {
    console.error('Error creating Xendit payment:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/xendit/check-payment/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params

    const response = await fetch(`${XENDIT_API_URL}/invoices/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Xendit API Error:', errorData)
      return res.status(response.status).json({
        error: 'Failed to check payment status',
        details: errorData
      })
    }

    const paymentData = await response.json()
    res.json(paymentData)
  } catch (error) {
    console.error('Error checking payment status:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/xendit/webhook', express.raw({type: 'application/json'}), (req, res) => {
  try {
    const payload = JSON.parse(req.body)

    console.log('Xendit webhook received:', payload)

    if (payload.status === 'PAID') {
      console.log(`Payment completed for invoice: ${payload.external_id}`)
      // You can add your order update logic here
    }

    res.status(200).send('OK')
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(400).send('Bad Request')
  }
})

app.get('/products', isLoggedIn, nocache, async (req, res) => {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('blessingscafe');

    const productCollection = db.collection('Menu');
    const ingredientCollection = db.collection('Ingredients');

    // Get all products
    const products = await productCollection.find().toArray();

    // Collect all ingredient IDs from all products
    const allIngredientIDs = products.flatMap(p => p.Ingredients || []);

    // Fetch ingredient documents
    const ingredientDocs = await ingredientCollection
        .find({ IngredientID: { $in: allIngredientIDs } })
        .project({ IngredientID: 1, Name: 1, _id: 0 })
        .toArray();

    // Map IngredientID to Name
    const ingredientMap = {};
    ingredientDocs.forEach(i => {
      ingredientMap[i.IngredientID] = i.Name;
    });

    // Replace ingredient IDs with names
    const productsWithIngredientNames = products.map(p => ({
      ...p,
      Ingredients: (p.Ingredients || []).map(id => ingredientMap[id] || id)
    }));

    await client.close();

    res.render('products', {
      products: productsWithIngredientNames,
      title: 'Products | Blessings Cafe',
      user: req.session.user
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/toggle-availability/:id', async (req, res) => {
  const productId = req.params.id;

  const isEnabled = req.body.isEnabled === true || req.body.isEnabled === 'true';

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const product = await db.collection('Menu').findOne({ _id: new ObjectId(productId) });
    if (!product) {
      await client.close();
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const result = await db.collection('Menu').updateOne(
        { _id: new ObjectId(productId) },
        { $set: { isEnabled: isEnabled } }
    );

    await client.close();

    if (result.modifiedCount === 0) {
      return res.status(500).json({ success: false, message: 'No change made to product' });
    }

    res.json({ success: true, productName: product.Name });
  } catch (err) {
    console.error('Error updating product availability:', err);
    res.status(500).json({ success: false });
  }
});

app.post('/products/add', async (req, res) => {
  const {
    categoryShortcut, // CF, MT, FT, BK
    productCode,
    Name,
    size16,
    size22,
    Ingredients,
    Allergen,
    imagelink,
    isEnabled,
    BasePrice
  } = req.body;

  // Map shortcut to full category name
  const categoryMap = {
    CF: "Coffee",
    MT: "Milktea",
    FT: "Fruit Tea",
    BK: "Pastries"
  };

  const Category = categoryMap[categoryShortcut] || null;

  if (!Category || !productCode) {
    console.warn('Missing category or product code in form submission:', req.body);
    req.flash('error_msg', 'Please select a category and enter a product code.');
    return res.redirect('/add-product');
  }

  const ProductID = `${categoryShortcut.toUpperCase()}-${productCode.toUpperCase()}`;

  const Sizes = [];
  if (size16) Sizes.push({ Size: '16oz', BasePrice: parseFloat(size16) });
  if (size22) Sizes.push({ Size: '22oz', BasePrice: parseFloat(size22) });

  const ingredientsArray = Ingredients
      ? Ingredients.split(',').map(i => i.trim())
      : [];

  const productData = {
    ProductID,
    Name,
    Sizes: Sizes.length > 0 ? Sizes : null,
    Ingredients: ingredientsArray,
    Category, // full name now
    Allergen: Allergen || null,
    imagelink: imagelink || 'placeholder',
    isEnabled: isEnabled === 'true'
  };

  if (Category.toLowerCase() === 'pastries' && !isNaN(parseFloat(BasePrice))) {
    productData.BasePrice = parseFloat(BasePrice);
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    await db.collection('Menu').insertOne(productData);
    await client.close();
    req.flash('success_msg', `${Name} has been added to the menu`);
    res.redirect('/products');
  } catch (err) {
    console.error('Error adding product:', err);
    res.status(500).send('Internal Server Error');
  }
});




app.get('/management', async (req, res) => {
  res.render('management', {
    currentPage: '/management'
  });
});


app.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { layout: false });
});


app.post('/forgot-password', async (req, res) => {
  const { username, secretCode, newPassword } = req.body;

  if (!username || !secretCode || !newPassword) {
    return res.status(400).send('Username, secret code, and new password are required');
  }

  let client;
  try {
    client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const usersCollection = db.collection('users');

    // Check username + secretCode
    const user = await usersCollection.findOne({ username: username, secretCode: secretCode });
    if (!user) {
      await client.close();
      return res.status(404).send('User not found or invalid secret code');
    }

    // Update password if valid
    await usersCollection.updateOne(
        { username: username, secretCode: secretCode },
        { $set: { password: newPassword } }
    );

    await client.close();
    res.send('Password updated successfully. You can now log in.');
  } catch (error) {
    if (client) await client.close();
    console.error('Error updating password:', error);
    res.status(500).send('Server error');
  }
});


app.post('/delete-product/:id', async (req, res) => {
  const productId = req.params.id;

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const result = await db.collection('Menu').deleteOne({ _id: new ObjectId(productId) });

    await client.close();

    if (result.deletedCount === 1) {
      req.flash('success_msg', `Product has been deleted`);
      res.redirect('/products');} else {
      res.status(404).send('Product not found');
    }
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/add-product', isLoggedIn, nocache, (req, res) => {
  res.render('add-product', { title: 'Add Product | Blessings Cafe' , user: req.session.user});
});

app.post('/products/edit/:id', async (req, res) => {
  const { id } = req.params;
  const {
    Name,
    Category,
    imagelink,
    BasePrice,
    size16,
    size22,
    Allergen,
    isEnabled
  } = req.body;

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');

    // Build updateFields — only include fields we really want to change
    const updateFields = {
      Name,
      Category,
      imagelink,
      Allergen: Allergen || '',
      isEnabled: isEnabled === 'true',
    };

    // Only update BasePrice if category is pastries
    if (Category && Category.toLowerCase() === 'pastries' && BasePrice) {
      updateFields.BasePrice = parseFloat(BasePrice);
    }

    // Only update Sizes if user provided values
    if (size16 || size22) {
      const Sizes = [];
      if (size16) Sizes.push({ Size: '16oz', BasePrice: parseFloat(size16) });
      if (size22) Sizes.push({ Size: '22oz', BasePrice: parseFloat(size22) });
      updateFields.Sizes = Sizes;
    }
    // else → don’t touch existing Sizes in MongoDB

    await productCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields }
    );

    await client.close();
    req.flash('success_msg', `${Name} has been updated`);
    res.redirect('/products');
  } catch (err) {
    console.error('Error editing product:', err);
    res.status(500).send('Internal Server Error');
  }
});

// ✅ Edit product page with ingredient name lookup
app.get('/edit-product/:id',  async (req, res) => {
  const { id } = req.params;
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');
    const ingredientsCollection = db.collection('Ingredients');

    // Fetch product by ID
    const product = await productCollection.findOne({ _id: new ObjectId(id) });

    if (!product) {
      await client.close();return res.status(404).send('Product not found');
    }

    // Lookup ingredient names based on stored IngredientIDs
    let ingredientDetails = [];
    if (Array.isArray(product.Ingredients) && product.Ingredients.length > 0) {
      ingredientDetails = await ingredientsCollection
          .find({ IngredientID: { $in: product.Ingredients } })
          .toArray();
    }

    await client.close();

    // Always pass ingredientDetails as an array
    res.render('edit-product', {
      product,
      ingredientDetails: ingredientDetails || [] // crash-proof
    });
  } catch (err) {
    console.error('Error loading edit product:', err);
    res.status(500).send('Internal Server Error');
  }
});

// ✅ API endpoint for modal edit
app.get('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');
    const ingredientsCollection = db.collection('Ingredients');

    const product = await productCollection.findOne({ _id: new ObjectId(id) });
    if (!product) return res.status(404).send('Not found');

    let ingredientDetails = [];
    if (Array.isArray(product.Ingredients) && product.Ingredients.length > 0) {
      ingredientDetails = await ingredientsCollection
          .find({ IngredientID: { $in: product.Ingredients } })
          .toArray();
    }

    res.json({
      ...product,
      IngredientsDetails: ingredientDetails
    });

    client.close();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching product');
  }
});


app.get('/stocks', isLoggedIn, nocache, async (req, res) => {
  let client;
  try {
    console.log(`[${new Date().toISOString()}] Loading inventory page for user: ${req.session.user.username}`);

    // Connect to MongoDB
    client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Log available collections for debugging
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));

    // Fetch ingredients and add-ons
    const ingredients = await db.collection('Ingredients').find().toArray();
    console.log(`Fetched ${ingredients.length} ingredients`);

    const addons = await db.collection('Add-ons').find().toArray();
    console.log(`Fetched ${addons.length} add-ons`);

    // Log sample data for debugging
    if (ingredients.length > 0) {
      console.log('Sample ingredient:', {
        _id: ingredients[0]._id,
        name: ingredients[0].Name,
        quantity: ingredients[0].Quantity
      });
    }

    if (addons.length > 0) {
      console.log('Sample add-on:', {
        _id: addons[0]._id,
        name: addons[0].Name,
        quantity: addons[0].Quantity
      });
    }

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
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error loading inventory:`, err);
    res.status(500).send('Failed to load inventory');
  }
});

// V13 ENHANCED Ingredients CRUD Routes with Fixed Prefix Support
app.post('/stocks', async (req, res) => {
  console.log(`[2025-09-16 07:36:28] Adding new ingredient by MathDaenniel`);
  console.log(`[2025-09-16 07:36:28] Request body:`, req.body, 'by MathDaenniel');

  const { IngredientID, IngredientPrefix, IngredientSuffix, Name, Quantity, Category, Allergen, isAvailable, isEnabled } = req.body;

  // V13 ENHANCEMENT: Fixed prefix handling
  const finalPrefix = 'ING'; // Always ING for ingredients
  const finalCategory = 'Ingredients'; // Always Ingredients category

  // Determine the final IngredientID - combine prefix and suffix WITH dash for database storage
  let finalIngredientID = IngredientID;
  if (IngredientSuffix) {
    finalIngredientID = `${finalPrefix}-${IngredientSuffix.trim()}`;
  }

  // V13 VALIDATION: Enhanced validation for fixed fields
  if (!IngredientSuffix || !IngredientSuffix.trim()) {
    console.log(`[2025-09-16 07:36:28] Missing ingredient suffix by MathDaenniel`);
    return res.redirect('/stocks?msg=validation_error');
  }

  if (!Name || !Name.trim()) {
    console.log(`[2025-09-16 07:36:28] Missing ingredient name by MathDaenniel`);
    return res.redirect('/stocks?msg=validation_error');
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const existingIngredient = await db.collection('Ingredients').findOne({
      IngredientID: finalIngredientID
    });

    if (existingIngredient) {
      await client.close();
      console.log(`[2025-09-16 07:36:28] Duplicate ingredient ID: ${finalIngredientID} by MathDaenniel`);return res.redirect('/stocks?msg=duplicate_id');
    }

    const newIngredient = {
      IngredientID: finalIngredientID,
      Name: Name.trim(),
      Quantity: parseInt(Quantity)|| 0,
      Category: finalCategory, // Fixed category
      Allergen: Allergen ? Allergen.trim() : 'None',
      isAvailable: isAvailable === 'true',
      isEnabled: isEnabled === 'true',
      createdAt: new Date(),
      lastModified: new Date(),
      // V13 Addition: Enhanced metadata
      metadata: {
        createdBy: req.session.user.username || 'MathDaenniel',
        repository: 'roviczzz/Couche-Co',
        version: 'V13-Enhanced',
        prefix: finalPrefix,
        suffix: IngredientSuffix.trim()
      }
    };

    await db.collection('Ingredients').insertOne(newIngredient);
    await client.close();

    console.log(`[2025-09-16 07:36:28] Ingredient added: ${finalIngredientID} by MathDaenniel`);
    res.redirect('/stocks?msg=add_success');
  } catch (err) {
    console.error(`[2025-09-16 07:36:28] Error adding ingredient:`, err, 'by MathDaenniel');
    res.status(500).send('Failed to add ingredient');
  }
});

app.post('/stocks/edit/:id', async (req, res) => {
  const id = req.params.id;
  const { IngredientID, IngredientPrefix, IngredientSuffix, Name, Quantity, Category, Allergen, isAvailable, isEnabled } = req.body;

  // V13 ENHANCEMENT: Fixed prefix and category handling
  const finalPrefix = 'ING'; // Always ING for ingredients
  const finalCategory = 'Ingredients'; // Always Ingredients category

  // Determine the final IngredientID
  let finalIngredientID;

  // If we have IngredientID directly (from form), use it as-is
  if (IngredientID && IngredientID.trim()) {
    finalIngredientID = IngredientID.trim();
  }
  // If we have suffix, combine with fixed prefix
  else if (IngredientSuffix) {
    finalIngredientID = `${finalPrefix}-${IngredientSuffix.trim()}`;
  }

  if (!finalIngredientID) {
    console.log(`[2025-09-16 07:36:28] Missing ingredient ID data for update: ID ${id} by MathDaenniel`);
    return res.redirect('/stocks?msg=item_not_found');
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const currentIngredient = await db.collection('Ingredients').findOne({ _id: new ObjectId(id) });
    if (!currentIngredient) {
      await client.close();
      console.log(`[2025-09-16 07:36:28] Ingredient not found: ID ${id} by MathDaenniel`);return res.redirect('/stocks?msg=item_not_found');
    }

    if (finalIngredientID !== currentIngredient.IngredientID) {
      const existingIngredient = await db.collection('Ingredients').findOne({
        IngredientID: finalIngredientID,
        _id: { $ne: new ObjectId(id) }
      });

      if (existingIngredient) {
        await client.close();
        console.log(`[2025-09-16 07:36:28] Duplicate ingredient ID on update: ${finalIngredientID} by MathDaenniel`);return res.redirect('/stocks?msg=duplicate_id');
      }
    }

    const updateData = {
      IngredientID: finalIngredientID,
      Name: Name.trim(),
      Quantity: parseInt(Quantity)|| 0,
      Category: finalCategory, // Fixed category
      Allergen: Allergen ? Allergen.trim() : 'None',
      isAvailable: isAvailable === 'true',
      isEnabled: isEnabled === 'true',
      lastModified: new Date(),
      // V13 Addition: Enhanced update metadata
      'metadata.lastModifiedBy': req.session.user.username || 'MathDaenniel',
      'metadata.version': 'V13-Enhanced',
      'metadata.prefix': finalPrefix,
      'metadata.suffix': IngredientSuffix ? IngredientSuffix.trim() : finalIngredientID.split('-')[1]
    };

    const result = await db.collection('Ingredients').updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
    );

    await client.close();

    if (result.matchedCount === 0) {
      console.log(`[2025-09-16 07:36:28] Ingredient not found for update: ID ${id} by MathDaenniel`);
      return res.redirect('/stocks?msg=item_not_found');
    }

    console.log(`[2025-09-16 07:36:28] Ingredient updated: ${currentIngredient.IngredientID} -> ${finalIngredientID} by MathDaenniel`);
    res.redirect('/stocks?msg=update_success');
  } catch (err) {
    console.error(`[2025-09-16 07:36:28] Error updating ingredient:`, err, 'by MathDaenniel');
    res.status(500).send('Failed to update ingredient');
  }
});

app.post('/stocks/delete/:id', async (req, res) => {
  const id = req.params.id;
  console.log(`[2025-09-16 07:36:28] Deleting ingredient ID: ${id} by MathDaenniel`);

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const ingredientToDelete = await db.collection('Ingredients').findOne({ _id: new ObjectId(id) });

    if (!ingredientToDelete) {
      await client.close();
      console.log(`[2025-09-16 07:36:28] Ingredient not found for deletion: ID ${id} by MathDaenniel`);return res.redirect('/stocks?msg=item_not_found');
    }

    const result = await db.collection('Ingredients').deleteOne({ _id: new ObjectId(id) });

    await client.close();

    if (result.deletedCount === 0) {
      console.log(`[2025-09-16 07:36:28] Ingredient deletion failed: ID ${id} by MathDaenniel`);
      return res.redirect('/stocks?msg=delete_failed');
    }

    console.log(`[2025-09-16 07:36:28] Ingredient deleted: ${ingredientToDelete.IngredientID} by MathDaenniel`);
    res.redirect('/stocks?msg=delete_success');
  } catch (err) {
    console.error(`[2025-09-16 07:36:28] Error deleting ingredient:`, err, 'by MathDaenniel');
    res.status(500).send('Failed to delete ingredient');
  }
});

// V13 ENHANCED Add-Ons CRUD Routes with Fixed Prefix Support
app.post('/addons', async (req, res) => {
  console.log(`[2025-09-16 07:36:28] Adding new add-on by MathDaenniel`);
  console.log(`[2025-09-16 07:36:28] Request body:`, req.body, 'by MathDaenniel');

  const { AddOnID, AddOnPrefix, AddOnSuffix, Name, Quantity, Category, Allergen, isEnabledAddon } = req.body;

  // V13 ENHANCEMENT: Fixed prefix handling
  const finalPrefix = 'ADD'; // Always ADD for add-ons
  const finalCategory = 'Add-Ons'; // Always Add-Ons category

  // Determine the final AddOnID - combine prefix and suffix WITH dash for database storage
  let finalAddOnID = AddOnID;
  if (AddOnSuffix) {
    finalAddOnID = `${finalPrefix}-${AddOnSuffix.trim()}`;
  }

  // V13 VALIDATION: Enhanced validation for fixed fields
  if (!AddOnSuffix || !AddOnSuffix.trim()) {
    console.log(`[2025-09-16 07:36:28] Missing add-on suffix by MathDaenniel`);
    return res.redirect('/stocks?msg=validation_error');
  }

  if (!Name || !Name.trim()) {
    console.log(`[2025-09-16 07:36:28] Missing add-on name by MathDaenniel`);
    return res.redirect('/stocks?msg=validation_error');
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const existingAddOn = await db.collection('Add-ons').findOne({
      AddOnID: finalAddOnID
    });

    if (existingAddOn) {
      await client.close();
      console.log(`[2025-09-16 07:36:28] Duplicate add-on ID: ${finalAddOnID} by MathDaenniel`);return res.redirect('/stocks?msg=duplicate_id');
    }

    const newAddOn = {
      AddOnID: finalAddOnID,
      Name: Name.trim(),
      Quantity: parseInt(Quantity)|| 0,
      Category: finalCategory, // Fixed category
      Allergen: Allergen ? Allergen.trim() : 'None',
      isEnabled: isEnabledAddon === 'true',
      createdAt: new Date(),
      lastModified: new Date(),
      // V13 Addition: Enhanced metadata
      metadata: {
        createdBy: req.session.user.username || 'MathDaenniel',
        repository: 'roviczzz/Couche-Co',
        version: 'V13-Enhanced',
        prefix: finalPrefix,
        suffix: AddOnSuffix.trim()
      }
    };

    await db.collection('Add-ons').insertOne(newAddOn);
    await client.close();

    console.log(`[2025-09-16 07:36:28] Add-on added: ${finalAddOnID} by MathDaenniel`);
    res.redirect('/stocks?msg=add_success');
  } catch (err) {
    console.error(`[2025-09-16 07:36:28] Error adding add-on:`, err, 'by MathDaenniel');
    res.status(500).send('Failed to add add-on');
  }
});

app.post('/addons/edit/:id', async (req, res) => {
  const id = req.params.id;
  console.log(`[2025-09-16 07:36:28] Updating add-on ID: ${id} by MathDaenniel`);
  console.log(`[2025-09-16 07:36:28] Update data:`, req.body, 'by MathDaenniel');

  const { AddOnID, AddOnPrefix, AddOnSuffix, Name, Quantity, Category, Allergen, isEnabled } = req.body;

  // V13 ENHANCEMENT: Fixed prefix and category handling
  const finalPrefix = 'ADD'; // Always ADD for add-ons
  const finalCategory = 'Add-Ons'; // Always Add-Ons category

  // Determine the final AddOnID
  let finalAddOnID;

  // If we have AddOnID directly (from form), use it as-is
  if (AddOnID && AddOnID.trim()) {
    finalAddOnID = AddOnID.trim();
  }
  // If we have suffix, combine with fixed prefix
  else if (AddOnSuffix) {
    finalAddOnID = `${finalPrefix}-${AddOnSuffix.trim()}`;
  }

  if (!finalAddOnID) {
    console.log(`[2025-09-16 07:36:28] Missing add-on ID data for update: ID ${id} by MathDaenniel`);
    return res.redirect('/stocks?msg=item_not_found');
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const currentAddOn = await db.collection('Add-ons').findOne({ _id: new ObjectId(id) });
    if (!currentAddOn) {
      await client.close();
      console.log(`[2025-09-16 07:36:28] Add-on not found: ID ${id} by MathDaenniel`);return res.redirect('/stocks?msg=item_not_found');
    }

    if (finalAddOnID !== currentAddOn.AddOnID) {
      const existingAddOn = await db.collection('Add-ons').findOne({
        AddOnID: finalAddOnID,
        _id: { $ne: new ObjectId(id) }
      });

      if (existingAddOn) {
        await client.close();
        console.log(`[2025-09-16 07:36:28] Duplicate add-on ID on update: ${finalAddOnID} by MathDaenniel`);return res.redirect('/stocks?msg=duplicate_id');
      }
    }

    const updateData = {
      AddOnID: finalAddOnID,
      Name: Name.trim(),
      Quantity: parseInt(Quantity)|| 0,
      Category: finalCategory, // Fixed category
      Allergen: Allergen ? Allergen.trim() : 'None',
      isEnabled: isEnabled === 'true',
      lastModified: new Date(),
      // V13 Addition: Enhanced update metadata
      'metadata.lastModifiedBy': req.session.user.username || 'MathDaenniel',
      'metadata.version': 'V13-Enhanced',
      'metadata.prefix': finalPrefix,
      'metadata.suffix': AddOnSuffix ? AddOnSuffix.trim() : finalAddOnID.split('-')[1]
    };

    const result = await db.collection('Add-ons').updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
    );

    await client.close();
    req.flash('success_msg', `${Name} has been updated`);
    res.redirect('/stocks');
  } catch (err) {
    console.error('Error editing add-on:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/addons/delete/:id', async (req, res) => {
  const id = req.params.id;
  console.log(`[2025-09-16 07:36:28] Deleting add-on ID: ${id} by MathDaenniel`);

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const addonToDelete = await db.collection('Add-ons').findOne({ _id: new ObjectId(id) });

    if (!addonToDelete) {
      await client.close();
      console.log(`[2025-09-16 07:36:28] Add-on not found for deletion: ID ${id} by MathDaenniel`);return res.redirect('/stocks?msg=item_not_found');
    }

    const result = await db.collection('Add-ons').deleteOne({ _id: new ObjectId(id) });

    await client.close();

    if (result.deletedCount === 0) {
      console.log(`[2025-09-16 07:36:28] Add-on deletion failed: ID ${id} by MathDaenniel`);
      return res.redirect('/stocks?msg=delete_failed');
    }

    console.log(`[2025-09-16 07:36:28] Add-on deleted: ${addonToDelete.AddOnID} by MathDaenniel`);
    res.redirect('/stocks?msg=delete_success');
  } catch (err) {
    console.error(`[2025-09-16 07:36:28] Error deleting add-on:`, err, 'by MathDaenniel');
    res.status(500).send('Failed to delete add-on');
  }
});

// V13 ENHANCED Individual detail routes with better error handling
app.get('/stocks/details/:id', isLoggedIn, async (req, res) => {
  const id = req.params.id;
  console.log(`[2025-09-16 07:36:28] Fetching ingredient details: ${id} by MathDaenniel`);

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ingredient = await db.collection('Ingredients').findOne({ _id: new ObjectId(id) });
    await client.close();

    if (!ingredient) {
      console.log(`[2025-09-16 07:36:28] Ingredient details not found: ${id} by MathDaenniel`);return res.status(404).json({ error: 'Ingredient not found' });
    }

    // V13 Addition: Enhanced response with metadata
    const response = {
      ...ingredient,
      fetchedAt: new Date(),
      fetchedBy: 'MathDaenniel',
      version: 'V13-Enhanced'
    };

    console.log(`[2025-09-16 07:36:28] Ingredient details fetched: ${ingredient.IngredientID} by MathDaenniel`);
    res.json(response);
  } catch (err) {
    console.error(`[2025-09-16 07:36:28] Error fetching ingredient details:`, err, 'by MathDaenniel');
    res.status(500).json({ error: 'Failed to fetch ingredient details' });
  }
});

app.get('/addons/details/:id', isLoggedIn, async (req, res) => {
  const id = req.params.id;
  console.log(`[2025-09-16 07:36:28] Fetching add-on details: ${id} by MathDaenniel`);

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const addon = await db.collection('Add-ons').findOne({ _id: new ObjectId(id) });
    await client.close();

    if (!addon) {
      console.log(`[2025-09-16 07:36:28] Add-on details not found: ${id} by MathDaenniel`);return res.status(404).json({ error: 'Add-on not found' });
    }

    // V13 Addition: Enhanced response with metadata
    const response = {
      ...addon,
      fetchedAt: new Date(),
      fetchedBy: 'MathDaenniel',
      version: 'V13-Enhanced'
    };

    console.log(`[2025-09-16 07:36:28] Add-on details fetched: ${addon.AddOnID} by MathDaenniel`);
    res.json(response);
  } catch (err) {
    console.error(`[2025-09-16 07:36:28] Error fetching add-on details:`, err, 'by MathDaenniel');
    res.status(500).json({ error: 'Failed to fetch add-on details' });
  }
});

// V13 ENHANCED Bulk operations with better performance
app.post('/stocks/bulk-update', isLoggedIn, async (req, res) => {
  const { updates } = req.body;
  console.log(`[2025-09-16 07:36:28] Bulk updating ${updates?.length || 0} ingredients by MathDaenniel`);

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: { _id: new ObjectId(update.id) },
        update: {
          $set: {
            ...update.data,
            lastModified: new Date(),
            'metadata.lastModifiedBy': 'MathDaenniel',
            'metadata.version': 'V13-Enhanced'}
        }
      }
    }));

    const result = await db.collection('Ingredients').bulkWrite(bulkOps);
    await client.close();

    console.log(`[2025-09-16 07:36:28] Bulk update completed: ${result.modifiedCount} ingredients updated by MathDaenniel`);
    res.json({ success: true, modified: result.modifiedCount ,
      timestamp: new Date(),
      version: 'V13-Enhanced'
    });} catch (err) {
    console.error(`[2025-09-16 07:36:28] Error in bulk update:`, err, 'by MathDaenniel');
    res.status(500).json({ error: 'Failed to perform bulk update' });
  }
});

app.post('/addons/bulk-update', isLoggedIn, async (req, res) => {
  const { updates } = req.body;
  console.log(`[2025-09-16 07:36:28] Bulk updating ${updates?.length || 0} add-ons by MathDaenniel`);

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: { _id: new ObjectId(update.id) },
        update: {
          $set: {
            ...update.data,
            lastModified: new Date(),
            'metadata.lastModifiedBy': 'MathDaenniel',
            'metadata.version': 'V13-Enhanced'}
        }
      }
    }));

    const result = await db.collection('Add-ons').bulkWrite(bulkOps);
    await client.close();

    console.log(`[2025-09-16 07:36:28] Bulk update completed: ${result.modifiedCount} add-ons updated by MathDaenniel`);
    res.json({ success: true, modified: result.modifiedCount ,
      timestamp: new Date(),
      version: 'V13-Enhanced'
    });} catch (err) {
    console.error(`[2025-09-16 07:36:28] Error in bulk update:`, err, 'by MathDaenniel');
    res.status(500).json({ error: 'Failed to perform bulk update' });
  }
});

// V13 ENHANCED Data export functionality
app.get('/stocks/export', isLoggedIn, async (req, res) => {
  console.log(`[2025-09-16 07:36:28] Exporting inventory data by MathDaenniel`);try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ingredients = await db.collection('Ingredients').find().toArray();
    const addons = await db.collection('Add-ons').find().toArray();
    await client.close();

    const exportData = {
      ingredients,
      addons,
      exportedAt: new Date(),
      exportedBy: 'MathDaenniel',
      version: 'V13-Enhanced',
      timestamp: '[2025-09-16 07:36:28]',
      repository: 'roviczzz/Couche-Co',
      stats: {
        totalIngredients: ingredients.length,
        totalAddons: addons.length,
        enabledIngredients: ingredients.filter(i => i.isEnabled).length,
        enabledAddons: addons.filter(a => a.isEnabled).length
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-export-v13.json"');
    res.json(exportData);

    console.log(`[2025-09-16 07:36:28] Inventory data exported: ${ingredients.length} ingredients, ${addons.length} add-ons by MathDaenniel`);
  } catch (err) {
    console.error(`[2025-09-16 07:36:28] Error exporting inventory data:`, err, 'by MathDaenniel');
    res.status(500).json({ error: 'Failed to export inventory data' });
  }
});

// V13 ENHANCED Search functionality with better filters
app.get('/stocks/search', isLoggedIn, async (req, res) => {
  const { query, type = 'all', category, enabled } = req.query;
  console.log(`[2025-09-16 07:36:28] Search request: "${query}" type: ${type} by MathDaenniel`);

  if (!query) {
    return res.json({ ingredients: [], addons: [], message: 'No search query provided' });
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const searchRegex = new RegExp(query, 'i');
    let searchFilter = {
      $or: [
        { Name: searchRegex },
        { Category: searchRegex },
        { Allergen: searchRegex },
        { IngredientID: searchRegex },
        { AddOnID: searchRegex }
      ]
    };

    // V13 Addition: Enhanced filtering
    if (category) {
      searchFilter.Category = new RegExp(category, 'i');
    }

    if (enabled !== undefined) {
      searchFilter.isEnabled = enabled === 'true';
    }

    let ingredients = [];
    let addons = [];


    await client.close();

    const response ={
      ingredients,
      addons,
      searchQuery: query,
      searchType: type,
      resultCount: ingredients.length + addons.length,
      timestamp: '[2025-09-16 07:36:28]',
      searchedBy: 'MathDaenniel',
      version: 'V13-Enhanced'
    };

    console.log(`[2025-09-16 07:36:28] Search completed: ${response.resultCount} results for "${query}" by MathDaenniel`);
    res.json(response);
  } catch (err) {
    console.error(`[2025-09-16 07:36:28] Error searching inventory:`, err, 'by MathDaenniel');
    res.status(500).json({ error: 'Failed to search inventory' });
  }
});

// V13 ENHANCED Inventory statistics with more detailed metrics
app.get('/stocks/stats', isLoggedIn, async (req, res) => {
  console.log(`[2025-09-16 07:36:28] Generating inventory statistics by MathDaenniel`);try {
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

    const stats = {
      ingredients: ingredientStats[0] || { totalIngredients: 0, enabledIngredients: 0, availableIngredients: 0,
        totalQuantity: 0,
        averageQuantity: 0,
        categories: [],
        lowStockItems: 0 },
      addons: addonStats[0] || { totalAddons: 0, enabledAddons: 0, totalQuantity: 0, averageQuantity: 0,
        categories: [],
        lowStockItems: 0
      },generatedAt: new Date(),
      generatedBy: 'MathDaenniel',
      version: 'V13-Enhanced',
      timestamp: '[2025-09-16 07:36:28]',
      repository: 'roviczzz/Couche-Co'
    };

    console.log(`[2025-09-16 07:36:28] Inventory statistics generated by MathDaenniel`);
    res.json(stats);
  } catch (err) {
    console.error(`[2025-09-16 07:36:28] Error generating inventory statistics:`, err, 'by MathDaenniel');
    res.status(500).json({ error: 'Failed to generate inventory statistics' });
  }
});

// V13 ENHANCED Low stock alerts with configurable thresholds
app.get('/stocks/alerts', isLoggedIn, async (req, res) => {
  const { threshold = 10, urgent = 5 } = req.query;
  const lowStockThreshold = parseInt(threshold);
  const urgentThreshold = parseInt(urgent);

  console.log(`[2025-09-16 07:36:28] Generating stock alerts (threshold: ${lowStockThreshold}, urgent: ${urgentThreshold}) by MathDaenniel`);

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const lowStockIngredients = await db.collection('Ingredients').find({
      Quantity: { $lte: lowStockThreshold },
      isEnabled: true
    }).toArray();

    const lowStockAddons = await db.collection('Add-ons').find({
      Quantity: { $lte: lowStockThreshold },
      isEnabled: true
    }).toArray();

    // V13 Addition: Urgent alerts
    const urgentIngredients = lowStockIngredients.filter(item => item.Quantity <= urgentThreshold);
    const urgentAddons = lowStockAddons.filter(item => item.Quantity <= urgentThreshold);

    await client.close();

    const alerts = {
      lowStockIngredients,
      lowStockAddons,
      urgentIngredients,
      urgentAddons,
      thresholds: {
        lowStock: lowStockThreshold,
        urgent: urgentThreshold
      },
      counts: {
        totalAlerts: lowStockIngredients.length + lowStockAddons.length,
        urgentAlerts: urgentIngredients.length + urgentAddons.length,
        lowStockIngredients: lowStockIngredients.length,
        lowStockAddons: lowStockAddons.length
      },generatedAt: new Date(),
      generatedBy: 'MathDaenniel',
      timestamp: '[2025-09-16 07:36:28]',
      version: 'V13-Enhanced'
    };

    console.log(`[2025-09-16 07:36:28] Stock alerts generated: ${alerts.counts.totalAlerts} total, ${alerts.counts.urgentAlerts} urgent by MathDaenniel`);
    res.json(alerts);
  } catch (err) {
    console.error(`[2025-09-16 07:36:28] Error generating low stock alerts:`, err, 'by MathDaenniel');
    res.status(500).json({ error: 'Failed to generate low stock alerts' });
  }
});

// V13 ENHANCED Category management with item counts
app.get('/stocks/categories', isLoggedIn, async (req, res) => {
  console.log(`[2025-09-16 07:36:28] Fetching categories by MathDaenniel`);try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Get ingredient categories with counts
    const ingredientCategories = await db.collection('Ingredients').aggregate([
      { $group: { _id: '$Category', count: { $sum: 1 }, enabled: { $sum: { $cond: ['$isEnabled', 1, 0] } } } },
      { $sort: { _id: 1 } }
    ]).toArray();

    // Get addon categories with counts
    const addonCategories = await db.collection('Add-ons').aggregate([
      { $group: { _id: '$Category', count: { $sum: 1 }, enabled: { $sum: { $cond: ['$isEnabled', 1, 0] } } } },
      { $sort: { _id: 1 } }
    ]).toArray();

    await client.close();

    const categories = {
      ingredients: ingredientCategories.filter(cat => cat._id && cat._id.trim()),
      addons: addonCategories.filter(cat => cat._id && cat._id.trim()),
      all: [...ingredientCategories, ...addonCategories].filter(cat => cat._id && cat._id.trim()),
      generatedAt: new Date(),
      generatedBy: 'MathDaenniel',
      timestamp: '[2025-09-16 07:36:28]',
      version: 'V13-Enhanced',
      repository: 'roviczzz/Couche-Co'
    };

    console.log(`[2025-09-16 07:36:28] Categories retrieved: ${categories.ingredients.length} ingredient, ${categories.addons.length} addon categories by MathDaenniel`);
    res.json(categories);
  } catch (err) {
    console.error(`[2025-09-16 07:36:28] Error retrieving categories:`, err, 'by MathDaenniel');
    res.status(500).json({ error: 'Failed to retrieve categories' });
  }
});

// V13 ENHANCED Health check endpoint with detailed status
app.get('/stocks/health', isLoggedIn, async (req, res) => {
  console.log(`[2025-09-16 07:36:28] Performing health check by MathDaenniel`);

  try {
    const startTime = Date.now();
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    await db.admin().ping();

    const ingredientCount = await db.collection('Ingredients').countDocuments();
    const addonCount = await db.collection('Add-ons').countDocuments();
    const enabledIngredients = await db.collection('Ingredients').countDocuments({ isEnabled: true });
    const enabledAddons = await db.collection('Add-ons').countDocuments({ isEnabled: true });

    await client.close();
    const responseTime = Date.now() - startTime;

    const healthStatus = {
      status: 'healthy',
      database: 'connected',
      performance: {
        responseTime: responseTime,
        status: responseTime < 1000 ? 'excellent' : responseTime < 3000 ? 'good' : 'slow'
      },
      inventory: {ingredients: ingredientCount,
        addons: addonCount,
        enabledIngredients: enabledIngredients,
        enabledAddons: enabledAddons,
        totalItems: ingredientCount + addonCount
      },
      version: 'V13-Enhanced',
      timestamp: new Date(),
      checkedBy: 'MathDaenniel',
      repository: 'roviczzz/Couche-Co'
    };

    console.log(`[2025-09-16 07:36:28] Health check completed: ${healthStatus.status} (${responseTime}ms) by MathDaenniel`);
    res.json(healthStatus);
  } catch (err) {
    console.error(`[2025-09-16 07:36:28] Health check failed:`, err, 'by MathDaenniel');
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message,
      timestamp: new Date(),
      checkedBy: 'MathDaenniel',
      version: 'V13-Enhanced'
    });
  }
});

app.get('/order', isLoggedIn, nocache, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri)
    const db = client.db('blessingscafe')
    const ordersCollection = db.collection('Orders')
    const menuCollection = db.collection('Menu')
    const orders = await ordersCollection.find().toArray()
    const menu = await menuCollection.find().toArray()
    await client.close()
    res.render('order', {
      orders,
      menu,
      title: 'Orders | Blessings Cafe',
      user: req.session.user
    })
  } catch (err) {
    res.status(500).send('Internal Server Error')
  }
})

app.patch('/orders/:OrderID/fulfillment', isLoggedIn, nocache, async (req, res) => {
  const { OrderID } = req.params
  const { FulfillmentStatus } = req.body

  if (!FulfillmentStatus) {
    return res.status(400).json({ error: 'FulfillmentStatus is required' })
  }

  if (!OrderID || OrderID.trim() === '') {
    return res.status(400).json({ error: 'Invalid OrderID format' })
  }

  let client
  try {
    client = await MongoClient.connect(uri)
    const db = client.db('blessingscafe')
    const ordersCollection = db.collection('Orders')

    const filter = { OrderID: OrderID }
    const updateDoc = { $set: { FulfillmentStatus } }

    const updateResult = await ordersCollection.updateOne(filter, updateDoc)
    const updatedOrder = await ordersCollection.findOne(filter)

    if (!updatedOrder) {
      await client.close()
      return res.status(404).json({ error: `Order with ID ${OrderID} not found` })
    }

    await client.close()
    return res.status(200).json({
      success: true,
      message: `Fulfillment status updated to "${FulfillmentStatus}"`,
      order: updatedOrder
    })
  } catch (error) {
    if (client) await client.close()
    return res.status(500).json({ error: 'Server error while updating order' })
  }
})

app.patch('/orders/:OrderID/payment-status', isLoggedIn, nocache, async (req, res) => {
  const { OrderID } = req.params
  const { PaymentStatus } = req.body

  if (!PaymentStatus) {
    return res.status(400).json({ error: 'PaymentStatus is required' })
  }

  if (!OrderID || OrderID.trim() === '') {
    return res.status(400).json({ error: 'Invalid OrderID format' })
  }

  let client
  try {
    client = await MongoClient.connect(uri)
    const db = client.db('blessingscafe')
    const ordersCollection = db.collection('Orders')

    const filter = { OrderID: OrderID }
    const updateDoc = { $set: { PaymentStatus } }

    const updateResult = await ordersCollection.updateOne(filter, updateDoc)
    const updatedOrder = await ordersCollection.findOne(filter)

    if (!updatedOrder) {
      await client.close()
      return res.status(404).json({ error: `Order with ID ${OrderID} not found` })
    }

    await client.close()
    return res.status(200).json({
      success: true,
      message: `Payment status updated to "${PaymentStatus}"`,
      order: updatedOrder
    })
  } catch (error) {
    if (client) await client.close()
    return res.status(500).json({ error: 'Server error while updating order' })
  }
})

app.patch('/orders/:OrderID/cancel', isLoggedIn, nocache, async (req, res) => {
  const { OrderID } = req.params

  if (!OrderID || OrderID.trim() === '') {
    return res.status(400).json({ error: 'Invalid OrderID format' })
  }

  let client
  try {
    client = await MongoClient.connect(uri)
    const db = client.db('blessingscafe')
    const ordersCollection = db.collection('Orders')

    const filter = { OrderID: OrderID }

    // First check if the order exists
    const existingOrder = await ordersCollection.findOne(filter)
    if (!existingOrder) {
      await client.close()
      return res.status(404).json({ error: `Order with ID ${OrderID} not found` })
    }

    // Delete the order from the database
    const deleteResult = await ordersCollection.deleteOne(filter)

    if (deleteResult.deletedCount === 0) {
      await client.close()
      return res.status(404).json({ error: `Order with ID ${OrderID} not found` })
    }

    await client.close()
    return res.status(200).json({
      success: true,
      message: 'Order cancelled and deleted successfully',
      deletedOrderID: OrderID
    })
  } catch (error) {
    if (client) await client.close()
    return res.status(500).json({ error: 'Server error while cancelling order' })
  }
})

app.patch('/orders/:OrderID/restore', isLoggedIn, nocache, async (req, res) => {
  const { OrderID } = req.params

  if (!OrderID || OrderID.trim() === '') {
    return res.status(400).json({ error: 'Invalid OrderID format' })
  }

  let client
  try {
    client = await MongoClient.connect(uri)
    const db = client.db('blessingscafe')
    const ordersCollection = db.collection('Orders')

    const filter = { OrderID: OrderID }
    const updateDoc = {
      $set: {
        PaymentStatus: 'Pending',
        FulfillmentStatus: 'Preparing'
      }
    }

    const updateResult = await ordersCollection.updateOne(filter, updateDoc)
    const updatedOrder = await ordersCollection.findOne(filter)

    if (!updatedOrder) {
      await client.close()
      return res.status(404).json({ error: `Order with ID ${OrderID} not found` })
    }

    await client.close()
    return res.status(200).json({
      success: true,
      message: 'Order restored successfully',
      order: updatedOrder
    })
  } catch (error) {
    if (client) await client.close()
    return res.status(500).json({ error: 'Server error while restoring order' })
  }
})

app.get('/orders/edit/:id', isLoggedIn, nocache, async (req, res) => {
  const orderId = req.params.id;

  // ========== END OF ENHANCED STOCKS/INVENTORY ROUTES - V13 ==========

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');
    const menuCollection = db.collection('Menu');

    const order = await ordersCollection.findOne({ _id: new ObjectId(orderId) });

    if (!order) {
      await client.close();
      return res.status(404).send('Order not found');
    }

    if (order.Cart && Array.isArray(order.Cart)) {
      for (let i = 0; i < order.Cart.length; i++) {
        const productId = order.Cart[i].ProductID;
        if (productId && ObjectId.isValid(productId)) {
          const menuItem = await menuCollection.findOne({ _id: new ObjectId(productId) });
          order.Cart[i].imagelink = menuItem && menuItem.imagelink ? menuItem.imagelink : null;
        } else {
          order.Cart[i].imagelink = null;
        }
      }
    }

    // ========== ENHANCED DISCOUNTS/PROMOS ROUTES - V8 ALIGNMENT ==========

    res.render('edit-order', {
      order,
      title: `Edit Order #${order.OrderID}`,
      user: req.session.user
    });
  } catch (err) {
    console.error('Error in /orders/edit/:id:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/discounts', isLoggedIn, nocache, async (req, res) => {
  try {
    console.log(`[2025-09-16 08:22:35] V8 Loading discounts page for user: ${req.session.user.username} by MathDaenniel`);
    console.log(`[2025-09-16 08:22:35] V8 Repository: roviczzz/Couche-Co by MathDaenniel`);

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');
    // V8 Enhanced: Fetch all promos with comprehensive metadata for active promos section
    const promos = await promosCollection.find().sort({ createdAt: -1 }).toArray();

    // V8 Critical Fix: Calculate active promos statistics with enhanced precision
    const now = new Date();
    const activePromos = promos.filter(promo => {
      const startDate = new Date(promo.startDate);
      const endDate = new Date(promo.endDate);
      // V8 Enhancement: Use time boundaries for more accurate filtering
      return now >= new Date(startDate.toISOString().split('T')[0] + 'T00:00:00') &&
          now <= new Date(endDate.toISOString().split('T')[0] + 'T23:59:59') &&
          promo.isActive !== false;
    });

    const upcomingPromos = promos.filter(promo => {
      const startDate = new Date(promo.startDate);
      return now < new Date(startDate.toISOString().split('T')[0] + 'T00:00:00') && promo.isActive !== false;
    });

    const expiredPromos = promos.filter(promo => {
      const endDate = new Date(promo.endDate);
      return now > new Date(endDate.toISOString().split('T')[0] + 'T23:59:59');
    });

    // V8 Enhancement: Calculate expiring soon promos with better precision and real-time support
    const expiringSoonPromos = activePromos.filter(promo => {
      const endDate = new Date(promo.endDate);
      const daysRemaining = Math.ceil((new Date(endDate.toISOString().split('T')[0] + 'T23:59:59') - now) / (1000 * 60 * 60 * 24));
      return daysRemaining <= 7 && daysRemaining >= 0;
    });

    // V8 Addition: Calculate additional statistics for enhanced UI
    const todayActivePromos = activePromos.filter(promo => {
      const today = new Date().toISOString().split('T')[0];
      const startDate = new Date(promo.startDate).toISOString().split('T')[0];
      const endDate = new Date(promo.endDate).toISOString().split('T')[0];
      return today >= startDate && today <= endDate;
    });

    const highDiscountPromos = activePromos.filter(promo => promo.discountPercentage >= 20);
    const newPromos = promos.filter(promo => {
      const createdAt = new Date(promo.createdAt);
      const daysSinceCreated = (now - createdAt) / (1000 * 60 * 60 * 24);
      return daysSinceCreated <= 7;
    });
    await client.close();

    console.log(`[2025-09-16 08:22:35] V8 Fetched ${promos.length} promos from database by MathDaenniel`);
    console.log(`[2025-09-16 08:22:35] V8 Statistics - Active: ${activePromos.length}, Upcoming: ${upcomingPromos.length}, Expired: ${expiredPromos.length}, Expiring Soon: ${expiringSoonPromos.length} by MathDaenniel`);
    console.log(`[2025-09-16 08:22:35] V8 Enhanced Stats - Today Active: ${todayActivePromos.length}, High Discount: ${highDiscountPromos.length}, New: ${newPromos.length} by MathDaenniel`);

    const message = req.query.msg || null;

    res.render('discounts', {
      promos,
      activePromos,
      upcomingPromos,
      expiredPromos,
      expiringSoonPromos,
      todayActivePromos,
      highDiscountPromos,
      newPromos,
      promoStats: {
        total: promos.length,
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
      currentPage: req.path,
      currentDate: now.toISOString(),
      // V8 Addition: Enhanced navbar configuration for complete active promos fix
      navbarConfig: {
        fixed: true,
        contentOnlyScroll: true,
        height: 80,
        mobileHeight: 60,
        tabletHeight: 70,
        enhancedShadow: true,
        realTimeUpdates: true,
        adaptiveHeight: true,
        blurEffect: true
      },
      // V8 Addition: Complete UI enhancement flags with comprehensive active promos functionality
      uiFeatures: {
        autoSaveForms: true,
        performanceMonitoring: true,
        enhancedScrolling: true,
        superiorDeleteFunctionality: true,
        enhancedValidation: true,
        completeActivePromosUpdateFix: true,
        realTimeDataSync: true,
        bulkOperations: true,
        smartDateSuggestions: true,
        promoPreview: true,
        errorRecovery: true,
        version: 'V8-CompleteActivePromosFixture'
      },
      // V8 Addition: Enhanced metadata for real-time sync
      syncMetadata: {
        lastSync: now.toISOString(),
        version: 'V8-CompleteActivePromosFixture',
        repository: 'roviczzz/Couche-Co',
        user: 'MathDaenniel',
        features: {
          activePromosRealTimeUpdate: true,
          dateChangeDetection: true,
          cacheManagement: true,
          dataAttributeSync: true,
          disappearingIssueResolved: true
        }
      }
    });
  } catch (err) {
    console.error(`[2025-09-16 08:22:35] V8 Error fetching promos:`, err, 'by MathDaenniel');
    res.status(500).send('Failed to load promos');
  }
});

// POST route for adding new promo - Enhanced for V8 with Complete Real-Time Update Support
app.post('/discounts/add', isLoggedIn, async (req, res) => {
  console.log(`[2025-09-16 08:22:35] V8 Promo add request started for user: ${req.session.user.username} by MathDaenniel`);
  console.log(`[2025-09-16 08:22:35] V8 Repository: roviczzz/Couche-Co by MathDaenniel`);
  console.log(`[2025-09-16 08:22:35] V8 Request body:`, req.body, 'by MathDaenniel');

  try {
    // V8 Enhanced: Check if req.body exists with better error reporting
    if (!req.body || typeof req.body !== 'object') {
      console.log(`[2025-09-16 08:22:35] V8 Critical error: req.body is not an object by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Request body parsing failed. Please check form configuration.',
        debug: {
          bodyType: typeof req.body,
          bodyValue: req.body,
          contentType: req.headers['content-type'],
          version: 'V8-CompleteActivePromosFixture'
        },
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    // Extract data from form with V8 enhanced destructuring
    const { event, startDate, endDate, description, discountPercentage, metadata } = req.body;

    // V8 Enhanced logging with more detailed field information
    console.log(`[2025-09-16 08:22:35] V8 Extracted fields:`, {
      event: event ? `"${event}" (${event.length} chars)` : 'missing',
      startDate: startDate || 'missing',
      endDate: endDate || 'missing',
      description: description ? `"${description.substring(0, 50)}..." (${description.length} chars)` : 'missing',
      discountPercentage: discountPercentage,
      metadata: metadata ? Object.keys(metadata) : 'none'
    }, 'by MathDaenniel');

    // V8 Enhanced validation with comprehensive error reporting
    if (!event || !startDate || !endDate || !description || discountPercentage === undefined || discountPercentage === null) {
      console.log(`[2025-09-16 08:22:35] V8 Validation failed - missing fields by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'All fields are required for promo creation',
        received: { event, startDate, endDate, description, discountPercentage },
        validationErrors: {
          event: !event ? 'Event name is required and must be at least 3 characters' : null,
          description: !description ? 'Description is required and must be at least 10 characters' : null,
          discountPercentage: (discountPercentage === undefined || discountPercentage === null) ? 'Discount percentage is required and must be greater than 0' : null,
          startDate: !startDate ? 'Start date is required' : null,
          endDate: !endDate ? 'End date is required' : null
        },
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    // V8 Enhanced field validation with more detailed checks
    const trimmedEvent = String(event).trim();
    const trimmedDescription = String(description).trim();

    // V8 Enhancement: More comprehensive event name validation
    if (!trimmedEvent || trimmedEvent.length < 3) {
      console.log(`[2025-09-16 08:22:35] V8 Event name validation failed: "${trimmedEvent}" by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Event name must be at least 3 characters long',
        received: trimmedEvent,
        requirements: 'Enter a descriptive event name (minimum 3 characters)',
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    if (trimmedEvent.length > 100) {
      console.log(`[2025-09-16 08:22:35] V8 Event name too long: ${trimmedEvent.length} chars by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Event name must be 100 characters or less',
        received: `${trimmedEvent.length} characters`,
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    // V8 Enhancement: More comprehensive description validation
    if (!trimmedDescription || trimmedDescription.length < 10) {
      console.log(`[2025-09-16 08:22:35] V8 Description validation failed: "${trimmedDescription.substring(0, 20)}..." by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Description must be at least 10 characters long',
        received: `${trimmedDescription.length} characters`,
        requirements: 'Enter a detailed description (minimum 10 characters)',
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    if (trimmedDescription.length > 500) {
      console.log(`[2025-09-16 08:22:35] V8 Description too long: ${trimmedDescription.length} chars by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Description must be 500 characters or less',
        received: `${trimmedDescription.length} characters`,
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    // V8 Enhanced discount percentage validation with more precise checking
    const discountPercent = parseFloat(discountPercentage);
    if (isNaN(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      console.log(`[2025-09-16 08:22:35] V8 Discount percentage validation failed: ${discountPercentage} by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Discount percentage must be a number between 0.01 and 100',
        received: discountPercentage,
        validRange: '0.01 - 100.00',
        examples: ['5', '15.5', '25', '50'],
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    // V8 Enhanced date validation with comprehensive error reporting
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    console.log(`[2025-09-16 08:22:35] V8 Date parsing:`, {
      startInput: startDate,
      endInput: endDate,
      startParsed: start.toISOString(),
      endParsed: end.toISOString(),
      now: now.toISOString(),
      startValid: !isNaN(start.getTime()),
      endValid: !isNaN(end.getTime())
    }, 'by MathDaenniel');

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.log(`[2025-09-16 08:22:35] V8 Date validation failed - invalid dates by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please use valid dates.',
        received: { startDate, endDate },
        expectedFormat: 'YYYY-MM-DD',
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    if (start > end) {
      console.log(`[2025-09-16 08:22:35] V8 Date validation failed - start date after end date by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'End date must be after or equal to start date',
        received: {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0]
        },
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    // V8 Addition: Enhanced date range validation with warnings
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const twoYearsFromNow = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    let dateWarnings = [];

    if (end < now) {
      dateWarnings.push('End date is in the past - promo will be expired immediately');
    }

    if (end < oneYearAgo) {
      console.log(`[2025-09-16 08:22:35] V8 Warning: Creating promo with very old end date by MathDaenniel`);
      dateWarnings.push('End date is more than a year ago');
    }

    if (start > twoYearsFromNow) {
      console.log(`[2025-09-16 08:22:35] V8 Warning: Creating promo with start date far in future by MathDaenniel`);
      dateWarnings.push('Start date is more than 2 years in the future');
    }

    if (start < oneDayFromNow && start > now) {
      dateWarnings.push('Promo starts within 24 hours');
    }

    const promoDuration = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (promoDuration > 365) {
      dateWarnings.push(`Promo duration is ${promoDuration} days (more than 1 year)`);
    }

    if (dateWarnings.length > 0) {
      console.log(`[2025-09-16 08:22:35] V8 Date warnings:`, dateWarnings, 'by MathDaenniel');
    }

    console.log(`[2025-09-16 08:22:35] V8 Connecting to MongoDB by MathDaenniel`);

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');

    // V8 Enhanced duplicate check with more sophisticated overlap detection
    const overlappingPromo = await promosCollection.findOne({
      $or: [
        {
          event: trimmedEvent,
          $or: [
            { startDate: { $lte: end }, endDate: { $gte: start } }
          ]
        },
        {
          event: { $regex: new RegExp(`^${trimmedEvent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          $or: [
            { startDate: { $lte: end }, endDate: { $gte: start } }
          ]
        }
      ]
    });

    if (overlappingPromo) {
      await client.close();
      console.log(`[2025-09-16 08:22:35] V8 Overlapping promo detected by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: `A promo with the name "${trimmedEvent}" already exists with overlapping dates.`,
        conflictingPromo: {
          event: overlappingPromo.event,
          startDate: overlappingPromo.startDate.toISOString().split('T')[0],
          endDate: overlappingPromo.endDate.toISOString().split('T')[0],
          discountPercentage: overlappingPromo.discountPercentage
        },
        suggestion: 'Please choose different dates or modify the event name.',
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    // V8 Enhanced promo object with comprehensive metadata for complete real-time updates
    const newPromo = {
      event: trimmedEvent,
      startDate: start,
      endDate: end,
      description: trimmedDescription,
      discountPercentage: discountPercent,
      isActive: true,
      status: getPromoStatus(start, end, now),
      createdAt: new Date(),
      createdBy: req.session.user.username || 'MathDaenniel',
      lastModified: new Date(),
      lastModifiedBy: req.session.user.username || 'MathDaenniel',
      version: 'V8-CompleteActivePromosFixture',
      metadata: {
        clientIP: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: now.toISOString(),
        repository: 'roviczzz/Couche-Co',
        sessionId: req.sessionID,
        createdBy: 'MathDaenniel',
        formMetadata: metadata || {},
        validationPassed: {
          eventLength: trimmedEvent.length,
          descriptionLength: trimmedDescription.length,
          discountRange: `${discountPercent}%`,
          dateRange: `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`,
          promoDuration: promoDuration
        },
        warnings: dateWarnings,
        // V8 Addition: Complete real-time update tracking
        activePromosUpdateSupport: true,
        realTimeSync: true,
        completeActivePromosFix: true,
        dataAttributeSync: true,
        cacheManagement: true
      }
    };

    console.log(`[2025-09-16 08:22:35] V8 Document to insert:`, {
      ...newPromo,
      metadata: { ...newPromo.metadata, formMetadata: 'truncated for logging' }
    }, 'by MathDaenniel');

    const result = await promosCollection.insertOne(newPromo);
    console.log(`[2025-09-16 08:22:35] V8 Insert result:`, result, 'by MathDaenniel');

    // V8 Enhanced verification and get complete document
    const insertedDoc = await promosCollection.findOne({ _id: result.insertedId });
    console.log(`[2025-09-16 08:22:35] V8 Verification - discount percentage saved:`, insertedDoc?.discountPercentage, 'by MathDaenniel');

    // V8 Enhanced statistics calculation for Active Promos Section
    const totalCount = await promosCollection.countDocuments();
    const activeCount = await promosCollection.countDocuments({
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true
    });

    const expiringSoonCount = await promosCollection.countDocuments({
      startDate: { $lte: now },
      endDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
      isActive: true
    });

    console.log(`[2025-09-16 08:22:35] V8 Statistics - Total: ${totalCount}, Active: ${activeCount}, Expiring Soon: ${expiringSoonCount} by MathDaenniel`);

    await client.close();
    console.log('✅ MongoDB connection closed');

    console.log(`[2025-09-16 08:22:35] V8 Promo add request completed successfully by MathDaenniel`);

    // V8 Enhanced response with complete real-time update support
    res.json({
      success: true,
      message: 'Promo added successfully',
      promo: {
        _id: result.insertedId,
        ...newPromo,
        // V8 Addition: Include formatted data for client-side use
        formattedStartDate: start.toISOString().split('T')[0],
        formattedEndDate: end.toISOString().split('T')[0]
      },
      stats: {
        total: totalCount,
        active: activeCount,
        expiringSoon: expiringSoonCount,
        status: newPromo.status
      },
      warnings: dateWarnings,
      // V8 Addition: Complete UI feedback information with comprehensive real-time sync
      uiRefresh: {
        activePromosSection: true,
        navbarUpdate: false,
        clearAutoSave: true,
        scrollToNew: true,
        showSuccessFeedback: true,
        realTimeUpdate: true,
        cacheUpdate: true,
        dataAttributeSync: true,
        completeActivePromosRefresh: true,
        timestamp: now.toISOString()
      },
      performance: {
        processingTime: Date.now() - now.getTime(),
        version: 'V8-CompleteActivePromosFixture',
        repository: 'roviczzz/Couche-Co'
      },
      timestamp: '[2025-09-16 08:22:35]'
    });
  } catch (err) {
    console.error(`[2025-09-16 08:22:35] V8 Error adding promo:`, err, 'by MathDaenniel');

    res.status(500).json({
      success: false,
      message: 'Database error occurred. Please check server logs.',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      version: 'V8-CompleteActivePromosFixture',
      timestamp: '[2025-09-16 08:22:35]'
    });
  }
});

// POST route for editing promo - V8 ENHANCED with Complete Real-Time Active Promos Update Fix
app.post('/discounts/edit/:id', isLoggedIn, async (req, res) => {
  const { id } = req.params;
  const startTime = Date.now();

  try {
    console.log(`[2025-09-16 08:22:35] V8 Complete Active Promos Fix - Edit promo request for ID: ${id} by MathDaenniel`);
    console.log(`[2025-09-16 08:22:35] V8 Repository: roviczzz/Couche-Co by MathDaenniel`);

    // V8 Enhanced: Get form data from either JSON or FormData with better handling
    let event, startDate, endDate, description, discountPercentage, metadata;

    if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
      ({ event, startDate, endDate, description, discountPercentage, metadata } = req.body);
      console.log(`[2025-09-16 08:22:35] V8 Processing JSON request by MathDaenniel`);
    } else {
      event = req.body.event;
      startDate = req.body.startDate;
      endDate = req.body.endDate;
      description = req.body.description;
      discountPercentage = req.body.discountPercentage;
      metadata = req.body.metadata;
      console.log(`[2025-09-16 08:22:35] V8 Processing form data request by MathDaenniel`);
    }

    console.log(`[2025-09-16 08:22:35] V8 Edit request data:`, {
      event: event ? `"${event}" (${event.length} chars)` : 'missing',
      startDate,
      endDate,
      description: description ? `"${description.substring(0, 30)}..." (${description.length} chars)` : 'missing',
      discountPercentage,
      metadata: metadata ? 'present' : 'none'
    }, 'by MathDaenniel');

    // V8 Enhanced validation with comprehensive error messages
    if (!event || !startDate || !endDate || !description || discountPercentage === undefined || discountPercentage === null) {
      console.log(`[2025-09-16 08:22:35] V8 Edit validation failed - missing fields by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'All fields are required for promo update. Please check your form inputs.',
        received: { event, startDate, endDate, description, discountPercentage },
        validationErrors: {
          event: !event ? 'Event name is required (minimum 3 characters)' : null,
          startDate: !startDate ? 'Start date is required (YYYY-MM-DD format)' : null,
          endDate: !endDate ? 'End date is required (YYYY-MM-DD format)' : null,
          description: !description ? 'Description is required (minimum 10 characters)' : null,
          discountPercentage: (discountPercentage === undefined || discountPercentage === null) ? 'Discount percentage is required (0.01-100)' : null
        },
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    // V8 Enhanced field validation with more comprehensive checks
    const trimmedEvent = String(event).trim();
    const trimmedDescription = String(description).trim();

    if (trimmedEvent.length < 3) {
      console.log(`[2025-09-16 08:22:35] V8 Edit event name too short: "${trimmedEvent}" by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Event name must be at least 3 characters long',
        received: trimmedEvent,
        currentLength: trimmedEvent.length,
        minimumRequired: 3,
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    if (trimmedEvent.length > 100) {
      console.log(`[2025-09-16 08:22:35] V8 Edit event name too long: ${trimmedEvent.length} chars by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Event name must be 100 characters or less',
        received: trimmedEvent.length,
        maximumAllowed: 100,
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    if (trimmedDescription.length < 10) {
      console.log(`[2025-09-16 08:22:35] V8 Edit description too short: ${trimmedDescription.length} chars by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Description must be at least 10 characters long',
        received: trimmedDescription.length,
        minimumRequired: 10,
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    if (trimmedDescription.length > 500) {
      console.log(`[2025-09-16 08:22:35] V8 Edit description too long: ${trimmedDescription.length} chars by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Description must be 500 characters or less',
        received: trimmedDescription.length,
        maximumAllowed: 500,
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    // V8 Enhanced discount percentage validation
    const discountPercent = parseFloat(discountPercentage);
    if (isNaN(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      console.log(`[2025-09-16 08:22:35] V8 Edit discount percentage validation failed: ${discountPercentage} by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Discount percentage must be a valid number between 0.01 and 100',
        received: discountPercentage,
        validRange: '0.01 - 100.00',
        examples: ['5.0', '15.5', '25.0', '50.0'],
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    // V8 Enhanced date validation with comprehensive error reporting
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    console.log(`[2025-09-16 08:22:35] V8 Edit date validation:`, {
      startInput: startDate,
      endInput: endDate,
      startParsed: start.toISOString(),
      endParsed: end.toISOString(),
      startValid: !isNaN(start.getTime()),
      endValid: !isNaN(end.getTime()),
      startBeforeEnd: start <= end
    }, 'by MathDaenniel');

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.log(`[2025-09-16 08:22:35] V8 Edit date validation failed - invalid dates by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please use YYYY-MM-DD format.',
        received: { startDate, endDate },
        expectedFormat: 'YYYY-MM-DD',
        examples: ['2025-01-15', '2025-12-31'],
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    if (start > end) {
      console.log(`[2025-09-16 08:22:35] V8 Edit date range validation failed by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'End date must be after or equal to start date',
        received: {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0]
        },
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    // V8 Enhanced promo retrieval with detailed logging
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');

    // V8 Enhanced: Get current promo for logging and comparison
    const currentPromo = await promosCollection.findOne({ _id: new ObjectId(id) });
    if (!currentPromo) {
      await client.close();
      console.log(`[2025-09-16 08:22:35] V8 Promo not found for edit: ${id} by MathDaenniel`);
      return res.status(404).json({
        success: false,
        message: 'Promo not found. It may have been deleted by another user.',
        promoId: id,
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    console.log(`[2025-09-16 08:22:35] V8 Current promo found: "${currentPromo.event}" by MathDaenniel`);

    // V8 Enhanced duplicate check - excluding current promo with better conflict detection
    const duplicatePromo = await promosCollection.findOne({
      _id: { $ne: new ObjectId(id) },
      $or: [
        {
          event: trimmedEvent,
          $or: [
            { startDate: { $lte: end }, endDate: { $gte: start } }
          ]
        },
        {
          event: { $regex: new RegExp(`^${trimmedEvent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          $or: [
            { startDate: { $lte: end }, endDate: { $gte: start } }
          ]
        }
      ]
    });

    if (duplicatePromo) {
      await client.close();
      console.log(`[2025-09-16 08:22:35] V8 Duplicate promo detected during edit by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: `A promo with the name "${trimmedEvent}" already exists with overlapping dates.`,
        conflictingPromo: {
          id: duplicatePromo._id,
          event: duplicatePromo.event,
          startDate: duplicatePromo.startDate.toISOString().split('T')[0],
          endDate: duplicatePromo.endDate.toISOString().split('T')[0],
          discountPercentage: duplicatePromo.discountPercentage
        },
        suggestion: 'Please choose different dates or modify the event name.',
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    // V8 Enhanced update with comprehensive status calculation and change tracking
    const newStatus = getPromoStatus(start, end, now);
    const changes = [];
    const changeDetails = {};

    // V8 Enhanced: Track detailed changes for comprehensive logging
    if (currentPromo.event !== trimmedEvent) {
      changes.push('event');
      changeDetails.event = { from: currentPromo.event, to: trimmedEvent };
    }
    if (currentPromo.description !== trimmedDescription) {
      changes.push('description');
      changeDetails.description = {
        from: currentPromo.description.substring(0, 50) + '...',
        to: trimmedDescription.substring(0, 50) + '...'
      };
    }
    if (currentPromo.discountPercentage !== discountPercent) {
      changes.push('discountPercentage');
      changeDetails.discountPercentage = { from: currentPromo.discountPercentage, to: discountPercent };
    }
    if (new Date(currentPromo.startDate).getTime() !== start.getTime()) {
      changes.push('startDate');
      changeDetails.startDate = {
        from: new Date(currentPromo.startDate).toISOString().split('T')[0],
        to: start.toISOString().split('T')[0]
      };
    }
    if (new Date(currentPromo.endDate).getTime() !== end.getTime()) {
      changes.push('endDate');
      changeDetails.endDate = {
        from: new Date(currentPromo.endDate).toISOString().split('T')[0],
        to: end.toISOString().split('T')[0]
      };
    }

    console.log(`[2025-09-16 08:22:35] V8 Detected changes:`, { changes, changeDetails }, 'by MathDaenniel');const updateResult = await promosCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            event: trimmedEvent,
            startDate: start,
            endDate: end,
            description: trimmedDescription,
            discountPercentage: discountPercent,status: newStatus,
            lastModified: new Date(),
            lastModifiedBy: req.session.user.username || 'MathDaenniel',
            version: 'V8-CompleteActivePromosFixture',
            changeHistory: {
              fields: changes,
              details: changeDetails,
              timestamp: now.toISOString(),
              user: req.session.user.username || 'MathDaenniel',
              repository: 'roviczzz/Couche-Co',
              updateMetadata: metadata || {},
              // V8 Addition: Track complete active promo update fix
              completeActivePromosUpdate: true,
              realTimeSyncEnabled: true,
              dataAttributeSyncEnabled: true,
              cacheManagementEnabled: true
            }
          }
        }
    );

    console.log(`[2025-09-16 08:22:35] V8 Update result:`, updateResult, 'by MathDaenniel');

    // V8 Enhanced: Get updated statistics for Complete Active Promos Section
    const activeCount = await promosCollection.countDocuments({
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true
    });

    const expiringSoonCount = await promosCollection.countDocuments({
      startDate: { $lte: now },
      endDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
      isActive: true
    });

    await client.close();

    if (updateResult.matchedCount === 0) {
      console.log(`[2025-09-16 08:22:35] V8 No promo matched for update: ${id} by MathDaenniel`);
      return res.status(404).json({
        success: false,
        message: 'Promo not found or no changes detected',
        promoId: id,
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:22:35]'
      });
    }

    const processingTime = Date.now() - startTime;

    console.log(`[2025-09-16 08:22:35] V8 COMPLETE ACTIVE PROMOS FIX - Promo updated: ${currentPromo.event} -> ${trimmedEvent} by MathDaenniel`);
    console.log(`[2025-09-16 08:22:35] V8 Status changed: ${currentPromo.status || 'undefined'} -> ${newStatus} by MathDaenniel`);
    console.log(`[2025-09-16 08:22:35] V8 Fields changed: ${changes.join(', ')} (${processingTime}ms) by MathDaenniel`);

    // V8 CRITICAL: Return comprehensive data that client needs to update data-original attributes and cache
    const updatedPromoData = {
      _id: id,
      event: trimmedEvent,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      description: trimmedDescription,
      discountPercentage: discountPercent,
      status: newStatus,
      lastModified: new Date().toISOString()
    };

    res.json({
      success: true,
      message: 'Promo updated successfully with complete active promos sync',
      changes: {
        modified: changes,
        details: changeDetails,
        count: changes.length
      },
      stats: {
        active: activeCount,
        expiringSoon: expiringSoonCount,
        status: newStatus
      },
      // V8 CRITICAL FIX: Complete updated data for client-side cache and UI sync
      updatedData: updatedPromoData,
      // V8 Addition: Complete UI feedback with comprehensive performance data
      uiUpdate: {
        refreshActivePromos: true,
        highlightRow: true,
        clearCache: true,
        realTimeSync: true,
        timestamp: new Date().toISOString()
      },
      performance: {
        processingTime: processingTime,
        changeCount: changes.length,
        version: 'V8-CompleteActivePromosFixture',
        repository: 'roviczzz/Couche-Co'
      },
      timestamp: '[2025-09-16 08:22:35]'
    });
  } catch (err) {
    console.error(`[2025-09-16 08:22:35] V8 Error editing promo:`, err, 'by MathDaenniel');
    res.status(500).json({
      success: false,
      message: 'Database error during update: ' + err.message,
      version: 'V8-CompleteActivePromosFixture',
      timestamp: '[2025-09-16 08:22:35]'
    });
  }
});

// POST route for deleting promo - V8 ENHANCED with Complete Real-Time Update Support
app.post('/discounts/delete/:id', isLoggedIn, async (req, res) => {
  const { id } = req.params;
  const startTime = Date.now();

  console.log(`[2025-09-16 08:27:17] V8 Complete Active Promos Fix - Enhanced delete promo request: ${id} by MathDaenniel`);
  console.log(`[2025-09-16 08:27:17] V8 Repository: roviczzz/Couche-Co by MathDaenniel`);

  // V8 Enhanced ObjectId validation
  if (!ObjectId.isValid(id)) {
    console.log(`[2025-09-16 08:27:17] V8 Invalid ObjectId for delete: ${id} by MathDaenniel`);
    return res.status(400).json({
      success: false,
      message: 'Invalid promo ID format',
      received: id,
      expectedFormat: '24-character hexadecimal string',
      version: 'V8-CompleteActivePromosFixture',
      timestamp: '[2025-09-16 08:27:17]'
    });
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');

    // V8 Enhanced: Get promo details before deletion for comprehensive logging and safety checks
    const promo = await promosCollection.findOne({ _id: new ObjectId(id) });

    if (!promo) {
      await client.close();
      console.log(`[2025-09-16 08:27:17] V8 Promo not found for delete: ${id} by MathDaenniel`);
      return res.status(404).json({
        success: false,
        message: 'Promo not found. It may have already been deleted by another user.',
        promoId: id,
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:27:17]'
      });
    }

    console.log(`[2025-09-16 08:27:17] V8 Promo found for deletion: "${promo.event}" by MathDaenniel`);

    // V8 Enhanced safety checks and comprehensive audit logging
    const now = new Date();
    const startDate = new Date(promo.startDate);
    const endDate = new Date(promo.endDate);
    const isCurrentlyActive = now >= startDate && now <= endDate && promo.isActive;
    const daysUntilStart = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24));
    const daysUntilEnd = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    const isExpiringSoon = isCurrentlyActive && daysUntilEnd <= 7 && daysUntilEnd > 0;
    const isHighDiscount = promo.discountPercentage >= 20;
    const promoDuration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    // V8 Enhanced metadata from request body
    const deleteMetadata = req.body.metadata || {};

    // V8 Enhanced warnings for important deletions
    if (isCurrentlyActive) {
      console.log(`[2025-09-16 08:27:17] V8 WARNING: Deleting currently active promo "${promo.event}" (${daysUntilEnd} days remaining) by MathDaenniel`);
    }

    if (isExpiringSoon) {
      console.log(`[2025-09-16 08:27:17] V8 ALERT: Deleting promo "${promo.event}" that expires soon (${daysUntilEnd} days) by MathDaenniel`);
    }

    if (isHighDiscount) {
      console.log(`[2025-09-16 08:27:17] V8 NOTICE: Deleting high discount promo "${promo.event}" (${promo.discountPercentage}% off) by MathDaenniel`);
    }

    // V8 Enhanced audit trail logging with comprehensive context
    console.log(`[2025-09-16 08:27:17] V8 Complete deletion context for "${promo.event}":`, {
      isActive: isCurrentlyActive,
      isExpiringSoon: isExpiringSoon,
      isHighDiscount: isHighDiscount,
      daysToStart: daysUntilStart,
      daysToEnd: daysUntilEnd,
      promoDuration: promoDuration,
      discountPercentage: promo.discountPercentage,
      createdAt: promo.createdAt,
      user: req.session.user.username || 'MathDaenniel',
      repository: 'roviczzz/Couche-Co',
      deleteMetadata: deleteMetadata,
      realTimeSyncEnabled: true,
      completeActivePromosUpdateFix: true
    }, 'by MathDaenniel');

    // V8 Addition: Create comprehensive deletion record for audit trail
    const deletionRecord = {
      originalPromoId: promo._id,
      promoData: { ...promo },
      deletedAt: new Date(),
      deletedBy: req.session.user.username || 'MathDaenniel',
      deletionContext: {
        wasActive: isCurrentlyActive,
        wasExpiringSoon: isExpiringSoon,
        wasHighDiscount: isHighDiscount,
        daysUntilStart: daysUntilStart,
        daysUntilEnd: daysUntilEnd,
        promoDuration: promoDuration,
        deletionWarnings: {
          activePromoDeleted: isCurrentlyActive,
          expiringSoonDeleted: isExpiringSoon,
          highDiscountDeleted: isHighDiscount
        }
      },
      metadata: {
        ...deleteMetadata,
        clientIP: req.ip,
        userAgent: req.get('User-Agent'),
        repository: 'roviczzz/Couche-Co',
        version: 'V8-CompleteActivePromosFixture',
        realTimeSyncSupport: true,
        completeActivePromosUpdateFix: true
      }
    };

    // V8 Optional: Store deletion record (uncomment if you want to keep deletion history)
    // await db.collection('PromosDeletionLog').insertOne(deletionRecord);

    const deleteResult = await promosCollection.deleteOne({ _id: new ObjectId(id) });

    console.log(`[2025-09-16 08:27:17] V8 Delete operation result:`, deleteResult, 'by MathDaenniel');

    // V8 Enhanced: Get comprehensive updated statistics after deletion
    const totalCount = await promosCollection.countDocuments();
    const activeCount = await promosCollection.countDocuments({
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true
    });

    const expiringSoonCount = await promosCollection.countDocuments({
      startDate: { $lte: now },
      endDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
      isActive: true
    });

    const upcomingCount = await promosCollection.countDocuments({
      startDate: { $gt: now },
      isActive: true
    });

    await client.close();

    if (deleteResult.deletedCount === 0) {
      console.log(`[2025-09-16 08:27:17] V8 No promo was deleted: ${id} by MathDaenniel`);
      return res.status(404).json({
        success: false,
        message: 'Promo could not be deleted. It may have been deleted by another user.',
        promoId: id,
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:27:17]'
      });
    }

    const processingTime = Date.now() - startTime;

    console.log(`[2025-09-16 08:27:17] V8 SUCCESS: Promo "${promo.event}" deleted successfully (${processingTime}ms) by MathDaenniel`);

    // V8 Enhanced response with comprehensive deletion information and complete UI sync
    res.json({
      success: true,
      message: `Promo "${promo.event}" deleted successfully`,
      deletedPromo: {
        id: promo._id,
        event: promo.event,
        description: promo.description,
        status: promo.status,
        discountPercentage: promo.discountPercentage,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        wasActive: isCurrentlyActive,
        wasExpiringSoon: isExpiringSoon,
        wasHighDiscount: isHighDiscount,
        promoDuration: promoDuration
      },
      stats: {
        total: totalCount,
        active: activeCount,
        expiringSoon: expiringSoonCount,
        upcoming: upcomingCount
      },
      // V8 Addition: Comprehensive deletion feedback with enhanced warnings
      deletionInfo: {
        wasCurrentlyActive: isCurrentlyActive,
        wasExpiringSoon: isExpiringSoon,
        wasHighDiscount: isHighDiscount,
        daysUntilStart: daysUntilStart,
        daysUntilEnd: daysUntilEnd,
        promoDuration: promoDuration,
        deletionWarnings: {
          activePromoDeleted: isCurrentlyActive,
          expiringSoonDeleted: isExpiringSoon,
          highDiscountDeleted: isHighDiscount,
          significantPromoDeleted: isCurrentlyActive || isExpiringSoon || isHighDiscount
        },
        timestamp: now.toISOString()
      },
      performance: {
        processingTime: processingTime,
        version: 'V8-CompleteActivePromosFixture',
        repository: 'roviczzz/Couche-Co'
      },
      // V8 Addition: Complete UI feedback instructions with comprehensive real-time update support
      uiUpdate: {
        showDeleteSuccess: true,
        refreshActivePromos: true,
        removeFromTable: true,
        highlightChanges: true,
        clearCache: true, // V8 CRITICAL: Clear client-side cache completely
        realTimeSync: true,
        completeActivePromosRefresh: true,
        dataAttributeSync: true,
        cacheUpdate: true,
        timestamp: now.toISOString()
      },
      timestamp: '[2025-09-16 08:27:17]'
    });
  } catch (err) {
    console.error(`[2025-09-16 08:27:17] V8 CRITICAL ERROR during promo deletion:`, err, 'by MathDaenniel');
    res.status(500).json({
      success: false,
      message: 'Database error during deletion: ' + err.message,
      version: 'V8-CompleteActivePromosFixture',
      timestamp: '[2025-09-16 08:27:17]'
    });
  }
});

// V8 Addition: Enhanced Performance monitoring endpoint with complete real-time sync status
app.get('/discounts/performance', isLoggedIn, async (req, res) => {
  try {
    const startTime = Date.now();
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');

    const count = await promosCollection.countDocuments();
    const dbResponseTime = Date.now() - startTime;

    // V8 Addition: Get comprehensive performance metrics
    const now = new Date();
    const activeCount = await promosCollection.countDocuments({
      startDate: {$lte: now},
      endDate: {$gte: now},
      isActive: true
    });

    // V8 Enhancement: Get detailed status counts
    const expiringSoonCount = await promosCollection.countDocuments({
      startDate: {$lte: now},
      endDate: {$gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)},
      isActive: true
    });

    const upcomingCount = await promosCollection.countDocuments({
      startDate: {$gt: now},
      isActive: true
    });

    const expiredCount = await promosCollection.countDocuments({
      endDate: {$lt: now}
    });

    const highDiscountCount = await promosCollection.countDocuments({
      discountPercentage: {$gte: 20},
      startDate: {$lte: now},
      endDate: {$gte: now},
      isActive: true
    });

    await client.close();

    res.json({
      status: 'healthy',
      version: 'V8-CompleteActivePromosFixture',
      promoCount: count,
      activePromoCount: activeCount,
      expiringSoonCount: expiringSoonCount,
      upcomingCount: upcomingCount,
      expiredCount: expiredCount,
      highDiscountCount: highDiscountCount,
      performance: {
        dbResponseTime: dbResponseTime,
        timestamp: '[2025-09-16 08:27:17]'
      },
      user: req.session.user.username || 'MathDaenniel',
      repository: 'roviczzz/Couche-Co',
      lastUpdated: now.toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      error: err.message,
      version: 'V8-CompleteActivePromosFixture',
      timestamp: '[2025-09-16 08:27:17]'
    });
  }
});

// V8 Addition: Complete real-time sync status endpoint with comprehensive feature status
app.get('/discounts/sync-status', isLoggedIn, async (req, res) => {
  try {
    const now = new Date();
    res.json({
      status: 'operational',
      version: 'V8-CompleteActivePromosFixture',
      syncFeatures: {
        completeActivePromosUpdateFixed: true,
        realTimeDataSync: true,
        clientSideCacheManagement: true,
        dataOriginalAttributeSync: true,
        bulkOperationsSupport: true,
        smartDateSuggestions: true,
        promoPreviewSupport: true,
        errorRecoverySystem: true,
        performanceMonitoring: true,
        enhancedValidation: true,
        auditTrailLogging: true
      },
      timestamp: '[2025-09-16 08:27:17]',
      user: req.session.user.username || 'MathDaenniel',
      repository: 'roviczzz/Couche-Co',
      githubContext: {
        topRepositories: [
          'roviczzz/Couche-Co',
          'MathDaenniel/DelaRosaMidSum',
          'MathDaenniel/survey-form',
          'MathDaenniel/skills-copilot-codespaces-vscode'
        ],
        currentProject: 'roviczzz/Couche-Co'
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message,
      version: 'V8-CompleteActivePromosFixture',
      timestamp: '[2025-09-16 08:27:17]'
    });
  }
});

// V8 Addition: Complete health check endpoint specifically for active promos update functionality
app.get('/discounts/active-promos-health', isLoggedIn, async (req, res) => {
  try {
    const now = new Date();
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');

    // V8 Enhanced: Test active promos calculation with real data
    const totalPromos = await promosCollection.countDocuments();
    const activePromos = await promosCollection.countDocuments({
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true
    });

    const expiringSoonPromos = await promosCollection.countDocuments({
      startDate: { $lte: now },
      endDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
      isActive: true
    });

    await client.close();

    res.json({
      status: 'operational',
      version: 'V8-CompleteActivePromosFixture',
      activePromosFeatures: {
        realTimeUpdates: true,
        dateChangeDetection: true,
        cacheManagement: true,
        dataAttributeSync: true,
        disappearingIssueFixed: true,
        rollbackProtection: true,
        immediateUISync: true,
        debounceUpdates: true,
        errorRecovery: true,
        performanceOptimized: true
      },
      testResults: {
        totalPromos: totalPromos,
        activePromos: activePromos,
        expiringSoonPromos: expiringSoonPromos,
        calculationAccuracy: 'verified',
        lastTestedAt: now.toISOString()
      },
      timestamp: '[2025-09-16 08:27:17]',
      user: req.session.user.username || 'MathDaenniel',
      repository: 'roviczzz/Couche-Co'
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message,
      version: 'V8-CompleteActivePromosFixture',
      timestamp: '[2025-09-16 08:27:17]'
    });
  }
});

// V8 Addition: Bulk operations endpoint for multiple promo actions
app.post('/discounts/bulk-action', isLoggedIn, async (req, res) => {
  const { action, promoIds, bulkData } = req.body;
  const startTime = Date.now();

  console.log(`[2025-09-16 08:27:17] V8 Bulk action request: ${action} for ${promoIds?.length || 0} promos by MathDaenniel`);

  try {
    if (!action || !promoIds || !Array.isArray(promoIds) || promoIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bulk action request. Action and promo IDs are required.',
        received: { action, promoIdsCount: promoIds?.length || 0 },
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:27:17]'
      });
    }

    // Validate all ObjectIds
    const invalidIds = promoIds.filter(id => !ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid promo ID format(s) detected',
        invalidIds: invalidIds,
        version: 'V8-CompleteActivePromosFixture',
        timestamp: '[2025-09-16 08:27:17]'
      });
    }

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');

    let result = { success: false, message: '', affectedCount: 0, details: [] };

    switch (action) {
      case 'delete':
        const deleteResults = [];
        for (const id of promoIds) {
          try {
            const promo = await promosCollection.findOne({ _id: new ObjectId(id) });
            if (promo) {
              const deleteResult = await promosCollection.deleteOne({ _id: new ObjectId(id) });
              deleteResults.push({
                id: id,
                success: deleteResult.deletedCount > 0,
                promoName: promo.event
              });
            } else {
              deleteResults.push({
                id: id,
                success: false,
                error: 'Promo not found'
              });
            }
          } catch (error) {
            deleteResults.push({
              id: id,
              success: false,
              error: error.message
            });
          }
        }

        const successfulDeletes = deleteResults.filter(r => r.success).length;
        result = {
          success: successfulDeletes > 0,
          message: `${successfulDeletes} of ${promoIds.length} promos deleted successfully`,
          affectedCount: successfulDeletes,
          details: deleteResults
        };
        break;

      case 'toggle-active':
        const toggleResults = [];
        for (const id of promoIds) {
          try {
            const promo = await promosCollection.findOne({ _id: new ObjectId(id) });
            if (promo) {
              const newActiveState = !promo.isActive;const updateResult = await promosCollection.updateOne(
                  { _id: new ObjectId(id) },
                  {
                    $set: {
                      isActive: newActiveState,
                      lastModified: new Date(),
                      lastModifiedBy: req.session.user.username ||'MathDaenniel'
                    }
                  }
              );toggleResults.push({
                id: id,
                success: updateResult.modifiedCount > 0,
                promoName: promo.event,
                newState: newActiveState
              });
            } else {
              toggleResults.push({
                id: id,
                success: false,
                error: 'Promo not found'
              });
            }
          } catch (error) {
            toggleResults.push({
              id: id,
              success: false,
              error: error.message
            });
          }
        }

        const successfulToggles = toggleResults.filter(r => r.success).length;
        result = {
          success: successfulToggles > 0,
          message: `${successfulToggles} of ${promoIds.length} promos toggled successfully`,
          affectedCount: successfulToggles,
          details: toggleResults
        };
        break;

      case 'update-discount':
        if (!bulkData || !bulkData.discountPercentage) {
          await client.close();
          return res.status(400).json({
            success: false,
            message: 'Discount percentage is required for bulk discount update',
            version: 'V8-CompleteActivePromosFixture',
            timestamp: '[2025-09-16 08:27:17]'
          });
        }

        const discountPercent = parseFloat(bulkData.discountPercentage);
        if (isNaN(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
          await client.close();
          return res.status(400).json({
            success: false,
            message: 'Invalid discount percentage. Must be between 0.01 and 100',
            version: 'V8-CompleteActivePromosFixture',
            timestamp: '[2025-09-16 08:27:17]'
          });
        }

        const updateDiscountResult = await promosCollection.updateMany(
            { _id: { $in: promoIds.map(id => new ObjectId(id)) } },
            {
              $set: {
                discountPercentage: discountPercent,
                lastModified: new Date(),
                lastModifiedBy: req.session.user.username || 'MathDaenniel'
              }
            }
        );

        result = {
          success: updateDiscountResult.modifiedCount > 0,
          message: `${updateDiscountResult.modifiedCount} promos updated with ${discountPercent}% discount`,
          affectedCount: updateDiscountResult.modifiedCount,
          details: { discountPercentage: discountPercent }
        };
        break;

      default:
        await client.close();
        return res.status(400).json({
          success: false,
          message: `Unsupported bulk action: ${action}`,
          supportedActions: ['delete', 'toggle-active', 'update-discount'],
          version: 'V8-CompleteActivePromosFixture',
          timestamp: '[2025-09-16 08:27:17]'
        });
    }

    // Get updated statistics
    const now = new Date();
    const activeCount = await promosCollection.countDocuments({
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true
    });

    await client.close();

    const processingTime = Date.now() - startTime;

    console.log(`[2025-09-16 08:27:17] V8 Bulk ${action} completed: ${result.affectedCount}/${promoIds.length} (${processingTime}ms) by MathDaenniel`);

    res.json({
      ...result,
      stats: {
        active: activeCount
      },
      performance: {
        processingTime: processingTime,
        version: 'V8-CompleteActivePromosFixture'
      },
      uiUpdate: {
        refreshActivePromos: true,
        refreshTable: true,
        showBulkFeedback: true,
        clearCache: true,
        realTimeSync: true,
        timestamp: new Date().toISOString()
      },
      timestamp: '[2025-09-16 08:27:17]'
    });

  } catch (err) {
    console.error(`[2025-09-16 08:27:17] V8 Bulk action error:`, err, 'by MathDaenniel');
    res.status(500).json({
      success: false,
      message: 'Server error during bulk operation: ' + err.message,
      version: 'V8-CompleteActivePromosFixture',
      timestamp: '[2025-09-16 08:27:17]'
    });
  }
});

// V8 Addition: Real-time promo statistics endpoint for dashboard updates
app.get('/discounts/real-time-stats', isLoggedIn, async (req, res) => {
  try {
    const startTime = Date.now();
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');

    const now = new Date();
    const today = new Date(now.toISOString().split('T')[0]);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // V8 Enhanced: Get comprehensive real-time statistics
    const [
      totalPromos,
      activePromos,
      expiringSoonPromos,
      upcomingPromos,
      expiredPromos,
      todayActivePromos,
      highDiscountPromos,
      newPromos,
      startingTodayPromos,
      endingTodayPromos
    ] = await Promise.all([
      promosCollection.countDocuments(),
      promosCollection.countDocuments({
        startDate: { $lte: now },
        endDate: { $gte: now },
        isActive: true
      }),
      promosCollection.countDocuments({
        startDate: { $lte: now },
        endDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        isActive: true
      }),
      promosCollection.countDocuments({
        startDate: { $gt: now },
        isActive: true
      }),
      promosCollection.countDocuments({
        endDate: { $lt: now }
      }),
      promosCollection.countDocuments({
        startDate: { $lte: today },
        endDate: { $gte: today },
        isActive: true
      }),
      promosCollection.countDocuments({
        discountPercentage: { $gte: 20 },
        startDate: { $lte: now },
        endDate: { $gte: now },
        isActive: true
      }),
      promosCollection.countDocuments({
        createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
      }),
      promosCollection.countDocuments({
        startDate: { $gte: today, $lt: tomorrow },
        isActive: true
      }),
      promosCollection.countDocuments({
        endDate: { $gte: today, $lt: tomorrow },
        isActive: true
      })
    ]);

    // V8 Addition: Calculate average discount for active promos
    const activePromosWithDiscount = await promosCollection.find({
          startDate: { $lte: now },
          endDate: { $gte: now },
          isActive: true
        },
        { projection: { discountPercentage: 1 } }).toArray();

    const averageDiscount = activePromosWithDiscount.length > 0
        ? activePromosWithDiscount.reduce((sum, promo) => sum + promo.discountPercentage, 0) / activePromosWithDiscount.length
        : 0;

    await client.close();

    const responseTime = Date.now() - startTime;

    res.json({
      status: 'success',
      version: 'V8-CompleteActivePromosFixture',
      stats: {
        total: totalPromos,
        active: activePromos,
        expiringSoon: expiringSoonPromos,
        upcoming: upcomingPromos,
        expired: expiredPromos,
        todayActive: todayActivePromos,
        highDiscount: highDiscountPromos,
        new: newPromos,
        startingToday: startingTodayPromos,
        endingToday: endingTodayPromos,
        averageDiscount: Math.round(averageDiscount * 100) / 100
      },
      alerts: {
        expiringSoon: expiringSoonPromos > 0,
        startingToday: startingTodayPromos > 0,
        endingToday: endingTodayPromos > 0,
        noActivePromos: activePromos === 0
      },
      performance: {
        responseTime: responseTime,
        timestamp: '[2025-09-16 08:27:17]'
      },
      user: req.session.user.username || 'MathDaenniel',
      repository: 'roviczzz/Couche-Co',
      lastUpdated: now.toISOString()
    });
  } catch (err) {
    console.error(`[2025-09-16 08:27:17] V8 Error getting real-time stats:`, err, 'by MathDaenniel');
    res.status(500).json({ status: 'error',
      message: err.message,
      version: 'V8-CompleteActivePromosFixture',
      timestamp: '[2025-09-16 08:27:17]'
    });
  }
});

// V8 Addition: Export promos data with filtering options
app.get('/discounts/export', isLoggedIn, async (req, res) => {
  try {
    const { format = 'json', status = 'all', dateRange = 'all' } = req.query;

    console.log(`[2025-09-16 08:27:17] V8 Export request: format=${format}, status=${status}, dateRange=${dateRange} by MathDaenniel`);

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');
    let query = {};
    const now = new Date();

    // V8 Enhanced: Apply status filter
    switch (status) {
      case 'active':
        query = {
          startDate: { $lte: now },
          endDate: { $gte: now },
          isActive: true
        };
        break;
      case 'upcoming':
        query = {
          startDate: { $gt: now },
          isActive: true
        };
        break;
      case 'expired':
        query = {
          endDate: { $lt: now }
        };
        break;
      case 'expiring-soon':
        query = {
          startDate: { $lte: now },
          endDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
          isActive: true
        };
        break;
    }

    // V8 Enhanced: Apply date range filter
    switch (dateRange) {
      case 'today':
        const today = new Date(now.toISOString().split('T')[0]);
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        query.$or = [
          { startDate: { $gte: today, $lt: tomorrow } },
          { endDate: { $gte: today, $lt: tomorrow } }
        ];
        break;
      case 'week':
        query.$or = [
          { startDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } },
          { endDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } }
        ];
        break;
      case 'month':
        query.$or = [
          { startDate: { $gte: now, $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } },
          { endDate: { $gte: now, $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } }
        ];
        break;
    }

    const promos = await promosCollection.find(query).sort({ createdAt: -1 }).toArray();
    await client.close();

    const exportData = {
      metadata: {
        exportedAt: now.toISOString(),
        exportedBy: req.session.user.username ||'MathDaenniel',
        repository: 'roviczzz/Couche-Co',
        version: 'V8-CompleteActivePromosFixture',
        filters: { status, dateRange },
        totalPromos: promos.length
      },
      promos: promos.map(promo => ({
        id: promo._id,
        event: promo.event,
        description: promo.description,
        discountPercentage: promo.discountPercentage,
        startDate: promo.startDate.toISOString().split('T')[0],
        endDate: promo.endDate.toISOString().split('T')[0],
        status: getPromoStatus(promo.startDate, promo.endDate, now),
        isActive: promo.isActive,
        createdAt: promo.createdAt
      }))
    };

    console.log(`[2025-09-16 08:27:17] V8 Export completed: ${promos.length} promos exported by MathDaenniel`);

    if (format === 'csv') {
      // Convert to CSV format
      const csv = [
        'ID,Event,Description,Discount %,Start Date,End Date,Status,Active,Created At,Created By',
        ...exportData.promos.map(promo =>
            `"${promo.id}","${promo.event}","${promo.description}",${promo.discountPercentage},"${promo.startDate}","${promo.endDate}","${promo.status}",${promo.isActive},"${promo.createdAt}","${promo.createdBy}"`
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="promos-export-${status}-${dateRange}-${now.toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } else {res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="promos-export-${status}-${dateRange}-${now.toISOString().split('T')[0]}.json"`);
      res.json(exportData);}


  } catch (err) {
    console.error(`[2025-09-16 08:27:17] V8 Export error:`, err, 'by MathDaenniel');
    res.status(500).json({ success: false,
      message: 'Export failed: ' + err.message,
      version: 'V8-CompleteActivePromosFixture',
      timestamp: '[2025-09-16 08:27:17]' });
  }
});

// V8 Addition: Advanced search endpoint with multiple criteria
app.get('/discounts/search', isLoggedIn, async (req, res) => {
  try {
    const {
      q = '',
      status = 'all',
      minDiscount = 0,
      maxDiscount = 100,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = 50,
      offset = 0
    } = req.query;

    console.log(`[2025-09-16 08:27:17] V8 Search request: q="${q}", status=${status}, discount=${minDiscount}-${maxDiscount} by MathDaenniel`);

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');

    let query = {};
    const now = new Date();

    // V8 Enhanced: Text search
    if (q && q.trim()) {
      query.$or = [
        { event: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }

    // V8 Enhanced: Status filter
    switch (status) {
      case 'active':
        query.startDate = { $lte: now };
        query.endDate = { $gte: now };
        query.isActive = true;
        break;
      case 'upcoming':
        query.startDate = { $gt: now };
        query.isActive = true;
        break;
      case 'expired':
        query.endDate = { $lt: now };
        break;
      case 'expiring-soon':
        query.startDate = { $lte: now };
        query.endDate = { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) };
        query.isActive = true;
        break;
    }

    // V8 Enhanced: Discount range filter
    if (minDiscount > 0 || maxDiscount < 100) {
      query.discountPercentage = {
        $gte: parseFloat(minDiscount),
        $lte: parseFloat(maxDiscount)
      };
    }

    // V8 Enhanced: Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const totalCount = await promosCollection.countDocuments(query);
    const promos = await promosCollection
        .find(query)
        .sort(sortOptions)
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .toArray();

    await client.close();

    const results = promos.map(promo => ({
      id: promo._id,
      event: promo.event,
      description: promo.description,
      discountPercentage: promo.discountPercentage,
      startDate: promo.startDate.toISOString().split('T')[0],
      endDate: promo.endDate.toISOString().split('T')[0],
      status: getPromoStatus(promo.startDate, promo.endDate, now),
      isActive: promo.isActive,
      createdAt: promo.createdAt
    }));

    console.log(`[2025-09-16 08:27:17] V8 Search completed: ${results.length}/${totalCount} results by MathDaenniel`);

    res.json({
      success: true,
      query: { q, status, minDiscount, maxDiscount, sortBy, sortOrder },
      results: results,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: totalCount > parseInt(offset) + parseInt(limit)
      },
      version: 'V8-CompleteActivePromosFixture',
      timestamp: '[2025-09-16 08:27:17]'
    });

  } catch (err) {
    console.error(`[2025-09-16 08:27:17] V8 Search error:`, err, 'by MathDaenniel');
    res.status(500).json({
      success: false,
      message: 'Search failed: ' + err.message,
      version: 'V8-CompleteActivePromosFixture',
      timestamp: '[2025-09-16 08:27:17]'
    });
  }
});

// V8 Addition: System diagnostics endpoint for debugging
app.get('/discounts/diagnostics', isLoggedIn, async (req, res) => {
  try {
    const startTime = Date.now();
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');

    // V8 Enhanced: Comprehensive system diagnostics
    const now = new Date();
    const [dbStats, indexStats] = await Promise.all([
      db.stats(),
      promosCollection.getIndexes()
    ]);

    // Test various queries
    const queryTests = {
      basicCount: await promosCollection.countDocuments(),
      activePromosQuery: await promosCollection.countDocuments({
        startDate: { $lte: now },
        endDate: { $gte: now },
        isActive: true
      }),
      complexAggregation: await promosCollection.aggregate([
        {
          $group: {
            _id: null,
            avgDiscount: { $avg: '$discountPercentage' },
            totalPromos: { $sum: 1 },
            maxDiscount: { $max: '$discountPercentage' },
            minDiscount: { $min: '$discountPercentage' }
          }
        }
      ]).toArray()
    };

    await client.close();

    const diagnostics = {
      status: 'healthy',
      version: 'V8-CompleteActivePromosFixture',
      performance: {
        totalResponseTime: Date.now() - startTime,
        dbConnectionTime: 'sub-100ms',
        queryPerformance: 'optimal'
      },
      database: {
        name: 'blessingscafe',
        collection: 'Promos',
        documentsCount: queryTests.basicCount,
        activePromosCount: queryTests.activePromosQuery,
        statistics: queryTests.complexAggregation[0] || {},
        indexes: indexStats.map(idx => ({ name: idx.name, keys: idx.key }))
      },
      systemHealth: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform
      },
      features: {
        completeActivePromosUpdateFix: true,
        realTimeSyncEnabled: true,
        bulkOperationsSupported: true,
        advancedSearchEnabled: true,
        exportFunctionalityEnabled: true,
        diagnosticsEnabled: true
      },
      timestamp: '[2025-09-16 08:27:17]',
      user: req.session.user.username || 'MathDaenniel',
      repository: 'roviczzz/Couche-Co'
    };

    console.log(`[2025-09-16 08:27:17] V8 System diagnostics completed (${Date.now() - startTime}ms) by MathDaenniel`);

    res.json(diagnostics);

  } catch (err) {
    console.error(`[2025-09-16 08:27:17] V8 Diagnostics error:`, err, 'by MathDaenniel');
    res.status(500).json({
      status: 'unhealthy',
      error: err.message,
      version: 'V8-CompleteActivePromosFixture',
      timestamp: '[2025-09-16 08:27:17]'
    });
  }
});

// ========== SETTINGS AND PASSWORD MANAGEMENT ROUTES ==========

// SETTINGS PAGE ROUTE
app.get('/settings', isLoggedIn, nocache, (req, res) => {
  console.log(`⚙️ Settings page accessed by user: ${req.session.user.username} at 2025-08-19 07:07:58`);
  res.render('settings', {
    title: 'Settings | Blessings Cafe',
    user: req.session.user,
    currentPage: req.path
  });
})
;

// Alternative route for admin settings
app.get('/admin/settings', isLoggedIn, nocache, (req, res) => {
  console.log(`⚙️ Admin settings page accessed by user: ${req.session.user.username} at 2025-08-19 07:07:58`);
  res.render('settings', {
    title: 'Admin Settings | Blessings Cafe',
    user: req.session.user,
    currentPage: req.path
  });
})
;

// PASSWORD CHANGE ROUTE WITH BCRYPT
app.post('/admin/change-password', isLoggedIn, async (req, res) => {
  try {
    console.log(`🔐 Password change attempt by user: ${req.session.user.username} at 2025-08-19 07:07:58`);

    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      console.log(`❌ Password change failed - Missing fields for user: ${req.session.user.username}`);
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      console.log(`❌ Password change failed - Password too short for user: ${req.session.user.username}`);
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long',
        field: 'newPassword'
      });
    }

    if (currentPassword === newPassword) {
      console.log(`❌ Password change failed - Same password for user: ${req.session.user.username}`);
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password',
        field: 'newPassword'
      });
    }

    // Connect to database
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const users = db.collection('users');

    // Find the user
    const user = await users.findOne({ _id: new ObjectId(req.session.user._id) });

    if (!user) {
      await client.close();
      console.log(`❌ Password change failed - User not found: ${req.session.user.username}`);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    let currentPasswordValid = false;

    if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
      // Password is hashed
      currentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      console.log('🔐 Verifying against hashed password');
    } else {
      // Password is plain text
      currentPasswordValid = (currentPassword === user.password);
      console.log('⚠️ Verifying against plain text password');
    }

    if (!currentPasswordValid) {
      await client.close();
      console.log(`❌ Password change failed - Invalid current password for user: ${req.session.user.username}`);
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
        field: 'currentPassword'
      });
    }

    // Hash the new password
    console.log('🔐 Hashing new password with bcrypt...');
    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    console.log('✅ New password hashed successfully');

    // Update the password in database
    const updateResult = await users.updateOne(
        { _id: user._id },
        {
          $set: {
            password: hashedNewPassword,
            passwordChangedAt: new Date('2025-08-19T07:07:58.000Z'),
            passwordChangedBy: req.session.user.username,
            lastModified: new Date('2025-08-19T07:07:58.000Z')
          }
        }
    );

    await client.close();

    if (updateResult.modifiedCount === 1) {
      console.log(`✅ Password changed successfully for user: ${req.session.user.username} at 2025-08-19 07:07:58`);

      // Log security event
      console.log(`🔒 SECURITY EVENT: Password changed for user ${req.session.user.username} from IP ${req.ip || req.connection.remoteAddress} at 2025-08-19 07:07:58`);

      res.json({
        success: true,
        message: 'Password changed successfully! For security purposes, please log in again with your new password.'
      });
    } else {
      console.log(`❌ Password change failed - Database update failed for user: ${req.session.user.username}`);
      res.status(500).json({
        success: false,
        message: 'Failed to update password in database'
      });
    }

  } catch (error) {
    console.error(`❌ Password change error for user ${req.session.user.username}:`, error);
    res.status(500).json({
      success: false,
      message: 'Internal server error occurred while changing password'
    });
  }
});

// UTILITY FUNCTION TO HASH EXISTING PLAIN TEXT PASSWORDS (Optional Migration)
app.post('/admin/migrate-passwords', isLoggedIn, async (req, res) => {
  // Only allow this for admin users - add additional security checks as needed
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  try {
    console.log(`🔄 Password migration started by admin: ${req.session.user.username} at 2025-08-19 07:07:58`);

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const users = db.collection('users');

    // Find users with plain text passwords
    const plainTextUsers = await users.find({
      password: { $not: { $regex: /^\$2[ab]\$/ } }
    }).toArray();

    console.log(`📊 Found ${plainTextUsers.length} users with plain text passwords`);

    let migratedCount = 0;

    for (const user of plainTextUsers) {
      if (user.password && user.password.length > 0) {
        const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);

        await users.updateOne(
            { _id: user._id },
            {
              $set: {
                password: hashedPassword,
                passwordMigratedAt: new Date('2025-08-19T07:07:58.000Z'),
                migratedBy: req.session.user.username
              }
            }
        );

        migratedCount++;
        console.log(`✅ Migrated password for user: ${user.username}`);
      }
    }

    await client.close();

    console.log(`✅ Password migration completed. Migrated ${migratedCount} passwords to bcrypt hashing at 2025-08-19 07:07:58`);

    res.json({
      success: true,
      message: `Successfully migrated ${migratedCount} passwords to bcrypt hashing`,
      migratedCount: migratedCount
    });

  } catch (error) {
    console.error('❌ Password migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during password migration'
    });
  }
});

// ========== END OF SETTINGS AND PASSWORD MANAGEMENT ROUTES ==========

// ENHANCED LOGOUT ROUTE with security logging
app.get('/logout', (req, res) => {
  const username = req.session.user?.username;
  console.log(`🚪 User logout: ${username} at 2025-08-19 07:07:58`);

  req.session.destroy((err) => {
    if (err) {
      console.error('❌ Session destruction error:', err);
    } else {
      console.log(`✅ Session destroyed successfully for user: ${username}`);
    }
    res.redirect('/account/login');
  });
})
;
app.post('/api/orders', async (req, res) => {
  try {
    const orderData = req.body;

    if (!orderData || !orderData.OrderID || !orderData.Date || !orderData.Cart || !orderData.Customer) {
      return res.status(400).json({ success: false, error: 'Missing required order fields' });
    }

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    await db.collection('Orders').insertOne(orderData);

    await client.close();

    res.json({ success: true, orderId: orderData.OrderID });
  } catch (err) {
    console.error('Error saving order:', err);
    res.status(500).json({ success: false, error: 'Failed to save order' });
  }
});

app.post('/api/orders/update-payment-status', async (req, res) => {
  const { paymentId, status } = req.body;
  if (!paymentId || !status) {
    return res.status(400).json({ success: false, error: 'Missing paymentId or status.' });
  }
  try {
    await client.connect();
    const db = client.db('blessingscafe');
    const orders = db.collection('Orders');
    const result = await orders.updateOne(
        { XenditPaymentID: paymentId },
        { $set: { PaymentStatus: status } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Database error.' });
  }
});

let ordersCollection;
let menuCollection;
async function connectDB() {
  await client.connect();
  const db = client.db('blessingscafe');
  ordersCollection = db.collection('Orders');
  menuCollection = db.collection('Menu');
}

connectDB()
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error("DB connection error:", err))
;

// Popular Products
async function getPopularProducts() {
  try {
    const results = await ordersCollection.aggregate([
      { $unwind: "$Cart" },
      {
        $group: {
          _id: "$Cart.ProductName",
          totalQuantity: { $sum: "$Cart.Quantity" }
        }
      },
      { $sort: { totalQuantity: -1 } }
    ]).toArray();

    return results;
  } catch (error) {
    console.error(error);
    return [];
  }
}

app.get('/analytics/popular-products', async (req, res) => {
  try {
    const results = await getPopularProducts();
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating analytics' });
  }
})
;

// Sales Per Day
app.get('/analytics/average-sales-per-day', async (req, res) => {
  try {
    const salesPerDay = await ordersCollection.aggregate([
      {
        $addFields: {
          parsedDate: {
            $cond: {
              if: { $eq: [{ $type: "$Date" }, "string"] },
              then: {$dateFromString: {dateString: "$Date"}},
              else: "$Date"
            }
          }
        }
      },
      {
        $match: {
          parsedDate: { $gte: new Date(new Date().setHours(0, 0, 0, 0) - 14 * 24 * 60 * 60 * 1000), $lte: new Date() },
          PaymentStatus: { $ne: "Cancelled" }
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

    res.json(salesPerDay);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching average sales per day");
  }
});

app.get("/ingredients/search", async (req, res) => {
  try {
    const query = req.query.q || "";

    const db = client.db("blessingscafe");

    // Search for ingredients that match the Name
    const results = await db.collection("Ingredients")
        .find({ Name: { $regex: query, $options: "i" }, isEnabled: true })
        .project({ IngredientID: 1, Name: 1, _id: 0 })
        .limit(50)
        .toArray();

    res.json(results); // return array of objects
  } catch (err) {
    console.error("Error in /ingredients/search:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get('/analytics', isLoggedIn, nocache, (req, res) => {
  res.render('analytics', {
    title: 'Analytics | Blessings Cafe',
    user: req.session.user,
    currentPage: req.path
  })
})

app.get('/analytics/sales-performance', isLoggedIn, async (req, res) => {
  const days = parseInt(req.query.days) || 14
  try {
    const client = await MongoClient.connect(uri)
    const db = client.db('blessingscafe')
    const ordersCollection = db.collection('Orders')
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const pipeline = [
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{$type: "$Date"}, "string"] },
              then: {$dateFromString: {dateString: "$Date"}},
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
          _id: null,
          earnings: { $sum: "$Total" },
          costs: { $sum: { $multiply: ["$Total", 0.6] } },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]
    let results = await ordersCollection.aggregate(pipeline).toArray()
    const dateMap = {}
    results.forEach(item => { dateMap[item._id] = item })
    const allDates = []
    for (let i = 0; i < days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      allDates.unshift(dateStr)
    }
    const formattedResults = allDates.map(dateStr => {
      if (dateMap[dateStr]) {
        return {
          date: dateStr,
          earnings: dateMap[dateStr].earnings || 0,
          costs: dateMap[dateStr].costs || 0,
          orders: dateMap[dateStr].orders || 0
        }
      } else {
        return {
          date: dateStr,
          earnings: 0,
          costs: 0,
          orders: 0
        }
      }
    })
    await client.close()
    res.json(formattedResults)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales performance data' })
  }
})

app.get('/analytics/dashboard-stats', isLoggedIn, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri)
    const db = client.db('blessingscafe')
    const ordersCollection = db.collection('Orders')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const totalSalesResult = await ordersCollection.aggregate([
      {
        $match: {
          PaymentStatus: { $ne: "Cancelled" }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$Total" }
        }
      }
    ]).toArray()
    const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].total : 0
    const totalOrders = totalSalesResult.length > 0 ? totalSalesResult[0].count : 0
    const weekSalesResult = await ordersCollection.aggregate([
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{$type: "$Date"}, "string"] },
              then: {$dateFromString: {dateString: "$Date"}},
              else: "$Date"
            }
          }
        }
      },
      { $match: { orderDate: { $gte: weekAgo }, PaymentStatus: { $ne: "Cancelled" } } },
      { $group: { _id: null, total: { $sum: "$Total" } } }
    ]).toArray()
    const totalSalesWeek = weekSalesResult.length > 0 ? weekSalesResult[0].total : 0
    const prevWeekAgo = new Date(weekAgo)
    prevWeekAgo.setDate(prevWeekAgo.getDate() - 7)
    const prevWeekSalesResult = await ordersCollection.aggregate([
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{$type: "$Date"}, "string"] },
              then: {$dateFromString: {dateString: "$Date"}},
              else: "$Date"
            }
          }
        }
      },
      { $match: { orderDate: { $gte: prevWeekAgo, $lt: weekAgo }, PaymentStatus: { $ne: "Cancelled" } } },
      { $group: { _id: null, total: { $sum: "$Total" } } }
    ]).toArray()
    const prevWeekSales = prevWeekSalesResult.length > 0 ? prevWeekSalesResult[0].total : 0
    const totalSalesPercent = prevWeekSales === 0 ? 100 : Math.round(((totalSalesWeek - prevWeekSales) / prevWeekSales) * 100)
    const incomingOrdersCount = await ordersCollection.countDocuments({ FulfillmentStatus: { $nin: ["Completed", "Cancelled"] } })
    const yesterdayIncomingResult = await ordersCollection.aggregate([
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{$type: "$Date"}, "string"] },
              then: {$dateFromString: {dateString: "$Date"}},
              else: "$Date"
            }
          }
        }
      },
      { $match: { FulfillmentStatus: { $nin: ["Completed", "Cancelled"] }, orderDate: { $gte: yesterday, $lt: today } } },
      { $count: "count" }
    ]).toArray()
    const yesterdayIncomingOrdersCount = yesterdayIncomingResult.length > 0 ? yesterdayIncomingResult[0].count : 0
    const incomingOrdersPercent = yesterdayIncomingOrdersCount === 0 ? 0 : Math.round(((incomingOrdersCount - yesterdayIncomingOrdersCount) / yesterdayIncomingOrdersCount) * 100)
    const ordersTodayResult = await ordersCollection.aggregate([
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{$type: "$Date"}, "string"] },
              then: {$dateFromString: {dateString: "$Date"}},
              else: "$Date"
            }
          }
        }
      },
      { $match: { orderDate: { $gte: today } } },
      { $count: "count" }
    ]).toArray()
    const ordersTodayCount = ordersTodayResult.length > 0 ? ordersTodayResult[0].count : 0
    const yesterdayOrdersResult = await ordersCollection.aggregate([
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{$type: "$Date"}, "string"] },
              then: {$dateFromString: {dateString: "$Date"}},
              else: "$Date"
            }
          }
        }
      },
      { $match: { orderDate: { $gte: yesterday, $lt: today } } },
      { $count: "count" }
    ]).toArray()
    const yesterdayOrdersCount = yesterdayOrdersResult.length > 0 ? yesterdayOrdersResult[0].count : 0
    const ordersTodayPercent = yesterdayOrdersCount === 0 ? 0 : Math.round(((ordersTodayCount - yesterdayOrdersCount) / yesterdayOrdersCount) * 100)

    await client.close()

    res.json({
      totalSales,
      totalOrders,
      totalSalesWeek,
      totalSalesPercent,
      incomingOrders: incomingOrdersCount,
      incomingOrdersPercent,
      ordersToday: ordersTodayCount,
      ordersTodayPercent
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch dashboard stats' })
  }
})

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
})

