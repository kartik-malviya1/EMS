import mongoose from 'mongoose';
import {
  LEAVE_STATUS,
  LEAVE_STATUS_LIST,
  LEAVE_TYPE,
  LEAVE_TYPE_LIST,
  HALF_DAY_PERIOD_LIST,
} from '../config/constants.js';

const leaveRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    leaveType: {
      type: String,
      required: [true, 'Leave type is required'],
      enum: {
        values: LEAVE_TYPE_LIST,
        message: '{VALUE} is not a valid leave type',
      },
      default: LEAVE_TYPE.ANNUAL,
    },
    startDate: {
      type: String,
      required: [true, 'Start date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'],
      index: true,
    },
    endDate: {
      type: String,
      required: [true, 'End date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'],
      index: true,
    },
    isHalfDay: {
      type: Boolean,
      default: false,
    },
    halfDayPeriod: {
      type: String,
      enum: {
        values: HALF_DAY_PERIOD_LIST,
        message: '{VALUE} is not a valid half-day period',
      },
      default: null,
    },
    daysCount: {
      type: Number,
      required: [true, 'Leave days count is required'],
      min: [0.5, 'Minimum leave duration is 0.5 days'],
    },
    reason: {
      type: String,
      required: [true, 'Leave reason is required'],
      trim: true,
      minlength: [5, 'Reason must be at least 5 characters'],
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: {
        values: LEAVE_STATUS_LIST,
        message: '{VALUE} is not a valid leave status',
      },
      default: LEAVE_STATUS.PENDING,
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewerRemarks: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Reviewer remarks cannot exceed 500 characters'],
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

leaveRequestSchema.index({ userId: 1, status: 1 });
leaveRequestSchema.index({ startDate: 1, endDate: 1 });
leaveRequestSchema.index({ status: 1, createdAt: -1 });

export const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);
export default LeaveRequest;
