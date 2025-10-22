const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

// Import multer for file uploads (messages)
const multer = require('multer');
const path = require('path');

// Authentication middleware for staff routes
function isStaffLoggedIn(req, res, next) {
  if (req.session.user && req.session.user.role === 'staff') {
    return next();
  }
  res.redirect('/admin/login');
}

// POS Order Submission Route (for staff POS)
router.post('/orders/submit', isStaffLoggedIn, async (req, res) => {
  try {
    const orderData = req.body;

    // Basic validation
    if (!orderData.OrderID || !orderData.Cart || !Array.isArray(orderData.Cart) || orderData.Cart.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order data: missing OrderID or empty cart'
      });
    }

    if (!orderData.Customer || !orderData.Customer.fullname) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order data: missing customer name'
      });
    }

    if (!orderData.Total || orderData.Total <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order data: invalid total amount'
      });
    }

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    // Ensure order is from POS with proper Source
    const orderToInsert = {
      ...orderData,
      Source: 'POS', // Ensure Source is always 'POS' for POS submissions
      cashierName: req.session.user?.fullname || 'Unknown',
      insertedAt: new Date()
    };

    const result = await ordersCollection.insertOne(orderToInsert);

    if (result.acknowledged && result.insertedId) {
      // Log successful order submission
      console.log(`✅ Staff POS Order submitted successfully: ${orderData.OrderID} by ${req.session.user?.fullname}`);

      res.json({
        success: true,
        message: 'Order submitted successfully',
        orderId: orderData.OrderID,
        insertedId: result.insertedId
      });
    } else {
      throw new Error('Order insertion failed');
    }

    await client.close();
  } catch (error) {
    console.error('Staff POS Order submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit order. Please try again.',
      error: error.message
    });
  }
});

// Apply authentication middleware to all protected routes
router.use(isStaffLoggedIn);

router.use((req, res, next) => {
  res.locals.sidebarItems = [
    { path: '/staff/dashboard', label: 'Dashboard', icon: 'house' },
    { path: '/staff/menu', label: 'POS Menu', icon: 'list' },
    { path: '/staff/order', label: 'Orders', icon: 'box' },
    { path: '/staff/messages', label: 'Messages', icon: 'envelope' },
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
    // Fetch current user data from database to ensure fullname is up to date
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const currentUser = await db.collection('users').findOne({ _id: new ObjectId(req.session.user._id) });
    
    // Fetch menu items, addons, and ingredients
    const menu = await getMenu();
    const addons = await db.collection('Add-ons').find({ isEnabled: true }).toArray();
    const ingredients = await db.collection('Ingredients').find({ isEnabled: true }).toArray();
    
    await client.close();

    // Merge session data with fresh database data
    const userData = {
      ...req.session.user,
      fullname: currentUser?.fullname
    };

    res.render('staff/menu', {
      title: 'POS Menu',
      layout: 'staff/layout',
      user: userData,
      menuItems: menu,
      addons,
      ingredients
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

    // Load user settings from UserSettings collection
    let userSettings = await db.collection('UserSettings').findOne({ userId: req.session.user._id });
    if (!userSettings) {
      userSettings = {
        soundEnabled: true,
        printReceipts: false,
        darkMode: false,
        orderConfirmations: true
      };
    }

    await client.close();

    res.render('staff/settings', {
      title: 'Settings',
      layout: 'staff/layout',
      user: user,
      settings: userSettings
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

// API route to save staff preferences
router.post('/settings/preferences', async (req, res) => {
  try {
    const { soundEnabled, printReceipts, darkMode, orderConfirmations } = req.body;

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Upsert user settings
    await db.collection('UserSettings').updateOne(
      { userId: req.session.user._id },
      {
        $set: {
          soundEnabled: soundEnabled === 'true' || soundEnabled === true,
          printReceipts: printReceipts === 'true' || printReceipts === true,
          darkMode: darkMode === 'true' || darkMode === true,
          orderConfirmations: orderConfirmations === 'true' || orderConfirmations === true,
          updatedAt: new Date()
        },
        $setOnInsert: {
          userId: req.session.user._id,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    await client.close();
    res.json({ success: true, message: 'Preferences updated successfully' });
  } catch (error) {
    console.error('Staff preferences update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update preferences' });
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/messages/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Messages page
router.get('/messages', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const currentUserId = req.session.user._id;

    // Get all users for messaging (admins, owners and staff only) - include current user for sender display
    const users = await db.collection('users').find({
      role: { $in: ['admin', 'owner', 'staff'] }
    }).project({
      _id: 1,
      fullname: 1,
      staffId: 1,
      role: 1
    }).toArray();

    // Get conversations for current user (server-side)
    const messages = await db.collection('messages')
      .find({
        $or: [
          { senderId: currentUserId },
          { recipientId: currentUserId }
        ]
      })
      .sort({ timestamp: -1 })
      .toArray();

    // Group messages by conversation partner
    const conversationMap = new Map();

    for (const message of messages) {
      const partnerId = message.senderId === currentUserId ? message.recipientId : message.senderId;
      const conversationKey = [currentUserId, partnerId].sort().join('_');

      if (!conversationMap.has(conversationKey)) {
        // Show subject if available, otherwise content
        const lastMessageText = message.subject ? `${message.subject}: ${message.content || 'Sent an attachment'}` : (message.content || 'Sent an attachment');
        conversationMap.set(conversationKey, {
          conversationId: conversationKey,
          participantId: partnerId,
          lastMessage: lastMessageText,
          lastMessageTime: message.timestamp,
          messageCount: 0,
          unreadCount: 0
        });
      }

      const conv = conversationMap.get(conversationKey);
      conv.messageCount++;

      // Count unread messages from this partner
      if (message.recipientId === currentUserId && !message.read) {
        conv.unreadCount++;
      }
    }

    const conversations = Array.from(conversationMap.values());

    // Get participant details
    if (conversations.length > 0) {
      const participantIds = conversations.map(c => c.participantId);
      const participants = await db.collection('users')
        .find({ _id: { $in: participantIds.map(id => new ObjectId(id)) } })
        .toArray();

      const participantMap = new Map(participants.map(p => [p._id.toString(), p]));

      conversations.forEach(conv => {
        const participant = participantMap.get(conv.participantId);
        if (participant) {
          conv.participantName = participant.fullname;
        }
      });
    }

    await client.close();

    res.render('staff/messages', {
      title: 'Messages | Blessings Cafe',
      user: req.session.user,
      currentPage: '/staff/messages',
      layout: 'staff/layout',
      users,
      conversations
    });
  } catch (error) {
    console.error('Staff Messages error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load messages',
      status: 500
    });
  }
});

router.get('/complete-order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    // Get current order status
    const order = await ordersCollection.findOne({ OrderID: orderId });
    if (!order) {
      await client.close();
      return res.status(404).render('error', {
        title: 'Order Not Found',
        message: 'The order you\'re trying to complete was not found.',
        status: 404
      });
    }

    // Only allow completion if not already completed
    if (order.FulfillmentStatus === 'Completed') {
      await client.close();
      return res.render('staff/order-complete', {
        title: 'Order Already Completed',
        layout: 'staff/layout',
        orderId: orderId,
        order: order,
        message: 'This order has already been completed.',
        currentUser: req.session.user
      });
    }

    // Update order status to Completed
    await ordersCollection.updateOne(
      { OrderID: orderId },
      { $set: { FulfillmentStatus: 'Completed', fulfillmentStatus: 'Completed' } }
    );

    await client.close();

    // Render success page
    res.render('staff/order-complete', {
      title: 'Order Completed Successfully',
      layout: 'staff/layout',
      orderId: orderId,
      order: { ...order, FulfillmentStatus: 'Completed' },
      message: `Order ${orderId} has been marked as completed.`,
      currentUser: req.session.user
    });

  } catch (error) {
    console.error('Error completing order:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to complete the order.',
      status: 500
    });
  }
});

// API Routes for messaging
// Get conversations for current user
router.get('/messages/api/conversations', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const currentUserId = req.session.user._id;

    // Find all unique conversation partners
    const messages = await db.collection('messages')
      .find({
        $or: [
          { senderId: currentUserId },
          { recipientId: currentUserId }
        ]
      })
      .sort({ timestamp: -1 })
      .toArray();

    // Group messages by conversation partner
    const conversationMap = new Map();

    for (const message of messages) {
      const partnerId = message.senderId === currentUserId ? message.recipientId : message.senderId;
      const conversationKey = [currentUserId, partnerId].sort().join('_');

      if (!conversationMap.has(conversationKey)) {
        // Show subject if available, otherwise content
        const lastMessageText = message.subject ? `${message.subject}: ${message.content || 'Sent an attachment'}` : (message.content || 'Sent an attachment');
        conversationMap.set(conversationKey, {
          conversationId: conversationKey,
          participantId: partnerId,
          lastMessage: lastMessageText,
          lastMessageTime: message.timestamp,
          messageCount: 0,
          unreadCount: 0
        });
      }

      const conv = conversationMap.get(conversationKey);
      conv.messageCount++;

      // Count unread messages from this partner
      if (message.recipientId === currentUserId && !message.read) {
        conv.unreadCount++;
      }
    }

    const conversations = Array.from(conversationMap.values());

    // Get participant details
    if (conversations.length > 0) {
      const participantIds = conversations.map(c => c.participantId);
      const participants = await db.collection('users')
        .find({ _id: { $in: participantIds.map(id => new ObjectId(id)) } })
        .toArray();

      const participantMap = new Map(participants.map(p => [p._id.toString(), p]));

      conversations.forEach(conv => {
        const participant = participantMap.get(conv.participantId);
        if (participant) {
          conv.participantName = participant.fullname;
        }
      });
    }

    await client.close();

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages for a conversation
router.get('/messages/api/messages/:conversationId', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const currentUserId = req.session.user._id;
    const conversationId = req.params.conversationId;

    // Parse conversation ID to get participant IDs
    const [user1, user2] = conversationId.split('_');
    const participantId = user1 === currentUserId ? user2 : user1;

    // Get messages between current user and participant
    const messages = await db.collection('messages')
      .find({
        $or: [
          { senderId: currentUserId, recipientId: participantId },
          { senderId: participantId, recipientId: currentUserId }
        ]
      })
      .sort({ timestamp: 1 })
      .toArray();

    // Mark messages as read
    await db.collection('messages').updateMany(
      {
        senderId: participantId,
        recipientId: currentUserId,
        read: false
      },
      { $set: { read: true, readAt: new Date() } }
    );

    await client.close();
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a message
router.post('/messages/api/send', async (req, res) => {
  try {
    const { recipientId, content, attachments, subject } = req.body;
    const senderId = req.session.user._id;

    if (!recipientId || (!content && (!attachments || attachments.length === 0))) {
      return res.status(400).json({ error: 'Recipient and content or attachments required' });
    }

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Verify recipient exists and is admin/staff/owner
    const recipient = await db.collection('users').findOne({
      _id: new ObjectId(recipientId),
      role: { $in: ['admin', 'owner', 'staff'] }
    });

    if (!recipient) {
      await client.close();
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const message = {
      senderId,
      recipientId,
      subject: subject || '',
      content: content || '',
      attachments: attachments || [],
      timestamp: new Date(),
      read: false
    };

    const result = await db.collection('messages').insertOne(message);

    await client.close();

    res.json({
      success: true,
      message: { ...message, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get users for messaging
router.get('/messages/api/users', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const users = await db.collection('users').find({
      role: { $in: ['admin', 'owner', 'staff'] },
      _id: { $ne: new ObjectId(req.session.user._id) } // Exclude current user
    }).toArray();

    await client.close();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get unread message count for current user
router.get('/messages/api/unread-count', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const currentUserId = req.session.user._id;

    const unreadCount = await db.collection('messages').countDocuments({
      recipientId: currentUserId,
      read: false
    });

    await client.close();
    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Upload files
router.post('/messages/api/upload', upload.array('files', 5), (req, res) => {
  try {
    const files = req.files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/messages/${file.filename}`
    }));

    res.json({ success: true, files });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

module.exports = router;
