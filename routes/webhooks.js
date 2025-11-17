const express = require('express');
const router = express.Router();

// Middleware to verify N8N webhook (optional but recommended for security)
const verifyN8nWebhook = (req, res, next) => {
  const secret = process.env.N8N_WEBHOOK_SECRET; // Set in .env
  if (req.headers['x-n8n-signature'] !== secret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};

router.post('/order-status-update', verifyN8nWebhook, async (req, res) => {
  try {
    const { orderId, fulfillmentStatus, deliveryMethod } = req.body; // From N8N payload
    if (!orderId || !fulfillmentStatus) {
      return res.status(400).json({ success: false, error: 'Missing orderId or fulfillmentStatus' });
    }

    // Update order in DB
    const db = req.db;
    const order = await db.collection('Orders').findOneAndUpdate(
      { OrderID: orderId },
      { $set: { FulfillmentStatus: fulfillmentStatus } },
      { returnDocument: 'after' }
    );
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Optional: Emit to Socket.IO or trigger real-time updates if needed
    // io.emit('orderStatusUpdate', { orderId, fulfillmentStatus });

    res.json({ success: true, message: 'Order status updated', data: { orderId, fulfillmentStatus } });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;