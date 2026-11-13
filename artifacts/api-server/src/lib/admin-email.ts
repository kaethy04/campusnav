import nodemailer from "nodemailer";
import { logger } from "./logger.js";

function getEmailCredentials() {
  const user = process.env["ADMIN_SMTP_USER"]?.trim();
  const password = process.env["ADMIN_SMTP_APP_PASSWORD"]?.replace(/\s/g, "");
  if (!user || !password) return null;
  return { user, password };
}

function getTransporter() {
  const credentials = getEmailCredentials();
  if (!credentials) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: credentials.user, pass: credentials.password },
  });
}

export function isAdminEmailConfigured() {
  return getEmailCredentials() !== null;
}

export async function sendUserPasswordResetCode(recipient: string, code: string) {
  const credentials = getEmailCredentials();
  const transporter = getTransporter();
  if (!transporter || !credentials) return false;

  try {
    await transporter.sendMail({
      from: credentials.user,
      to: recipient,
      subject: "CampusNav password reset code",
      text: `Your CampusNav password reset code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    });
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to send user password reset code");
    return false;
  }
}

export async function sendUserEmailVerificationCode(recipient: string, code: string) {
  const credentials = getEmailCredentials();
  const transporter = getTransporter();
  if (!transporter || !credentials) return false;

  try {
    await transporter.sendMail({
      from: credentials.user,
      to: recipient,
      subject: "Verify your CampusNav email",
      text: `Your CampusNav email verification code is ${code}. It expires in 10 minutes. If you did not create this account, you can ignore this email.`,
    });
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to send user email verification code");
    return false;
  }
}

export async function sendAdminNotification(subject: string, text: string, recipient: string) {
  const credentials = getEmailCredentials();
  const transporter = getTransporter();
  if (!transporter || !credentials) {
    logger.warn("Admin email notifications are disabled; configure ADMIN_SMTP_USER and ADMIN_SMTP_APP_PASSWORD.");
    return;
  }

  try {
    await transporter.sendMail({ from: credentials.user, to: recipient, subject, text });
  } catch (err) {
    logger.error({ err }, "Failed to send admin email notification");
  }
}
