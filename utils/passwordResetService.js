const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendPasswordResetEmail = async (userEmail, userName, resetUrl, isAdmin = false) => {
  try {
    console.log(`[RESETMAIL] Sending password reset email to ${userEmail}`);
    
    if (!process.env.RESEND_API_KEY) {
      console.error('[RESETMAIL] Resend API key not configured');
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    if (!process.env.RESEND_FROM_EMAIL) {
      console.error('[RESETMAIL] Resend from email not configured');
      return {
        success: false,
        error: 'Email service not properly configured'
      };
    }

    const userType = isAdmin ? 'admin' : 'user';
    const accountType = isAdmin ? 'Blessings Cafe Admin' : 'Blessings Cafe';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f3f0; padding: 20px;">
        <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <div style="text-align: center; margin: -40px -40px 20px -40px; padding-top: 20px;">
            <img src="cid:logo" alt="Blessings Café" style="width: 120px; height: auto; margin-bottom: -10px;" />
          </div>
          <div style="background: linear-gradient(135deg, #a05c2f 0%, #8b4a26 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; margin: 0 -40px 30px -40px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Password Reset</h1>
            <p style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.95; text-transform: uppercase; letter-spacing: 1px;">Secure Your Account</p>
          </div>

          <h2 style="color: #372b2a; font-size: 18px; margin-top: 0; margin-bottom: 20px;">Password Reset Request</h2>
          
          <p style="color: #372b2a; font-size: 14px; line-height: 1.6; margin-bottom: 15px;">Hello <strong>${userName || 'User'}</strong>,</p>
          
          <p style="color: #372b2a; font-size: 14px; line-height: 1.6; margin-bottom: 15px;">You requested a password reset for your ${accountType} account. Click the button below to reset your password.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #a05c2f 0%, #8b4a26 100%); color: white; padding: 12px 40px; text-decoration: none; border-radius: 5px; font-weight: 600; display: inline-block; font-size: 14px;">Reset Password</a>
          </div>

          <p style="color: #666; font-size: 13px; line-height: 1.6; background-color: #faf8f6; padding: 15px; border-left: 4px solid #a05c2f; border-radius: 4px; margin: 20px 0;">
            <strong>Link expires in:</strong> 1 hour<br>
            If you didn't request this reset, you can safely ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #e8e8e8; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            © ${new Date().getFullYear()} Blessings Café. All rights reserved.<br>
            Questions? Contact us at <a href="mailto:blessingscafe1@gmail.com" style="color: #a05c2f; text-decoration: none;">support@blessingsateverysip.me</a>
          </p>
        </div>
      </div>
    `;

    const logoPath = path.join(__dirname, '../public/resources/Blessings-Logo.png');
    const logoBase64 = fs.readFileSync(logoPath).toString('base64');
    
    const response = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: userEmail,
      subject: `Password Reset - ${accountType}`,
      html: html,
      attachments: [
        {
          filename: 'logo.png',
          content: logoBase64
        }
      ]
    });

    if (response.error) {
      console.error(`❌ [RESETMAIL] Resend error:`, response.error);
      return {
        success: false,
        error: response.error.message || 'Failed to send email'
      };
    }

    console.log(`✅ [RESETMAIL] Password reset email sent to ${userEmail} (MessageID: ${response.data.id})`);
    return {
      success: true,
      messageId: response.data.id
    };
  } catch (error) {
    console.error(`❌ [RESETMAIL] Error sending password reset email:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  sendPasswordResetEmail
};
