import mongoose from 'mongoose';
import {
  WORKING_STATUS,
  WORKING_STATUS_LIST,
  CLOSED_BY_LIST,
  VERIFICATION_STATUS,
  VERIFICATION_STATUS_LIST,
  OVERTIME_STATUS,
  OVERTIME_STATUS_LIST,
} from '../config/constants.js';

const punchEventSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    selfie: {
      publicId: { type: String, required: true },
      mimeType: { type: String, required: true },
      bytes: { type: Number, required: true },
    },
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      accuracy: { type: Number, required: true },
      distanceFromOfficeMeters: { type: Number, default: null },
      withinGeofence: { type: Boolean, default: null },
    },
  },
  { _id: false }
);

const verificationHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewedAt: { type: Date, required: true },
    remarks: { type: String, default: null },
  },
  { _id: false }
);

const overtimeHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    requestedMinutes: { type: Number, default: null },
    reason: { type: String, default: null },
    requestedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    remarks: { type: String, default: null },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    workDate: {
      type: String, // 'YYYY-MM-DD'
      required: true,
    },
    punchIn: {
      type: punchEventSchema,
      required: true,
    },
    punchOut: {
      type: punchEventSchema,
      default: null,
    },
    workedMinutes: {
      type: Number,
      default: null,
    },
    workingStatus: {
      type: String,
      enum: WORKING_STATUS_LIST,
      default: WORKING_STATUS.IN_PROGRESS,
    },
    closedBy: {
      type: String,
      enum: [...CLOSED_BY_LIST, null],
      default: null,
    },
    verification: {
      status: {
        type: String,
        enum: VERIFICATION_STATUS_LIST,
        default: VERIFICATION_STATUS.PENDING,
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
      remarks: {
        type: String,
        default: null,
      },
      history: {
        type: [verificationHistorySchema],
        default: [],
      },
    },
    overtime: {
      status: {
        type: String,
        enum: OVERTIME_STATUS_LIST,
        default: OVERTIME_STATUS.NOT_REQUESTED,
      },
      requestedMinutes: {
        type: Number,
        default: null,
      },
      reason: {
        type: String,
        default: null,
      },
      requestedAt: {
        type: Date,
        default: null,
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
      remarks: {
        type: String,
        default: null,
      },
      history: {
        type: [overtimeHistorySchema],
        default: [],
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        if (ret.punchIn?.selfie) {
          delete ret.punchIn.selfie.publicId;
        }
        if (ret.punchOut?.selfie) {
          delete ret.punchOut.selfie.publicId;
        }
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

// Indexes per CLAUDE.md section 4
attendanceSchema.index({ employeeId: 1, workDate: 1 }, { unique: true });
attendanceSchema.index({ workDate: 1, workingStatus: 1 });
attendanceSchema.index({ employeeId: 1, workDate: -1 });
attendanceSchema.index({ 'overtime.status': 1, workDate: -1 });
attendanceSchema.index({ 'verification.status': 1, workDate: -1 });

export const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
