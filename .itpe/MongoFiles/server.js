const express = require('express');
const { MongoClient } = require('mongodb');
const { check, validationResult } = require('express-validator');
const app = express();
const port = 8080;
const uri = 'mongodb+srv://CoucheAdmin:couchemongo2025!@bsit.dhojcct.mongodb.net/';

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.urlencoded({ extended: false }));
app.use(express.static(__dirname + '/public'));

app.get('/', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db();
    const collection = db.collection('users');
    const data = await collection.find({}).toArray();
    await client.close();
    res.render('myIndex', { data, title: 'Home', errors: {}, formData: {}, error: null });
  } catch (err) {
    console.error('Error fetching data from MongoDB:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/account/login', (req, res) => {
  res.render('login', { title: 'Login', errors: {}, error: null, formData: {} });
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
      });
    }
    try {
      const client = await MongoClient.connect(uri);
      const db = client.db();
      const users = db.collection('users');
      const user = await users.findOne({ username: req.body.Username, password: req.body.Password });
      await client.close();
      if (!user) {
        return res.render('login', {
          title: 'Login',
          errors: {},
          error: 'Invalid username or password',
          formData: { Username: req.body.Username },
        });
      }
      res.redirect('/');
    } catch (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    }
  }
);

app.get('/account/register', (req, res) => {
  res.render('register', { errors: {}, formData: {}, error: null });
});

app.post(
  '/account/register',
  [
    check('Username').notEmpty().withMessage('Username is required'),
    check('Email').isEmail().withMessage('Valid email is required'),
    check('Password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    check('ConfirmPassword')
      .custom((value, { req }) => value === req.body.Password)
      .withMessage('Passwords do not match'),
  ],
  async (req, res) => {
    const errorsResult = validationResult(req);
    const errorsObj = {};
    if (!errorsResult.isEmpty()) {
      errorsResult.array().forEach(err => {
        errorsObj[err.param] = err;
      });
      return res.render('register', { errors: errorsObj, formData: req.body, error: null });
    }
    try {
      const client = await MongoClient.connect(uri);
      const db = client.db();
      const users = db.collection('users');
      const existingUser = await users.findOne({ username: req.body.Username });
      if (existingUser) {
        await client.close();
        return res.render('register', {
          errors: {},
          formData: req.body,
          error: 'Username already taken',
        });
      }
      await users.insertOne({
        username: req.body.Username,
        email: req.body.Email,
        password: req.body.Password,
      });
      await client.close();
      res.redirect('/account/login');
    } catch (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    }
  }
);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
