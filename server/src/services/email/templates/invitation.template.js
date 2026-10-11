import { DateTime } from 'luxon';
import { env } from '../../../config/env.js';

/**
 * Escapes unsafe HTML characters to prevent HTML/XSS injection.
 */
export const escapeHtml = (unsafe) => {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Renders the invitation email subject, HTML body, and plain text part.
 * Formats expiresAt in BUSINESS_TIMEZONE with inline styles, no external images, no tracking pixels.
 * Contains exactly one call-to-action link in HTML and fallback URL as text.
 */
export const renderInvitationTemplate = ({
  name,
  role,
  adminName,
  invitationUrl,
  expiresAt,
}) => {
  const safeName = escapeHtml(name);
  const safeRole = escapeHtml(role);
  const safeAdminName = escapeHtml(adminName || 'System Administrator');
  const safeUrl = escapeHtml(invitationUrl);

  const timezone = env.BUSINESS_TIMEZONE || 'Asia/Kolkata';
  const expiryDate = new Date(expiresAt);
  const formattedExpiry = DateTime.fromJSDate(expiryDate)
    .setZone(timezone)
    .toFormat('dd LLL yyyy, hh:mm a (ZZZZ)');

  const subject = "You're invited to join AMS Portal";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to join AMS Portal</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5;">
  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background-color: #0f172a; padding: 28px 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">AMS Portal</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">Attendance &amp; Workforce Management</p>
    </div>
    <div style="padding: 28px 24px;">
      <h2 style="margin: 0 0 16px 0; font-size: 17px; font-weight: 600; color: #0f172a;">Hello ${safeName},</h2>
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">
        <strong>${safeAdminName}</strong> has invited you to join the Attendance Management System (AMS Portal) as a <strong>${safeRole}</strong>.
      </p>

      <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 13px;">
        <div style="margin-bottom: 6px;"><strong>Assigned Role:</strong> <span style="text-transform: capitalize;">${safeRole}</span></div>
        <div style="margin-bottom: 6px;"><strong>Invited By:</strong> <span>${safeAdminName}</span></div>
        <div><strong>Valid Until:</strong> <span>${formattedExpiry}</span></div>
      </div>

      <p style="margin: 0 0 24px 0; font-size: 14px; color: #334155;">
        Click the link below to set your password and activate your account:
      </p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${safeUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">Accept Invitation &amp; Set Password</a>
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; word-break: break-all;">
        <p style="margin: 0 0 6px 0;">If the button above does not work, copy and paste this link into your browser:</p>
        <p style="margin: 0; color: #2563eb;">${safeUrl}</p>
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
        <p style="margin: 0;">If you weren't expecting this invitation, you can ignore this email.</p>
      </div>
    </div>
    <div style="padding: 16px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
      AMS Portal &bull; Secure Invitation System
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Hello ${name},

${adminName || 'System Administrator'} has invited you to join the Attendance Management System (AMS Portal) as a ${role}.

Assigned Role: ${role}
Invited By: ${adminName || 'System Administrator'}
Valid Until: ${formattedExpiry}

Please activate your account and establish your password using the link below:
${invitationUrl}

If you weren't expecting this invitation, you can ignore this email.
  `.trim();

  return { subject, html, text };
};

export default renderInvitationTemplate;
