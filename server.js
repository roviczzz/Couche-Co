const express = require('express');
const session = require('express-session');
const { MongoClient } = require('mongodb');
const expressLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');
const favicon = require('serve-favicon');
const compression = require('compression');
const path = require('path');
const cron = require('node-cron');

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
const inventoryRoutes = require('./routes/inventory');
const inventoryAdminRoutes = require('./routes/inventory-admin');
const notificationRoutes = require('./routes/notifications');

// Import promo manager for automated deactivation
const { initializePromoDeactivationCron } = require('./utils/promoManager');
const { generatePeriodicNotifications } = require('./admin-helpers');

// Enable gzip compression for all responses
app.use(compression({
  level: 6, // Good balance between speed and compression
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression filter function
    return compression.filter(req, res);
  }
}));

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

// Middleware to make request path available to templates
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

// Middleware to load user settings for all authenticated users
app.use(async (req, res, next) => {
  if (req.session.user) {
    try {
      const client = await MongoClient.connect(uri);
      const db = client.db('blessingscafe');

      // Load user settings from UserSettings collection
      const userSettings = await db.collection('UserSettings').findOne({
        userId: req.session.user._id
      });

      // Set default settings if none exist
      res.locals.settings = userSettings || {
        darkMode: false,
        soundEnabled: true,
        printReceipts: false,
        orderConfirmations: true,
        lowStockAlertRange: 5
      };

      await client.close();
    } catch (error) {
      console.error('Error loading user settings:', error);
      res.locals.settings = {
        darkMode: false,
        soundEnabled: true,
        printReceipts: false,
        orderConfirmations: true,
        lowStockAlertRange: 5
      };
    }
  }
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

// Middleware to set layout based on user role
app.use((req, res, next) => {
  if (req.session.user && req.session.user.role === 'user') {
    res.locals.layout = 'user/layout';
  }
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
app.use('/api', apiRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/admin/inventory', inventoryAdminRoutes);
app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/admin', adminRoutes);
app.use('/staff', staffRoutes);
app.use('/', notificationRoutes);

// Legacy route compatibility
app.use('/account', authRoutes);

app.use('/uploads', express.static('uploads'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (err && err.stack) {
    console.error('Stack Trace:', err.stack);
  }
  res.status(500).render('error', {
    title: 'Server Error',
    message: err && err.message ? err.message : 'An unexpected error occurred. Please try again later.',
    status: 500,
    user: req.session?.user || null
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.',
    status: 404,
    user: req.session?.user || null
  });
});

// Initialize automated promo deactivation cron job
initializePromoDeactivationCron();

// Initialize periodic notifications using node-cron
function initializeNotificationsCron() {
  try {
    // Run immediately on startup
    generatePeriodicNotifications().catch(error => {
      console.error('Error generating initial notifications:', error);
    });
    
    // Schedule periodic notifications - every 30 minutes for general checks
    cron.schedule('*/30 * * * *', async () => {
      try {
        console.log('🔔 Running periodic notification check...');
        const notifications = await generatePeriodicNotifications();
        console.log(`✅ Generated ${notifications.length} new notifications`);
      } catch (error) {
        console.error('❌ Error in periodic notifications cron:', error);
      }
    });
    
    // Enhanced hourly promo tracking - every hour at minute 0
    cron.schedule('0 * * * *', async () => {
      try {
        console.log('🔔 Running hourly comprehensive promo tracking...');
        const notifications = await generatePeriodicNotifications();
        console.log(`✅ Hourly promo tracking: Generated ${notifications.length} new notifications`);
      } catch (error) {
        console.error('❌ Error in hourly promo tracking cron:', error);
      }
    });
    
    // Critical promo monitoring - every 6 hours for urgent expiry checks
    cron.schedule('0 */6 * * *', async () => {
      try {
        console.log('🚨 Running critical promo expiry check...');
        const notifications = await generatePeriodicNotifications();
        console.log(`✅ Critical check: Generated ${notifications.length} new notifications`);
      } catch (error) {
        console.error('❌ Error in critical promo check:', error);
      }
    });
    
    console.log('📅 Enhanced promo tracking cron jobs initialized:');
    console.log('   • Every 30 minutes: General notifications');
    console.log('   • Every hour: Comprehensive promo tracking');
    console.log('   • Every 6 hours: Critical promo expiry checks');
  } catch (error) {
    console.error('Failed to initialize notifications cron job:', error);
  }
}

initializeNotificationsCron();

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

module.exports = app;
