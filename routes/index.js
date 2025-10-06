const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

// Helper functions
function isLoggedIn(req, res, next) {
  if (req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
}

function nocache(req, res, next) {
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  next();
}

// Home page
router.get('/', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const menuCollection = db.collection('Menu');

    // Get all menu items for gallery display
    const featuredItems = await menuCollection.find().toArray();

    await client.close();

    if (req.session.user) {
      if (req.session.user.role === 'admin') {
        return res.redirect('/admin/dashboard');
      }
      return res.render('home', {
        title: 'Home | Blessings Cafe',
        user: req.session.user,
        featuredItems: featuredItems,
        layout: 'layout'
      });
    }
    return res.render('home', {
      title: 'Home | Blessings Cafe',
      user: null,
      featuredItems: featuredItems,
      layout: 'layout'
    });
  } catch (err) {
    console.error('Home page error:', err);
    res.render('home', {
      title: 'Home | Blessings Cafe',
      user: null,
      featuredItems: [],
      layout: 'layout'
    });
  }
});

// About page
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'About Us | Blessings Cafe',
    user: req.session?.user || null,
    layout: 'layout'
  });
});

// Contact page
router.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Contact Us | Blessings Cafe',
    user: req.session?.user || null,
    layout: 'layout'
  });
});

// Legacy login route redirect
router.get('/login', (req, res) => {
  res.redirect('/auth/login');
});

// Dashboard route
router.get('/dashboard', isLoggedIn, nocache, (req, res) => {
  if (req.session.user && req.session.user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  }
  res.render('home', { title: 'Dashboard | Blessings Cafe', user: req.session.user, layout: false });
});

// Menu route (public for guests)
router.get('/menu', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const menuCollection = db.collection('Menu');
    const menuItems = await menuCollection.find().toArray();
    await client.close();
    res.render('menu', {
      menuItems,
      title: 'Menu | Blessings Cafe',
      user: req.session?.user || null,
      layout: 'layout'
    });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});

// Products route
router.get('/products', isLoggedIn, nocache, async (req, res) => {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('blessingscafe');
    const products = await db.collection('Menu').find().toArray();

    res.render('products', {
      title: 'Products | Blessings Cafe',
      user: req.session.user,
      products
    });
    
    await client.close();
  } catch (error) {
    console.error('Products error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load products',
      status: 500
    });
  }
});

module.exports = router;
