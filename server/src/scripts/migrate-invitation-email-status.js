import { connectDB, disconnectDB } from '../config/db.js';
import { Invitation } from '../models/invitation.model.js';

/**
 * Migration script: Migrate legacy invitation email delivery statuses.
 * - Old 'sent' with a provider id -> 'accepted'
 * - Old 'sent' or 'dev_link' without a provider id -> 'failed' with emailLastError.code = 'NOT_SENT'
 *   and message = 'Created in the old simulated mode; no email was sent. Press Resend.'
 * - Unsets deprecated emailMode field.
 *
 * Runs in dry-run mode by default. Pass `--confirm` flag to apply writes.
 * Prints counts only.
 */
const run = async () => {
  const isConfirm = process.argv.includes('--confirm');

  await connectDB();

  try {
    const totalInvitations = await Invitation.countDocuments({});

    const sentWithProviderIdQuery = {
      emailDeliveryStatus: 'sent',
      emailProviderMessageId: { $ne: null, $nin: ['', null] },
    };

    const simulatedWithoutProviderIdQuery = {
      $or: [
        { emailDeliveryStatus: 'dev_link' },
        {
          emailDeliveryStatus: 'sent',
          $or: [
            { emailProviderMessageId: null },
            { emailProviderMessageId: { $exists: false } },
            { emailProviderMessageId: '' },
          ],
        },
      ],
    };

    const countToAccepted = await Invitation.countDocuments(sentWithProviderIdQuery);
    const countToFailed = await Invitation.countDocuments(simulatedWithoutProviderIdQuery);

    console.log(`[MIGRATION] Total invitations in database: ${totalInvitations}`);
    console.log(`[MIGRATION] Records with 'sent' and provider message ID (-> 'accepted'): ${countToAccepted}`);
    console.log(
      `[MIGRATION] Records with 'sent'/'dev_link' without provider message ID (-> 'failed' with NOT_SENT): ${countToFailed}`
    );

    if (!isConfirm) {
      console.log(`[MIGRATION] Dry run complete. No database records modified. Use --confirm to apply changes.`);
      return;
    }

    let modifiedAccepted = 0;
    let modifiedFailed = 0;

    if (countToAccepted > 0) {
      const res = await Invitation.updateMany(sentWithProviderIdQuery, {
        $set: { emailDeliveryStatus: 'accepted' },
        $unset: { emailMode: 1 },
      });
      modifiedAccepted = res.modifiedCount;
    }

    if (countToFailed > 0) {
      const now = new Date();
      const res = await Invitation.updateMany(simulatedWithoutProviderIdQuery, {
        $set: {
          emailDeliveryStatus: 'failed',
          emailLastError: {
            code: 'NOT_SENT',
            message: 'Created in the old simulated mode; no email was sent. Press Resend.',
            at: now,
            outcomeUnknown: false,
          },
        },
        $unset: { emailMode: 1 },
      });
      modifiedFailed = res.modifiedCount;
    }

    // Clean up any remaining legacy emailMode
    await Invitation.updateMany({ emailMode: { $exists: true } }, { $unset: { emailMode: 1 } });

    console.log(`[MIGRATION] Applied confirmed migration:`);
    console.log(`  - Updated to 'accepted': ${modifiedAccepted}`);
    console.log(`  - Updated to 'failed' (NOT_SENT): ${modifiedFailed}`);
  } finally {
    await disconnectDB();
  }
};

run().catch((err) => {
  console.error('[MIGRATION_ERROR]', err.message);
  process.exit(1);
});
