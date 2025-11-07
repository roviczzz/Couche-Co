const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const { checkInventoryAvailability, deductInventoryAfterPayment } = require('../middleware/inventoryMiddleware');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

console.log('API routes module loaded');
router.get('/', (req, res) => {
  res.json({ message: 'API routes work' });
});

// Xendit configuration
const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY || 'xnd_development_9YDHJULGUWulhmoYgQxildVQ3EWsAeviiJHwF3PSi9zmNcCKll8zEP3thAc5VvD9'
const XENDIT_API_URL = 'https://api.xendit.co'

function isLoggedIn(req, res, next) {
  if (req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
}

router.get('/addons', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const addOns = await db.collection('Add-ons').find({ isEnabled: true }).toArray();

    await client.close();
    res.json(addOns);
  } catch (err) {
    console.error('Error fetching add-ons:', err);
    res.status(500).json([]);
  }
});

router.get('/orders/preparing-customers', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri)
    const db = client.db('blessingscafe')
    const docs = await db.collection('Orders').find({ FulfillmentStatus: "Preparing" }).project({ Customer: 1 }).toArray()
    await client.close()
    res.json(docs.map(d => d.Customer))
  } catch (err) {
    res.status(500).json([])
  }
})

router.post('/xendit/create-payment', async (req, res) => {
  try {
    const invoicePayload = req.body

    // Check API configuration
    const apiKey = process.env.XENDIT_SECRET_KEY || 'xnd_development_9YDHJULGUWulhmoYgQxildVQ3EWsAeviiJHwF3PSi9zmNcCKll8zEP3thAc5VvD9'

    // Validate payload structure
    const requiredFields = ['external_id', 'amount', 'currency', 'customer']
    const missing = requiredFields.filter(field => !invoicePayload[field])
    if (missing.length > 0) {
      console.error('❌ Missing required fields:', missing)
      return res.status(400).json({
        error: 'Invalid request data',
        message: `Missing required fields: ${missing.join(', ')}`,
        details: 'Request payload validation failed'
      })
    }

    console.log('📤 Sending request to Xendit...')
    const authHeader = `Basic ${Buffer.from(apiKey + ':').toString('base64')}`
    console.log('🔐 Authorization header:', authHeader.substring(0, 20) + '...')
    console.log('📦 Request body:', JSON.stringify(invoicePayload, null, 2))

    const response = await fetch(`${XENDIT_API_URL}/invoices`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invoicePayload)
    })

    console.log('📥 Xendit response status:', response.status)
    console.log('📥 Xendit response headers:', Object.fromEntries(response.headers.entries()))

    const responseText = await response.text()
    console.log('📄 Raw response:', responseText)

    if (!response.ok) {
      console.error('❌ INVOICE CREATION FAILED')
      console.error('Status:', response.status)
      console.error('Response:', responseText)

      try {
        const errorJson = JSON.parse(responseText)
        console.error('Parsed error:', errorJson)
      } catch (e) {
        console.error('Could not parse error response')
      }

      // Return user-friendly error
      return res.status(400).json({
        error: 'Payment setup failed',
        message: 'Unable to prepare payment. Please try again or contact support.',
        details: `Xendit API error: ${response.status}`
      })
    }

    let paymentData
    try {
      paymentData = JSON.parse(responseText)
      console.log('✅ INVOICE CREATED SUCCESSFULLY')
      console.log('🔹 Invoice ID:', paymentData.id)
      console.log('🔹 External ID:', paymentData.external_id)
      console.log('🔹 Invoice URL:', paymentData.invoice_url)
      console.log('🔹 Status:', paymentData.status)
      console.log('===================================================\n')
    } catch (e) {
      console.error('❌ Failed to parse successful response:', responseText)
      return res.status(500).json({
        error: 'Response parsing error',
        message: 'Payment created but response was invalid.'
      })
    }

    res.json(paymentData)
  } catch (error) {
    console.error('💥 UNEXPECTED ERROR in invoice creation:', error)
    console.log('===================================================\n')
    res.status(500).json({
      error: 'Unexpected error',
      message: 'An unexpected error occurred. Please try again or contact support.'
    })
  }
})

router.get('/xendit/check-payment-by-order/:OrderID', async (req, res) => {
  try {
    const { OrderID } = req.params

    console.log('Checking payment status for OrderID:', OrderID)

    // Get the invoice ID from the order
    const client = await MongoClient.connect(uri)
    const db = client.db('blessingscafe')
    const order = await db.collection('Orders').findOne({ OrderID: OrderID })
    await client.close()

    if (!order || !order.XenditPaymentID) {
      return res.status(400).json({
        error: 'Payment not found',
        message: 'This order may not have been properly processed for payment. Please contact customer support.',
        details: 'Invoice ID not found in order'
      })
    }

    const invoiceId = order.XenditPaymentID
    console.log('Using Xendit Invoice ID:', invoiceId)

    const response = await fetch(`${XENDIT_API_URL}/invoices/${invoiceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      }
    })

    console.log('Xendit API response status:', response.status)

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Xendit check-payment error:', {
        status: response.status,
        OrderID: OrderID,
        invoiceId: invoiceId,
        error: errorData
      })

      // Handle specific error cases
      if (response.status === 400) {
        return res.status(400).json({
          error: 'Payment not found',
          message: 'This order may not have been properly processed for payment. Please contact customer support.',
          details: 'Invoice not found in Xendit'
        })
      }

      return res.status(response.status).json({
        error: 'Failed to check payment status',
        details: errorData
      })
    }

    const paymentData = await response.json()
    console.log('Payment data retrieved:', paymentData.status)
    res.json(paymentData)
  } catch (error) {
    console.error('Error checking payment status:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Unable to verify payment. Please try again or contact support.'
    })
  }
})

router.post('/xendit/webhook', express.raw({type: 'application/json'}), (req, res) => {
  try {
    const payload = JSON.parse(req.body)

    console.log('Xendit webhook received:', payload)

    if (payload.status === 'PAID') {
      console.log(`Payment completed for invoice: ${payload.external_id}`)
      // Update order status in database
      updateOrderAfterPayment(payload.external_id)
    }

    res.status(200).send('OK')
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(400).send('Bad Request')
  }
})

// Helper function to update order after payment
async function updateOrderAfterPayment(externalId) {
  try {
    const client = await MongoClient.connect(uri)
    const db = client.db('blessingscafe')
    const result = await db.collection('Orders').updateOne(
      { OrderID: externalId },
      {
        $set: {
          PaymentStatus: 'Paid',
          FulfillmentStatus: 'Preparing' // or 'Ready for Processing'
        }
      }
    )
    console.log(`Updated order ${externalId} payment status: ${result.matchedCount} matched`)
    await client.close()
  } catch (error) {
    console.error('Error updating order after payment:', error)
  }
}

router.post('/orders', checkInventoryAvailability, async (req, res) => {
  try {
    const orderData = req.body;

    if (!orderData || !orderData.OrderID || !orderData.Date || !orderData.Cart || !orderData.Customer) {
      return res.status(400).json({ success: false, error: 'Missing required order fields' });
    }

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Add inventory check status to order
    if (req.inventoryChecked) {
      orderData.InventoryChecked = true;
      orderData.InventoryCheckedAt = new Date();
    } else if (req.inventoryCheckFailed) {
      orderData.InventoryCheckFailed = true;
      orderData.InventoryCheckError = req.inventoryError;
      orderData.InventoryCheckAttemptedAt = new Date();
      console.warn(`Order ${orderData.OrderID} created without inventory validation due to: ${req.inventoryError}`);
    }

    await db.collection('Orders').insertOne(orderData);

    await client.close();

    console.log(`Order created: ${orderData.OrderID} (Inventory ${req.inventoryChecked ? 'validated' : 'check failed'})`);
    res.json({ success: true, orderId: orderData.OrderID });
  } catch (err) {
    console.error('Error saving order:', err);
    res.status(500).json({ success: false, error: 'Failed to save order' });
  }
});

router.post('/orders/update-payment-status', async (req, res) => {
  const { paymentId, invoiceId, status, PaymentMethod } = req.body;
  if (!paymentId || !invoiceId || !status) {
    return res.status(400).json({ success: false, error: 'Missing paymentId, invoiceId or status.' });
  }
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const orders = db.collection('Orders');
    
    // Build update object
    const updateFields = { 
      PaymentStatus: status, 
      XenditPaymentID: invoiceId,
      PaymentUpdatedAt: new Date()
    };
    
    // Add PaymentMethod if provided
    if (PaymentMethod) {
      updateFields.PaymentMethod = PaymentMethod;
    }
    
    const result = await orders.updateOne(
        { OrderID: paymentId },
        { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      await client.close();
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    // If payment is successful, deduct inventory
    if (status === 'Paid') {
      const order = await orders.findOne({ OrderID: paymentId });
      
      if (order) {
        console.log(`[ORDER] Payment confirmed for order ${paymentId}, processing inventory deduction...`);
        const inventoryResult = await deductInventoryAfterPayment(order);
        
        if (!inventoryResult.success) {
          console.error(`[ORDER ERROR] Failed to deduct inventory for order ${paymentId}:`, inventoryResult.error);
          // Log the error but don't fail the payment update
          await orders.updateOne(
            { OrderID: paymentId },
            { 
              $set: { 
                InventoryDeductionError: inventoryResult.error,
                InventoryDeductionAttemptedAt: new Date()
              }
            }
          );
        } else {
          // Log successful inventory deduction
          await orders.updateOne(
            { OrderID: paymentId },
            { 
              $set: { 
                InventoryDeducted: true,
                InventoryDeductedAt: new Date(),
                InventoryDeductions: inventoryResult.deductions
              }
            }
          );
          console.log(`[ORDER SUCCESS] Inventory successfully deducted for order ${paymentId}. Items processed: ${inventoryResult.deductions.length}`);
        }
      }
    }

    await client.close();
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating payment status:', err);
    res.status(500).json({ success: false, error: 'Database error.' });
  }
});

// Add Order Management Routes
router.patch('/orders/:OrderID/fulfillment', async (req, res) => {
  const { OrderID } = req.params;
  const { FulfillmentStatus } = req.body;

  if (!FulfillmentStatus) {
    return res.status(400).json({ error: 'FulfillmentStatus is required' });
  }

  if (!OrderID || OrderID.trim() === '') {
    return res.status(400).json({ error: 'Invalid OrderID format' });
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    const filter = { OrderID: OrderID };
    const updateDoc = { $set: { FulfillmentStatus } };

    const updateResult = await ordersCollection.updateOne(filter, updateDoc);
    const updatedOrder = await ordersCollection.findOne(filter);

    await client.close();

    if (!updatedOrder) {
      return res.status(404).json({ error: `Order with ID ${OrderID} not found` });
    }

    return res.status(200).json({
      success: true,
      message: `Fulfillment status updated to "${FulfillmentStatus}"`,
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error updating order fulfillment:', error);
    return res.status(500).json({ error: 'Server error while updating order' });
  }
});

router.patch('/orders/:OrderID/payment-status', async (req, res) => {
  const { OrderID } = req.params;
  const { PaymentStatus } = req.body;

  if (!PaymentStatus) {
    return res.status(400).json({ error: 'PaymentStatus is required' });
  }

  if (!OrderID || OrderID.trim() === '') {
    return res.status(400).json({ error: 'Invalid OrderID format' });
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    const filter = { OrderID: OrderID };
    const updateDoc = { $set: { PaymentStatus } };

    const updateResult = await ordersCollection.updateOne(filter, updateDoc);
    const updatedOrder = await ordersCollection.findOne(filter);

    await client.close();

    if (!updatedOrder) {
      return res.status(404).json({ error: `Order with ID ${OrderID} not found` });
    }

    return res.status(200).json({
      success: true,
      message: `Payment status updated to "${PaymentStatus}"`,
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    return res.status(500).json({ error: 'Server error while updating order' });
  }
});

router.patch('/orders/:OrderID/cancel', async (req, res) => {
  const { OrderID } = req.params;

  if (!OrderID || OrderID.trim() === '') {
    return res.status(400).json({ error: 'Invalid OrderID format' });
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    const filter = { OrderID: OrderID };

    // First check if the order exists
    const existingOrder = await ordersCollection.findOne(filter);
    if (!existingOrder) {
      await client.close();
      return res.status(404).json({ error: `Order with ID ${OrderID} not found` });
    }

    // Delete the order from the database
    const deleteResult = await ordersCollection.deleteOne(filter);

    await client.close();

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({ error: `Order with ID ${OrderID} not found` });
    }

    return res.status(200).json({
      success: true,
      message: 'Order cancelled and deleted successfully',
      deletedOrderID: OrderID
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return res.status(500).json({ error: 'Server error while cancelling order' });
  }
});

router.patch('/orders/:OrderID/restore', async (req, res) => {
  const { OrderID } = req.params;

  if (!OrderID || OrderID.trim() === '') {
    return res.status(400).json({ error: 'Invalid OrderID format' });
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    const filter = { OrderID: OrderID };
    const updateDoc = {
      $set: {
        PaymentStatus: 'Pending',
        FulfillmentStatus: 'Preparing'
      }
    };

    const updateResult = await ordersCollection.updateOne(filter, updateDoc);
    const updatedOrder = await ordersCollection.findOne(filter);

    await client.close();

    if (!updatedOrder) {
      return res.status(404).json({ error: `Order with ID ${OrderID} not found` });
    }

    return res.status(200).json({
      success: true,
      message: 'Order restored successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error restoring order:', error);
    return res.status(500).json({ error: 'Server error while restoring order' });
  }
});

router.get('/orders/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    const order = await ordersCollection.findOne({ OrderID: orderId });

    if (!order) {
      await client.close();
      return res.status(404).json({ error: 'Order not found' });
    }

    // Calculate progress percentage based on FulfillmentStatus
    let progressPercentage = 25; // Default preparing
    let statusText = 'Preparing your order';
    switch (order.FulfillmentStatus) {
      case 'Preparing':
        progressPercentage = 25;
        statusText = 'Preparing your order';
        break;
      case 'In Progress':
        progressPercentage = 50;
        statusText = 'Your order is being prepared';
        break;
      case 'Ready':
        progressPercentage = 90;
        statusText = 'Your order is ready for pickup';
        break;
      case 'Completed':
        progressPercentage = 100;
        statusText = 'Order completed successfully';
        break;
      default:
        progressPercentage = 25;
        statusText = 'Preparing your order';
    }

    await client.close();

    res.json({
      FulfillmentStatus: order.FulfillmentStatus,
      PaymentStatus: order.PaymentStatus,
      progressPercentage: progressPercentage,
      statusText: statusText,
      orderId: order.OrderID
    });
  } catch (error) {
    console.error('Error fetching order status:', error);
    res.status(500).json({ error: 'Failed to fetch order status' });
  }
});

// Add Stock Management Routes
router.get('/stocks/ingredients', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ingredients = await db.collection('Ingredients').find().toArray();
    await client.close();

    res.json(ingredients);
  } catch (err) {
    console.error('Error fetching ingredients:', err);
    res.status(500).json({ error: 'Failed to fetch ingredients' });
  }
});

router.get('/stocks/addons', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const addons = await db.collection('Add-ons').find().toArray();
    await client.close();

    res.json(addons);
  } catch (err) {
    console.error('Error fetching add-ons:', err);
    res.status(500).json({ error: 'Failed to fetch add-ons' });
  }
});

router.get('/stocks/export', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const ingredients = await db.collection('Ingredients').find().toArray();
    const addons = await db.collection('Add-ons').find().toArray();

    await client.close();

    const exportData = {
      ingredients,
      addons,
      exportedAt: new Date(),
      stats: {
        totalIngredients: ingredients.length,
        totalAddons: addons.length,
        enabledIngredients: ingredients.filter(i => i.isEnabled).length,
        enabledAddons: addons.filter(a => a.isEnabled).length
      }
    };

    res.json(exportData);
  } catch (err) {
    console.error('Error exporting inventory data:', err);
    res.status(500).json({ error: 'Failed to export inventory data' });
  }
});

router.get('/stocks/alerts', async (req, res) => {
  try {
    const { threshold = 10, urgent = 5 } = req.query;
    const lowStockThreshold = parseInt(threshold);
    const urgentThreshold = parseInt(urgent);

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const lowStockIngredients = await db.collection('Ingredients').find({
      Quantity: { $lte: lowStockThreshold },
      isEnabled: true
    }).toArray();

    const lowStockAddons = await db.collection('Add-ons').find({
      Quantity: { $lte: lowStockThreshold },
      isEnabled: true
    }).toArray();

    const urgentIngredients = lowStockIngredients.filter(item => item.Quantity <= urgentThreshold);
    const urgentAddons = lowStockAddons.filter(item => item.Quantity <= urgentThreshold);

    await client.close();

    const alerts = {
      lowStockIngredients,
      lowStockAddons,
      urgentIngredients,
      urgentAddons,
      thresholds: {
        lowStock: lowStockThreshold,
        urgent: urgentThreshold
      },
      counts: {
        totalAlerts: lowStockIngredients.length + lowStockAddons.length,
        urgentAlerts: urgentIngredients.length + urgentAddons.length,
        lowStockIngredients: lowStockIngredients.length,
        lowStockAddons: lowStockAddons.length
      }
    };

    res.json(alerts);
  } catch (err) {
    console.error('Error generating low stock alerts:', err);
    res.status(500).json({ error: 'Failed to generate low stock alerts' });
  }
});

router.get('/ingredients/search', async (req, res) => {
  try {
    const query = req.query.q || '';

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Search for ingredients that match the Name
    const results = await db.collection('Ingredients')
      .find({ Name: { $regex: query, $options: 'i' }, isEnabled: true })
      .project({ IngredientID: 1, Name: 1, _id: 0 })
      .limit(50)
      .toArray();

    await client.close();
    res.json(results);
  } catch (err) {
    console.error('Error in ingredient search:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/addons/search', async (req, res) => {
  try {
    const query = req.query.q || '';

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Search for add-ons that match the Name
    const results = await db.collection('Add-ons')
      .find({ Name: { $regex: query, $options: 'i' }, isEnabled: true })
      .project({ AddOnID: 1, Name: 1, _id: 0 })
      .limit(50)
      .toArray();

    await client.close();
    res.json(results);
  } catch (err) {
    console.error('Error in add-on search:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/stocks/health', async (req, res) => {
  try {
    const startTime = Date.now();
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    await db.admin().ping();

    const ingredientCount = await db.collection('Ingredients').countDocuments();
    const addonCount = await db.collection('Add-ons').countDocuments();
    const enabledIngredients = await db.collection('Ingredients').countDocuments({ isEnabled: true });
    const enabledAddons = await db.collection('Add-ons').countDocuments({ isEnabled: true });

    await client.close();
    const responseTime = Date.now() - startTime;

    const healthStatus = {
      status: 'healthy',
      database: 'connected',
      performance: {
        responseTime: responseTime,
        status: responseTime < 1000 ? 'excellent' : responseTime < 3000 ? 'good' : 'slow'
      },
      inventory: {
        ingredients: ingredientCount,
        addons: addonCount,
        enabledIngredients: enabledIngredients,
        enabledAddons: enabledAddons,
        totalItems: ingredientCount + addonCount
      }
    };

    res.json(healthStatus);
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message
    });
  }
});

// Add Analytics Routes
router.get('/analytics/popular-products', async (req, res) => {
  try {
    const { days = 'all', startDate, endDate, category } = req.query;
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    let pipeline = [
      { $unwind: "$Cart" }
    ];

    // Add date filter if not 'all'
    if (days !== 'all' || startDate || endDate) {
      let startDateFilter, endDateFilter;

      if (startDate || endDate) {
        // Custom date range
        if (startDate) startDateFilter = new Date(startDate + 'T00:00:00.000Z');
        if (endDate) {
          endDateFilter = new Date(endDate + 'T23:59:59.999Z');
        }
      } else if (days !== 'all') {
        // Preset days
        const daysNumber = parseInt(days);
        startDateFilter = new Date();
        startDateFilter.setDate(startDateFilter.getDate() - daysNumber);
        startDateFilter.setHours(0, 0, 0, 0);
      }

      pipeline.push({
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{ $type: "$Date" }, "string"] },
              then: {
                $dateFromString: {
                  dateString: {
                    $concat: [
                      { $substr: ["$Date", 0, 10] }, // Extract YYYY-MM-DD
                      "T00:00:00.000Z" // Add UTC time
                    ]
                  }
                }
              },
              else: "$Date"
            }
          }
        }
      });

      const dateMatch = {};
      if (startDateFilter) dateMatch.$gte = startDateFilter;
      if (endDateFilter) dateMatch.$lte = endDateFilter;

      if (Object.keys(dateMatch).length > 0) {
        pipeline.push({
          $match: { orderDate: dateMatch }
        });
      }
    }

    pipeline.push(
      {
        $group: {
          _id: "$Cart.ProductName",
          totalQuantity: { $sum: "$Cart.Quantity" }
        }
      },
      { $sort: { totalQuantity: -1 } }
    );

    const ordersFiltered = await db.collection('Orders').aggregate(pipeline.slice(0, days !== 'all' ? 3 : 1)).toArray();
    const monthCounts = {};
    ordersFiltered.forEach(order => {
      const dateStr = order.Date.substring(0, 7); // YYYY-MM
      monthCounts[dateStr] = (monthCounts[dateStr] || 0) + 1;
    });

    const results = await db.collection('Orders').aggregate(pipeline).toArray();
    console.log(`Popular products for days=${days}:`, results.length, 'products, from', ordersFiltered.length, 'filtered orders');
    console.log('Orders by month:', monthCounts);
    await client.close();
    res.json(results);
  } catch (err) {
    console.error('Error fetching popular products:', err);
    res.status(500).json({ error: 'Failed to fetch popular products' });
  }
});

router.get('/analytics/sales-per-day', async (req, res) => {
  try {
    const { days = 'all' } = req.query;
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    let pipeline = [
      {
        $addFields: {
          parsedDate: {
            $cond: {
              if: { $eq: [{ $type: "$Date" }, "string"] },
              then: { $dateFromString: { dateString: "$Date" } },
              else: "$Date"
            }
          }
        }
      }
    ];

    // Add date range filter if not 'all'
    if (days !== 'all') {
      const daysNumber = parseInt(days);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNumber);

      pipeline.push({
        $match: {
          parsedDate: { $gte: startDate }
        }
      });
    }

    pipeline.push(
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$parsedDate" } },
          totalSales: { $sum: "$Total" }
        }
      },
      { $sort: { _id: 1 } }
    );

    const salesPerDay = await db.collection('Orders').aggregate(pipeline).toArray();
    await client.close();
    res.json(salesPerDay);
  } catch (err) {
    console.error('Error fetching sales per day:', err);
    res.status(500).json({ error: 'Failed to fetch sales per day' });
  }
});


router.get('/analytics/sales-performance', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 14;
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const pipeline = [
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{ $type: "$Date" }, "string"] },
              then: { $dateFromString: { dateString: "$Date" } },
              else: "$Date"
            }
          }
        }
      },
      {
        $match: {
          orderDate: { $gte: startDate, $lte: endDate },
          PaymentStatus: { $ne: "Cancelled" }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
          earnings: { $sum: "$Total" },
          costs: { $sum: { $multiply: ["$Total", 0.6] } },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];

    let results = await db.collection('Orders').aggregate(pipeline).toArray();

    // Fill in missing dates
    const dateMap = {};
    results.forEach(item => { dateMap[item._id] = item });

    const allDates = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      allDates.unshift(dateStr);
    }

    const formattedResults = allDates.map(dateStr => {
      if (dateMap[dateStr]) {
        return {
          date: dateStr,
          earnings: dateMap[dateStr].earnings || 0,
          costs: dateMap[dateStr].costs || 0,
          orders: dateMap[dateStr].orders || 0
        };
      } else {
        return {
          date: dateStr,
          earnings: 0,
          costs: 0,
          orders: 0
        };
      }
    });

    await client.close();
    res.json(formattedResults);
  } catch (err) {
    console.error('Error fetching sales performance:', err);
    res.status(500).json({ error: 'Failed to fetch sales performance data' });
  }
});

router.get('/analytics/dashboard-stats', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ordersCollection = db.collection('Orders');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const totalSalesResult = await ordersCollection.aggregate([
      {
        $match: {
          PaymentStatus: { $ne: "Cancelled" }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$Total" },
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].total : 0;
    const totalOrders = totalSalesResult.length > 0 ? totalSalesResult[0].count : 0;

    const weekSalesResult = await ordersCollection.aggregate([
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{ $type: "$Date" }, "string"] },
              then: { $dateFromString: { dateString: "$Date" } },
              else: "$Date"
            }
          }
        }
      },
      { $match: { orderDate: { $gte: weekAgo }, PaymentStatus: { $ne: "Cancelled" } } },
      { $group: { _id: null, total: { $sum: "$Total" } } }
    ]).toArray();

    const totalSalesWeek = weekSalesResult.length > 0 ? weekSalesResult[0].total : 0;

    const prevWeekAgo = new Date(weekAgo);
    prevWeekAgo.setDate(prevWeekAgo.getDate() - 7);

    const prevWeekSalesResult = await ordersCollection.aggregate([
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{ $type: "$Date" }, "string"] },
              then: { $dateFromString: { dateString: "$Date" } },
              else: "$Date"
            }
          }
        }
      },
      { $match: { orderDate: { $gte: prevWeekAgo, $lt: weekAgo }, PaymentStatus: { $ne: "Cancelled" } } },
      { $group: { _id: null, total: { $sum: "$Total" } } }
    ]).toArray();

    const prevWeekSales = prevWeekSalesResult.length > 0 ? prevWeekSalesResult[0].total : 0;
    const totalSalesPercent = prevWeekSales === 0 ? 100 : Math.round(((totalSalesWeek - prevWeekSales) / prevWeekSales) * 100);

    const incomingOrdersCount = await ordersCollection.countDocuments({
      FulfillmentStatus: { $nin: ["Completed", "Cancelled"] }
    });

    const yesterdayIncomingResult = await ordersCollection.aggregate([
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{ $type: "$Date" }, "string"] },
              then: { $dateFromString: { dateString: "$Date" } },
              else: "$Date"
            }
          }
        }
      },
      { $match: { FulfillmentStatus: { $nin: ["Completed", "Cancelled"] }, orderDate: { $gte: yesterday, $lt: today } } },
      { $count: "count" }
    ]).toArray();

    const yesterdayIncomingOrdersCount = yesterdayIncomingResult.length > 0 ? yesterdayIncomingResult[0].count : 0;
    const incomingOrdersPercent = yesterdayIncomingOrdersCount === 0 ? 0 : Math.round(((incomingOrdersCount - yesterdayIncomingOrdersCount) / yesterdayIncomingOrdersCount) * 100);

    const ordersTodayResult = await ordersCollection.aggregate([
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{ $type: "$Date" }, "string"] },
              then: { $dateFromString: { dateString: "$Date" } },
              else: "$Date"
            }
          }
        }
      },
      { $match: { orderDate: { $gte: today } } },
      { $count: "count" }
    ]).toArray();

    const ordersTodayCount = ordersTodayResult.length > 0 ? ordersTodayResult[0].count : 0;

    const yesterdayOrdersResult = await ordersCollection.aggregate([
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{ $type: "$Date" }, "string"] },
              then: { $dateFromString: { dateString: "$Date" } },
              else: "$Date"
            }
          }
        }
      },
      { $match: { orderDate: { $gte: yesterday, $lt: today } } },
      { $count: "count" }
    ]).toArray();

    const yesterdayOrdersCount = yesterdayOrdersResult.length > 0 ? yesterdayOrdersResult[0].count : 0;
    const ordersTodayPercent = yesterdayOrdersCount === 0 ? 0 : Math.round(((ordersTodayCount - yesterdayOrdersCount) / yesterdayOrdersCount) * 100);

    await client.close();

    res.json({
      totalSales,
      totalOrders,
      totalSalesWeek,
      totalSalesPercent,
      incomingOrders: incomingOrdersCount,
      incomingOrdersPercent,
      ordersToday: ordersTodayCount,
      ordersTodayPercent
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// New Analytics Endpoints - Payment Methods Distribution
router.get('/analytics/payment-methods', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const pipeline = [
      {
        $match: {
          PaymentStatus: { $ne: 'Cancelled' }
        }
      },
      {
        $project: {
          PaymentMode: {
            $cond: {
              if: { $in: ['$PaymentMode', ['E-PAYMENT', 'E-Payment']] },
              then: 'E-Payment',
              else: {
                $cond: {
                  if: { $in: ['$PaymentMode', ['Cash on Hand', 'Cash']] },
                  then: 'Cash',
                  else: '$PaymentMode'
                }
              }
            }
          },
          Total: 1
        }
      },
      {
        $group: {
          _id: '$PaymentMode',
          count: { $sum: 1 },
          revenue: { $sum: '$Total' }
        }
      },
      { $sort: { revenue: -1 } }
    ];

    const paymentMethods = await db.collection('Orders').aggregate(pipeline).toArray();
    await client.close();
    res.json(paymentMethods);
  } catch (err) {
    console.error('Error fetching payment methods:', err);
    res.status(500).json({ error: 'Failed to fetch payment methods data' });
  }
});

// Order Sources Distribution
router.get('/analytics/order-sources', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const pipeline = [
      {
        $match: {
          Source: { $exists: true, $ne: null, $ne: '' },
          PaymentStatus: { $ne: 'Cancelled' }
        }
      },
      {
        $group: {
          _id: '$Source',
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: '$Total' }
        }
      },
      { $sort: { orderCount: -1 } }
    ];

    const orderSources = await db.collection('Orders').aggregate(pipeline).toArray();
    await client.close();
    res.json(orderSources);
  } catch (err) {
    console.error('Error fetching order sources:', err);
    res.status(500).json({ error: 'Failed to fetch order sources data' });
  }
});

// Peak Hours Analysis
router.get('/analytics/peak-hours', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const pipeline = [
      {
        $match: {
          PaymentStatus: { $ne: 'Cancelled' }
        }
      },
      {
        $addFields: {
          orderHour: {
            $cond: {
              if: { $eq: [{ $type: '$Date' }, 'string'] },
              then: { $hour: { $dateFromString: { dateString: '$Date' } } },
              else: { $hour: '$Date' }
            }
          }
        }
      },
      {
        $group: {
          _id: '$orderHour',
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: '$Total' }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const peakHours = await db.collection('Orders').aggregate(pipeline).toArray();
    await client.close();
    res.json(peakHours);
  } catch (err) {
    console.error('Error fetching peak hours:', err);
    res.status(500).json({ error: 'Failed to fetch peak hours data' });
  }
});

// Average Order Value Trend
router.get('/analytics/avg-order-value', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const pipeline = [
      {
        $addFields: {
          orderDate: {
            $cond: {
              if: { $eq: [{ $type: '$Date' }, 'string'] },
              then: { $dateFromString: { dateString: '$Date' } },
              else: '$Date'
            }
          }
        }
      },
      {
        $match: {
          orderDate: { $gte: startDate, $lte: endDate },
          PaymentStatus: { $ne: 'Cancelled' }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$orderDate' } },
          totalRevenue: { $sum: '$Total' },
          orderCount: { $sum: 1 }
        }
      },
      {
        $addFields: {
          avgOrderValue: { $divide: ['$totalRevenue', '$orderCount'] }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const aovData = await db.collection('Orders').aggregate(pipeline).toArray();
    await client.close();
    res.json(aovData);
  } catch (err) {
    console.error('Error fetching AOV data:', err);
    res.status(500).json({ error: 'Failed to fetch average order value data' });
  }
});

// Add-ons Popularity
router.get('/analytics/addons-popularity', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const pipeline = [
      { $unwind: '$Cart' },
      {
        $match: {
          'Cart.AddOns': { $exists: true, $ne: [] },
          PaymentStatus: { $ne: 'Cancelled' }
        }
      },
      { $unwind: '$Cart.AddOns' },
      {
        $group: {
          _id: '$Cart.AddOns.Name',
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: '$Cart.AddOns.BasePrice' }
        }
      },
      { $sort: { orderCount: -1 } },
      { $limit: 10 }
    ];

    const addonsData = await db.collection('Orders').aggregate(pipeline).toArray();
    await client.close();
    res.json(addonsData);
  } catch (err) {
    console.error('Error fetching addons popularity:', err);
    res.status(500).json({ error: 'Failed to fetch addons popularity data' });
  }
});

// Add Discount/Promo Routes
router.get('/discounts/active', async (req, res) => {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const now = new Date();

    const activeDiscounts = await db.collection('Promos').find({
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true
    }).toArray();

    await client.close();
    res.json(activeDiscounts);
  } catch (err) {
    console.error('Error fetching active discounts:', err);
    res.status(500).json({ error: 'Failed to fetch active discounts' });
  }
});

router.get('/discounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const discount = await db.collection('Promos').findOne({ _id: new ObjectId(id) });

    await client.close();

    if (!discount) {
      return res.status(404).json({ error: 'Discount not found' });
    }

    res.json(discount);
  } catch (err) {
    console.error('Error fetching discount:', err);
    res.status(500).json({ error: 'Failed to fetch discount' });
  }
});

router.get('/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const productCollection = db.collection('Menu');
    const ingredientsCollection = db.collection('Ingredients');

    const product = await productCollection.findOne({ _id: new ObjectId(id) });
    if (!product) return res.status(404).send('Not found');

    let ingredientDetails = [];
    if (Array.isArray(product.Ingredients) && product.Ingredients.length > 0) {
      ingredientDetails = await ingredientsCollection
          .find({ IngredientID: { $in: product.Ingredients } })
          .toArray();
    }

    res.json({
      ...product,
      IngredientsDetails: ingredientDetails
    });

    client.close();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching product');
  }
});




// Product search for navbar
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q || '';

    if (!query || query.trim().length < 2) {
      return res.json([]);
    }

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    // Search for products that match the Name
    const results = await db.collection('Menu')
      .find({ Name: { $regex: query, $options: 'i' } })
      .project({ Name: 1, Category: 1, imagelink: 1, _id: 1 })
      .limit(10)
      .toArray();

    await client.close();
    res.json(results);
  } catch (err) {
    console.error('Error in product search:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Simple cache for user carts
const cartCache = new Map();
const CART_CACHE_DURATION = 30 * 1000; // 30 seconds

router.get('/cart', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const cacheKey = `cart_${userId}`;
    const now = Date.now();

    // Check cache
    if (cartCache.has(cacheKey)) {
      const { data, timestamp } = cartCache.get(cacheKey);
      if (now - timestamp < CART_CACHE_DURATION) {
        return res.json(data);
      } else {
        cartCache.delete(cacheKey);
      }
    }

    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const cartDoc = await db.collection('UserCart').findOne({
      userId: new ObjectId(userId)
    });
    await client.close();

    const cartData = cartDoc ? cartDoc.cart : [];
    // Cache the result
    cartCache.set(cacheKey, { data: cartData, timestamp: now });

    res.json(cartData);
  } catch (err) {
    console.error('Error getting cart:', err);
    res.status(500).json([]);
  }
});

router.post('/cart', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    await db.collection('UserCart').updateOne(
      { userId: new ObjectId(userId) },
      { $set: { cart: req.body || [] } },
      { upsert: true }
    );
    await client.close();
    // Invalidate cache
    cartCache.delete(`cart_${userId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving cart:', err);
    res.status(500).json({ success: false });
  }
});

router.delete('/cart', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const result = await db.collection('UserCart').deleteOne({
      userId: new ObjectId(userId)
    });
    await client.close();
    // Invalidate cache
    cartCache.delete(`cart_${userId}`);
    res.json({
      success: true,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error('Error deleting cart:', err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
