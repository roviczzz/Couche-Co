const express = require('express');
const session = require('express-session');
const { MongoClient, ObjectId } = require('mongodb');
const { check, validationResult } = require('express-validator');
const expressLayouts = require('express-ejs-layouts');
const app = express();
const port = 8080;
require('dotenv').config();
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
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
    MT: "Milk Tea",
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
    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
        return res.status(400).send('Username and new password are required');
    }

    let client;
    try {
        client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');
        const usersCollection = db.collection('users');

        const user = await usersCollection.findOne({ username: username });
        if (!user) {
            await client.close();
            return res.status(404).send('User not found');
        }

        await usersCollection.updateOne(
            { username: username },
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

    const message = req.query.msg || null;
    res.render('stocks', {
      ingredients,
      title: 'Stocks | Blessings Cafe',
      user: req.session.user,
      currentPage: req.path,
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
      user: req.session.user, 
      currentPage: req.path
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
      user: req.session.user,
      currentPage: req.path
    });
  } catch (err) {
    console.error('Error in /orders/edit/:id:', err);
    res.status(500).send('Internal Server Error');
  }
});




app.get('/logout', (req, res) => {
  req.session.destroy(() => {
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
