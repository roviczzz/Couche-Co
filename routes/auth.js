const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');


const SALT_ROUNDS = 12;

// Create nodemailer transporter with improved Gmail configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  },
  pool: false,
  connectionTimeout: 30000,
  greetingTimeout: 10000,
  socketTimeout: 30000,
  tls: {
    rejectUnauthorized: false
  },
  debug: true,
  logger: true
});

// Verify transporter configuration on startup
transporter.verify(function(error, success) {
  if (error) {
    console.log('❌ Gmail SMTP verification failed:', error);
  } else {
    console.log('✅ Gmail SMTP server is ready to send emails');
  }
});

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
  res.redirect('/login');
});

// Login form submission
router.post('/login', (req, res) => {
  res.redirect(307, '/login'); // 307 preserves POST method
});

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

    try {
      // Check if email already exists
      const existingUser = await req.db.collection('users').findOne({ email: req.body.email });
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
      await req.db.collection('users').insertOne(newUser);

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

    try {
      const users = req.db.collection('users');

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
  res.render('forgot-password', {
    layout: false,
    error: null,
    success: null,
    errors: {},
    formData: {}
  });
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

    try {
      const user = await req.db.collection('users').findOne({ email: req.body.email });
      if (!user) {
        return res.render('forgot-password', {
          layout: false,
          errors: {},
          error: 'Email not registered',
          formData: req.body
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

      // Store token in database
      await req.db.collection('users').updateOne(
        { _id: user._id },
        {
          $set: {
            resetToken: resetToken,
            resetTokenExpiry: resetTokenExpiry
          }
        }
      );

      // Send reset email with enhanced configuration
      const resetUrl = `${process.env.BASE_URL}/auth/reset-password?token=${resetToken}`;
      const mailOptions = {
        from: `"Blessings Cafe" <${process.env.GMAIL_USER}>`,
        to: user.email,
        subject: '🔐 Password Reset Request - Blessings Cafe',
        text: `Hello ${user.fullname || user.name || 'User'},\n\nYou requested a password reset for your Blessings Cafe account.\n\nClick this link to reset your password: ${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this reset, please ignore this email.\n\nBest regards,\nBlessings Cafe Team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #8B4513; margin: 0;">🍵 Blessings Cafe</h1>
            </div>
            <h2 style="color: #333; border-bottom: 2px solid #8B4513; padding-bottom: 10px;">Password Reset Request</h2>
            <p style="font-size: 16px; line-height: 1.5;">Hello <strong>${user.fullname || user.name || 'User'}</strong>,</p>
            <p style="font-size: 16px; line-height: 1.5;">You requested a password reset for your Blessings Cafe account.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #8B4513; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 16px;">🔐 Reset Your Password</a>
            </div>
            <p style="font-size: 14px; color: #666; border-left: 4px solid #ffcc00; padding-left: 10px; margin: 20px 0;">⏰ This link will expire in <strong>1 hour</strong></p>
            <p style="font-size: 14px; color: #666;">If you didn't request this reset, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">Best regards,<br>Blessings Cafe Team<br>${process.env.BASE_URL}</p>
          </div>
        `,
        priority: 'high',
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'high'
        }
      };

      // Add timeout wrapper for email sending
      const sendEmailWithTimeout = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Email sending timeout'));
        }, 15000); // 15 second timeout

        transporter.sendMail(mailOptions)
          .then(result => {
            clearTimeout(timeout);
            resolve(result);
          })
          .catch(error => {
            clearTimeout(timeout);
            reject(error);
          });
      });

      try {
        const emailResult = await sendEmailWithTimeout;
        console.log('✅ Password reset email sent successfully');
        console.log('📧 Email details:', {
          messageId: emailResult.messageId,
          from: process.env.GMAIL_USER,
          to: user.email,
          subject: mailOptions.subject,
          timestamp: new Date().toISOString()
        });
        
        res.render('forgot-password', {
          success: `Password reset email sent to ${user.email}. Please check your inbox and spam folder.`,
          layout: false,
          errors: {},
          error: null,
          formData: req.body
        });
      } catch (emailError) {
        console.error('❌ Email sending failed:', {
          error: emailError.message,
          code: emailError.code,
          command: emailError.command,
          to: user.email,
          timestamp: new Date().toISOString()
        });
        
        // Still create the reset token but show different message
        res.render('forgot-password', {
          success: 'Password reset request processed. If the email exists, you will receive instructions shortly. Please check your spam folder.',
          layout: false,
          errors: {},
          error: null,
          formData: req.body
        });
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      res.render('forgot-password', {
        layout: false,
        errors: {},
        error: 'Server error. Please try again.',
        formData: req.body
      });
    }
  }
);

// Reset password page
router.get('/reset-password', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.render('reset-password', {
      layout: false,
      error: 'Invalid reset token',
      token: null,
      errors: {},
      success: null
    });
  }

  try {
    const user = await req.db.collection('users').findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.render('reset-password', {
        layout: false,
        error: 'Invalid or expired reset token',
        token: null,
        errors: {},
        success: null
      });
    }

    res.render('reset-password', {
      layout: false,
      error: null,
      token: token,
      errors: {},
      success: null
    });
  } catch (error) {
    console.error('Reset password page error:', error);
    res.render('reset-password', {
      layout: false,
      error: 'Server error. Please try again.',
      token: null,
      errors: {},
      success: null
    });
  }
});

// Reset password form submission
router.post('/reset-password',
  [
    check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    check('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
    check('token').notEmpty().withMessage('Reset token is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('reset-password', {
        layout: false,
        errors: errors.mapped(),
        error: 'Please fix the errors below',
        token: req.body.token
      });
    }

    try {
      const user = await req.db.collection('users').findOne({
        resetToken: req.body.token,
        resetTokenExpiry: { $gt: new Date() }
      });

      if (!user) {
        return res.render('reset-password', {
          layout: false,
          errors: {},
          error: 'Invalid or expired reset token',
          token: req.body.token
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(req.body.password, SALT_ROUNDS);

      // Update password and clear reset token
      await req.db.collection('users').updateOne(
        { _id: user._id },
        {
          $set: {
            password: hashedPassword,
            passwordResetAt: new Date()
          },
          $unset: {
            resetToken: '',
            resetTokenExpiry: ''
          }
        }
      );

      res.render('reset-password', {
        success: 'Password reset successfully. You can now log in with your new password.',
        layout: false,
        errors: {},
        error: null,
        token: null
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.render('reset-password', {
        layout: false,
        errors: {},
        error: 'Server error. Please try again.',
        token: req.body.token
      });
    }
  }
);

// Unified login route for both admin and staff
router.post('/unified/login', (req, res) => {
  res.redirect(307, '/admin/login');
});

// Update admin login GET route to use unified login
router.get('/admin/login', (req, res) => {
  res.redirect('/admin/login');
});

module.exports = router;
