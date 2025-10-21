const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const SALT_ROUNDS = 12;

// Generate staff ID based on role and user ID
function generateStaffId(role, userId) {
  const rolePrefix = {
    'admin': 'ADM',
    'owner': 'OWN',
    'staff': 'BC',
    'user': 'USR'
  };

  const prefix = rolePrefix[role] || 'USR';

  // Generate a 5-digit number based on ObjectId hash for all roles
  const hash = userId.toString().split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  const idNumber = Math.abs(hash % 100000).toString().padStart(5, '0');
  return `${prefix}${idNumber}`;
}

function isLoggedIn(req, res, next) {
  if (req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
}

// Login page
router.get('/login', (req, res) => {
  console.log('Login page requested');
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'admin' ? '/admin/dashboard' : '/');
  }

  try {
    res.render('login', {
      title: 'Login | Blessings Cafe',
      layout: false,
      errors: {},
      error: null,
      formData: {}
    });
  } catch (error) {
    console.error('Error rendering login page:', error);
    res.status(500).send('Error loading login page');
  }
});

// Login form submission
router.post('/login',
  [
    check('email').isEmail().withMessage('Please enter a valid email address'),
    check('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('login', {
        title: 'Login | Blessings Cafe',
        layout: false,
        errors: errors.mapped(),
        error: 'Please fix the errors below',
        formData: req.body
      });
    }

    let client;
    try {
      client = new MongoClient(uri);
      await client.connect();
      const db = client.db('blessingscafe');

      const user = await db.collection('users').findOne({ email: req.body.email });

      if (!user) {
        return res.render('login', {
          title: 'Login | Blessings Cafe',
          layout: false,
          errors: {},
          error: 'Invalid email or password',
          formData: req.body
        });
      }

      const validPassword = await bcrypt.compare(req.body.password, user.password);
      if (!validPassword) {
        return res.render('login', {
          title: 'Login | Blessings Cafe',
          layout: false,
          errors: {},
          error: 'Invalid email or password',
          formData: req.body
        });
      }

      // Update last login time in database
      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { lastLogin: new Date() } }
      );

      // Set user session
      req.session.user = {
        _id: user._id,
        email: user.email,
        name: user.fullname || user.name,
        fullname: user.fullname,
        role: user.role || 'user',
        staffId: user.staffId || generateStaffId(user.role, user._id),
        username: user.username
      };

      // Redirect based on role
      const redirectPath = user.role === 'admin' ? '/admin/dashboard' : '/';
      res.redirect(redirectPath);

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).render('login', {
        title: 'Login | Blessings Cafe',
        layout: false,
        errors: {},
        error: 'An error occurred during login',
        formData: req.body
      });
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
);

// Logout route
router.get('/logout', (req, res) => {
  const username = req.session.user?.username;
  console.log(`🚪 User logout: ${username} at ${new Date().toISOString()}`);

  req.session.destroy((err) => {
    if (err) {
      console.error('❌ Session destruction error:', err);
      return res.status(500).send('Error during logout');
    }
    console.log(`✅ Session destroyed successfully for user: ${username}`);
    res.redirect('/');
  });
});

// Register page
router.get('/register', (req, res) => {
  res.render('register', {
    errors: {},
    formData: {},
    error: null,
    layout: false
  });
});

// Register form submission
router.post('/register',
  [
    check('firstName').notEmpty().withMessage('First name is required'),
    check('lastName').notEmpty().withMessage('Last name is required'),
    check('contactNumber').matches(/^09[0-9]{9}$/).withMessage('Invalid Philippine mobile number'),
    check('addressLine').notEmpty().withMessage('Address line is required'),
    check('city').isIn(['Imus, Cavite', 'Kawit, Cavite']).withMessage('Invalid city'),
    check('email').isEmail().withMessage('Invalid email address'),
    check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    check('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('register', {
        title: 'Sign Up | Blessings Cafe',
        layout: false,
        errors: errors.mapped(),
        error: 'Please fix the errors below',
        formData: req.body
      });
    }

    let client;
    try {
      client = new MongoClient(uri);
      await client.connect();
      const db = client.db('blessingscafe');

      // Check if email already exists
      const existingUser = await db.collection('users').findOne({ email: req.body.email });
      if (existingUser) {
        return res.render('register', {
          title: 'Sign Up | Blessings Cafe',
          layout: false,
          errors: {},
          error: 'Email already registered',
          formData: req.body
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(req.body.password, SALT_ROUNDS);

      // Create user object with merged fields
      const fullname = req.body.firstName + ' ' + req.body.lastName;
      const address = req.body.addressLine + ', ' + req.body.city;

      const newUser = {
        email: req.body.email,
        fullname: fullname,
        phone: req.body.contactNumber,
        address: address,
        password: hashedPassword,
        role: 'user',
        createdAt: new Date()
      };

      // Insert user
      await db.collection('users').insertOne(newUser);

      // Show success message before redirecting
      res.render('register', {
        success: true,
        error: null,
        errors: {},
        formData: {},
        layout: false
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.render('register', {
        title: 'Sign Up | Blessings Cafe',
        layout: false,
        errors: {},
        error: 'Registration failed. Please try again.',
        formData: req.body
      });
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
);

// Account login route (for legacy compatibility)
router.get('/account/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'admin' ? '/admin/dashboard' : '/');
  }
  res.render('login', {
    title: 'Login | Blessings Cafe',
    layout: false,
    errors: {},
    error: null,
    formData: {}
  });
});

// Account login form submission
router.post('/account/login',
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

    const SALT_ROUNDS = 12;
    console.log(`📅 Login attempt at ${new Date().toISOString()} for user: ${req.body.Username}`);

    let client;
    try {
      client = new MongoClient(uri);
      await client.connect();
      const db = client.db('blessingscafe');
      const users = db.collection('users');

      const user = await users.findOne({
        username: req.body.Username
      });

      if (!user) {
        console.log(`❌ Login failed for user: ${req.body.Username} - User not found`);
        return res.render('login', {
          title: 'Login | Blessings Cafe',
          errors: {},
          error: 'Invalid username or password',
          formData: { Username: req.body.Username },
          layout: false
        });
      }

      let passwordMatch = false;

      if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
        passwordMatch = await bcrypt.compare(req.body.Password, user.password);
        console.log('🔐 Using bcrypt verification for hashed password');
      } else {
        if (req.body.Password === user.password) {
          passwordMatch = true;
          console.log('⚠️ Plain text password detected - upgrading to bcrypt');

          const hashedPassword = await bcrypt.hash(req.body.Password, SALT_ROUNDS);
          await users.updateOne(
            { _id: user._id },
            {
              $set: {
                password: hashedPassword,
                passwordUpgraded: new Date(),
                upgradedBy: 'auto-login'
              }
            }
          );
          console.log('✅ Password upgraded to bcrypt hash');
        }
      }

      if (!passwordMatch) {
        console.log(`❌ Login failed for user: ${req.body.Username} - Invalid password`);
        return res.render('login', {
          title: 'Login | Blessings Cafe',
          errors: {},
          error: 'Invalid username or password',
          formData: { Username: req.body.Username },
          layout: false
        });
      }

      // Update last login time in database
      await users.updateOne(
        { _id: user._id },
        { $set: { lastLogin: new Date() } }
      );

      req.session.user = {
        _id: user._id,
        username: user.username,
        email: user.email,
        name: user.fullname || user.name,
        fullname: user.fullname,
        role: user.role || 'admin',
        staffId: user.staffId || generateStaffId(user.role, user._id),
        loginTime: new Date().toISOString()
      };

      console.log(`✅ Login successful for user: ${user.username} (ID: ${user._id}) at ${new Date().toISOString()}`);

      // Redirect based on role
      const redirectPath = user.role === 'admin' ? '/admin/dashboard' : '/';
      res.redirect(redirectPath);
    } catch (err) {
      console.error('❌ Login error:', err);
      res.status(500).send('Internal Server Error');
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
);

// Account register route
router.get('/account/register', (req, res) => {
  res.render('register', {
    errors: {},
    formData: {},
    error: null,
    layout: false
  });
});

// Forgot password page
router.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { layout: false });
});

// Forgot password form submission (email based)
router.post('/forgot-password',
  [
    check('email').isEmail().withMessage('Invalid email address')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('forgot-password', {
        layout: false,
        errors: errors.mapped(),
        error: 'Invalid email',
        formData: req.body
      });
    }

    let client;
    try {
      client = new MongoClient(uri);
      await client.connect();
      const db = client.db('blessingscafe');

      const user = await db.collection('users').findOne({ email: req.body.email });
      if (!user) {
        return res.render('forgot-password', {
          layout: false,
          errors: {},
          error: 'Email not registered',
          formData: req.body
        });
      }

      // Here you would send reset email, but for now just show success
      res.render('forgot-password', {
        success: 'Password reset email sent. Please check your inbox.',
        layout: false,
        errors: {},
        error: null,
        formData: req.body
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.render('forgot-password', {
        layout: false,
        errors: {},
        error: 'Server error. Please try again.',
        formData: req.body
      });
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
);

// Unified login route for both admin and staff
router.post('/unified/login',
  [
    check('Username').notEmpty().withMessage('Username is required'),
    check('Password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorsObj = {};
      errors.array().forEach(err => {
        errorsObj[err.param] = err;
      });
      return res.render('admin/login', {
        title: 'Staff & Admin Login',
        layout: false,
        errors: errorsObj,
        error: 'Please fix the errors below',
        formData: req.body
      });
    }

    const { Username, Password } = req.body;
    console.log(`📅 Login attempt at ${new Date().toISOString()} for user: ${Username}`);

    let client;
    try {
      client = new MongoClient(uri);
      await client.connect();
      const db = client.db('blessingscafe');
      const users = db.collection('users');

      const user = await users.findOne({
        username: Username
      });

      if (!user) {
        console.log(`❌ Login failed for user: ${Username} - User not found`);
        return res.render('admin/login', {
          title: 'Staff & Admin Login',
          layout: false,
          errors: {},
          error: 'Invalid username or password',
          formData: { Username }
        });
      }

      let passwordMatch = false;

      if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
        passwordMatch = await bcrypt.compare(Password, user.password);
        console.log('🔐 Using bcrypt verification for hashed password');
      } else {
        if (Password === user.password) {
          passwordMatch = true;
          console.log('⚠️ Plain text password detected - upgrading to bcrypt');

          const hashedPassword = await bcrypt.hash(Password, SALT_ROUNDS);
          await users.updateOne(
            { _id: user._id },
            {
              $set: {
                password: hashedPassword,
                passwordUpgraded: new Date(),
                upgradedBy: 'auto-login'
              }
            }
          );
          console.log('✅ Password upgraded to bcrypt hash');
        }
      }

      if (!passwordMatch) {
        console.log(`❌ Login failed for user: ${Username} - Invalid password`);
        return res.render('admin/login', {
          title: 'Staff & Admin Login',
          layout: false,
          errors: {},
          error: 'Invalid username or password',
          formData: { Username }
        });
      }

      // Update last login time in database
      await users.updateOne(
        { _id: user._id },
        { $set: { lastLogin: new Date() } }
      );

      req.session.user = {
        _id: user._id,
        username: user.username,
        email: user.email,
        name: user.fullname || user.name,
        fullname: user.fullname,
        role: user.role || 'admin',
        staffId: user.staffId || generateStaffId(user.role, user._id),
        loginTime: new Date().toISOString()
      };

      console.log(`✅ Login successful for user: ${user.username} (ID: ${user._id}) at ${new Date().toISOString()}`);

      // Redirect based on role - staff goes to staff dashboard, admin and owner go to admin dashboard
      let redirectPath;
      if (user.role === 'staff') {
        redirectPath = '/staff/dashboard';
      } else if (user.role === 'admin' || user.role === 'owner') {
        redirectPath = '/admin/dashboard';
      } else {
        redirectPath = '/admin/dashboard'; // Default
      }

      res.redirect(redirectPath);

    } catch (err) {
      console.error('❌ Login error:', err);
      res.status(500).render('admin/login', {
        title: 'Staff & Admin Login',
        layout: false,
        errors: {},
        error: 'An error occurred during login',
        formData: { Username }
      });
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
);

// Update admin login GET route to use unified login
router.get('/admin/login', (req, res) => {
  if (req.session.user) {
    let redirectPath;
    if (req.session.user.role === 'staff') {
      redirectPath = '/staff/dashboard';
    } else if (req.session.user.role === 'admin' || req.session.user.role === 'owner') {
      redirectPath = '/admin/dashboard';
    } else {
      redirectPath = '/admin/dashboard'; // Default
    }
    return res.redirect(redirectPath);
  }
  res.render('admin/login', {
    title: 'Staff & Admin Login',
    layout: false,
    errors: {},
    error: null,
    formData: {}
  });
});

module.exports = router;
