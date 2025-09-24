const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
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

// Middleware to ensure user is logged in
const isLoggedIn = (req, res, next) => {
  if (req.session?.user) {
    return next();
  }
  res.redirect('/login');
};

// Disable caching for all routes in this router
const nocache = (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};

// Apply login check and nocache to all routes in this file
router.use(isLoggedIn);
router.use(nocache);

// User login route
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/user/home');
  }
  res.render('user/login', {
    title: 'Login | Couche Co',
    layout: false,
    errors: {},
    error: null,
    formData: {}
  });
});

router.post('/login',
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

      let client;
      try {
        client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');
        const users = db.collection('users');

        const user = await users.findOne({ email: req.body.email });

        if (!user) {
          return res.render('user/login', {
            title: 'Login | Couche Co',
            errors: {},
            error: 'Invalid email or password',
            formData: { email: req.body.email },
            layout: false
          });
        }

        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) {
          return res.render('user/login', {
            title: 'Login | Couche Co',
            errors: {},
            error: 'Invalid email or password',
            formData: { email: req.body.email },
            layout: false
          });
        }

        // Update last login time in database
        await users.updateOne(
          { _id: user._id },
          { $set: { lastLogin: new Date() } }
        );

        req.session.user = {
          _id: user._id,
          email: user.email,
          name: user.name || user.email,
          role: 'user',
          staffId: user.staffId || generateStaffId('user', user._id),
          username: user.username,
          loginTime: new Date().toISOString()
        };

        res.redirect('/user/home');
      } catch (err) {
        console.error('Login error:', err);
        res.status(500).render('user/login', {
          title: 'Login | Couche Co',
          errors: {},
          error: 'An error occurred during login',
          formData: req.body,
          layout: false
        });
      } finally {
        if (client) {
          await client.close();
        }
      }
    }
);



// User profile route
router.get('/profile', async (req, res) => {
  try {
    res.render('user/profile', {
      title: 'My Profile',
      user: req.session.user
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).send('Error loading profile');
  }
});

// Menu route
router.get('/menu', async (req, res) => {
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

// Products route
router.get('/products', async (req, res) => {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('blessingscafe');

    const productCollection = db.collection('Menu');
    const ingredientCollection = db.collection('Ingredients');

    const products = await productCollection.find().toArray();

    const allIngredientIDs = products.flatMap(p => p.Ingredients || []);

    const ingredientDocs = await ingredientCollection
        .find({ IngredientID: { $in: allIngredientIDs } })
        .project({ IngredientID: 1, Name: 1, _id: 0 })
        .toArray();

    const ingredientMap = {};
    ingredientDocs.forEach(i => {
      ingredientMap[i.IngredientID] = i.Name;
    });

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

// Toggle product availability
router.post('/toggle-availability/:id', async (req, res) => {
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

// Add new product
router.post('/products/add', async (req, res) => {
  const {
    categoryShortcut,
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
    Category,
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

// Render add product page
router.get('/add-product', (req, res) => {
  res.render('add-product', { title: 'Add Product | Blessings Cafe', user: req.session.user});
});

// Edit product
router.post('/products/edit/:id', async (req, res) => {
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

    const updateFields = {
      Name,
      Category,
      imagelink,
      Allergen: Allergen || '',
      isEnabled: isEnabled === 'true',
    };

    if (Category && Category.toLowerCase() === 'pastries' && BasePrice) {
      updateFields.BasePrice = parseFloat(BasePrice);
    }

    if (size16 || size22) {
      const Sizes = [];
      if (size16) Sizes.push({ Size: '16oz', BasePrice: parseFloat(size16) });
      if (size22) Sizes.push({ Size: '22oz', BasePrice: parseFloat(size22) });
      updateFields.Sizes = Sizes;
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

// Render edit product page
router.get('/edit-product/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');
    const ingredientsCollection = db.collection('Ingredients');

    const product = await productCollection.findOne({ _id: new ObjectId(id) });

    if (!product) {
      await client.close();
      return res.status(404).send('Product not found');
    }

    let ingredientDetails = [];
    if (Array.isArray(product.Ingredients) && product.Ingredients.length > 0) {
      ingredientDetails = await ingredientsCollection
          .find({ IngredientID: { $in: product.Ingredients } })
          .toArray();
    }

    await client.close();

    res.render('edit-product', {
      product,
      ingredientDetails: ingredientDetails || []
    });
  } catch (err) {
    console.error('Error loading edit product:', err);
    res.status(500).send('Internal Server Error');
  }
});

// API to get product by ID
router.get('/api/products/:id', async (req, res) => {
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

// Delete product
router.post('/delete-product/:id', async (req, res) => {
  const productId = req.params.id;

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const result = await db.collection('Menu').deleteOne({ _id: new ObjectId(productId) });

    await client.close();

    if (result.deletedCount === 1) {
      req.flash('success_msg', `Product has been deleted`);
      res.redirect('/products');
    } else {
      res.status(404).send('Product not found');
    }
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Management route
router.get('/management', async (req, res) => {
  res.render('management', {
    currentPage: '/management'
  });
});

// User settings route
router.get('/settings', (req, res) => {
  console.log(`⚙️ Settings page accessed by user: ${req.session.user.username} at ${new Date().toISOString()}`);
  res.render('settings', {
    title: 'Settings | Blessings Cafe',
    user: req.session.user,
    currentPage: req.path
  });
});

// Change password route
router.post('/change-password', async (req, res) => {
  try {
    console.log(`🔐 Password change attempt by user: ${req.session.user.username} at ${new Date().toISOString()}`);

    const { currentPassword, newPassword } = req.body;

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

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const users = db.collection('users');

    const user = await users.findOne({ _id: new ObjectId(req.session.user._id) });

    if (!user) {
      await client.close();
      console.log(`❌ Password change failed - User not found: ${req.session.user.username}`);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let currentPasswordValid = false;

    if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
      currentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      console.log('🔐 Verifying against hashed password');
    } else {
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

    console.log('🔐 Hashing new password with bcrypt...');
    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    console.log('✅ New password hashed successfully');

    const updateResult = await users.updateOne(
        { _id: user._id },
        {
          $set: {
            password: hashedNewPassword,
            passwordChangedAt: new Date(),
            passwordChangedBy: req.session.user.username,
            lastModified: new Date()
          }
        }
    );

    await client.close();

    if (updateResult.modifiedCount === 1) {
      console.log(`✅ Password changed successfully for user: ${req.session.user.username} at ${new Date().toISOString()}`);

      console.log(`🔒 SECURITY EVENT: Password changed for user ${req.session.user.username} from IP ${req.ip || req.connection.remoteAddress} at ${new Date().toISOString()}`);

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

module.exports = router;
