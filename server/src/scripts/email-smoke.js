import { env, parseEmailAddress } from '../config/env.js';
import { getEmailProvider, ResendEmailProvider } from '../services/email/index.js';

/**
 * Manual smoke test script.
 * Usage: npm run email:smoke -- --to <address> --confirm
 *
 * Requirements:
 * - Refuses to run without BOTH `--to <address>` and `--confirm`.
 * - Never prints any secret or API key.
 * - Prints mode, sender domain, and whether key is set/unset.
 * - Sends ONE plain test email (no tokens, no invitation link).
 * - Prints provider message ID or mapped error code/message.
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

  const recipient = args[toIndex + 1].trim();
  const parsedFrom = parseEmailAddress(env.EMAIL_FROM);
  const isKeySet = Boolean(
    env.RESEND_API_KEY &&
    env.RESEND_API_KEY.startsWith('re_') &&
    env.RESEND_API_KEY !== 're_xxxxxxxxx'
  );

  console.log('=== EMAIL SMOKE TEST CONFIGURATION ===');
  console.log(`EMAIL_MODE: ${env.EMAIL_MODE}`);
  console.log(`EMAIL_PROVIDER: ${env.EMAIL_PROVIDER}`);
  console.log(`Sender Address: ${parsedFrom.address || 'not configured'}`);
  console.log(`Sender Domain: ${parsedFrom.domain || 'not configured'}`);
  console.log(`RESEND_API_KEY status: ${isKeySet ? 'set' : 'unset/placeholder'}`);
  console.log(`Target Recipient: ${recipient}`);
  console.log('======================================');

  if (env.EMAIL_MODE === 'development') {
    console.log('[NOTE] EMAIL_MODE is set to development. Testing via the development provider...');
  }

  const provider = env.EMAIL_MODE === 'resend'
    ? new ResendEmailProvider()
    : getEmailProvider();

  const timestamp = new Date().toISOString();
  const result = await provider.sendInvitation({
    to: recipient,
    subject: `AMS Portal Smoke Test - ${timestamp}`,
    html: `<p>This is a manual smoke test email from AMS Portal sent at <strong>${timestamp}</strong>.</p><p>No tokens or sensitive data are contained in this test.</p>`,
    text: `This is a manual smoke test email from AMS Portal sent at ${timestamp}.\nNo tokens or sensitive data are contained in this test.`,
  });

  if (result.ok) {
    console.log('[SMOKE_TEST_SUCCESS]');
    if (result.devOnly) {
      console.log('Outcome: Development mode simulated send successful (no external network call made).');
    } else {
      console.log(`Outcome: Provider accepted the message.`);
      console.log(`Provider Message ID: ${result.providerMessageId}`);
    }
  } else {
    console.error('[SMOKE_TEST_FAILED]');
    console.error(`Error Code: ${result.error?.code}`);
    console.error(`Actionable Message: ${result.error?.message}`);
    console.error(`Retryable: ${result.error?.retryable}`);
    process.exit(1);
  }
};

run().catch((err) => {
  console.error('[SMOKE_TEST_EXCEPTION]', err.message);
  process.exit(1);
});
