import mongoose from 'mongoose';
import { NOTIFICATION_TYPE_LIST } from '../config/constants.js';

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPE_LIST,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    data: {
      attendanceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Attendance',
        default: null,
      },
      workDate: {
        type: String,
        default: null,
      },
    },
    readAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

// TTL index: 90 days = 90 * 24 * 60 * 60 = 7,776,000 seconds
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
