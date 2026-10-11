import { connectDB, disconnectDB } from '../config/db.js';
import { Invitation } from '../models/invitation.model.js';

/**
 * Migration script: Migrate legacy 'sent' invitation email delivery statuses.
 * - Records with status 'sent' and an emailProviderMessageId -> 'accepted'
 * - Records with status 'sent' without an emailProviderMessageId -> 'dev_link'
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
      emailProviderMessageId: { $ne: null },
    };

    const sentWithoutProviderIdQuery = {
      emailDeliveryStatus: 'sent',
      $or: [
        { emailProviderMessageId: null },
        { emailProviderMessageId: { $exists: false } },
        { emailProviderMessageId: '' },
      ],
    };

    const countToAccepted = await Invitation.countDocuments(sentWithProviderIdQuery);
    const countToDevLink = await Invitation.countDocuments(sentWithoutProviderIdQuery);

    console.log(`[MIGRATION] Total invitations in database: ${totalInvitations}`);
    console.log(`[MIGRATION] Records with 'sent' and provider message ID (-> 'accepted'): ${countToAccepted}`);
    console.log(`[MIGRATION] Records with 'sent' without provider message ID (-> 'dev_link'): ${countToDevLink}`);

    if (!isConfirm) {
      console.log(`[MIGRATION] Dry run complete. No database records modified. Use --confirm to apply changes.`);
      return;
    }

    let modifiedAccepted = 0;
    let modifiedDevLink = 0;

    if (countToAccepted > 0) {
      const res = await Invitation.updateMany(sentWithProviderIdQuery, {
        $set: { emailDeliveryStatus: 'accepted', emailMode: 'resend' },
      });
      modifiedAccepted = res.modifiedCount;
    }

    if (countToDevLink > 0) {
      const res = await Invitation.updateMany(sentWithoutProviderIdQuery, {
        $set: { emailDeliveryStatus: 'dev_link', emailMode: 'development' },
      });
      modifiedDevLink = res.modifiedCount;
    }

    console.log(`[MIGRATION] Applied confirmed migration:`);
    console.log(`  - Updated to 'accepted': ${modifiedAccepted}`);
    console.log(`  - Updated to 'dev_link': ${modifiedDevLink}`);
  } finally {
    await disconnectDB();
  }
};

run().catch((err) => {
  console.error('[MIGRATION_ERROR]', err.message);
  process.exit(1);
});
