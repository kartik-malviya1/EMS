import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'geofence',
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    officeLatitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    officeLongitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    radiusMeters: {
      type: Number,
      default: 200,
      min: 1,
    },
    maxAccuracyMeters: {
      type: Number,
      default: 100,
      min: 1,
    },
  },
  {
    timestamps: true,
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

export const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
