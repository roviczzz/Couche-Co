const express = require('express');
const session = require('express-session');
const { MongoClient, ObjectId } = require('mongodb');
const { check, validationResult } = require('express-validator');
const expressLayouts = require('express-ejs-layouts');
const app = express();
const port = 8080;
const uri = 'mongodb+srv://CoucheAdmin:couchemongo2025!@bsit.dhojcct.mongodb.net/';

const flash = require('connect-flash');
const favicon = require('serve-favicon');
const path = require('path');

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


app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.urlencoded({ extended: false }));
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
    try {
      const client = await MongoClient.connect(uri);
      const db = client.db('blessingscafe');
      const users = db.collection('users');
      const user = await users.findOne({
        username: req.body.Username,
        password: req.body.Password,
      });
      await client.close();
      if (!user) {
        return res.render('login', {
          title: 'Login | Blessings Cafe',
          errors: {},
          error: 'Invalid username or password',
          formData: { Username: req.body.Username },
          layout: false
        });
      }
      req.session.user = {
        username: user.username,
        email: user.email
      };
      res.redirect('/dashboard');
    } catch (err) {
      res.status(500).send('Internal Server Error');
    }
  }
);

app.get('/account/register', (req, res) => {
  res.render('register', { errors: {}, formData: {}, error: null, layout: false });
});

app.get('/dashboard', isLoggedIn, nocache, (req, res) => {
  res.render('dashboard', { title: 'Dashboard | Blessings Cafe', user: req.session.user, currentPage: req.path });
});

app.get('/menu', isLoggedIn, nocache, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const menuCollection = db.collection('Menu');
    const menuItems = await menuCollection.find().toArray();
    await client.close();
    res.render('menu', { menuItems, title: 'Menu | Blessings Cafe', user: req.session.user, currentPage: req.path });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});

app.get('/products', isLoggedIn, nocache, async (req, res) => {
  try {
    const client = new MongoClient(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');
    const products = await productCollection.find().toArray();
    await client.close();
    res.render('products', { products, title: 'Products | Blessings Cafe', user: req.session.user, currentPage: req.path });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/toggle-availability/:id', async (req, res) => {
  const productId = req.params.id;
  
  // Safely convert to boolean in case it comes as a string
  const available = req.body.available === true || req.body.available === 'true';

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
      { $set: { available: available } }
    );

    await client.close();

    // Optional: Check if update actually modified the document
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
    ProductID,
    Name,
    size16,
    size22,
    Quantity,
    Ingredients,
    Category,
    Allergen,
    imagelink,
    available,
    IsEnabled,
    BasePrice 
  } = req.body;

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
    Quantity: parseInt(Quantity),
    Ingredients: ingredientsArray,
    Category,
    Allergen: Allergen || null,
    imagelink: imagelink || 'placeholder',
    available: available === 'true',
    IsEnabled: IsEnabled === 'true'
  };

if (Category.toLowerCase() === 'pastries' && !isNaN(parseFloat(BasePrice))) {
  productData.BasePrice = parseFloat(BasePrice);
}


  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');

    console.log('Submitted Form Data:', req.body); 

    await productCollection.insertOne(productData);
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
    Quantity,
    Ingredients,
    Allergen,
    available,
    IsEnabled
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
      Quantity: Quantity ? parseInt(Quantity) : 0,
      Allergen: Allergen || '',
      available: available === 'true',
      IsEnabled: IsEnabled === 'true',
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



app.post('/delete-product/:id', async (req, res) => {
  const productId = req.params.id;

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe'); 
    const result = await db.collection('Menu').deleteOne({ _id: new ObjectId(productId) });

    await client.close(); // ✅ clean up

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
  res.render('add-product', { title: 'Add Product | Blessings Cafe' , user: req.session.user, currentPage: req.path});
});

app.get('/edit-product/:id', isLoggedIn, nocache, async (req, res) => {
  const { id } = req.params;
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const product = await db.collection('Menu').findOne({ _id: new ObjectId(id) });
    await client.close();

    if (!product) return res.status(404).send('Product not found');

    res.render('edit-product', { title: 'Edit Product | Blessings Cafe', product, user: req.session.user, currentPage: req.path});
  } catch (err) {
    console.error('Error fetching product for editing:', err);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/stocks', isLoggedIn, nocache, async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ingredients = await db.collection('Ingredients').find().toArray();
    await client.close();
    res.render('stocks', { ingredients, title: 'Stocks | Blessings Cafe', user: req.session.user, currentPage: req.path});
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
    res.redirect('/stocks');
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
    res.redirect('/stocks');
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
    res.redirect('/stocks');
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
    const orders = await ordersCollection.find().toArray();
    await client.close();
    res.render('order', { orders, title: 'Orders | Blessings Cafe', user: req.session.user, currentPage: req.path});
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).send('Internal Server Error');
  }
});




app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/account/login');
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
