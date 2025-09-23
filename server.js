const express = require('express');
const session = require('express-session');
const { MongoClient } = require('mongodb');
const expressLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');
const favicon = require('serve-favicon');
const path = require('path');

const app = express();
const port = 8080;
require('dotenv').config();
const uri = process.env.MONGODB_URI;

// Import route modules
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const staffRoutes = require('./routes/staff');

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))
app.use(session({
  secret: '4eaf42844a1772cb12e90869666b3a929f785d5bbd6d0fc5402c95ebc8721c3bca4ac502cc2fa7ec8abcbec042202876',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}))
app.use(flash())
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

app.use((req, res, next) => {
  res.locals.sidebarItems = [
    { path: '/dashboard', label: 'Home', icon: 'house' },
    { path: '/order', label: 'Orders', icon: 'box' },
    { path: '/menu', label: 'POS Menu', icon: 'list' },
    { path: '/stocks', label: 'Stocks', icon: 'warehouse' },
    { path: '/products', label: 'Products', icon: 'cart-shopping' },
    { path: '/logout', label: 'Logout', icon: 'door-open' }
  ];
  res.locals.currentPage = req.path;
  next();
});

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(__dirname + '/public'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Use route modules
app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);
app.use('/staff', staffRoutes);

// Legacy route compatibility
app.use('/account', authRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (err && err.stack) {
    console.error('Stack Trace:', err.stack);
  }
  res.status(500).render('error', {
    title: 'Server Error',
    message: err && err.message ? err.message : 'An unexpected error occurred. Please try again later.',
    status: 500
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.',
    status: 404
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

module.exports = app;
