const express = require('express');
const session = require('express-session');
const { MongoClient, ObjectId } = require('mongodb');
const { check, validationResult } = require('express-validator');
const expressLayouts = require('express-ejs-layouts');
const app = express();
const port = 8080;
const uri = 'mongodb+srv://CoucheAdmin:couchemongo2025!@bsit.dhojcct.mongodb.net/';

app.use(
  session({
    secret: '4eaf42844a1772cb12e90869666b3a929f785d5bbd6d0fc5402c95ebc8721c3bca4ac502cc2fa7ec8abcbec042202876',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
  })
);

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

app.get('/', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const collection = db.collection('users');
    const data = await collection.find({}).toArray();
    await client.close();
    res.render('login', { data, title: 'Login', errors: {}, formData: {}, error: null, layout: false });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});

app.get('/account/login', (req, res) => {
  res.render('login', { title: 'Login', errors: {}, error: null, formData: {}, layout: false });
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
        title: 'Login',
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
          title: 'Login',
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
      res.redirect('/admin/dashboard');
    } catch (err) {
      res.status(500).send('Internal Server Error');
    }
  }
);

app.get('/account/register', (req, res) => {
  res.render('register', { errors: {}, formData: {}, error: null, layout: false });
});

app.get('/admin/dashboard', isLoggedIn, (req, res) => {
  res.render('dashboard', { title: 'Admin Dashboard', user: req.session.user });
});

app.get('/menu', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const menuCollection = db.collection('Menu');
    const menuItems = await menuCollection.find().toArray();
    await client.close();
    res.render('menu', { menuItems });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});

app.get('/products', async (req, res) => {
  try {
    const client = new MongoClient(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');
    const products = await productCollection.find().toArray();
    await client.close();
    res.render('products', { title: 'Products', products });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/toggle-availability/:id', async (req, res) => {
  const productId = req.params.id;
  const available = req.body.available;

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    await db.collection('Menu').updateOne(
      { _id: new ObjectId(productId) },
      { $set: { available: available } }
    );
    await client.close();
    res.json({ success: true });
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
    BasePrice // <-- ✅ Include this
  } = req.body;

  // Build Sizes array if sizes are provided
  const Sizes = [];
  if (size16) Sizes.push({ Size: '16oz', BasePrice: parseFloat(size16) });
  if (size22) Sizes.push({ Size: '22oz', BasePrice: parseFloat(size22) });

  // Parse ingredients into array
  const ingredientsArray = Ingredients
    ? Ingredients.split(',').map(i => i.trim())
    : [];

  // Build the product object to insert
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

  // ✅ Only include BasePrice if the category is "Pastries" and a value is provided
if (Category.toLowerCase() === 'pastries' && !isNaN(parseFloat(BasePrice))) {
  productData.BasePrice = parseFloat(BasePrice);
}


  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');

    console.log('Submitted Form Data:', req.body); // optional debug

    await productCollection.insertOne(productData);
    await client.close();
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
    const db = client.db('blessingscafe'); // ✅ this is your correct DB
    const result = await db.collection('Menu').deleteOne({ _id: new ObjectId(productId) });

    await client.close(); // ✅ clean up

    if (result.deletedCount === 1) {
      res.redirect('/products');
    } else {
      res.status(404).send('Product not found');
    }
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/add-product', isLoggedIn, (req, res) => {
  res.render('add-product', { title: 'Add Product' });
});

app.get('/edit-product/:id', isLoggedIn, async (req, res) => {
  const { id } = req.params;
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const product = await db.collection('Menu').findOne({ _id: new ObjectId(id) });
    await client.close();

    if (!product) return res.status(404).send('Product not found');

    res.render('edit-product', { title: 'Edit Product', product });
  } catch (err) {
    console.error('Error fetching product for editing:', err);
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
