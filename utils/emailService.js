const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const path = require('path');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

const generateEmailTemplate = (order, customerName) => {
  const itemsHTML = order.Cart.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e8e8e8; text-align: left; font-size: 14px;">${item.ProductName || item.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e8e8e8; text-align: center; font-size: 14px;">${item.Quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e8e8e8; text-align: right; font-size: 14px;">₱${(item.Price || item.unitPrice).toFixed(2)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e8e8e8; text-align: right; font-size: 14px; font-weight: 600;">₱${(item.Subtotal || (item.Quantity * (item.Price || item.unitPrice))).toFixed(2)}</td>
    </tr>
  `).join('');

  const addOnsHTML = order.Cart.some(item => item.AddOns && item.AddOns.length > 0) ? `
    <div style="margin: 20px 0; background-color: #faf8f6; padding: 15px; border-radius: 5px; border-left: 4px solid #a05c2f;">
      <h3 style="margin: 0 0 12px 0; color: #8b4a26; font-size: 14px; font-weight: 600; text-transform: uppercase;">Add-ons</h3>
      ${order.Cart.flatMap(item => item.AddOns || []).map(addon => `
        <div style="padding: 8px 0; border-bottom: 1px solid #e8e8e8; display: flex; justify-content: space-between; font-size: 13px;">
          <span style="color: #372b2a;">${addon.Name || addon.name}</span>
          <span style="font-weight: 600; color: #8b4a26;">₱${addon.Price.toFixed(2)}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  const statusBadgeColor = order.FulfillmentStatus === 'Completed' ? '#a05c2f' : 
                           order.FulfillmentStatus === 'Preparing' ? '#d4894c' : 
                           order.FulfillmentStatus === 'Ready' ? '#8b4a26' : '#999';

  const fulfillmentMethod = order.FulfillmentMethod || order.fulfillmentMethod || 'Pickup';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          line-height: 1.6;
          color: #372b2a;
          max-width: 600px;
          margin: 0 auto;
          padding: 0;
          background-color: #f5f3f0;
        }
        .container {
          background-color: #ffffff;
          overflow: hidden;
          margin: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .header {
          background: linear-gradient(135deg, #a05c2f 0%, #8b4a26 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }
        .header-subtitle {
          margin: 8px 0 0 0;
          font-size: 14px;
          opacity: 0.95;
          font-weight: 300;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .content {
          padding: 40px;
        }
        .greeting {
          font-size: 16px;
          margin-bottom: 30px;
          color: #372b2a;
          line-height: 1.5;
        }
        .greeting strong {
          color: #a05c2f;
          font-weight: 600;
        }
        .order-meta {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
          padding-bottom: 30px;
          border-bottom: 2px solid #e8e8e8;
        }
        .meta-item {
          text-align: center;
        }
        .meta-label {
          color: #999;
          font-size: 11px;
          text-transform: uppercase;
          margin-bottom: 6px;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        .meta-value {
          font-size: 18px;
          font-weight: 700;
          color: #a05c2f;
        }
        .meta-value.date {
          font-size: 14px;
          color: #372b2a;
        }
        .status-badge {
          display: inline-block;
          background-color: ${statusBadgeColor};
          color: white;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .section-title {
          font-size: 14px;
          font-weight: 700;
          color: #8b4a26;
          margin: 30px 0 15px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        table {
          width: 100%;
          margin: 20px 0;
          border-collapse: collapse;
        }
        th {
          background-color: #faf8f6;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          color: #8b4a26;
          border-bottom: 2px solid #e8e8e8;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        th.text-right {
          text-align: right;
        }
        th.text-center {
          text-align: center;
        }
        .summary {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid #e8e8e8;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          margin: 12px 0;
          font-size: 14px;
          color: #372b2a;
        }
        .summary-row .label {
          color: #666;
        }
        .summary-row.subtotal {
          padding-bottom: 10px;
        }
        .summary-row.total {
          font-size: 20px;
          font-weight: 700;
          color: #a05c2f;
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #e8e8e8;
        }
        .fulfillment {
          margin: 30px 0;
          padding: 15px 20px;
          background-color: #faf8f6;
          border-left: 4px solid #a05c2f;
          border-radius: 4px;
        }
        .fulfillment-label {
          color: #8b4a26;
          font-size: 11px;
          text-transform: uppercase;
          margin-bottom: 6px;
          font-weight: 600;
        }
        .fulfillment-value {
          font-size: 16px;
          font-weight: 600;
          color: #372b2a;
        }
        .qr-section {
          text-align: center;
          margin: 35px 0;
          padding: 25px;
          background-color: #faf8f6;
          border-radius: 8px;
        }
        .qr-section img {
          width: 120px;
          height: 120px;
          border-radius: 8px;
          border: 2px solid #e8e8e8;
        }
        .qr-label {
          color: #8b4a26;
          font-size: 12px;
          margin-top: 12px;
          font-weight: 600;
        }
        .footer {
          background-color: #372b2a;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #e8e8e8;
          font-size: 12px;
          color: #ccc;
        }
        .footer-brand {
          margin: 0 0 15px 0;
          color: #a05c2f;
          font-size: 16px;
          font-weight: 700;
        }
        .footer p {
          margin: 8px 0;
          line-height: 1.4;
        }
        .footer-note {
          margin-top: 15px;
          color: #999;
          font-size: 11px;
        }
        @media (max-width: 480px) {
          .content {
            padding: 20px;
          }
          .header {
            padding: 25px 20px;
          }
          .header h1 {
            font-size: 24px;
          }
          .order-meta {
            grid-template-columns: 1fr;
            gap: 15px;
          }
          table {
            font-size: 13px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Blessings Café</h1>
          <p class="header-subtitle">Order Receipt</p>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hi <strong>${customerName}</strong>, thank you for your order!
          </div>
          
          <div class="order-meta">
            <div class="meta-item">
              <div class="meta-label">Order Number</div>
              <div class="meta-value">#${order.OrderID}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Date</div>
              <div class="meta-value date">${new Date(order.Date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Status</div>
              <div style="margin-top: 8px;"><span class="status-badge">${order.FulfillmentStatus}</span></div>
            </div>
          </div>

          <h2 class="section-title">Order Items</h2>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="text-center" style="width: 60px;">Qty</th>
                <th class="text-right" style="width: 80px;">Price</th>
                <th class="text-right" style="width: 80px;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>

          ${addOnsHTML}

          <div class="summary">
            <div class="summary-row subtotal">
              <span class="label">Subtotal</span>
              <span>₱${(order.Total || 0).toFixed(2)}</span>
            </div>
            <div class="summary-row total">
              <span>Total Amount</span>
              <span>₱${order.Total.toFixed(2)}</span>
            </div>
          </div>

          <div class="fulfillment">
            <div class="fulfillment-label">Fulfillment Method</div>
            <div class="fulfillment-value">${fulfillmentMethod === 'Delivery' ? 'Delivery' : 'Pickup'}</div>
          </div>

          <div class="qr-section">
            <img src="cid:qrcode" alt="Order QR Code">
            <div class="qr-label">Scan QR to track your order</div>
          </div>
        </div>

        <div class="footer">
          <div class="footer-brand">Blessings Café</div>
          <p>We appreciate your order! Your satisfaction is our priority.</p>
          <p style="margin-top: 20px; border-top: 1px solid #555; padding-top: 15px;">For inquiries or feedback, please contact us through the website.</p>
          <p class="footer-note">This is an automated message. Please do not reply directly.</p>
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
    console.log(`[EMAILSVC] Starting email send. Email: ${customerEmail}, Order: ${order.OrderID}, Customer: ${customerName}`);
    
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASSWORD) {
      console.error('[EMAILSVC] Gmail credentials not configured in environment variables');
      console.error(`[EMAILSVC] GMAIL_USER: ${process.env.GMAIL_USER ? 'SET' : 'NOT SET'}`);
      console.error(`[EMAILSVC] GMAIL_PASSWORD: ${process.env.GMAIL_PASSWORD ? 'SET' : 'NOT SET'}`);
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    console.log(`[EMAILSVC] Generating QR code for order ${order.OrderID}`);
    const qrCodeBuffer = await generateQRCode(order.OrderID);
    console.log(`[EMAILSVC] QR code generated successfully`);
    
    console.log(`[EMAILSVC] Generating email template`);
    const emailHTML = generateEmailTemplate(order, customerName);
    console.log(`[EMAILSVC] Email template generated (length: ${emailHTML.length})`);

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

    console.log(`[EMAILSVC] Attempting to send email...`);
    const result = await transporter.sendMail(mailOptions);
    
    console.log(`✅ [EMAILSVC] Email sent successfully! MessageID: ${result.messageId}`);
    console.log(`✅ Order receipt sent to ${customerEmail} for order ${order.OrderID}`);
    
    return {
      success: true,
      messageId: result.messageId
    };
  } catch (error) {
    console.error(`❌ [EMAILSVC] Error sending order receipt to ${customerEmail}:`, error);
    console.error(`❌ [EMAILSVC] Error details:`, {
      message: error.message,
      code: error.code,
      command: error.command
    });
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
