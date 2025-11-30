const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');
const favicon = require('serve-favicon');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cron = require('node-cron');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  const browserSync = require('browser-sync');
  const bs = browserSync.create();
  
  // Start Browsersync after Express server starts
  const startBrowsersync = () => {
    bs.init({
      proxy: `http://localhost:${port}`,
      files: [
        path.join(__dirname, 'views'),
        path.join(__dirname, 'public')
      ],
      open: false,
      notify: false,
      port: 3000
    });
  };
  // Attach to app.locals for later use in startServer
  app.locals.startBrowsersync = startBrowsersync;
}

if (process.env.NODE_ENV === 'production') {
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));
}


require('dotenv').config();

const dbConnection = require('./utils/db');

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
const webhooksRoutes = require('./routes/webhooks');
const feedbackRoutes = require('./routes/feedback');

// Import promo manager for automated deactivation
const { initializePromoDeactivationCron } = require('./utils/promoManager');
const { generatePeriodicNotifications } = require('./admin-helpers');

// Middleware to provide db to all routes
app.use((req, res, next) => {
  req.db = dbConnection.getDb();
  next();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await dbConnection.close();
  process.exit(0);
});

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

// Performance monitoring middleware
app.use((req, res, next) => {
  req.startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  
  next();
});

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.session?.user?.role === 'admin';
  }
});

app.use('/api', apiLimiter);

// Auth rate limiting (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true
});

app.use('/login', authLimiter);
app.use('/auth/register', authLimiter);

// Session configuration with better settings
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false, // Changed to false for better performance
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // Enable secure cookies in production
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true, // Prevent XSS attacks
    sameSite: 'lax' // CSRF protection
  }
}));

app.use(flash());
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

// User settings middleware with caching
app.use(async (req, res, next) => {
  if (req.session.user) {
    try {
      const userSettings = await req.db.collection('UserSettings').findOne(
        { userId: req.session.user._id },
        { 
          projection: {
            darkMode: 1,
            soundEnabled: 1,
            printReceipts: 1,
            orderConfirmations: 1,
            lowStockAlertRange: 1
          }
        }
      );

      res.locals.settings = userSettings || {
        darkMode: false,
        soundEnabled: true,
        printReceipts: false,
        orderConfirmations: true,
        lowStockAlertRange: 5
      };
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

// Static sidebar items (no need to recreate on every request)
const SIDEBAR_ITEMS = [
  { path: '/dashboard', label: 'Home', icon: 'house' },
  { path: '/order', label: 'Orders', icon: 'box' },
  { path: '/menu', label: 'POS Menu', icon: 'list' },
  { path: '/stocks', label: 'Stocks', icon: 'warehouse' },
  { path: '/products', label: 'Products', icon: 'cart-shopping' },
  { path: '/logout', label: 'Logout', icon: 'door-open' }
];

app.use((req, res, next) => {
  res.locals.sidebarItems = SIDEBAR_ITEMS;
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

// View engine setup
app.set('view engine', 'ejs');
app.set('view cache', true); // Good - already enabled
app.set('views', __dirname + '/views');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const uploadDir = path.join(__dirname, 'public/resources');
const upload = multer({ 
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});
app.use('/admin/api/page-management', upload.single('bannerImage'));

// Static files with caching
app.use(express.static(__dirname + '/public', {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

app.use(expressLayouts);
app.set('layout', 'layout');

// Use route modules
app.use('/api', apiRoutes);
app.use('/api', feedbackRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/admin/inventory', inventoryAdminRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/admin', adminRoutes);
app.use('/staff', staffRoutes);
app.use('/', notificationRoutes);

// Legacy route compatibility
app.use('/account', authRoutes);

app.use('/uploads', express.static('public/uploads', {
  maxAge: '7d', // Images can be cached longer
  etag: true
}));

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
async function initializeNotificationsCron() {
  try {
    const db = dbConnection.getDb();

    // Generate initial notifications
    await generatePeriodicNotifications(db).catch(error => {
      console.error('Error generating initial notifications:', error);
    });

    cron.schedule('*/30 * * * *', async () => {
      try {
        await generatePeriodicNotifications(db);
      } catch (error) {
        console.error('Error in periodic notifications cron:', error);
      }
    });

    cron.schedule('0 * * * *', async () => {
      try {
        await generatePeriodicNotifications(db);
      } catch (error) {
        console.error('Error in hourly promo tracking cron:', error);
      }
    });

    cron.schedule('0 */6 * * *', async () => {
      try {
        await generatePeriodicNotifications(db);
      } catch (error) {
        console.error('Error in critical promo check:', error);
      }
    });
  } catch (error) {
    console.error('Failed to initialize notifications cron job:', error);
  }
}

async function startServer() {
  try {
    await dbConnection.connect();
    app.locals.db = dbConnection.getDb();

// Helper function for image URLs
app.locals.getImageUrl = function(imagelink) {
  if (!imagelink) return '';
  if (imagelink.startsWith('https://blessingsateverysip.me/')) {
    return imagelink.replace('https://blessingsateverysip.me', '');
  }
  return imagelink;
};
    
    const { verifyEmailConnection } = require('./utils/emailService');
    const emailConnected = await verifyEmailConnection();
    if (!emailConnected) {
      console.warn('⚠️ Email service verification failed - emails may not be sent');
    }
    
    await initializeNotificationsCron();
    
    const server = app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
      if (process.env.NODE_ENV !== 'production' && app.locals.startBrowsersync) {
        app.locals.startBrowsersync();
        console.log('Browsersync running on http://localhost:3000');
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;