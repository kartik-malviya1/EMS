import { describe, it, expect } from 'vitest';
import {
  calculateWorkingStatus,
  lazyAutoClose,
  autoCloseOldRecords,
} from '../services/attendance.service.js';
import { calculateWorkedMinutes } from '../utils/time.js';
import { Attendance } from '../models/attendance.model.js';
import { User } from '../models/user.model.js';
import { WORKING_STATUS, CLOSED_BY, ROLES } from '../config/constants.js';

describe('Working Hours & Shift Status Rules', () => {
  describe('calculateWorkingStatus pure function', () => {
    it('returns in_progress when workedMinutes is null or undefined', () => {
      expect(calculateWorkingStatus(null)).toBe(WORKING_STATUS.IN_PROGRESS);
      expect(calculateWorkingStatus(undefined)).toBe(WORKING_STATUS.IN_PROGRESS);
    });

    it('returns incomplete when workedMinutes is 479 (< 480)', () => {
      expect(calculateWorkingStatus(479)).toBe(WORKING_STATUS.INCOMPLETE);
      expect(calculateWorkingStatus(0)).toBe(WORKING_STATUS.INCOMPLETE);
      expect(calculateWorkingStatus(400)).toBe(WORKING_STATUS.INCOMPLETE);
    });

    it('returns completed when workedMinutes is 480 (= 480 standard shift)', () => {
      expect(calculateWorkingStatus(480)).toBe(WORKING_STATUS.COMPLETED);
    });

    it('returns completed when workedMinutes is 481 (> 480)', () => {
      expect(calculateWorkingStatus(481)).toBe(WORKING_STATUS.COMPLETED);
      expect(calculateWorkingStatus(600)).toBe(WORKING_STATUS.COMPLETED);
    });
  });

  describe('calculateWorkedMinutes', () => {
    it('calculates floor((out - in)/60000)', () => {
      const inAt = new Date('2026-10-10T09:00:00.000Z');
      const outAt = new Date('2026-10-10T17:00:30.000Z'); // 8 hours and 30 seconds
      expect(calculateWorkedMinutes(inAt, outAt)).toBe(480);
    });

    it('returns 0 when punchOut <= punchIn', () => {
      const inAt = new Date('2026-10-10T10:00:00.000Z');
      const outAt = new Date('2026-10-10T09:00:00.000Z');
      expect(calculateWorkedMinutes(inAt, outAt)).toBe(0);
    });
  });

  describe('Auto-Close & Missed Record State', () => {
    it('lazy auto-close marks older in_progress records as missed with 0 workedMinutes', async () => {
      const user = await User.create({
        name: 'Lazy Test',
        email: 'lazy@workinghours.com',
        passwordHash: 'dummy',
        role: ROLES.EMPLOYEE,
      });

      const oldRecord = await Attendance.create({
        employeeId: user._id,
        workDate: '2026-10-08',
        punchIn: {
          at: new Date('2026-10-08T09:00:00.000Z'),
          selfie: null,
          location: { latitude: 28.6, longitude: 77.2, accuracy: 10 },
        },
        workingStatus: WORKING_STATUS.IN_PROGRESS,
      });

      // Lazy auto-close for today '2026-10-10'
      await lazyAutoClose(user._id, '2026-10-10');

      const updated = await Attendance.findById(oldRecord._id);
      expect(updated.workingStatus).toBe(WORKING_STATUS.MISSED);
      expect(updated.workedMinutes).toBe(0);
      expect(updated.punchOut).toBeNull();
      expect(updated.closedBy).toBe(CLOSED_BY.SYSTEM);
    });

    it('autoCloseOldRecords closes all in_progress records before today', async () => {
      const user = await User.create({
        name: 'Job Test',
        email: 'job@workinghours.com',
        passwordHash: 'dummy',
        role: ROLES.EMPLOYEE,
      });

      await Attendance.create({
        employeeId: user._id,
        workDate: '2026-10-05',
        punchIn: {
          at: new Date('2026-10-05T09:00:00.000Z'),
          selfie: null,
          location: { latitude: 28.6, longitude: 77.2, accuracy: 10 },
        },
        workingStatus: WORKING_STATUS.IN_PROGRESS,
      });

      const res = await autoCloseOldRecords('2026-10-10');
      expect(res.modifiedCount).toBeGreaterThanOrEqual(1);
    });
  });
});
