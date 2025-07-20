const express = require('express');
const session = require('express-session');
const { MongoClient } = require('mongodb');
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



app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/account/login');
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
