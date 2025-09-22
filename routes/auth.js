const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const SALT_ROUNDS = 12;

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
    return res.redirect(req.session.user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard');
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

    try {
      const client = new MongoClient(uri);
      await client.connect();
      const db = client.db('blessingscafe');
      
      const user = await db.collection('Users').findOne({ email: req.body.email });
      
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

      // Set user session
      req.session.user = {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role || 'user'
      };

      // Redirect based on role
      const redirectPath = user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard';
      res.redirect(redirectPath);
      
      await client.close();
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).render('login', {
        title: 'Login | Blessings Cafe',
        layout: false,
        errors: {},
        error: 'An error occurred during login',
        formData: req.body
      });
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

// Account login route (for legacy compatibility)
router.get('/account/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
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

    try {
      const client = new MongoClient(uri);
      await client.connect();
      const db = client.db('blessingscafe');
      const users = db.collection('users');

      const user = await users.findOne({
        username: req.body.Username
      });

      if (!user) {
        await client.close();
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

      await client.close();

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

      req.session.user = {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role || 'admin',
        loginTime: new Date().toISOString()
      };

      console.log(`✅ Login successful for user: ${user.username} (ID: ${user._id}) at ${new Date().toISOString()}`);
      res.redirect('/dashboard');
    } catch (err) {
      console.error('❌ Login error:', err);
      res.status(500).send('Internal Server Error');
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

// Forgot password form submission
router.post('/forgot-password', async (req, res) => {
  const { username, secretCode, newPassword } = req.body;

  if (!username || !secretCode || !newPassword) {
    return res.status(400).send('Username, secret code, and new password are required');
  }

  let client;
  try {
    client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ username: username, secretCode: secretCode });
    if (!user) {
      await client.close();
      return res.status(404).send('User not found or invalid secret code');
    }

    await usersCollection.updateOne(
        { username: username, secretCode: secretCode },
        { $set: { password: newPassword } }
    );

    await client.close();
    res.send('Password updated successfully. You can now log in.');
  } catch (error) {
    if (client) await client.close();
    console.error('Error updating password:', error);
    res.status(500).send('Server error');
  }
});

// Admin login page
router.get('/admin/login', (req, res) => {
  console.log('Admin login page requested');
  if (req.session.user) {
    return res.redirect('/admin/dashboard');
  }

  try {
    res.render('admin/login', {
      title: 'Admin Login | Blessings Cafe',
      layout: false,
      formData: {},
      errors: {},
      error: null
    });
  } catch (error) {
    console.error('Error rendering admin login page:', error);
    res.status(500).send('Error loading admin login page');
  }
});

// Admin login form submission
router.post('/admin/login', async (req, res) => {
  const { Username, Password } = req.body;
  const errors = {};
  let formData = { Username };

  if (!Username) errors.Username = { msg: 'Username is required' };
  if (!Password) errors.Password = { msg: 'Password is required' };

  if (Object.keys(errors).length > 0) {
    return res.render('admin/login', {
      title: 'Admin Login | Blessings Cafe',
      layout: false,
      formData,
      errors,
      error: null
    });
  }

  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('blessingscafe');
    const user = await db.collection('users').findOne({ username: Username, role: 'admin' });
    await client.close();

    if (!user) {
      return res.render('admin/login', {
        title: 'Admin Login | Blessings Cafe',
        layout: false,
        formData,
        errors: {},
        error: 'Invalid username or password.'
      });
    }

    const isMatch = await bcrypt.compare(Password, user.password);
    if (!isMatch) {
      return res.render('admin/login', {
        title: 'Admin Login | Blessings Cafe',
        layout: false,
        formData,
        errors: {},
        error: 'Invalid username or password.'
      });
    }

    req.session.user = {
      _id: user._id,
      username: user.username,
      role: user.role,
      name: user.name
    };
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).render('admin/login', {
      title: 'Admin Login | Blessings Cafe',
      layout: false,
      formData,
      errors: {},
      error: 'An error occurred. Please try again.'
    });
  }
});

module.exports = router;
