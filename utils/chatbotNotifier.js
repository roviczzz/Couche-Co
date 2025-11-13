/**
 * Chatbot Notifier - Sends fulfillment status updates to n8n webhooks
 * This triggers messenger notifications to chatbot customers
 * 
 * IMPORTANT: Chatbot uses only two FulfillmentMethod values:
 * - "Delivery" → Routes to delivery webhook
 * - "Pick-Up" → Routes to pickup webhook
 * 
 * CRITICAL: n8n webhooks MUST be configured to accept POST requests!
 * Set "HTTP Method" to "POST" or "ALL" in n8n webhook node settings.
 */

const axios = require('axios');

// n8n webhook configuration
// Supports two modes:
// 1. Base URL + Webhook IDs (default)
// 2. Complete separate URLs (if N8N_DELIVERY_WEBHOOK_URL and N8N_PICKUP_WEBHOOK_URL are set)

const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL || 'https://your-n8n-instance.com/webhook';
const DELIVERY_WEBHOOK_ID = process.env.N8N_DELIVERY_WEBHOOK_ID || '949aa252-9ae4-4395-8747-924202f2aa42';
const PICKUP_WEBHOOK_ID = process.env.N8N_PICKUP_WEBHOOK_ID || '949aa252-9ae4-4395-8747-924202f2aa42';

// Complete webhook URLs (if set, these override base URL + ID)
const DELIVERY_WEBHOOK_URL = process.env.N8N_DELIVERY_WEBHOOK_URL;
const PICKUP_WEBHOOK_URL = process.env.N8N_PICKUP_WEBHOOK_URL;

/**
 * Get the appropriate webhook URL based on delivery method
 * @param {Boolean} isDelivery - Whether it's a delivery order
 * @returns {String} Full webhook URL
 */
function getWebhookUrl(isDelivery) {
  if (isDelivery) {
    // Use complete URL if set, otherwise construct from base + ID
    return DELIVERY_WEBHOOK_URL || `${N8N_BASE_URL}/${DELIVERY_WEBHOOK_ID}`;
  } else {
    // Use complete URL if set, otherwise construct from base + ID
    return PICKUP_WEBHOOK_URL || `${N8N_BASE_URL}/${PICKUP_WEBHOOK_ID}`;
  }
}

/**
 * Notify chatbot customer about order status change
 * @param {Object} order - The order object from database
 * @param {String} newStatus - The new fulfillment status
 * @returns {Promise<Object>} Result of the notification
 */
async function notifyOrderStatusChange(order, newStatus) {
  // Only notify for chatbot orders
  if (!order.Source || order.Source !== 'Chatbot') {
    return {
      success: false,
      message: 'Not a chatbot order, skipping notification',
      skipped: true
    };
  }

  // Determine if it's delivery or pickup
  // Check both DeliveryStatus and FulfillmentMethod fields
  const deliveryValue = order.DeliveryStatus || order.FulfillmentMethod || '';
  const isDelivery = deliveryValue.toLowerCase().includes('delivery');
  const webhookUrl = getWebhookUrl(isDelivery);
  
  console.log(`📦 Order type detected: ${deliveryValue} → ${isDelivery ? 'Delivery' : 'Pickup'} webhook`);
  console.log(`🔗 Webhook URL: ${webhookUrl}`);

  // Prepare payload
  const payload = {
    orderId: order.OrderID,
    userId: order.Customer, // Facebook PSID
    fulfillmentStatus: newStatus,
    deliveryMethod: order.DeliveryStatus,
    orderDate: order.Date,
    total: order.Total,
    items: order.Cart,
    contactNumber: order.ContactNumber,
    address: order.Address,
    timestamp: new Date().toISOString()
  };

  try {
    console.log(`🔔 Sending notification to chatbot for order ${order.OrderID} - Status: ${newStatus}`);
    console.log(`   └─ Delivery type: ${deliveryValue}, Using: ${isDelivery ? 'DELIVERY' : 'PICKUP'} webhook`);
    console.log(`   └─ Webhook URL: ${webhookUrl}`);
    
    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000, // 10 second timeout
      // Handle SSL certificate issues (only for development/self-signed certs)
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false // Set to true in production with valid SSL
      })
    });

    console.log(`✅ Chatbot notification sent successfully for ${order.OrderID}`);
    console.log(`   └─ Response status: ${response.status}`);
    return {
      success: true,
      message: 'Notification sent to chatbot',
      response: response.data
    };

  } catch (error) {
    console.error(`❌ Failed to send chatbot notification for ${order.OrderID}:`);
    console.error(`   └─ Error: ${error.message}`);
    
    if (error.code) {
      console.error(`   └─ Error code: ${error.code}`);
    }
    
    if (error.response) {
      console.error(`   └─ HTTP Status: ${error.response.status}`);
      console.error(`   └─ Response data:`, error.response.data);
    } else if (error.request) {
      console.error(`   └─ No response received from webhook`);
      console.error(`   └─ This usually means the server is unreachable or DNS failed`);
    }
    
    return {
      success: false,
      message: 'Failed to send notification',
      error: error.message,
      errorCode: error.code
    };
  }
}

/**
 * Get status message for customer notification
 * @param {String} status - Fulfillment status
 * @param {Boolean} isDelivery - Whether it's a delivery order
 * @returns {String} Customer-friendly message
 */
function getStatusMessage(status, isDelivery) {
  const messages = {
    'Preparing': '🍰 Your order is now being prepared! We\'ll notify you when it\'s ready.',
    'In Progress': '👨‍🍳 Your order is currently being prepared by our team.',
    'Ready': isDelivery 
      ? '✅ Your order is ready and will be out for delivery soon!'
      : '✅ Your order is ready for pickup! Please come to our store.',
    'In Delivery': '🚚 Your order is out for delivery! It should arrive shortly.',
    'Completed': '🎉 Your order has been completed! Thank you for choosing Blessings Cafe!',
    'Cancelled': '❌ Your order has been cancelled. If you have questions, please contact us.'
  };

  return messages[status] || `Your order status has been updated to: ${status}`;
}

module.exports = {
  notifyOrderStatusChange,
  getStatusMessage
};
