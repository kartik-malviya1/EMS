import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../models/user.model.js';
import { Attendance } from '../models/attendance.model.js';
import { Notification } from '../models/notification.model.js';
import { Settings } from '../models/settings.model.js';
import { ROLES, WORKING_STATUS } from '../config/constants.js';

describe('Data Models', () => {
  describe('User Model', () => {
    it('normalizes email to lowercase and trimmed', async () => {
      const user = await User.create({
        name: 'Jane Doe',
        email: '  Jane.Doe@EXAMPLE.COM ',
        passwordHash: 'dummy_hash',
      });

      expect(user.email).toBe('jane.doe@example.com');
      expect(user.role).toBe(ROLES.EMPLOYEE);
      expect(user.isActive).toBe(true);
      expect(user.managerId).toBeNull();
    });

    it('enforces unique email index', async () => {
      await User.init();
      await User.create({
        name: 'User 1',
        email: 'unique@example.com',
        passwordHash: 'dummy_hash',
      });

      await expect(
        User.create({
          name: 'User 2',
          email: 'unique@example.com',
          passwordHash: 'dummy_hash',
        })
      ).rejects.toThrow();
    });

    it('never exposes passwordHash or __v in toJSON', async () => {
      const user = await User.create({
        name: 'Secret User',
        email: 'secret@example.com',
        passwordHash: 'super_secret_hash',
      });

      const json = user.toJSON();
      expect(json.passwordHash).toBeUndefined();
      expect(json.__v).toBeUndefined();
      expect(json.name).toBe('Secret User');
    });

    it('does not select passwordHash by default in queries', async () => {
      const created = await User.create({
        name: 'Query User',
        email: 'query@example.com',
        passwordHash: 'hidden_hash',
      });

      const queried = await User.findById(created._id);
      expect(queried.passwordHash).toBeUndefined();

      const withHash = await User.findById(created._id).select('+passwordHash');
      expect(withHash.passwordHash).toBe('hidden_hash');
    });
  });

  describe('Attendance Model', () => {
    it('creates attendance and respects unique {employeeId, workDate}', async () => {
      await Attendance.init();
      const employeeId = new mongoose.Types.ObjectId();
      const workDate = '2026-10-10';

      const punchData = {
        at: new Date(),
        selfie: { publicId: 'attendance/selfie-1', mimeType: 'image/jpeg', bytes: 12345 },
        location: { latitude: 28.6139, longitude: 77.209, accuracy: 15 },
      };

      const record = await Attendance.create({
        employeeId,
        workDate,
        punchIn: punchData,
        workingStatus: WORKING_STATUS.IN_PROGRESS,
      });

      expect(record.workingStatus).toBe(WORKING_STATUS.IN_PROGRESS);
      expect(record.verification.status).toBe('pending');
      expect(record.overtime.status).toBe('not_requested');

      // Duplicate punch-in on same workDate should throw duplicate key error
      await expect(
        Attendance.create({
          employeeId,
          workDate,
          punchIn: punchData,
        })
      ).rejects.toThrow();
    });

    it('strips selfie.publicId and __v from toJSON', async () => {
      const employeeId = new mongoose.Types.ObjectId();
      const record = await Attendance.create({
        employeeId,
        workDate: '2026-10-11',
        punchIn: {
          at: new Date(),
          selfie: { publicId: 'attendance/private-public-id', mimeType: 'image/jpeg', bytes: 500 },
          location: { latitude: 28.6, longitude: 77.2, accuracy: 10 },
        },
      });

      const json = record.toJSON();
      expect(json.punchIn.selfie.publicId).toBeUndefined();
      expect(json.punchIn.selfie.mimeType).toBe('image/jpeg');
      expect(json.__v).toBeUndefined();
    });

    it('has all required indexes defined', async () => {
      const indexes = Attendance.schema.indexes();
      const indexFields = indexes.map((idx) => Object.keys(idx[0]).join(','));

      expect(indexFields).toContain('employeeId,workDate');
      expect(indexFields).toContain('workDate,workingStatus');
      expect(indexFields).toContain('employeeId,workDate');
      expect(indexFields).toContain('overtime.status,workDate');
      expect(indexFields).toContain('verification.status,workDate');
    });
  });

  describe('Notification Model', () => {
    it('has compound and TTL indexes defined', async () => {
      const indexes = Notification.schema.indexes();
      const indexDefs = indexes.map((idx) => ({
        fields: Object.keys(idx[0]).join(','),
        options: idx[1],
      }));

      const compoundIndex = indexDefs.find((idx) => idx.fields === 'userId,readAt,createdAt');
      expect(compoundIndex).toBeDefined();

      const ttlIndex = indexDefs.find((idx) => idx.fields === 'createdAt');
      expect(ttlIndex).toBeDefined();
      expect(ttlIndex.options?.expireAfterSeconds).toBe(90 * 24 * 60 * 60);
    });
  });

  describe('Settings Model', () => {
    it('validates office coordinates and sets defaults', async () => {
      const settings = await Settings.create({
        officeLatitude: 28.6139,
        officeLongitude: 77.209,
      });

      expect(settings.key).toBe('geofence');
      expect(settings.enabled).toBe(false);
      expect(settings.radiusMeters).toBe(200);
      expect(settings.maxAccuracyMeters).toBe(100);

      // Invalid latitude (> 90) must fail validation
      await expect(
        Settings.create({
          key: 'invalid-geofence',
          officeLatitude: 95,
          officeLongitude: 77,
        })
      ).rejects.toThrow();
    });
  });
});
