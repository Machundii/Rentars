/**
 * Email service — sends transactional emails via nodemailer (SMTP).
 * Configuration is read from the validated `env` object (see config/env.ts).
 * Falls back to a no-op console log when SMTP_HOST is not set.
 */
import nodemailer from 'nodemailer';
import { env } from '@/config/env.js';

type BookingEmailData = {
  to: string;
  userName: string;
  propertyTitle: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
};

type PasswordResetEmailData = {
  to: string;
  token: string;
};

type VerificationEmailData = {
  to: string;
  token: string;
};

function createTransport() {
  if (!env.SMTP_HOST) return null;

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.log(`[EmailService] SMTP not configured — skipping email to ${to}: ${subject}`);
    return;
  }
  await transport.sendMail({ from: env.EMAIL_FROM, to, subject, html });
}

export const emailService = {
  async sendVerificationEmail(data: VerificationEmailData): Promise<void> {
    const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${data.token}`;
    await send(
      data.to,
      'Verify your Rentars email',
      `<p>Welcome to Rentars!</p>
       <p><a href="${verifyUrl}">Click here to verify your email address</a></p>
       <p>This link expires in 24 hours.</p>`,
    );
  },

  async sendBookingCreated(data: BookingEmailData): Promise<void> {
    await send(
      data.to,
      'Booking Confirmed — Rentars',
      `<p>Hi ${data.userName},</p>
       <p>Your booking for <strong>${data.propertyTitle}</strong> has been created.</p>
       <p>Check-in: ${data.checkIn} · Check-out: ${data.checkOut}</p>
       <p>Total: ${data.totalPrice} USDC</p>`,
    );
  },

  async sendBookingConfirmed(data: BookingEmailData): Promise<void> {
    await send(
      data.to,
      'Booking Confirmed by Host — Rentars',
      `<p>Hi ${data.userName},</p>
       <p>Your booking for <strong>${data.propertyTitle}</strong> has been confirmed by the host.</p>`,
    );
  },

  async sendBookingCancelled(data: BookingEmailData): Promise<void> {
    await send(
      data.to,
      'Booking Cancelled — Rentars',
      `<p>Hi ${data.userName},</p>
       <p>Your booking for <strong>${data.propertyTitle}</strong> has been cancelled.</p>`,
    );
  },

  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${data.token}`;
    await send(
      data.to,
      'Reset your Rentars password',
      `<p>Someone requested a password reset for your Rentars account.</p>
       <p><a href="${resetUrl}">Click here to reset your password</a></p>
       <p>This link expires in 60 minutes. If you did not request a reset, you can ignore this email.</p>`,
    );
  },
};
