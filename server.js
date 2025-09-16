const express = require('express');
const session = require('express-session');
const { MongoClient, ObjectId } = require('mongodb');
const { check, validationResult } = require('express-validator');
const expressLayouts = require('express-ejs-layouts');
const bcrypt = require('bcrypt'); // ADDED FOR PASSWORD HASHING
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

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use(
    session({
      secret: '4eaf42844a1772cb12e90869666b3a929f785d5bbd6d0fc5402c95ebc8721c3bca4ac502cc2fa7ec8abcbec042202876',
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false }
    })
);

app.use(flash());

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


app.get('/', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const collection = db.collection('users');
    const data = await collection.find({}).toArray();
    await client.close();
    res.render('login', { data, title: 'Login | Blessings Cafe', errors: {}, formData: {}, error: null, layout: false });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});

app.get('/account/login', (req, res) => {
  res.render('login', { title: 'Login | Blessings Cafe', errors: {}, error: null, formData: {}, layout: false });
});

// ENHANCED LOGIN ROUTE WITH BCRYPT SUPPORT
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

app.get('/account/register', (req, res) => {
  res.render('register', { errors: {}, formData: {}, error: null, layout: false });
});

app.get('/dashboard', isLoggedIn, nocache, (req, res) => {
  res.render('dashboard', { title: 'Dashboard | Blessings Cafe', user: req.session.user });
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
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const docs = await db.collection('Orders').find({ FulfillmentStatus: "Preparing" }).project({ Customer: 1 }).toArray();
    await client.close();
    res.json(docs.map(d => d.Customer));
  } catch (err) {
    res.status(500).json([]);
  }
});

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
app.get('/edit-product/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');
    const ingredientsCollection = db.collection('Ingredients');

    // Fetch product by ID
    const product = await productCollection.findOne({ _id: new ObjectId(id) });

    if (!product) {
      await client.close();
      return res.status(404).send('Product not found');
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
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ingredients = await db.collection('Ingredients').find().toArray();
    await client.close();

    const message = req.query.msg || null;
    res.render('stocks', {
      ingredients,
      title: 'Stocks | Blessings Cafe',
      user: req.session.user,
      message
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to load ingredients');
  }
});

app.post('/stocks', async (req, res) => {
  const { IngredientID, Name, Quantity, Category, Allergen, isEnabled } = req.body;
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    await db.collection('Ingredients').insertOne({
      IngredientID,
      Name,
      Quantity: parseInt(Quantity),
      Category,
      Allergen,
      isEnabled: isEnabled === 'true'
    });
    await client.close();
    res.redirect('/stocks?msg=add_success');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to add ingredient');
  }
});

app.post('/stocks/edit/:id', async (req, res) => {
  const id = req.params.id;
  const { IngredientID, Name, Quantity, Category, Allergen, isEnabled } = req.body;
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    await db.collection('Ingredients').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            IngredientID,
            Name,
            Quantity: parseInt(Quantity),
            Category,
            Allergen,
            isEnabled: isEnabled === 'true'
          }
        }
    );
    await client.close();
    res.redirect('/stocks?msg=update_success');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to update ingredient');
  }
});

app.post('/stocks/delete/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    await db.collection('Ingredients').deleteOne({ _id: new ObjectId(id) });
    await client.close();
    res.redirect('/stocks?msg=delete_success');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to delete ingredient');
  }
});

app.get('/order', isLoggedIn, nocache, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const ordersCollection = db.collection('Orders');
    const menuCollection = db.collection('Menu');
    const orders = await ordersCollection.find().toArray();

    const menu = await menuCollection.find().toArray();

    await client.close();

    res.render('order', {
      orders,
      menu,
      title: 'Orders | Blessings Cafe',
      user: req.session.user
    });
  } catch (err) {
    console.error('Error fetching orders or menu:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.patch('/orders/:OrderID/fulfillment', isLoggedIn, nocache, async (req, res) => {
  const { OrderID } = req.params;
  const { FulfillmentStatus } = req.body;

  if (!FulfillmentStatus) {
    return res.status(400).json({ error: 'FulfillmentStatus is required' });
  }

  const orderIDNumber = Number(OrderID);
  if (isNaN(orderIDNumber)) {
    return res.status(400).json({ error: 'Invalid OrderID format' });
  }

  let client;
  try {
    client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    const filter = { OrderID: orderIDNumber };
    const updateDoc = { $set: { FulfillmentStatus } };

    const updateResult = await ordersCollection.updateOne(filter, updateDoc);
    console.log('Update result:', updateResult);

    const updatedOrder = await ordersCollection.findOne(filter);
    console.log('Updated order:', updatedOrder);

    if (!updatedOrder) {
      await client.close();
      return res.status(404).json({ error: `Order with ID ${orderIDNumber} not found` });
    }

    await client.close();
    return res.status(200).json({
      success: true,
      message: `Fulfillment status updated to "${FulfillmentStatus}"`,
      order: updatedOrder
    });

  } catch (error) {
    if (client) await client.close();
    console.error('Error updating FulfillmentStatus:', error);
    return res.status(500).json({ error: 'Server error while updating order' });
  }
});

app.patch('/orders/:OrderID/payment-status', isLoggedIn, nocache, async (req, res) => {
  const { OrderID } = req.params;
  const { PaymentStatus } = req.body;

  if (!PaymentStatus) {
    return res.status(400).json({ error: 'PaymentStatus is required' });
  }

  const orderIDNumber = Number(OrderID);
  if (isNaN(orderIDNumber)) {
    return res.status(400).json({ error: 'Invalid OrderID format' });
  }

  let client;
  try {
    client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    const filter = { OrderID: orderIDNumber };
    const updateDoc = { $set: { PaymentStatus } };

    const updateResult = await ordersCollection.updateOne(filter, updateDoc);
    console.log('Update result:', updateResult);

    const updatedOrder = await ordersCollection.findOne(filter);
    console.log('Updated order:', updatedOrder);

    if (!updatedOrder) {
      await client.close();
      return res.status(404).json({ error: `Order with ID ${orderIDNumber} not found` });
    }

    await client.close();
    return res.status(200).json({
      success: true,
      message: `Payment status updated to "${PaymentStatus}"`,
      order: updatedOrder
    });

  } catch (error) {
    if (client) await client.close();
    console.error('Error updating PaymentStatus:', error);
    return res.status(500).json({ error: 'Server error while updating order' });
  }
});

app.patch('/orders/:OrderID/cancel', isLoggedIn, nocache, async (req, res) => {
  const { OrderID } = req.params;

  const orderIDNumber = Number(OrderID);
  if (isNaN(orderIDNumber)) {
    return res.status(400).json({ error: 'Invalid OrderID format' });
  }

  let client;
  try {
    client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    const filter = { OrderID: orderIDNumber };
    const updateDoc = {
      $set: {
        PaymentStatus: 'Cancelled',
        FulfillmentStatus: 'Cancelled'
      }
    };

    const updateResult = await ordersCollection.updateOne(filter, updateDoc);
    const updatedOrder = await ordersCollection.findOne(filter);

    if (!updatedOrder) {
      await client.close();
      return res.status(404).json({ error: `Order with ID ${orderIDNumber} not found` });
    }

    await client.close();
    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      order: updatedOrder
    });

  } catch (error) {
    if (client) await client.close();
    console.error('Error cancelling order:', error);
    return res.status(500).json({ error: 'Server error while cancelling order' });
  }
});

app.get('/orders/edit/:id', isLoggedIn, nocache, async (req, res) => {
  const orderId = req.params.id;

  if (!ObjectId.isValid(orderId)) {
    return res.status(400).send('Invalid order ID');
  }

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

    await client.close();

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

// ========== ENHANCED DISCOUNTS/PROMOS ROUTES ==========

// GET route for discounts page
app.get('/discounts', isLoggedIn, nocache, async (req, res) => {
  try {
    console.log('📋 Loading discounts page for user:', req.session.user.username, 'at 2025-08-19 07:07:58');

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');
    const promos = await promosCollection.find().toArray();
    await client.close();

    console.log(`✅ Fetched ${promos.length} promos from database`);

    res.render('discounts', {
      promos,
      title: 'Discounts | Blessings Cafe',
      user: req.session.user,
      currentPage: req.path
    });
  } catch (err) {
    console.error('❌ Error fetching promos:', err);
    res.status(500).send('Internal Server Error');
  }
});

// POST route for adding new promo - FIXED VERSION WITH DISCOUNT PERCENTAGE
app.post('/discounts/add', isLoggedIn, async (req, res) => {
  console.log('=== PROMO ADD REQUEST STARTED for user:', req.session.user.username, 'at 2025-08-19 07:07:58 ===');
  console.log('User:', req.session.user?.username || 'No user found');
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Raw req.body:', req.body);
  console.log('req.body type:', typeof req.body);
  console.log('req.body keys:', Object.keys(req.body || {}));

  try {
    // Check if req.body exists
    if (!req.body || typeof req.body !== 'object') {
      console.log('❌ CRITICAL ERROR: req.body is not an object');
      console.log('req.body value:', req.body);
      return res.status(400).json({
        success: false,
        message: 'Request body parsing failed. Please check form configuration.',
        debug: {
          bodyType: typeof req.body,
          bodyValue: req.body,
          contentType: req.headers['content-type']
        }
      });
    }

    // Extract data from form - ADDED DISCOUNT PERCENTAGE
    const { event, startDate, endDate, description, discountPercentage } = req.body;

    // Log extracted fields
    console.log('Extracted fields:');
    console.log('- event:', event, '(type:', typeof event, ')');
    console.log('- startDate:', startDate, '(type:', typeof startDate, ')');
    console.log('- endDate:', endDate, '(type:', typeof endDate, ')');
    console.log('- description:', description, '(type:', typeof description, ')');
    console.log('- discountPercentage:', discountPercentage, '(type:', typeof discountPercentage, ')');

    // Validation - ADDED DISCOUNT PERCENTAGE VALIDATION
    if (!event || !startDate || !endDate || !description || discountPercentage === undefined || discountPercentage === null) {
      console.log('❌ VALIDATION FAILED - Missing fields');
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
        received: { event, startDate, endDate, description, discountPercentage }
      });
    }

    // Trim whitespace
    const trimmedEvent = String(event).trim();
    const trimmedDescription = String(description).trim();

    if (!trimmedEvent || !trimmedDescription) {
      console.log('❌ VALIDATION FAILED - Empty fields after trim');
      return res.status(400).json({
        success: false,
        message: 'Fields cannot be empty'
      });
    }

    // ADDED DISCOUNT PERCENTAGE VALIDATION
    const discountPercent = parseFloat(discountPercentage);
    if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      console.log('❌ DISCOUNT PERCENTAGE VALIDATION FAILED');
      return res.status(400).json({
        success: false,
        message: 'Discount percentage must be a number between 0 and 100'
      });
    }

    // Date validation
    const start = new Date(startDate);
    const end = new Date(endDate);

    console.log('Date parsing:');
    console.log('- start date:', start);
    console.log('- end date:', end);
    console.log('- start valid:', !isNaN(start.getTime()));
    console.log('- end valid:', !isNaN(end.getTime()));

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.log('❌ DATE VALIDATION FAILED - Invalid dates');
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    if (start > end) {
      console.log('❌ DATE VALIDATION FAILED - Start date after end date');
      return res.status(400).json({
        success: false,
        message: 'End date must be after or equal to start date'
      });
    }

    console.log('🔄 Connecting to MongoDB...');

    const client = await MongoClient.connect(uri);
    console.log('✅ MongoDB connected successfully');

    const db = client.db('blessingscafe');
    console.log('✅ Database selected: blessingscafe');

    const promosCollection = db.collection('Promos');
    console.log('✅ Collection selected: Promos');

    const newPromo = {
      event: trimmedEvent,
      startDate: start,
      endDate: end,
      description: trimmedDescription,
      discountPercentage: discountPercent, // ADDED DISCOUNT PERCENTAGE
      isActive: true,
      createdAt: new Date('2025-08-19T07:07:58.000Z'),
      createdBy: req.session.user?.username || 'Unknown'
    };

    console.log('📄 Document to insert:', JSON.stringify(newPromo, null, 2));

    const result = await promosCollection.insertOne(newPromo);
    console.log('✅ Insert result:', result);
    console.log('✅ Inserted ID:', result.insertedId);

    // Verify the insertion
    const insertedDoc = await promosCollection.findOne({ _id: result.insertedId });
    console.log('✅ Verification - inserted document exists:', !!insertedDoc);
    console.log('✅ Verification - discount percentage saved:', insertedDoc?.discountPercentage);

    // Count total promos
    const totalCount = await promosCollection.countDocuments();
    console.log('✅ Total promos in collection:', totalCount);

    await client.close();
    console.log('✅ MongoDB connection closed');

    console.log('=== PROMO ADD REQUEST COMPLETED SUCCESSFULLY for user:', req.session.user.username, 'at 2025-08-19 07:07:58 ===');

    // Return the created promo with its ID for frontend table update
    res.json({
      success: true,
      message: 'Promo added successfully',
      promo: {
        _id: result.insertedId,
        ...newPromo
      }
    });
  } catch (err) {
    console.error('❌ ERROR adding promo:', err);
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.log('=== PROMO ADD REQUEST FAILED ===');

    res.status(500).json({
      success: false,
      message: 'Database error occurred. Please check server logs.',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      timestamp: '2025-08-19 07:07:58'
    });
  }
});

// POST route for editing promo - JSON VERSION WITH DISCOUNT PERCENTAGE
app.post('/discounts/edit/:id', isLoggedIn, async (req, res) => {
  const { id } = req.params;

  try {
    // Get form data from either JSON or FormData - ADDED DISCOUNT PERCENTAGE
    let event, startDate, endDate, description, discountPercentage;

    if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
      // JSON data
      ({ event, startDate, endDate, description, discountPercentage } = req.body);
    } else {
      // Form data
      event = req.body.event;
      startDate = req.body.startDate;
      endDate = req.body.endDate;
      description = req.body.description;
      discountPercentage = req.body.discountPercentage;
    }

    console.log('Edit request data for user:', req.session.user.username, 'at 2025-08-19 07:07:58:', { event, startDate, endDate, description, discountPercentage });

    // Validation - ADDED DISCOUNT PERCENTAGE VALIDATION
    if (!event || !startDate || !endDate || !description || discountPercentage === undefined || discountPercentage === null) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
        received: { event, startDate, endDate, description, discountPercentage }
      });
    }

    // ADDED DISCOUNT PERCENTAGE VALIDATION
    const discountPercent = parseFloat(discountPercentage);
    if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return res.status(400).json({
        success: false,
        message: 'Discount percentage must be a number between 0 and 100'
      });
    }

    // Date validation
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after or equal to start date'
      });
    }

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid promo ID'
      });
    }

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');

    const updateResult = await promosCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          event: String(event).trim(),
          startDate: start,
          endDate: end,
          description: String(description).trim(),
          discountPercentage: discountPercent, // ADDED DISCOUNT PERCENTAGE
          updatedAt: new Date('2025-08-19T07:07:58.000Z'),
          updatedBy: req.session.user?.username || 'Unknown'
        }
      }
    );

    console.log('Update result for user:', req.session.user.username, ':', updateResult);

    await client.close();

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Promo not found'
      });
    }

    res.json({
      success: true,
      message: 'Promo updated successfully'
    });
  } catch (err) {
    console.error('Error editing promo for user:', req.session.user.username, ':', err);
    res.status(500).json({
      success: false,
      message: 'Database error: ' + err.message
    });
  }
});

// POST route for deleting promo
app.post('/discounts/delete/:id', isLoggedIn, async (req, res) => {
  const { id } = req.params;

  console.log('🗑️ Deleting promo for user:', req.session.user.username, 'at 2025-08-19 07:07:58:', id);

  // Validate ObjectId
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid promo ID'
    });
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');

    // Get promo details before deletion for logging
    const promo = await promosCollection.findOne({ _id: new ObjectId(id) });

    if (!promo) {
      await client.close();
      return res.status(404).json({
        success: false,
        message: 'Promo not found'
      });
    }

    const deleteResult = await promosCollection.deleteOne({ _id: new ObjectId(id) });

    console.log('✅ Delete result for user:', req.session.user.username, ':', deleteResult);

    await client.close();

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Promo not found'
      });
    }

    console.log(`✅ Promo "${promo.event}" deleted by ${req.session.user.username} at 2025-08-19 07:07:58`);

    res.json({
      success: true,
      message: 'Promo deleted successfully'
    });
  } catch (err) {
    console.error('❌ Error deleting promo for user:', req.session.user.username, ':', err);
    res.status(500).json({
      success: false,
      message: 'Database error: ' + err.message
    });
  }
});

// POST route for toggling promo switches
app.post('/discounts/toggle-switch', isLoggedIn, async (req, res) => {
  const { promoId, enabled } = req.body;

  try {
    console.log(`🔄 Promo ${promoId} toggled to: ${enabled} by ${req.session.user.username} at 2025-08-19 07:07:58`);

    // Here you could update a database field if needed
    // For example, updating an 'enabled' field in the promo document

    res.json({
      success: true,
      message: `Promo switch ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (err) {
    console.error('❌ Error toggling promo switch for user:', req.session.user.username, ':', err);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle promo switch'
    });
  }
});

// ========== END OF ENHANCED DISCOUNTS/PROMOS ROUTES ==========



// ========== SETTINGS AND PASSWORD MANAGEMENT ROUTES ==========

// SETTINGS PAGE ROUTE
app.get('/settings', isLoggedIn, nocache, (req, res) => {
  console.log(`⚙️ Settings page accessed by user: ${req.session.user.username} at 2025-08-19 07:07:58`);
  res.render('settings', {
    title: 'Settings | Blessings Cafe',
    user: req.session.user,
    currentPage: req.path
  });
});

// Alternative route for admin settings
app.get('/admin/settings', isLoggedIn, nocache, (req, res) => {
  console.log(`⚙️ Admin settings page accessed by user: ${req.session.user.username} at 2025-08-19 07:07:58`);
  res.render('settings', {
    title: 'Admin Settings | Blessings Cafe',
    user: req.session.user,
    currentPage: req.path
  });
});

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

    console.log(`✅ Password migration completed. Migrated ${migratedCount} passwords at 2025-08-19 07:07:58`);

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
});

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
  .catch(err => console.error("DB connection error:", err));

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
});

// Sales Per Day
app.get('/analytics/average-sales-per-day', async (req, res) => {
  try {
    const salesPerDay = await ordersCollection.aggregate([
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

    res.json(salesPerDay);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching average sales per day");
  }
});

// Autocomplete search for ingredients
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

// Analytics page
app.get('/analytics', isLoggedIn, nocache, (req, res) => {
  res.render('analytics', {
    title: 'Analytics | Blessings Cafe',
    user: req.session.user,
    currentPage: req.path
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});