/**
 * Email service — sends transactional emails via nodemailer (SMTP).
 *
 * All emails are rendered through the shared `emailLayout` module which
 * provides a consistent branded HTML wrapper and a plaintext fallback.
 *
 * Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, FRONTEND_URL
 * in .env.  Falls back to a no-op when SMTP_HOST is not configured.
 */
import nodemailer from 'nodemailer';
import { renderEmail, escapeHtml } from './emailLayout.js';

// ─── Data shapes ──────────────────────────────────────────────────────────────

export type BookingEmailData = {
  to: string;
  userName: string;
  propertyTitle: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  /** Signed per-recipient URL for preference management (optional). */
  preferencesUrl?: string;
};

export type PasswordResetEmailData = {
  to: string;
  token: string;
};

export type EmailVerificationData = {
  to: string;
  userName: string;
  verificationUrl: string;
};

// ─── Transport ────────────────────────────────────────────────────────────────

function createTransport() {
  if (!process.env.SMTP_HOST) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM = process.env.EMAIL_FROM ?? 'Rentars <no-reply@rentars.app>';

async function send(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EmailService] SMTP not configured — skipping email to ${to}: ${subject}`);
    return;
  }
  await transport.sendMail({ from: FROM, to, subject, html, text });
}

// ─── Templates ────────────────────────────────────────────────────────────────

function bookingDetailsHtml(data: BookingEmailData): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="width:100%;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin:16px 0;">
      <tr style="background-color:#F9FAFB;">
        <td style="padding:10px 16px;font-size:13px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">
          BOOKING DETAILS
        </td>
      </tr>
      <tr>
        <td style="padding:14px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
            <tr>
              <td style="font-size:14px;color:#6B7280;padding-bottom:8px;">Property</td>
              <td style="font-size:14px;font-weight:600;color:#111827;padding-bottom:8px;text-align:right;">
                ${escapeHtml(data.propertyTitle)}
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#6B7280;padding-bottom:8px;">Check-in</td>
              <td style="font-size:14px;font-weight:600;color:#111827;padding-bottom:8px;text-align:right;">
                ${escapeHtml(data.checkIn)}
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#6B7280;padding-bottom:8px;">Check-out</td>
              <td style="font-size:14px;font-weight:600;color:#111827;padding-bottom:8px;text-align:right;">
                ${escapeHtml(data.checkOut)}
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#6B7280;">Total</td>
              <td style="font-size:16px;font-weight:700;color:#2563EB;text-align:right;">
                ${data.totalPrice.toLocaleString()} USDC
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

// ─── Public service ───────────────────────────────────────────────────────────

export const emailService = {
  /**
   * Sent immediately when a guest creates a booking (status = Pending).
   * Optional: not security-critical, preference link shown in footer.
   */
  async sendBookingCreated(data: BookingEmailData): Promise<void> {
    const body = `
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(data.userName)},</p>
      <p style="margin:0 0 16px;">
        Your booking for <strong>${escapeHtml(data.propertyTitle)}</strong> has been received
        and is pending confirmation from the host.
      </p>
      ${bookingDetailsHtml(data)}
      <p style="margin:16px 0 0;font-size:14px;color:#6B7280;">
        You'll receive another email once the host confirms your stay.
      </p>`;

    const { html, text } = renderEmail({
      title: 'Booking Received — Rentars',
      preheader: `Your booking at ${data.propertyTitle} is pending confirmation.`,
      body,
      preferencesUrl: data.preferencesUrl,
    });

    await send(data.to, 'Booking Received — Rentars', html, text);
  },

  /**
   * Sent when the host confirms the booking (status → Confirmed).
   * Optional: preference link shown in footer.
   */
  async sendBookingConfirmed(data: BookingEmailData): Promise<void> {
    const body = `
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(data.userName)},</p>
      <p style="margin:0 0 16px;">
        Great news — your booking for <strong>${escapeHtml(data.propertyTitle)}</strong>
        has been <strong style="color:#16A34A;">confirmed</strong> by the host!
      </p>
      ${bookingDetailsHtml(data)}
      <p style="margin:16px 0 0;font-size:14px;color:#6B7280;">
        Safe travels, and enjoy your stay.
      </p>`;

    const { html, text } = renderEmail({
      title: 'Booking Confirmed — Rentars',
      preheader: `Your stay at ${data.propertyTitle} is confirmed!`,
      body,
      preferencesUrl: data.preferencesUrl,
    });

    await send(data.to, 'Booking Confirmed by Host — Rentars', html, text);
  },

  /**
   * Sent when a booking is cancelled by either party.
   * Optional: preference link shown in footer.
   */
  async sendBookingCancelled(data: BookingEmailData): Promise<void> {
    const body = `
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(data.userName)},</p>
      <p style="margin:0 0 16px;">
        Your booking for <strong>${escapeHtml(data.propertyTitle)}</strong> has been cancelled.
      </p>
      ${bookingDetailsHtml(data)}
      <p style="margin:16px 0 0;font-size:14px;color:#6B7280;">
        If you did not request this cancellation or have questions, please
        <a href="${process.env.FRONTEND_URL ?? 'https://rentars.app'}/support"
           style="color:#2563EB;">contact support</a>.
      </p>`;

    const { html, text } = renderEmail({
      title: 'Booking Cancelled — Rentars',
      preheader: `Your booking at ${data.propertyTitle} has been cancelled.`,
      body,
      preferencesUrl: data.preferencesUrl,
    });

    await send(data.to, 'Booking Cancelled — Rentars', html, text);
  },

  /**
   * Password reset — essential / security email, no preference link.
   */
  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL ?? 'https://rentars.app'}/reset-password?token=${encodeURIComponent(data.token)}`;

    const body = `
      <p style="margin:0 0 16px;font-size:16px;">Hi there,</p>
      <p style="margin:0 0 16px;">
        Someone requested a password reset for your Rentars account.
        Click the button below to choose a new password — the link expires in
        <strong>60 minutes</strong>.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
        <tr>
          <td style="border-radius:8px;background-color:#2563EB;">
            <a href="${escapeHtml(resetUrl)}"
               style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">
              Reset Password
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:14px;color:#6B7280;">
        If you did not request a password reset, you can safely ignore this email.
        Your password will not be changed.
      </p>`;

    const { html, text } = renderEmail({
      title: 'Reset Your Rentars Password',
      preheader: 'Reset your Rentars password — link expires in 60 minutes.',
      body,
      isEssential: true,
    });

    await send(data.to, 'Reset your Rentars password', html, text);
  },

  /**
   * Email address verification — essential / security email, no preference link.
   */
  async sendEmailVerification(data: EmailVerificationData): Promise<void> {
    const body = `
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(data.userName)},</p>
      <p style="margin:0 0 16px;">
        Please verify your email address to finish setting up your Rentars account.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
        <tr>
          <td style="border-radius:8px;background-color:#2563EB;">
            <a href="${escapeHtml(data.verificationUrl)}"
               style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">
              Verify Email Address
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:14px;color:#6B7280;">
        This link expires in 24 hours. If you did not create a Rentars account,
        you can safely ignore this email.
      </p>`;

    const { html, text } = renderEmail({
      title: 'Verify Your Email — Rentars',
      preheader: 'Verify your email to activate your Rentars account.',
      body,
      isEssential: true,
    });

    await send(data.to, 'Verify your email — Rentars', html, text);
  },
};
