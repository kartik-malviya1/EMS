import mongoose from 'mongoose';
import { AUDIT_ACTION_LIST } from '../config/constants.js';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    actorEmail: {
      type: String,
      default: '',
      trim: true,
    },
    actorRole: {
      type: String,
      default: '',
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      enum: {
        values: AUDIT_ACTION_LIST,
        message: '{VALUE} is not a valid audit action',
      },
      index: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    targetUserEmail: {
      type: String,
      default: '',
      trim: true,
    },
    invitationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invitation',
      default: null,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
