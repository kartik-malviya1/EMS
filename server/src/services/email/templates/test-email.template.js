import { DateTime } from 'luxon';
import { env } from '../../../config/env.js';
import { escapeHtml } from './invitation.template.js';

/**
 * Fixed test email template used exclusively by the admin test endpoint.
 * Plain "AMS Portal test email", sent time, sender address, NO link, NO token.
 */
export const renderTestEmailTemplate = ({ sentAt = new Date(), senderAddress = env.EMAIL_FROM }) => {
  const timezone = env.BUSINESS_TIMEZONE || 'Asia/Kolkata';
  const formattedTime = DateTime.fromJSDate(new Date(sentAt))
    .setZone(timezone)
    .toFormat('dd LLL yyyy, hh:mm:ss a (ZZZZ)');

  const safeSender = escapeHtml(senderAddress);
  const subject = 'AMS Portal test email';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>AMS Portal test email</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
    <h2 style="margin-top: 0; color: #0f172a; font-size: 18px;">AMS Portal test email</h2>
    <p style="margin: 8px 0; font-size: 14px; color: #334155;">
      This is a test email sent from the AMS Portal Admin Settings to verify delivery configuration.
    </p>
    <div style="margin: 16px 0; padding: 12px; background: #f1f5f9; border-radius: 6px; font-size: 13px; color: #475569;">
      <div><strong>Sent Time:</strong> ${formattedTime}</div>
      <div style="margin-top: 4px;"><strong>Sender Address:</strong> ${safeSender}</div>
    </div>
    <p style="margin-bottom: 0; font-size: 12px; color: #94a3b8;">
      No action is required. This message contains no links or credentials.
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
AMS Portal test email

This is a test email sent from the AMS Portal Admin Settings to verify delivery configuration.

Sent Time: ${formattedTime}
Sender Address: ${senderAddress}

No action is required. This message contains no links or credentials.
  `.trim();

  return { subject, html, text };
};
