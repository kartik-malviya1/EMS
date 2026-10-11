import mongoose from 'mongoose';
import {
  ROLES,
  INVITATION_STATUS,
  INVITATION_STATUS_LIST,
  EMAIL_DELIVERY_STATUS,
  EMAIL_DELIVERY_STATUS_LIST,
} from '../config/constants.js';

const invitationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    role: {
      type: String,
      enum: {
        values: [ROLES.EMPLOYEE, ROLES.MANAGER],
        message: '{VALUE} is not a valid invited role',
      },
      required: [true, 'Role is required'],
    },
    employeeId: {
      type: String,
      trim: true,
      default: '',
    },
    department: {
      type: String,
      trim: true,
      default: '',
    },
    designation: {
      type: String,
      trim: true,
      default: '',
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Inviting user is required'],
      index: true,
    },
    invitedByRole: {
      type: String,
      enum: {
        values: [ROLES.ADMIN, ROLES.MANAGER],
        message: '{VALUE} is not a valid invitedByRole',
      },
      default: ROLES.ADMIN,
    },
    tokenHash: {
      type: String,
      required: [true, 'Token hash is required'],
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: INVITATION_STATUS_LIST,
        message: '{VALUE} is not a valid invitation status',
      },
      default: INVITATION_STATUS.PENDING,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      index: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    lastSentAt: {
      type: Date,
      default: Date.now,
    },
    resendCount: {
      type: Number,
      default: 0,
    },
    emailDeliveryStatus: {
      type: String,
      enum: {
        values: EMAIL_DELIVERY_STATUS_LIST,
        message: '{VALUE} is not a valid email delivery status',
      },
      default: EMAIL_DELIVERY_STATUS.PENDING,
      index: true,
    },
    emailProviderMessageId: {
      type: String,
      default: null,
      index: true,
    },
    emailLastEvent: {
      type: String,
      default: null,
    },
    emailLastEventAt: {
      type: Date,
      default: null,
    },
    emailAttempt: {
      type: Number,
      default: 0,
    },
    sendingAt: {
      type: Date,
      default: null,
      index: true,
    },
    emailLastError: {
      type: new mongoose.Schema(
        {
          code: { type: String, default: null },
          message: { type: String, default: null },
          at: { type: Date, default: null },
          outcomeUnknown: { type: Boolean, default: false },
        },
        { _id: false }
      ),
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

invitationSchema.index({ email: 1, status: 1 });
invitationSchema.index({ status: 1, expiresAt: 1 });

export const Invitation = mongoose.model('Invitation', invitationSchema);
export default Invitation;
