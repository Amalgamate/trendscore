import { Resend } from 'resend';
import prisma from '../config/database';
import { decrypt } from '../utils/encryption.util';
import { render } from '@react-email/render';
import * as React from 'react';
import { COMMUNICATION_CONFIG } from '../config/communication.messages';
import { PRODUCT_DISPLAY_NAME, PRODUCT_SUPPORT_EMAIL } from '../config/productIdentity';

// Templates
import WelcomeEmail from '../templates/emails/WelcomeEmail';
import OnboardingEmail from '../templates/emails/OnboardingEmail';
import PasswordResetEmail from '../templates/emails/PasswordResetEmail';
import TicketCreatedEmail from '../templates/emails/TicketCreatedEmail';

export interface WelcomeEmailData {
  to: string;
  schoolName: string;
  adminName: string;
  loginUrl: string;
  tempPassword?: string;
}

export interface OnboardingEmailData {
  to: string;
  schoolName: string;
  adminName: string;
  loginUrl: string;
  emailTemplates?: any;
}

export interface PasswordResetEmailData {
  to: string;
  userName: string;
  schoolName: string;
  resetLink: string;
}

export interface TicketCreatedEmailData {
  schoolName: string;
  userName: string;
  ticketSubject: string;
  ticketPriority: string;
  ticketMessage: string;
  ticketId: string;
}

export interface GenericEmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface GenericEmailData {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  attachments?: GenericEmailAttachment[];
  templateKey?: string;
  variables?: Record<string, string | number | null | undefined>;
}

export class EmailService {
  private static defaultFrom = COMMUNICATION_CONFIG.email.fromEmail;

  private static getResendClient(apiKey?: string) {
    const key = apiKey || process.env.RESEND_API_KEY;
    if (!key) return null;
    return new Resend(key);
  }

  private static async getGlobalConfig() {
    try {
      const config = await prisma.communicationConfig.findFirst();

      if (config && config.emailEnabled && config.emailApiKey) {
        return {
          apiKey: decrypt(config.emailApiKey),
          from: config.emailFrom || this.defaultFrom,
          fromName: config.emailFromName || PRODUCT_DISPLAY_NAME,
          emailTemplates: config.emailTemplates as any
        };
      }
    } catch (error) {
      console.error('Error fetching email config:', error);
    }
    return null;
  }

  private static replaceTemplateVariables(value: string, variables: Record<string, string | number | null | undefined>) {
    return value.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
      const replacement = variables[key];
      return replacement === null || replacement === undefined ? '' : String(replacement);
    });
  }

  private static renderConfiguredTemplate(
    templates: any,
    templateKey: string | undefined,
    fallbackSubject: string,
    fallbackHtml: string,
    variables: Record<string, string | number | null | undefined> = {}
  ) {
    if (!templateKey || !templates?.[templateKey]) {
      return { subject: fallbackSubject, html: fallbackHtml };
    }

    const template = templates[templateKey];
    const mergedVariables = {
      subject: fallbackSubject,
      messageBody: fallbackHtml,
      ...variables
    };
    const heading = template.heading
      ? this.replaceTemplateVariables(String(template.heading), mergedVariables)
      : fallbackSubject;
    const body = template.body
      ? this.replaceTemplateVariables(String(template.body), mergedVariables)
      : fallbackHtml;

    return {
      subject: fallbackSubject,
      html: `
        <div>
          <h2>${heading}</h2>
          ${body}
        </div>
      `
    };
  }

  private static inferNotificationTemplateKey(subject: string) {
    const normalized = subject.toLowerCase();
    if (normalized.includes('parent portal')) return 'parentPortal';
    if (normalized.includes('scheme of work')) return 'schemeReview';
    if (normalized.includes('new fee waiver')) return 'feeWaiverRequest';
    if (normalized.includes('fee waiver approved')) return 'feeWaiverApproved';
    if (normalized.includes('fee waiver declined')) return 'feeWaiverDeclined';
    return 'generic';
  }

  private static async getDeliveryContext() {
    const config = await this.getGlobalConfig();
    const client = this.getResendClient(config?.apiKey);

    if (!client) {
      return null;
    }

    return {
      client,
      fromEmail: config?.from || this.defaultFrom,
      fromName: config?.fromName || PRODUCT_DISPLAY_NAME,
      emailTemplates: config?.emailTemplates || {}
    };
  }

  static async sendEmail(data: GenericEmailData): Promise<{ id?: string }> {
    const context = await this.getDeliveryContext();
    const recipients = Array.isArray(data.to) ? data.to : [data.to];

    if (!context) {
      throw new Error('No Resend API key configured');
    }

    if (recipients.length === 0 || recipients.some((recipient) => !recipient)) {
      throw new Error('Email recipient is required');
    }

    const fromName = data.fromName || context.fromName;
    const rendered = this.renderConfiguredTemplate(
      context.emailTemplates,
      data.templateKey,
      data.subject,
      data.html,
      data.variables
    );
    const response = await context.client.emails.send({
      from: fromName ? `${fromName} <${context.fromEmail}>` : context.fromEmail,
      to: recipients,
      subject: rendered.subject,
      html: rendered.html,
      text: data.text,
      attachments: data.attachments as any
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return { id: response.data?.id };
  }

  static async sendNotificationEmail(data: { to: string; subject: string; html: string; text?: string; templateKey?: string; variables?: Record<string, string | number | null | undefined> }): Promise<void> {
    if (!data.to) {
      console.warn('EmailService.sendNotificationEmail skipped: missing recipient');
      return;
    }

    try {
      const response = await this.sendEmail({
        ...data,
        templateKey: data.templateKey || this.inferNotificationTemplateKey(data.subject),
        variables: {
          messageText: data.text || data.html.replace(/<[^>]*>/g, ' '),
          ...data.variables
        }
      });
      console.log(`📧 Notification email sent to ${data.to} (ID: ${response.id})`);
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
      const response = await this.sendEmail({
        to,
        subject: `New Invoice: ${learnerName} - ${term}`,
        html,
        fromName: schoolName,
        templateKey: 'feeInvoice',
        variables: {
          schoolName,
          parentName,
          learnerName,
          invoiceNumber,
          term,
          amount: amount.toLocaleString(),
          dueDate,
          feeItems: feeRows
        }
      });
      console.log(`📧 Fee invoice email sent to ${to} (ID: ${response.id})`);
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

    const response = await this.sendEmail({
      to,
      subject: `Fee Statement: ${learnerName}`,
      html,
      fromName: schoolName,
      templateKey: 'feeStatement',
      variables: {
        schoolName,
        parentName,
        learnerName
      },
      attachments: [
        {
          filename: `Statement-${learnerName.replace(/\s+/g, '-')}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    console.log(`📧 Fee statement email sent to ${to} (ID: ${response.id})`);
  }

  static async sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
    const { to, schoolName, adminName, loginUrl } = data;

    const config = await this.getGlobalConfig();
    const client = this.getResendClient(config?.apiKey);
    const fromEmail = config?.from || this.defaultFrom;
    const fromName = config?.fromName || PRODUCT_DISPLAY_NAME;

    if (!client) {
      console.warn(`⚠️ Skipped Welcome Email to ${to}: No Resend API Key configured.`);
      return;
    }

    try {
      const html = await render(
        React.createElement(WelcomeEmail, {
          schoolName,
          adminName,
          loginUrl,
          tempPassword: data.tempPassword,
          customHeading: config?.emailTemplates?.welcome?.heading,
          customBody: config?.emailTemplates?.welcome?.body
        })
      );

      const response = await client.emails.send({
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        to: [to],
        subject: `Welcome to ${schoolName} on ${PRODUCT_DISPLAY_NAME}!`,
        html,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(`📧 Welcome email sent to ${to} (ID: ${response.data?.id})`);
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
    }
  }

  static async sendOnboardingEmail(data: OnboardingEmailData): Promise<void> {
    const { to, schoolName, adminName, loginUrl } = data;

    const config = await this.getGlobalConfig();
    const client = this.getResendClient(config?.apiKey);
    const fromEmail = config?.from || this.defaultFrom;
    const fromName = config?.fromName || PRODUCT_DISPLAY_NAME;

    if (!client) {
      console.warn(`⚠️ Skipped Onboarding Email to ${to}: No Resend API Key configured.`);
      return;
    }

    try {
      const html = await render(
        React.createElement(OnboardingEmail, {
          schoolName,
          adminName,
          loginUrl,
          email: to,
          customHeading: config?.emailTemplates?.onboarding?.heading,
          customBody: config?.emailTemplates?.onboarding?.body
        })
      );

      const response = await client.emails.send({
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        to: [to],
        subject: `Your Guide to Setting Up ${schoolName}`,
        html,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(`📧 Onboarding email sent to ${to} (ID: ${response.data?.id})`);
    } catch (error) {
      console.error('❌ Failed to send onboarding email:', error);
    }
  }

  static async sendPasswordReset(data: PasswordResetEmailData): Promise<void> {
    const { to, userName, schoolName, resetLink } = data;

    const config = await this.getGlobalConfig();
    const client = this.getResendClient(config?.apiKey);
    const fromEmail = config?.from || this.defaultFrom;
    const fromName = config?.fromName || PRODUCT_DISPLAY_NAME;

    if (!client) {
      console.warn(`⚠️ Skipped Password Reset Email to ${to}: No Resend API Key configured.`);
      return;
    }

    try {
      const html = await render(
        React.createElement(PasswordResetEmail, {
          schoolName,
          userName,
          resetLink
        })
      );

      const response = await client.emails.send({
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        to: [to],
        subject: `Password Reset Request - ${schoolName}`,
        html,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(`📧 Password reset email sent to ${to} (ID: ${response.data?.id})`);
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      throw error;
    }
  }

  static async sendTicketCreated(data: TicketCreatedEmailData): Promise<void> {
    const client = this.getResendClient();
    const fromEmail = this.defaultFrom;
    const toEmail = process.env.SUPPORT_EMAIL || PRODUCT_SUPPORT_EMAIL;

    if (!client) {
      console.warn(`⚠️ Skipped Ticket Notification: No Resend API Key configured.`);
      return;
    }

    try {
      const html = await render(
        React.createElement(TicketCreatedEmail, {
          schoolName: data.schoolName,
          userName: data.userName,
          ticketSubject: data.ticketSubject,
          ticketPriority: data.ticketPriority,
          ticketMessage: data.ticketMessage,
          ticketLink: `${process.env.FRONTEND_URL}/superadmin/support?id=${data.ticketId}`
        })
      );

      const response = await client.emails.send({
        from: `${PRODUCT_DISPLAY_NAME} Support <${fromEmail}>`,
        to: [toEmail],
        subject: `[${data.ticketPriority}] New Ticket: ${data.ticketSubject}`,
        html,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(`📧 Support Notification sent for ticket ${data.ticketId} (ID: ${response.data?.id})`);
    } catch (error) {
      console.error('❌ Failed to send support notification:', error);
    }
  }
}
