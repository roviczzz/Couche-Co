const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

// Authentication middleware for staff routes
function isStaffLoggedIn(req, res, next) {
  if (req.session.user && req.session.user.role === 'staff') {
    return next();
  }
  res.redirect('/admin/login');
}

// Apply authentication middleware to all protected routes
router.use(isStaffLoggedIn);

router.use((req, res, next) => {
  res.locals.sidebarItems = [
    { path: '/staff/dashboard', label: 'Dashboard', icon: 'house' },
    { path: '/staff/menu', label: 'POS Menu', icon: 'list' },
    { path: '/staff/order', label: 'Orders', icon: 'box' },
    { path: '/staff/calculator', label: 'Calculator', icon: 'calculator' },
    { path: '/staff/settings', label: 'Settings', icon: 'gear' },
    { path: '/logout', label: 'Logout', icon: 'door-open' }
  ];
  res.locals.currentPage = req.path;
  next();
});

async function getMenu() {
  const client = await MongoClient.connect(uri);
  const db = client.db('blessingscafe');
  const menu = await db.collection('Menu').find().toArray();
  await client.close();
  return menu;
}

async function getDashboardStats() {
  const client = await MongoClient.connect(uri);
  const db = client.db('blessingscafe');
  const ordersCount = await db.collection('Orders').countDocuments();
  const usersCount = await db.collection('users').countDocuments();
  const menuCount = await db.collection('Menu').countDocuments();
  await client.close();
  return { ordersCount, usersCount, menuCount };
}

router.get('/dashboard', async (req, res) => {
  try {
    // Fetch current user data from database to ensure fullname is up to date
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const currentUser = await db.collection('users').findOne({ _id: new ObjectId(req.session.user._id) });
    await client.close();

    // Merge session data with fresh database data
    const userData = {
      ...req.session.user,
      fullname: currentUser?.fullname
    };

    const stats = await getDashboardStats();
    res.render('staff/dashboard', {
      title: 'Staff Dashboard',
      layout: 'staff/layout',
      user: userData,
      ...stats
    });
  } catch (error) {
    console.error('Staff Dashboard error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load dashboard',
      status: 500
    });
  }
});

router.get('/pos', async (req, res) => {
  res.redirect('/staff/menu');
});

router.get('/menu', async (req, res) => {
  try {
    const menu = await getMenu();
    res.render('staff/menu', {
      title: 'POS Menu',
      layout: 'staff/layout',
      menuItems: menu
    });
  } catch (error) {
    console.error('Staff Menu error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load menu',
      status: 500
    });
  }
});

router.get('/order', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');
    const menuCollection = db.collection('Menu');
    const orders = await ordersCollection.find().toArray();
    const menu = await menuCollection.find().toArray();
    await client.close();
    res.render('staff/order', {
      title: 'Orders',
      layout: 'staff/layout',
      orders,
      menu
    });
  } catch (error) {
    console.error('Staff Orders error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load orders',
      status: 500
    });
  }
});

router.get('/calculator', (req, res) => {
  res.render('staff/calculator', {
    title: 'Calculator',
    layout: 'staff/layout'
  });
});

router.get('/settings', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.session.user._id) });
    await client.close();

    res.render('staff/settings', {
      title: 'Settings',
      layout: 'staff/layout',
      user: user
    });
  } catch (error) {
    console.error('Staff Settings error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load settings',
      status: 500
    });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const { displayName, email, phone } = req.body;

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    await db.collection('users').updateOne(
      { _id: new ObjectId(req.session.user._id) },
      { $set: { displayName, email, phone } }
    );

    await client.close();

    res.redirect('/staff/settings');
  } catch (error) {
    console.error('Staff Settings update error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to update settings',
      status: 500
    });
  }
});

// Order management endpoints
router.patch('/orders/:orderId/fulfillment', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { FulfillmentStatus } = req.body;
    
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');
    
    const result = await ordersCollection.updateOne(
      { OrderID: orderId },
      { $set: { FulfillmentStatus, fulfillmentStatus: FulfillmentStatus } }
    );
    
    await client.close();
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({ success: true, message: 'Fulfillment status updated successfully' });
  } catch (error) {
    console.error('Error updating fulfillment status:', error);
    res.status(500).json({ error: 'Failed to update fulfillment status' });
  }
});

router.patch('/orders/:orderId/payment-status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { PaymentStatus } = req.body;
    
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');
    
    const result = await ordersCollection.updateOne(
      { OrderID: orderId },
      { $set: { PaymentStatus, paymentStatus: PaymentStatus } }
    );
    
    await client.close();
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({ success: true, message: 'Payment status updated successfully' });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

router.patch('/orders/:orderId/cancel', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');
    
    const result = await ordersCollection.updateOne(
      { OrderID: orderId },
      { 
        $set: { 
          PaymentStatus: 'Cancelled',
          paymentStatus: 'Cancelled',
          FulfillmentStatus: 'Cancelled',
          fulfillmentStatus: 'Cancelled'
        } 
      }
    );
    
    await client.close();
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

router.patch('/orders/:orderId/restore', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { PaymentStatus, FulfillmentStatus } = req.body;
    
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');
    
    const result = await ordersCollection.updateOne(
      { OrderID: orderId },
      { 
        $set: { 
          PaymentStatus,
          paymentStatus: PaymentStatus,
          FulfillmentStatus,
          fulfillmentStatus: FulfillmentStatus
        } 
      }
    );
    
    await client.close();
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({ success: true, message: 'Order restored successfully' });
  } catch (error) {
    console.error('Error restoring order:', error);
    res.status(500).json({ error: 'Failed to restore order' });
  }
});

module.exports = router;
