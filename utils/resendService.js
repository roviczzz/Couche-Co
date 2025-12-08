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
          border-radius: 5px;
          border-left: 4px solid #a05c2f;
        }
        .fulfillment-label {
          color: #999;
          font-size: 11px;
          text-transform: uppercase;
          margin-bottom: 6px;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        .fulfillment-value {
          color: #372b2a;
          font-size: 16px;
          font-weight: 600;
        }
        .qr-code {
          margin: 30px 0;
          text-align: center;
        }
        .qr-code img {
          width: 200px;
          height: 200px;
          border: 2px solid #a05c2f;
          border-radius: 8px;
          padding: 10px;
          background: white;
        }
        .footer {
          background-color: #faf8f6;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #999;
          border-top: 1px solid #e8e8e8;
          margin-top: 30px;
        }
        .footer a {
          color: #a05c2f;
          text-decoration: none;
        }
        .footer a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Confirmation</h1>
          <div class="header-subtitle">Thank You for Your Order</div>
        </div>
        <div class="content">
          <div class="greeting">
            Thank you <strong>${customerName}</strong> for your order! Your receipt is below.
          </div>
          <div class="order-meta">
            <div class="meta-item">
              <div class="meta-label">Order ID</div>
              <div class="meta-value">#${order.OrderID}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Status</div>
              <div style="margin-top: 6px;"><span class="status-badge">${order.FulfillmentStatus}</span></div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Order Date</div>
              <div class="meta-value date">${new Date(order.CreatedAt).toLocaleDateString()}</div>
            </div>
          </div>
          <div class="section-title">Order Items</div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="text-center">Qty</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>
          ${addOnsHTML}
          <div class="fulfillment">
            <div class="fulfillment-label">Fulfillment Method</div>
            <div class="fulfillment-value">${fulfillmentMethod}</div>
          </div>
          <div class="summary">
            <div class="summary-row subtotal">
              <span class="label">Subtotal:</span>
              <span>₱${(order.Subtotal || order.Cart.reduce((sum, item) => sum + (item.Subtotal || item.Quantity * (item.Price || item.unitPrice)), 0)).toFixed(2)}</span>
            </div>
            ${order.DiscountAmount ? `<div class="summary-row"><span class="label">Discount:</span><span>-₱${order.DiscountAmount.toFixed(2)}</span></div>` : ''}
            <div class="summary-row">
              <span class="label">Delivery:</span>
              <span>₱${(order.DeliveryFee || 0).toFixed(2)}</span>
            </div>
            <div class="summary-row total">
              <span>Total</span>
              <span>₱${(order.TotalPrice || order.Total).toFixed(2)}</span>
            </div>
          </div>
          <div class="qr-code">
            <div class="section-title" style="text-align: center; margin: 20px 0 15px 0;">Order QR Code</div>
            <img src="cid:qrcode" alt="Order QR Code">
            <div style="margin-top: 10px; font-size: 12px; color: #999;">Scan to track your order</div>
          </div>
        </div>
        <div class="footer">
          <p style="margin: 0 0 10px 0;">
            Questions? Contact us at <a href="mailto:support@blessingsateverysip.me">support@blessingsateverysip.me</a>
          </p>
          <p style="margin: 0;">
            © ${new Date().getFullYear()} Blessings Café. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const generateQRCode = async (orderId) => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
  const qrCodeUrl = `${baseUrl}/order/success?orderId=${orderId}`;
  const qrImage = await QRCode.toDataURL(qrCodeUrl, {
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
    console.log(`[RESEND] Starting email send. Email: ${customerEmail}, Order: ${order.OrderID}, Customer: ${customerName}`);
    
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASSWORD) {
      console.error('[RESEND] Gmail credentials not configured in environment variables');
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    console.log(`[RESEND] Generating QR code for order ${order.OrderID}`);
    const qrCodeDataUrl = await generateQRCode(order.OrderID);
    console.log(`[RESEND] QR code generated successfully`);
    
    console.log(`[RESEND] Generating email template`);
    const emailHTML = generateEmailTemplate(order, customerName);
    console.log(`[RESEND] Email template generated (length: ${emailHTML.length})`);

    console.log(`[RESEND] Attempting to send email via Gmail SMTP...`);
    
    const logoPath = path.join(__dirname, '../public/resources/Blessings-Logo.png');
    
    const response = await transporter.sendMail({
      from: `Blessings Café <${process.env.GMAIL_USER}>`,
      to: customerEmail,
      subject: `Order Receipt #${order.OrderID} - Blessings Café`,
      html: emailHTML,
      attachments: [
        {
          filename: 'qrcode.png',
          content: qrCodeDataUrl.split(',')[1],
          encoding: 'base64',
          cid: 'qrcode'
        },
        {
          filename: 'logo.png',
          path: logoPath,
          cid: 'logo'
        }
      ]
    });

    console.log(`✅ [RESEND] Email sent successfully! MessageID: ${response.messageId}`);
    console.log(`✅ Order receipt sent to ${customerEmail} for order ${order.OrderID}`);
    
    return {
      success: true,
      messageId: response.messageId
    };
  } catch (error) {
    console.error(`❌ [RESEND] Error sending order receipt to ${customerEmail}:`, error);
    console.error(`❌ [RESEND] Error details:`, {
      message: error.message,
      stack: error.stack
    });
    return {
      success: false,
      error: error.message
    };
  }
};

const verifyEmailConnection = async () => {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASSWORD) {
      console.error('Gmail credentials not configured');
      return false;
    }
    await transporter.verify();
    console.log('✅ Email service (Gmail SMTP) configured and verified successfully');
    return true;
  } catch (error) {
    console.error('❌ Email service verification failed:', error.message);
    return false;
  }
};

module.exports = {
  sendOrderReceipt,
  generateEmailTemplate,
  generateQRCode,
  verifyEmailConnection
};
