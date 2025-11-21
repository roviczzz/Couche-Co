const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const path = require('path');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD
  }
});

const generateEmailTemplate = (order, customerName) => {
  const itemsHTML = order.Cart.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: left;">${item.ProductName || item.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.Quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">₱${(item.Price || item.unitPrice).toFixed(2)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">₱${(item.Subtotal || (item.Quantity * (item.Price || item.unitPrice))).toFixed(2)}</td>
    </tr>
  `).join('');

  const addOnsHTML = order.Cart.some(item => item.AddOns && item.AddOns.length > 0) ? `
    <div style="margin: 20px 0; background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
      <h3 style="margin: 0 0 10px 0; color: #333;">Add-ons</h3>
      ${order.Cart.flatMap(item => item.AddOns || []).map(addon => `
        <div style="padding: 8px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
          <span>${addon.Name || addon.name}</span>
          <span style="font-weight: bold;">₱${addon.Price.toFixed(2)}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  const statusBadgeColor = order.FulfillmentStatus === 'Completed' ? '#4CAF50' : 
                           order.FulfillmentStatus === 'Preparing' ? '#FF9800' : 
                           order.FulfillmentStatus === 'Ready' ? '#2196F3' : '#999';

  const fulfillmentMethod = order.FulfillmentMethod || order.fulfillmentMethod || 'Pickup';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 28px;
        }
        .header p {
          margin: 0;
          opacity: 0.9;
        }
        .content {
          padding: 30px;
        }
        .greeting {
          font-size: 18px;
          margin-bottom: 20px;
          color: #333;
        }
        .order-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 2px solid #eee;
        }
        .meta-item {
          flex: 1;
        }
        .meta-label {
          color: #999;
          font-size: 12px;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .meta-value {
          font-size: 16px;
          font-weight: bold;
          color: #333;
        }
        .status-badge {
          display: inline-block;
          background-color: ${statusBadgeColor};
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
        }
        table {
          width: 100%;
          margin: 20px 0;
          border-collapse: collapse;
        }
        th {
          background-color: #f5f5f5;
          padding: 12px;
          text-align: left;
          font-weight: bold;
          color: #666;
          border-bottom: 2px solid #ddd;
        }
        .summary {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 2px solid #eee;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          margin: 10px 0;
          font-size: 14px;
        }
        .summary-row.total {
          font-size: 18px;
          font-weight: bold;
          color: #667eea;
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #eee;
        }
        .fulfillment {
          margin: 20px 0;
          padding: 15px;
          background-color: #f0f7ff;
          border-left: 4px solid #2196F3;
          border-radius: 4px;
        }
        .fulfillment-label {
          color: #666;
          font-size: 12px;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .fulfillment-value {
          font-size: 16px;
          font-weight: bold;
          color: #333;
        }
        .qr-section {
          text-align: center;
          margin: 30px 0;
          padding: 20px;
          background-color: #f9f9f9;
          border-radius: 8px;
        }
        .qr-section p {
          color: #999;
          font-size: 12px;
          margin-top: 10px;
        }
        .footer {
          background-color: #f5f5f5;
          padding: 20px;
          text-align: center;
          border-top: 1px solid #eee;
          font-size: 12px;
          color: #666;
        }
        .footer h4 {
          margin: 0 0 10px 0;
          color: #333;
        }
        .footer p {
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Blessings Café</h1>
          <p>Order Receipt</p>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hi <strong>${customerName}</strong>, thank you for your order!
          </div>
          
          <div class="order-meta">
            <div class="meta-item">
              <div class="meta-label">Order ID</div>
              <div class="meta-value">#${order.OrderID}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Date</div>
              <div class="meta-value">${new Date(order.Date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Status</div>
              <div><span class="status-badge">${order.FulfillmentStatus}</span></div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>

          ${addOnsHTML}

          <div class="summary">
            <div class="summary-row total">
              <span>Total Amount:</span>
              <span>₱${order.Total.toFixed(2)}</span>
            </div>
          </div>

          <div class="fulfillment">
            <div class="fulfillment-label">Fulfillment Method</div>
            <div class="fulfillment-value">${fulfillmentMethod === 'Delivery' ? '🚚 Delivery' : '🏪 Pickup'}</div>
          </div>

          <div class="qr-section">
            <img src="cid:qrcode" alt="Order QR Code" style="width: 150px; height: 150px; border-radius: 8px;">
            <p>Scan to view order details</p>
          </div>
        </div>

        <div class="footer">
          <h4>Blessings Café</h4>
          <p>Thank you for your order!</p>
          <p style="margin-top: 15px; color: #999;">This is an automated email. Please do not reply directly to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const generateQRCode = async (orderId) => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
  const qrCodeUrl = `${baseUrl}/order/success?orderId=${orderId}`;
  const qrImage = await QRCode.toBuffer(qrCodeUrl, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    quality: 0.92,
    margin: 1,
    width: 300
  });
  return qrImage;
};

const sendOrderReceipt = async (order, customerEmail, customerName) => {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASSWORD) {
      console.error('Gmail credentials not configured in environment variables');
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    const qrCodeBuffer = await generateQRCode(order.OrderID);
    const emailHTML = generateEmailTemplate(order, customerName);

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: customerEmail,
      subject: `Order Receipt #${order.OrderID} - Blessings Café`,
      html: emailHTML,
      attachments: [
        {
          filename: 'qrcode.png',
          content: qrCodeBuffer,
          cid: 'qrcode'
        }
      ]
    };

    const result = await transporter.sendMail(mailOptions);
    
    console.log(`Order receipt sent to ${customerEmail} for order ${order.OrderID}`);
    
    return {
      success: true,
      messageId: result.messageId
    };
  } catch (error) {
    console.error(`Error sending order receipt to ${customerEmail}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('Email service connected successfully');
    return true;
  } catch (error) {
    console.error('Email service connection failed:', error);
    return false;
  }
};

module.exports = {
  sendOrderReceipt,
  generateEmailTemplate,
  generateQRCode,
  verifyEmailConnection,
  transporter
};
