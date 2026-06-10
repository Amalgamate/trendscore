import nodemailer from 'nodemailer';
import {
  PRODUCT_DISPLAY_NAME,
  PRODUCT_LOGO_URL,
  PRODUCT_SUPPORT_EMAIL,
} from '../config/productIdentity';

export interface WelcomeEmailData {
  to: string;
  schoolName: string;
  adminName: string;
  tempPassword: string;
  loginUrl: string;
}

export interface PasswordResetEmailData {
  to: string;
  userName: string;
  schoolName: string;
  resetLink: string;
}

export class EmailService {
  private static transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  static async sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
    const { to, schoolName, adminName, tempPassword, loginUrl } = data;

    const brandColor = '#1e3a8a'; // Industry standard blue

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { width: 80px; height: 80px; margin-bottom: 10px; }
          .content { background: #f9fafb; padding: 25px; border-radius: 8px; }
          .button { display: inline-block; padding: 12px 24px; background-color: ${brandColor}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
          .footer { margin-top: 30px; font-size: 0.875rem; color: #6b7280; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${PRODUCT_LOGO_URL}" alt="${PRODUCT_DISPLAY_NAME} Logo" class="logo">
            <h1 style="color: ${brandColor};">Welcome to ${PRODUCT_DISPLAY_NAME}!</h1>
          </div>
          <div class="content">
            <p>Dear <strong>${adminName}</strong>,</p>
            <p>Congratulations! Your school, <strong>${schoolName}</strong>, has been successfully registered on ${PRODUCT_DISPLAY_NAME}.</p>
            <p>We are excited to help you streamline your school management, from CBC assessments to real-time reporting.</p>
            <p>You can now log in to your dashboard with the temporary password below:</p>
            <div style="background: #ffffff; padding: 15px; border: 1px dashed ${brandColor}; border-radius: 6px; text-align: center; margin: 20px 0;">
              <span style="font-size: 1.2rem; font-family: monospace; font-weight: bold; color: ${brandColor};">${tempPassword}</span>
            </div>
            <p style="font-size: 0.875rem; color: #ef4444; text-align: center;"><strong>Note:</strong> Please change your password after your first login.</p>
            <div style="text-align: center;">
              <a href="${loginUrl}" class="button">Log In to Dashboard</a>
            </div>
            <p style="margin-top: 20px;">If the button above doesn't work, copy and paste this link into your browser:<br>
            <a href="${loginUrl}">${loginUrl}</a></p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${PRODUCT_DISPLAY_NAME}. All rights reserved.</p>
            <p>You received this email because you signed up for a ${PRODUCT_DISPLAY_NAME} account.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"${schoolName} via ${PRODUCT_DISPLAY_NAME}" <${process.env.SMTP_FROM || process.env.SMTP_USER || PRODUCT_SUPPORT_EMAIL}>`,
        to,
        subject: `Welcome to ${schoolName} on ${PRODUCT_DISPLAY_NAME}!`,
        html,
      });
      console.log(`📧 Welcome email sent to ${to}`);
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      // We don't throw here to avoid breaking the registration flow
    }
  }

  static async sendPasswordReset(data: PasswordResetEmailData): Promise<void> {
    const { to, userName, schoolName, resetLink } = data;

    const brandColor = '#1e3a8a';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { width: 80px; height: 80px; margin-bottom: 10px; }
          .content { background: #f9fafb; padding: 25px; border-radius: 8px; }
          .button { display: inline-block; padding: 12px 24px; background-color: ${brandColor}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
          .footer { margin-top: 30px; font-size: 0.875rem; color: #6b7280; text-align: center; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${PRODUCT_LOGO_URL}" alt="${PRODUCT_DISPLAY_NAME} Logo" class="logo">
            <h1 style="color: ${brandColor};">Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${userName}</strong>,</p>
            <p>We received a request to reset your password for your ${PRODUCT_DISPLAY_NAME} account at <strong>${schoolName}</strong>.</p>
            <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </div>
            <p style="margin-top: 20px;">If the button above doesn't work, copy and paste this link into your browser:<br>
            <a href="${resetLink}">${resetLink}</a></p>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Never share your password with anyone</li>
                <li>This link expires in 1 hour for your security</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${PRODUCT_DISPLAY_NAME}. All rights reserved.</p>
            <p>This is an automated security email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"${schoolName} via ${PRODUCT_DISPLAY_NAME}" <${process.env.SMTP_FROM || process.env.SMTP_USER || PRODUCT_SUPPORT_EMAIL}>`,
        to,
        subject: `Password Reset Request - ${schoolName}`,
        html,
      });
      console.log(`📧 Password reset email sent to ${to}`);
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      throw error; // We throw here because password reset is critical
    }
  }

  static async sendNotificationEmail(data: { to: string; subject: string; html: string; text?: string }): Promise<void> {
    const { to, subject, html, text } = data;
    if (!to) {
      console.warn('EmailService.sendNotificationEmail skipped: missing recipient');
      return;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
        html,
      });
      console.log(`📧 Notification email sent to ${to}`);
    } catch (error) {
      console.error('❌ Failed to send notification email:', error);
    }
  }

  static async sendFeeInvoiceEmail(data: {
    to: string;
    schoolName: string;
    parentName: string;
    learnerName: string;
    invoiceNumber: string;
    term: string;
    amount: number;
    dueDate: string;
    feeItems: { name: string; amount: number }[];
  }): Promise<void> {
    const { to, schoolName, parentName, learnerName, invoiceNumber, term, amount, dueDate, feeItems } = data;
    const brandColor = '#1e3a8a';

    // Generate table rows for fee items
    const feeRows = feeItems.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">KES ${item.amount.toLocaleString()}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { width: 80px; height: 80px; margin-bottom: 10px; }
          .content { background: #f9fafb; padding: 25px; border-radius: 8px; }
          .amount-box { background: ${brandColor}; color: white; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
          .footer { margin-top: 30px; font-size: 0.875rem; color: #6b7280; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: ${brandColor};">${schoolName}</h1>
            <h3>New Fee Invoice Generated</h3>
          </div>
          <div class="content">
            <p>Dear <strong>${parentName}</strong>,</p>
            <p>A new fee invoice has been generated for <strong>${learnerName}</strong> for <strong>${term}</strong>.</p>
            
            <div class="amount-box">
              <div style="font-size: 0.9rem; opacity: 0.9;">Total Amount Due</div>
              <div style="font-size: 2rem; font-weight: bold;">KES ${amount.toLocaleString()}</div>
              <div style="font-size: 0.9rem; margin-top: 5px;">Due Date: ${dueDate}</div>
            </div>

            <h4>Invoice Details (${invoiceNumber})</h4>
            <table>
              ${feeRows}
              <tr>
                <td style="padding: 8px; border-top: 2px solid #ddd; font-weight: bold;">Total</td>
                <td style="padding: 8px; border-top: 2px solid #ddd; text-align: right; font-weight: bold;">KES ${amount.toLocaleString()}</td>
              </tr>
            </table>

            <p style="margin-top: 20px;">Please ensure payment is made by the due date to avoid disruption of services.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${schoolName}. All rights reserved.</p>
            <p>This is an automated notification.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"${schoolName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject: `New Invoice: ${learnerName} - ${term}`,
        html,
      });
      console.log(`📧 Fee invoice email sent to ${to}`);
    } catch (error) {
      console.error('❌ Failed to send fee invoice email:', error);
    }
  }

  static async sendFeeStatementEmail(data: {
    to: string;
    schoolName: string;
    parentName: string;
    learnerName: string;
    pdfBuffer: Buffer;
  }): Promise<void> {
    const { to, schoolName, parentName, learnerName, pdfBuffer } = data;
    const brandColor = '#1e3a8a';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; }
          .header { text-align: center; margin-bottom: 30px; }
          .content { background: #f9fafb; padding: 25px; border-radius: 8px; }
          .footer { margin-top: 30px; font-size: 0.875rem; color: #6b7280; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: ${brandColor};">${schoolName}</h1>
            <h3>Fee Statement</h3>
          </div>
          <div class="content">
            <p>Dear <strong>${parentName}</strong>,</p>
            <p>Please find attached the latest fee statement for <strong>${learnerName}</strong>.</p>
            <p>If you have any questions regarding this statement, please contact the school administration.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${schoolName}. All rights reserved.</p>
            <p>This is an automated notification.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"${schoolName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject: `Fee Statement: ${learnerName}`,
        html,
        attachments: [
          {
            filename: `Statement-${learnerName.replace(/\s+/g, '-')}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      });
      console.log(`📧 Fee statement email sent to ${to}`);
    } catch (error) {
      console.error('❌ Failed to send fee statement email:', error);
      throw error;
    }
  }
}
