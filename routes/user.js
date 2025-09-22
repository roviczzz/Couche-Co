const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');
const { check, validationResult } = require('express-validator');
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

// Middleware to ensure user is logged in
const isLoggedIn = (req, res, next) => {
  if (req.session?.user) {
    return next();
  }
  res.redirect('/login');
};

// Apply login check to all routes in this file
router.use(isLoggedIn);

// User dashboard route
router.get('/dashboard', async (req, res) => {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('blessingscafe');
    
    // Get user's recent orders
    const recentOrders = await db.collection('Orders')
      .find({ 'user._id': req.session.user._id })
      .sort({ date: -1 })
      .limit(5)
      .toArray();

    res.render('user/dashboard', {
      title: 'My Dashboard',
      user: req.session.user,
      recentOrders
    });
    
    await client.close();
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Error loading dashboard');
  }
});

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

// Add other user routes here...

module.exports = router;
