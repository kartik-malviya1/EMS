import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, ROLE_LIST, ACCOUNT_STATUS, ACCOUNT_STATUS_LIST } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name must be at most 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: function () {
        return this.accountStatus === ACCOUNT_STATUS.ACTIVE;
      },
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ROLE_LIST,
        message: '{VALUE} is not a valid role',
      },
      default: ROLES.EMPLOYEE,
    },
    employeeId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
      default: undefined,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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
    dateOfJoining: {
      type: Date,
      default: null,
    },
    accountStatus: {
      type: String,
      enum: {
        values: ACCOUNT_STATUS_LIST,
        message: '{VALUE} is not a valid account status',
      },
      default: ACCOUNT_STATUS.ACTIVE,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Synchronize accountStatus and isActive before save
userSchema.pre('save', function () {
  if (this.isModified('accountStatus')) {
    this.isActive = this.accountStatus === ACCOUNT_STATUS.ACTIVE;
  } else if (this.isModified('isActive')) {
    if (!this.isActive && this.accountStatus === ACCOUNT_STATUS.ACTIVE) {
      this.accountStatus = ACCOUNT_STATUS.DEACTIVATED;
    } else if (this.isActive && this.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
      this.accountStatus = ACCOUNT_STATUS.ACTIVE;
    }
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.statics.hashPassword = async function (password) {
  return bcrypt.hash(password, 12);
};

export const User = mongoose.model('User', userSchema);
export default User;
