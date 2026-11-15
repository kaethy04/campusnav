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
