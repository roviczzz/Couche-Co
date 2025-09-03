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
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');
    const products = await productCollection.find().toArray();
    await client.close();
    res.render('products', { products, title: 'Products | Blessings Cafe', user: req.session.user });
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

app.post('/products/edit/:id', async (req, res) => {
  const { id } = req.params;
  const {
    Name,
    Price,
    Category,
    imagelink,
    BasePrice,
    size16,
    size22,
    Ingredients,
    Allergen,
    isEnabled
  } = req.body;

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');

    const updateFields = {
      Name,
      Price: parseFloat(Price),
      Category,
      imagelink,
      Allergen: Allergen || '',
      isEnabled: isEnabled === 'true',
      Ingredients: Ingredients ? Ingredients.split(',').map(i => i.trim()) : [],
    };

    if (Category.toLowerCase() === 'pastries' && BasePrice) {
      updateFields.BasePrice = parseFloat(BasePrice);
    }

    if (size16 || size22) {
      const Sizes = [];
      if (size16) Sizes.push({ Size: '16oz', BasePrice: parseFloat(size16) });
      if (size22) Sizes.push({ Size: '22oz', BasePrice: parseFloat(size22) });
      updateFields.Sizes = Sizes;
    } else {
      updateFields.Sizes = [];
    }

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

app.get('/edit-product/:id', isLoggedIn, nocache, async (req, res) => {
  const { id } = req.params;
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const product = await db.collection('Menu').findOne({ _id: new ObjectId(id) });
    await client.close();

    if (!product) return res.status(404).send('Product not found');

    res.render('edit-product', { title: 'Edit Product | Blessings Cafe', product, user: req.session.user});
  } catch (err) {
    console.error('Error fetching product for editing:', err);
    res.status(500).send('Internal Server Error');
  }
});



//stockssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss



//stocks with add-ons functionality - V12

app.get('/stocks', isLoggedIn, nocache, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ingredients = await db.collection('Ingredients').find().toArray();
    const addons = await db.collection('Add-ons').find().toArray();
    await client.close();

    const message = req.query.msg || null;
    res.render('stocks', {
      ingredients,
      addons,
      title: 'Inventory Management | Blessings Cafe',
      user: req.session.user,
      message
    });
  } catch (err) {
    console.error(`[2025-09-03 15:26:01] Error loading inventory:`, err);
    res.status(500).send('Failed to load inventory');
  }
});

// Ingredients CRUD Routes
app.post('/stocks', async (req, res) => {
  const { IngredientID, IngredientPrefix, IngredientSuffix, Name, Quantity, Category, Allergen, isAvailable, isEnabled } = req.body;
  
  // Determine the final IngredientID - combine prefix and suffix WITH dash for database storage
  let finalIngredientID = IngredientID;
  if (IngredientPrefix && IngredientSuffix) {
    finalIngredientID = `${IngredientPrefix}-${IngredientSuffix}`;
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    
    // Check if ingredient ID already exists
    const existingIngredient = await db.collection('Ingredients').findOne({ 
      IngredientID: finalIngredientID 
    });
    
    if (existingIngredient) {
      await client.close();
      return res.redirect('/stocks?msg=duplicate_id');
    }

    const newIngredient = {
      IngredientID: finalIngredientID,
      Name: Name.trim(),
      Quantity: parseInt(Quantity),
      Category: Category.trim(),
      Allergen: Allergen ? Allergen.trim() : 'None',
      isAvailable: isAvailable === 'true',
      isEnabled: isEnabled === 'true',
      createdAt: new Date(),
      lastModified: new Date()
    };

    await db.collection('Ingredients').insertOne(newIngredient);
    await client.close();
    
    console.log(`[2025-09-03 15:26:01] Ingredient added: ${finalIngredientID} by MathDaenniel`);
    res.redirect('/stocks?msg=add_success');
  } catch (err) {
    console.error(`[2025-09-03 15:26:01] Error adding ingredient:`, err);
    res.status(500).send('Failed to add ingredient');
  }
});

app.post('/stocks/edit/:id', async (req, res) => {
  const id = req.params.id;
  const { IngredientID, IngredientPrefix, IngredientSuffix, Name, Quantity, Category, Allergen, isAvailable, isEnabled } = req.body;
  
  // Determine the final IngredientID
  let finalIngredientID;
  
  // If we have IngredientID directly (from form), use it as-is
  if (IngredientID && IngredientID.trim()) {
    finalIngredientID = IngredientID.trim();
  }
  // If we have prefix and suffix, combine them with dash
  else if (IngredientPrefix && IngredientSuffix) {
    finalIngredientID = `${IngredientPrefix}-${IngredientSuffix}`;
  }
  
  if (!finalIngredientID) {
    console.log(`[2025-09-03 15:26:01] Missing ingredient ID data for update: ID ${id} by MathDaenniel`);
    return res.redirect('/stocks?msg=item_not_found');
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    
    // Get the current ingredient for logging
    const currentIngredient = await db.collection('Ingredients').findOne({ _id: new ObjectId(id) });
    if (!currentIngredient) {
      await client.close();
      return res.redirect('/stocks?msg=item_not_found');
    }
    
    // Check if the new ingredient ID already exists (but not for the current document)
    if (finalIngredientID !== currentIngredient.IngredientID) {
      const existingIngredient = await db.collection('Ingredients').findOne({ 
        IngredientID: finalIngredientID,
        _id: { $ne: new ObjectId(id) }
      });
      
      if (existingIngredient) {
        await client.close();
        return res.redirect('/stocks?msg=duplicate_id');
      }
    }

    const updateData = {
      IngredientID: finalIngredientID,
      Name: Name.trim(),
      Quantity: parseInt(Quantity),
      Category: Category.trim(),
      Allergen: Allergen ? Allergen.trim() : 'None',
      isAvailable: isAvailable === 'true',
      isEnabled: isEnabled === 'true',
      lastModified: new Date()
    };

    const result = await db.collection('Ingredients').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    await client.close();

    if (result.matchedCount === 0) {
      console.log(`[2025-09-03 15:26:01] Ingredient not found for update: ID ${id} by MathDaenniel`);
      return res.redirect('/stocks?msg=item_not_found');
    }

    console.log(`[2025-09-03 15:26:01] Ingredient updated: ${currentIngredient.IngredientID} -> ${finalIngredientID} by MathDaenniel`);
    res.redirect('/stocks?msg=update_success');
  } catch (err) {
    console.error(`[2025-09-03 15:26:01] Error updating ingredient:`, err);
    res.status(500).send('Failed to update ingredient');
  }
});

app.post('/stocks/delete/:id', async (req, res) => {
  const id = req.params.id;
  
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    
    // Get the ingredient info before deletion for logging
    const ingredientToDelete = await db.collection('Ingredients').findOne({ _id: new ObjectId(id) });
    
    if (!ingredientToDelete) {
      await client.close();
      return res.redirect('/stocks?msg=item_not_found');
    }
    
    const result = await db.collection('Ingredients').deleteOne({ _id: new ObjectId(id) });
    
    await client.close();

    if (result.deletedCount === 0) {
      console.log(`[2025-09-03 15:26:01] Ingredient not found for deletion: ID ${id} by MathDaenniel`);
      return res.redirect('/stocks?msg=delete_failed');
    }
    
    console.log(`[2025-09-03 15:26:01] Ingredient deleted: ${ingredientToDelete.IngredientID} by MathDaenniel`);
    res.redirect('/stocks?msg=delete_success');
  } catch (err) {
    console.error(`[2025-09-03 15:26:01] Error deleting ingredient:`, err);
    res.status(500).send('Failed to delete ingredient');
  }
});

// Add-Ons CRUD Routes
app.post('/addons', async (req, res) => {
  const { AddOnID, AddOnPrefix, AddOnSuffix, Name, Quantity, Category, Allergen, isEnabledAddon } = req.body;
  
  // Determine the final AddOnID - combine prefix and suffix WITH dash for database storage
  let finalAddOnID = AddOnID;
  if (AddOnPrefix && AddOnSuffix) {
    finalAddOnID = `${AddOnPrefix}-${AddOnSuffix}`;
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    
    // Check if add-on ID already exists
    const existingAddOn = await db.collection('Add-ons').findOne({ 
      AddOnID: finalAddOnID 
    });
    
    if (existingAddOn) {
      await client.close();
      return res.redirect('/stocks?msg=duplicate_id');
    }

    const newAddOn = {
      AddOnID: finalAddOnID,
      Name: Name.trim(),
      Quantity: parseInt(Quantity),
      Category: Category.trim(),
      Allergen: Allergen ? Allergen.trim() : 'None',
      isEnabled: isEnabledAddon === 'true',
      createdAt: new Date(),
      lastModified: new Date()
    };

    await db.collection('Add-ons').insertOne(newAddOn);
    await client.close();
    
    console.log(`[2025-09-03 15:26:01] Add-on added: ${finalAddOnID} by MathDaenniel`);
    res.redirect('/stocks?msg=add_success');
  } catch (err) {
    console.error(`[2025-09-03 15:26:01] Error adding add-on:`, err);
    res.status(500).send('Failed to add add-on');
  }
});

app.post('/addons/edit/:id', async (req, res) => {
  const id = req.params.id;
  const { AddOnID, AddOnPrefix, AddOnSuffix, Name, Quantity, Category, Allergen, isEnabled } = req.body;
  
  // Determine the final AddOnID
  let finalAddOnID;
  
  // If we have AddOnID directly (from form), use it as-is
  if (AddOnID && AddOnID.trim()) {
    finalAddOnID = AddOnID.trim();
  }
  // If we have prefix and suffix, combine them with dash
  else if (AddOnPrefix && AddOnSuffix) {
    finalAddOnID = `${AddOnPrefix}-${AddOnSuffix}`;
  }
  
  if (!finalAddOnID) {
    console.log(`[2025-09-03 15:26:01] Missing add-on ID data for update: ID ${id} by MathDaenniel`);
    return res.redirect('/stocks?msg=item_not_found');
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    
    // Get the current add-on for logging
    const currentAddOn = await db.collection('Add-ons').findOne({ _id: new ObjectId(id) });
    if (!currentAddOn) {
      await client.close();
      return res.redirect('/stocks?msg=item_not_found');
    }
    
    // Check if the new add-on ID already exists (but not for the current document)
    if (finalAddOnID !== currentAddOn.AddOnID) {
      const existingAddOn = await db.collection('Add-ons').findOne({ 
        AddOnID: finalAddOnID,
        _id: { $ne: new ObjectId(id) }
      });
      
      if (existingAddOn) {
        await client.close();
        return res.redirect('/stocks?msg=duplicate_id');
      }
    }

    const updateData = {
      AddOnID: finalAddOnID,
      Name: Name.trim(),
      Quantity: parseInt(Quantity),
      Category: Category.trim(),
      Allergen: Allergen ? Allergen.trim() : 'None',
      isEnabled: isEnabled === 'true',
      lastModified: new Date()
    };

    const result = await db.collection('Add-ons').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    await client.close();

    if (result.matchedCount === 0) {
      console.log(`[2025-09-03 15:26:01] Add-on not found for update: ID ${id} by MathDaenniel`);
      return res.redirect('/stocks?msg=item_not_found');
    }

    console.log(`[2025-09-03 15:26:01] Add-on updated: ${currentAddOn.AddOnID} -> ${finalAddOnID} by MathDaenniel`);
    res.redirect('/stocks?msg=update_success');
  } catch (err) {
    console.error(`[2025-09-03 15:26:01] Error updating add-on:`, err);
    res.status(500).send('Failed to update add-on');
  }
});

app.post('/addons/delete/:id', async (req, res) => {
  const id = req.params.id;
  
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    
    // Get the add-on info before deletion for logging
    const addonToDelete = await db.collection('Add-ons').findOne({ _id: new ObjectId(id) });
    
    if (!addonToDelete) {
      await client.close();
      return res.redirect('/stocks?msg=item_not_found');
    }
    
    const result = await db.collection('Add-ons').deleteOne({ _id: new ObjectId(id) });
    
    await client.close();

    if (result.deletedCount === 0) {
      console.log(`[2025-09-03 15:26:01] Add-on not found for deletion: ID ${id} by MathDaenniel`);
      return res.redirect('/stocks?msg=delete_failed');
    }
    
    console.log(`[2025-09-03 15:26:01] Add-on deleted: ${addonToDelete.AddOnID} by MathDaenniel`);
    res.redirect('/stocks?msg=delete_success');
  } catch (err) {
    console.error(`[2025-09-03 15:26:01] Error deleting add-on:`, err);
    res.status(500).send('Failed to delete add-on');
  }
});

// Individual detail routes (useful for future features)
app.get('/stocks/details/:id', isLoggedIn, async (req, res) => {
  const id = req.params.id;
  
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ingredient = await db.collection('Ingredients').findOne({ _id: new ObjectId(id) });
    await client.close();

    if (!ingredient) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }

    res.json(ingredient);
  } catch (err) {
    console.error(`[2025-09-03 15:26:01] Error fetching ingredient details:`, err);
    res.status(500).json({ error: 'Failed to fetch ingredient details' });
  }
});

app.get('/addons/details/:id', isLoggedIn, async (req, res) => {
  const id = req.params.id;
  
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const addon = await db.collection('Add-ons').findOne({ _id: new ObjectId(id) });
    await client.close();

    if (!addon) {
      return res.status(404).json({ error: 'Add-on not found' });
    }

    res.json(addon);
  } catch (err) {
    console.error(`[2025-09-03 15:26:01] Error fetching add-on details:`, err);
    res.status(500).json({ error: 'Failed to fetch add-on details' });
  }
});

// Bulk operations (future enhancement)
app.post('/stocks/bulk-update', isLoggedIn, async (req, res) => {
  const { updates } = req.body;
  
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
    
    const result = await db.collection('Ingredients').bulkWrite(bulkOps);
    await client.close();
    
    console.log(`[2025-09-03 15:26:01] Bulk update completed: ${result.modifiedCount} ingredients updated by MathDaenniel`);
    res.json({ success: true, modified: result.modifiedCount });
  } catch (err) {
    console.error(`[2025-09-03 15:26:01] Error in bulk update:`, err);
    res.status(500).json({ error: 'Failed to perform bulk update' });
  }
});

app.post('/addons/bulk-update', isLoggedIn, async (req, res) => {
  const { updates } = req.body;
  
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
    
    const result = await db.collection('Add-ons').bulkWrite(bulkOps);
    await client.close();
    
    console.log(`[2025-09-03 15:26:01] Bulk update completed: ${result.modifiedCount} add-ons updated by MathDaenniel`);
    res.json({ success: true, modified: result.modifiedCount });
  } catch (err) {
    console.error(`[2025-09-03 15:26:01] Error in bulk update:`, err);
    res.status(500).json({ error: 'Failed to perform bulk update' });
  }
});

// Data export functionality (future enhancement)
app.get('/stocks/export', isLoggedIn, async (req, res) => {
  try {
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
      version: 'V3.0',
      timestamp: '[2025-09-03 15:26:01]'
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-export-v3.json"');
    res.json(exportData);
    
    console.log(`[2025-09-03 15:26:01] Inventory data exported by MathDaenniel`);
  } catch (err) {
    console.error(`[2025-09-03 15:26:01] Error exporting inventory data:`, err);
    res.status(500).json({ error: 'Failed to export inventory data' });
  }
});

// Search functionality (future enhancement)
app.get('/stocks/search', isLoggedIn, async (req, res) => {
  const { query, type = 'all' } = req.query;
  
  if (!query) {
    return res.json({ ingredients: [], addons: [] });
  }
  
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    
    const searchRegex = new RegExp(query, 'i');
    const searchFilter = {
      $or: [
        { Name: searchRegex },
        { Category: searchRegex },
        { Allergen: searchRegex },
        { IngredientID: searchRegex },
        { AddOnID: searchRegex }
      ]
    };
    
    let ingredients = [];
    let addons = [];
    
    if (type === 'all' || type === 'ingredients') {
      ingredients = await db.collection('Ingredients').find(searchFilter).toArray();
    }
    
    if (type === 'all' || type === 'addons') {
      addons = await db.collection('Add-ons').find(searchFilter).toArray();
    }
    
    await client.close();
    
    console.log(`[2025-09-03 15:26:01] Search performed for "${query}" by MathDaenniel`);
    res.json({ 
      ingredients, 
      addons, 
      searchQuery: query, 
      searchType: type,
      resultCount: ingredients.length + addons.length,
      timestamp: '[2025-09-03 15:26:01]'
    });
  } catch (err) {
    console.error(`[2025-09-03 15:26:01] Error searching inventory:`, err);
    res.status(500).json({ error: 'Failed to search inventory' });
  }
});

// Inventory statistics (new feature for V3.0)
app.get('/stocks/stats', isLoggedIn, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    
    // Get ingredient statistics
    const ingredientStats = await db.collection('Ingredients').aggregate([
      {
        $group: {
          _id: null,
          totalIngredients: { $sum: 1 },
          enabledIngredients: { $sum: { $cond: ['$isEnabled', 1, 0] } },
          totalQuantity: { $sum: '$Quantity' },
          categories: { $addToSet: '$Category' }
        }
      }
    ]).toArray();
    
    // Get add-on statistics
    const addonStats = await db.collection('Add-ons').aggregate([
      {
        $group: {
          _id: null,
          totalAddons: { $sum: 1 },
          enabledAddons: { $sum: { $cond: ['$isEnabled', 1, 0] } },
          totalQuantity: { $sum: '$Quantity' },
          categories: { $addToSet: '$Category' }
        }
      }
    ]).toArray();
    
    await client.close();
    
    const stats = {
      ingredients: ingredientStats[0] || { totalIngredients: 0, enabledIngredients: 0, totalQuantity: 0, categories: [] },
      addons: addonStats[0] || { totalAddons: 0, enabledAddons: 0, totalQuantity: 0, categories: [] },
      generatedAt: new Date(),
      generatedBy: 'MathDaenniel',
      version: 'V3.0',
      timestamp: '[2025-09-03 15:26:01]'
    };
    
    console.log(`[2025-09-03 15:26:01] Inventory statistics generated by MathDaenniel`);
    res.json(stats);
  } catch (err) {
    console.error(`[2025-09-03 15:26:01] Error generating inventory statistics:`, err);
    res.status(500).json({ error: 'Failed to generate inventory statistics' });
  }
});

// Low stock alerts (new feature for V3.0)
app.get('/stocks/alerts', isLoggedIn, async (req, res) => {
  const { threshold = 10 } = req.query;
  const lowStockThreshold = parseInt(threshold);
  
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
    
    await client.close();
    
    const alerts = {
      lowStockIngredients,
      lowStockAddons,
      threshold: lowStockThreshold,
      totalAlerts: lowStockIngredients.length + lowStockAddons.length,
      generatedAt: new Date(),
      generatedBy: 'MathDaenniel',
      timestamp: '[2025-09-03 15:26:01]'
    };
    
    console.log(`[2025-09-03 15:26:01] Low stock alerts generated (threshold: ${lowStockThreshold}) by MathDaenniel`);
    res.json(alerts);
  } catch (err) {
    console.error(`[2025-09-03 15:26:01] Error generating low stock alerts:`, err);
    res.status(500).json({ error: 'Failed to generate low stock alerts' });
  }
});

// Category management (new feature for V3.0)
app.get('/stocks/categories', isLoggedIn, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    
    const ingredientCategories = await db.collection('Ingredients').distinct('Category');
    const addonCategories = await db.collection('Add-ons').distinct('Category');
    
    await client.close();
    
    const categories = {
      ingredients: ingredientCategories.filter(cat => cat && cat.trim()),
      addons: addonCategories.filter(cat => cat && cat.trim()),
      all: [...new Set([...ingredientCategories, ...addonCategories])].filter(cat => cat && cat.trim()),
      generatedAt: new Date(),
      generatedBy: 'MathDaenniel',
      timestamp: '[2025-09-03 15:26:01]'
    };
    
    console.log(`[2025-09-03 15:26:01] Categories retrieved by MathDaenniel`);
    res.json(categories);
  } catch (err) {
    console.error(`[2025-09-03 15:26:01] Error retrieving categories:`, err);
    res.status(500).json({ error: 'Failed to retrieve categories' });
  }
});

// Health check endpoint (new feature for V3.0)
app.get('/stocks/health', isLoggedIn, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    
    // Test database connectivity
    await db.admin().ping();
    
    // Get collection stats
    const ingredientCount = await db.collection('Ingredients').countDocuments();
    const addonCount = await db.collection('Add-ons').countDocuments();
    
    await client.close();
    
    const healthStatus = {
      status: 'healthy',
      database: 'connected',
      ingredients: ingredientCount,
      addons: addonCount,
      version: 'V3.0',
      timestamp: new Date(),
      checkedBy: 'MathDaenniel'
    };
    
    console.log(`[2025-09-03 15:26:01] Health check performed by MathDaenniel`);
    res.json(healthStatus);
  } catch (err) {
    console.error(`[2025-09-03 15:26:01] Health check failed:`, err);
    res.status(500).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message,
      timestamp: new Date(),
      checkedBy: 'MathDaenniel'
    });
  }
});
// end of stockssssssssssssssssssssssssssssssssssssssssssssssssssssssssss





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

// ========== ENHANCED DISCOUNTS/PROMOS ROUTES - V12 ==========

// GET route for discounts page
app.get('/discounts', isLoggedIn, nocache, async (req, res) => {
  try {
    console.log(`[2025-08-26 17:33:44] Loading discounts page for user: ${req.session.user.username} by MathDaenniel`);

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');
    const promos = await promosCollection.find().toArray();
    await client.close();

    console.log(`[2025-08-26 17:33:44] Fetched ${promos.length} promos from database by MathDaenniel`);

    const message = req.query.msg || null;
    res.render('discounts', {
      promos,
      title: 'Promo Management | Blessings Cafe',
      user: req.session.user,
      message,
      currentPage: req.path
    });
  } catch (err) {
    console.error(`[2025-08-26 17:33:44] Error fetching promos:`, err, 'by MathDaenniel');
    res.status(500).send('Failed to load promos');
  }
});

// POST route for adding new promo - Enhanced for V12
app.post('/discounts/add', isLoggedIn, async (req, res) => {
  console.log(`[2025-08-26 17:33:44] Promo add request started for user: ${req.session.user.username} by MathDaenniel`);
  console.log(`[2025-08-26 17:33:44] Request body:`, req.body, 'by MathDaenniel');

  try {
    // Check if req.body exists
    if (!req.body || typeof req.body !== 'object') {
      console.log(`[2025-08-26 17:33:44] Critical error: req.body is not an object by MathDaenniel`);
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

    // Extract data from form
    const { event, startDate, endDate, description, discountPercentage } = req.body;

    // Log extracted fields
    console.log(`[2025-08-26 17:33:44] Extracted fields:`, {
      event, startDate, endDate, description, discountPercentage
    }, 'by MathDaenniel');

    // Validation
    if (!event || !startDate || !endDate || !description || discountPercentage === undefined || discountPercentage === null) {
      console.log(`[2025-08-26 17:33:44] Validation failed - missing fields by MathDaenniel`);
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
      console.log(`[2025-08-26 17:33:44] Validation failed - empty fields after trim by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Fields cannot be empty'
      });
    }

    // Discount percentage validation
    const discountPercent = parseFloat(discountPercentage);
    if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      console.log(`[2025-08-26 17:33:44] Discount percentage validation failed by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Discount percentage must be a number between 0 and 100'
      });
    }

    // Date validation
    const start = new Date(startDate);
    const end = new Date(endDate);

    console.log(`[2025-08-26 17:33:44] Date parsing:`, {
      start, end, 
      startValid: !isNaN(start.getTime()), 
      endValid: !isNaN(end.getTime())
    }, 'by MathDaenniel');

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.log(`[2025-08-26 17:33:44] Date validation failed - invalid dates by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    if (start > end) {
      console.log(`[2025-08-26 17:33:44] Date validation failed - start date after end date by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'End date must be after or equal to start date'
      });
    }

    console.log(`[2025-08-26 17:33:44] Connecting to MongoDB by MathDaenniel`);

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');

    // Check for duplicate promo (same event name and overlapping dates)
    const existingPromo = await promosCollection.findOne({
      event: trimmedEvent,
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ]
    });

    if (existingPromo) {
      await client.close();
      console.log(`[2025-08-26 17:33:44] Duplicate promo detected by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'A promo with the same event name already exists in the selected date range'
      });
    }

    const newPromo = {
      event: trimmedEvent,
      startDate: start,
      endDate: end,
      description: trimmedDescription,
      discountPercentage: discountPercent,
      isActive: true,
      createdAt: new Date(),
      createdBy: 'MathDaenniel',
      lastModified: new Date(),
      lastModifiedBy: 'MathDaenniel'
    };

    console.log(`[2025-08-26 17:33:44] Document to insert:`, newPromo, 'by MathDaenniel');

    const result = await promosCollection.insertOne(newPromo);
    console.log(`[2025-08-26 17:33:44] Insert result:`, result, 'by MathDaenniel');

    // Verify the insertion
    const insertedDoc = await promosCollection.findOne({ _id: result.insertedId });
    console.log(`[2025-08-26 17:33:44] Verification - discount percentage saved:`, insertedDoc?.discountPercentage, 'by MathDaenniel');

    // Count total promos
    const totalCount = await promosCollection.countDocuments();
    console.log(`[2025-08-26 17:33:44] Total promos in collection: ${totalCount} by MathDaenniel`);

    await client.close();

    console.log(`[2025-08-26 17:33:44] Promo add request completed successfully by MathDaenniel`);

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
    console.error(`[2025-08-26 17:33:44] Error adding promo:`, err, 'by MathDaenniel');

    res.status(500).json({
      success: false,
      message: 'Database error occurred. Please check server logs.',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      timestamp: '[2025-08-26 17:33:44]'
    });
  }
});

// POST route for editing promo - Enhanced for V12
app.post('/discounts/edit/:id', isLoggedIn, async (req, res) => {
  const { id } = req.params;

  try {
    console.log(`[2025-08-26 17:33:44] Edit promo request for ID: ${id} by MathDaenniel`);

    // Get form data from either JSON or FormData
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

    console.log(`[2025-08-26 17:33:44] Edit request data:`, { 
      event, startDate, endDate, description, discountPercentage 
    }, 'by MathDaenniel');

    // Validation
    if (!event || !startDate || !endDate || !description || discountPercentage === undefined || discountPercentage === null) {
      console.log(`[2025-08-26 17:33:44] Edit validation failed - missing fields by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
        received: { event, startDate, endDate, description, discountPercentage }
      });
    }

    // Discount percentage validation
    const discountPercent = parseFloat(discountPercentage);
    if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      console.log(`[2025-08-26 17:33:44] Edit discount percentage validation failed by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Discount percentage must be a number between 0 and 100'
      });
    }

    // Date validation
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.log(`[2025-08-26 17:33:44] Edit date validation failed by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    if (start > end) {
      console.log(`[2025-08-26 17:33:44] Edit date range validation failed by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'End date must be after or equal to start date'
      });
    }

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      console.log(`[2025-08-26 17:33:44] Invalid ObjectId: ${id} by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'Invalid promo ID'
      });
    }

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');

    // Get current promo for logging
    const currentPromo = await promosCollection.findOne({ _id: new ObjectId(id) });
    if (!currentPromo) {
      await client.close();
      console.log(`[2025-08-26 17:33:44] Promo not found for edit: ${id} by MathDaenniel`);
      return res.status(404).json({
        success: false,
        message: 'Promo not found'
      });
    }

    // Check for duplicate promo (same event name and overlapping dates, excluding current promo)
    const duplicatePromo = await promosCollection.findOne({
      _id: { $ne: new ObjectId(id) },
      event: String(event).trim(),
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ]
    });

    if (duplicatePromo) {
      await client.close();
      console.log(`[2025-08-26 17:33:44] Duplicate promo detected during edit by MathDaenniel`);
      return res.status(400).json({
        success: false,
        message: 'A promo with the same event name already exists in the selected date range'
      });
    }

    const updateResult = await promosCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          event: String(event).trim(),
          startDate: start,
          endDate: end,
          description: String(description).trim(),
          discountPercentage: discountPercent,
          lastModified: new Date(),
          lastModifiedBy: 'MathDaenniel'
        }
      }
    );

    console.log(`[2025-08-26 17:33:44] Update result:`, updateResult, 'by MathDaenniel');

    await client.close();

    if (updateResult.matchedCount === 0) {
      console.log(`[2025-08-26 17:33:44] No promo matched for update: ${id} by MathDaenniel`);
      return res.status(404).json({
        success: false,
        message: 'Promo not found'
      });
    }

    console.log(`[2025-08-26 17:33:44] Promo updated: ${currentPromo.event} -> ${String(event).trim()} by MathDaenniel`);

    res.json({
      success: true,
      message: 'Promo updated successfully'
    });
  } catch (err) {
    console.error(`[2025-08-26 17:33:44] Error editing promo:`, err, 'by MathDaenniel');
    res.status(500).json({
      success: false,
      message: 'Database error: ' + err.message
    });
  }
});

// POST route for deleting promo - Enhanced for V12
app.post('/discounts/delete/:id', isLoggedIn, async (req, res) => {
  const { id } = req.params;

  console.log(`[2025-08-26 17:33:44] Deleting promo: ${id} by MathDaenniel`);

  // Validate ObjectId
  if (!ObjectId.isValid(id)) {
    console.log(`[2025-08-26 17:33:44] Invalid ObjectId for delete: ${id} by MathDaenniel`);
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
      console.log(`[2025-08-26 17:33:44] Promo not found for delete: ${id} by MathDaenniel`);
      return res.status(404).json({
        success: false,
        message: 'Promo not found'
      });
    }

    const deleteResult = await promosCollection.deleteOne({ _id: new ObjectId(id) });

    console.log(`[2025-08-26 17:33:44] Delete result:`, deleteResult, 'by MathDaenniel');

    await client.close();

    if (deleteResult.deletedCount === 0) {
      console.log(`[2025-08-26 17:33:44] No promo deleted: ${id} by MathDaenniel`);
      return res.status(404).json({
        success: false,
        message: 'Promo not found'
      });
    }

    console.log(`[2025-08-26 17:33:44] Promo "${promo.event}" deleted by MathDaenniel`);

    res.json({
      success: true,
      message: 'Promo deleted successfully'
    });
  } catch (err) {
    console.error(`[2025-08-26 17:33:44] Error deleting promo:`, err, 'by MathDaenniel');
    res.status(500).json({
      success: false,
      message: 'Database error: ' + err.message
    });
  }
});

// POST route for toggling promo switches - Enhanced for V12
app.post('/discounts/toggle-switch', isLoggedIn, async (req, res) => {
  const { promoId, enabled } = req.body;

  try {
    console.log(`[2025-08-26 17:33:44] Promo ${promoId} toggled to: ${enabled} by MathDaenniel`);

    // Validate ObjectId
    if (!ObjectId.isValid(promoId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid promo ID'
      });
    }

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');

    const updateResult = await promosCollection.updateOne(
      { _id: new ObjectId(promoId) },
      {
        $set: {
          isActive: enabled === true || enabled === 'true',
          lastModified: new Date(),
          lastModifiedBy: 'MathDaenniel'
        }
      }
    );

    await client.close();

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Promo not found'
      });
    }

    res.json({
      success: true,
      message: `Promo switch ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (err) {
    console.error(`[2025-08-26 17:33:44] Error toggling promo switch:`, err, 'by MathDaenniel');
    res.status(500).json({
      success: false,
      message: 'Failed to toggle promo switch'
    });
  }
});

// Additional routes for V12 compatibility

// GET route for promo statistics (new feature)
app.get('/discounts/stats', isLoggedIn, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');
    
    const now = new Date();
    
    const stats = await promosCollection.aggregate([
      {
        $group: {
          _id: null,
          totalPromos: { $sum: 1 },
          activePromos: { $sum: { $cond: ['$isActive', 1, 0] } },
          currentPromos: { 
            $sum: { 
              $cond: [
                { $and: [
                  { $lte: ['$startDate', now] },
                  { $gte: ['$endDate', now] },
                  '$isActive'
                ]}, 
                1, 
                0 
              ] 
            }
          },
          avgDiscountPercentage: { $avg: '$discountPercentage' }
        }
      }
    ]).toArray();
    
    await client.close();
    
    const result = {
      ...(stats[0] || { totalPromos: 0, activePromos: 0, currentPromos: 0, avgDiscountPercentage: 0 }),
      generatedAt: new Date(),
      generatedBy: 'MathDaenniel',
      timestamp: '[2025-08-26 17:33:44]'
    };
    
    console.log(`[2025-08-26 17:33:44] Promo statistics generated by MathDaenniel`);
    res.json(result);
  } catch (err) {
    console.error(`[2025-08-26 17:33:44] Error generating promo statistics:`, err, 'by MathDaenniel');
    res.status(500).json({ error: 'Failed to generate promo statistics' });
  }
});

// GET route for promo export (new feature)
app.get('/discounts/export', isLoggedIn, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');
    const promos = await promosCollection.find().toArray();
    await client.close();
    
    const exportData = {
      promos,
      exportedAt: new Date(),
      exportedBy: 'MathDaenniel',
      version: 'V12',
      timestamp: '[2025-08-26 17:33:44]'
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="promos-export-v12.json"');
    res.json(exportData);
    
    console.log(`[2025-08-26 17:33:44] Promo data exported by MathDaenniel`);
  } catch (err) {
    console.error(`[2025-08-26 17:33:44] Error exporting promo data:`, err, 'by MathDaenniel');
    res.status(500).json({ error: 'Failed to export promo data' });
  }
});

// ========== END OF ENHANCED DISCOUNTS/PROMOS ROUTES - V12 ==========





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