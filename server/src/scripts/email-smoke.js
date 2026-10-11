import { isEmailConfigured } from '../config/env.js';
import { getEmailProvider } from '../services/email/index.js';
import { renderTestEmailTemplate } from '../services/email/templates/test-email.template.js';

/**
 * Manual smoke test script.
 * Usage: npm run email:smoke -- --to <address> --confirm
 *
 * Requirements:
 * - Refuses to run without BOTH `--to <address>` and `--confirm`.
 * - Never prints any secret or raw token.
 * - Sends ONE plain test email via the real provider.
 * - Prints the provider ID or mapped error only.
 */
const run = async () => {
  const args = process.argv.slice(2);
  const confirmIndex = args.indexOf('--confirm');
  const toIndex = args.indexOf('--to');

  if (confirmIndex === -1 || toIndex === -1 || !args[toIndex + 1]) {
    console.error('Error: Smoke test requires BOTH flags: --to <address> and --confirm');
    console.error('Usage: npm run email:smoke -- --to <address> --confirm');
    process.exit(1);
  }

  const recipient = args[toIndex + 1].trim().toLowerCase();
  if (!recipient || !recipient.includes('@')) {
    console.error('Error: Invalid recipient email address provided.');
    process.exit(1);
  }

  if (!isEmailConfigured()) {
    console.error('Error: EMAIL_NOT_CONFIGURED');
    console.error('Email delivery is not configured. RESEND_API_KEY is missing, placeholder, or invalid.');
    process.exit(1);
  }

  const provider = getEmailProvider();
  const template = renderTestEmailTemplate({});

  const result = await provider.send({
    to: recipient,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  if (result.ok) {
    console.log(`Success. Provider Message ID: ${result.providerMessageId}`);
  } else {
    console.error(`Error: ${result.error?.code || 'EMAIL_PROVIDER_ERROR'}`);
    if (result.error?.message) {
      console.error(result.error.message);
    }
    process.exit(1);
  }
};

run().catch((err) => {
  console.error(`Error: EMAIL_PROVIDER_ERROR - ${err.message}`);
  process.exit(1);
});
