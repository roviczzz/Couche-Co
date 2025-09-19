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
router.get('/', (req, res) => {
  if (!req.session.user) {
    return res.render('default/home', { title: 'Home | Blessings Cafe', layout: false });
  }
  if (req.session.user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  }
  res.render('user/home', { title: 'Home | Blessings Cafe', user: req.session.user, layout: false });
});

// About page
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'About Us | Blessings Cafe',
    user: req.session?.user || null
  });
});

// Contact page
router.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Contact Us | Blessings Cafe',
    user: req.session?.user || null
  });
});

// Dashboard route
router.get('/dashboard', isLoggedIn, nocache, (req, res) => {
  if (req.session.user && req.session.user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  }
  res.render('user/home', { title: 'Dashboard | Blessings Cafe', user: req.session.user, layout: false });
});

// Menu route
router.get('/menu', isLoggedIn, nocache, async (req, res) => {
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

// API Routes
router.get('/api/addons', async (req, res) => {
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

router.get('/api/orders/preparing-customers', async (req, res) => {
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
const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY || 'xnd_development_9YDHJULGUWulhmoYgQxildVQ3EWsAeviiJHwF3PSi9zmNcCKll8zEP3thAc5VvD9'
const XENDIT_API_URL = 'https://api.xendit.co'

router.post('/api/xendit/create-payment', async (req, res) => {
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

router.get('/api/xendit/check-payment/:paymentId', async (req, res) => {
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

router.post('/api/xendit/webhook', express.raw({type: 'application/json'}), (req, res) => {
  try {
    const payload = JSON.parse(req.body)

    console.log('Xendit webhook received:', payload)

    if (payload.status === 'PAID') {
      console.log(`Payment completed for invoice: ${payload.external_id}`)
    }

    res.status(200).send('OK')
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(400).send('Bad Request')
  }
})

module.exports = router;
